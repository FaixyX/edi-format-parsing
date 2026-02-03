"""
Fly KMS Client for envelope encryption.

Fly KMS exposes a filesystem interface at /.fly/kms/<label>/ with:
- encr: write plaintext → read ciphertext
- decr: write ciphertext → read plaintext
- info: metadata (label, type, version)

This client wraps that interface for encrypting/decrypting small blobs (DEKs, index keys).
"""

import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class FlyKMSClient:
    """
    Client for interacting with Fly KMS filesystem interface.

    Used for wrapping/unwrapping Data Encryption Keys (DEKs) and index keys.
    NOT for encrypting large data - that's done with AES-GCM in CryptoService.
    """

    # Default KMS base path on Fly.io machines
    DEFAULT_BASE_PATH = "/.fly/kms"

    def __init__(
        self,
        label: str,
        base_path: Optional[str] = None,
    ):
        """
        Initialize KMS client for a specific key label.

        Args:
            label: The KMS key label (e.g., 'ephi_master_kek')
            base_path: Override base path (useful for testing)
        """
        self.label = label
        self.base_path = base_path or os.getenv("FLY_KMS_PATH", self.DEFAULT_BASE_PATH)
        self._key_path = Path(self.base_path) / label

    @property
    def is_available(self) -> bool:
        """Check if KMS is available (running on Fly.io)."""
        return self._key_path.exists()

    def _check_availability(self) -> None:
        """Raise if KMS is not available."""
        if not self.is_available:
            raise RuntimeError(
                f"Fly KMS not available at {self._key_path}. "
                "Ensure you're running on Fly.io with KMS enabled, "
                "or set FLY_KMS_PATH for local development."
            )

    def encrypt_key(self, plaintext: bytes) -> bytes:
        """
        Encrypt a small blob (DEK/index key) using Fly KMS.

        The KMS uses the latest key version for encryption.

        Args:
            plaintext: Raw bytes to encrypt (typically 32 bytes for AES-256 key)

        Returns:
            Ciphertext bytes (includes KMS metadata for versioning)

        Raises:
            RuntimeError: If KMS is not available
            IOError: If file operations fail
        """
        self._check_availability()

        encr_path = self._key_path / "encr"

        try:
            # Open in read/write binary mode, unbuffered
            # Write plaintext, then read back ciphertext
            with encr_path.open("r+b", buffering=0) as f:
                f.write(plaintext)
                f.flush()
                f.seek(0)
                ciphertext = f.read()

            logger.debug(
                f"KMS encrypted {len(plaintext)} bytes → {len(ciphertext)} bytes"
            )
            return ciphertext

        except Exception as e:
            logger.error(f"KMS encryption failed: {e}")
            raise IOError(f"Failed to encrypt with KMS: {e}") from e

    def decrypt_key(self, ciphertext: bytes) -> bytes:
        """
        Decrypt a small blob using Fly KMS.

        KMS automatically uses the correct key version based on ciphertext metadata.

        Args:
            ciphertext: Encrypted bytes from encrypt_key()

        Returns:
            Original plaintext bytes

        Raises:
            RuntimeError: If KMS is not available
            IOError: If file operations fail or decryption fails
        """
        self._check_availability()

        decr_path = self._key_path / "decr"

        try:
            with decr_path.open("r+b", buffering=0) as f:
                f.write(ciphertext)
                f.flush()
                f.seek(0)
                plaintext = f.read()

            logger.debug(
                f"KMS decrypted {len(ciphertext)} bytes → {len(plaintext)} bytes"
            )
            return plaintext

        except Exception as e:
            logger.error(f"KMS decryption failed: {e}")
            raise IOError(f"Failed to decrypt with KMS: {e}") from e

    def get_info(self) -> dict:
        """
        Get KMS key metadata.

        Returns:
            Dict with key info (label, type, version)
        """
        self._check_availability()

        info_path = self._key_path / "info"

        try:
            content = info_path.read_text()
            # Parse key=value lines
            info = {}
            for line in content.strip().split("\n"):
                if "=" in line:
                    key, value = line.split("=", 1)
                    info[key.strip()] = value.strip()
            return info
        except Exception as e:
            logger.warning(f"Failed to read KMS info: {e}")
            return {}


class SharedSecretKMSClient(FlyKMSClient):
    """
    KMS client using a shared secret from Fly Secrets.

    Use this when you have MULTIPLE Fly apps (e.g., server + worker) that need
    to share the same KEK. Fly KMS keys are app-scoped, so they can't be shared.
    This client uses a regular Fly Secret (env var) instead.

    Set the secret in both apps:
        flyctl secrets set HIPAA_KEK_HEX=<64-char-hex> --app billup
        flyctl secrets set HIPAA_KEK_HEX=<64-char-hex> --app billup-worker

    Trade-offs vs Fly KMS:
    - ✅ Works across multiple apps in the same org
    - ✅ You control the key (can back it up)
    - ❌ No automatic key versioning (you manage rotation manually)
    - ❌ Key is in env var (less isolated than KMS hardware)
    """

    # Environment variable name for the shared KEK
    ENV_VAR_NAME = "HIPAA_KEK_HEX"

    def __init__(
        self,
        label: str,
        key_hex: Optional[str] = None,
    ):
        """
        Initialize shared secret client.

        Args:
            label: Key label (for consistency with other clients)
            key_hex: 64-character hex string (32 bytes). If None, reads from env.
        """
        super().__init__(label, base_path="/nonexistent")
        self.label = label

        # Get key from parameter or environment
        if key_hex:
            hex_value = key_hex
        else:
            hex_value = os.getenv(self.ENV_VAR_NAME)
            if not hex_value:
                raise RuntimeError(
                    f"{self.ENV_VAR_NAME} environment variable not set. "
                    'Generate a 32-byte key with: python -c "import os; print(os.urandom(32).hex())" '
                    "and set it in both apps with: flyctl secrets set HIPAA_KEK_HEX=<hex>"
                )

        # Validate and convert hex to bytes
        try:
            self._kek = bytes.fromhex(hex_value)
            if len(self._kek) != 32:
                raise ValueError(f"Key must be 32 bytes, got {len(self._kek)}")
        except ValueError as e:
            raise RuntimeError(f"Invalid {self.ENV_VAR_NAME}: {e}") from e

        # Use Fernet for encryption (same as fallback for consistency)
        from cryptography.fernet import Fernet
        import base64

        fernet_key = base64.urlsafe_b64encode(self._kek)
        self._fernet = Fernet(fernet_key)

        logger.info(f"Using shared secret KMS client for label '{label}'")

    @property
    def is_available(self) -> bool:
        """Shared secret client is available if initialized successfully."""
        return True

    def _check_availability(self) -> None:
        """No-op - availability checked in __init__."""
        pass

    def encrypt_key(self, plaintext: bytes) -> bytes:
        """Encrypt using shared secret."""
        logger.debug(f"[SharedSecret] Encrypting {len(plaintext)} bytes")
        return self._fernet.encrypt(plaintext)

    def decrypt_key(self, ciphertext: bytes) -> bytes:
        """Decrypt using shared secret."""
        logger.debug(f"[SharedSecret] Decrypting {len(ciphertext)} bytes")
        return self._fernet.decrypt(ciphertext)

    def get_info(self) -> dict:
        """Return info about this client."""
        return {
            "label": self.label,
            "type": "shared_secret",
            "version": "0",
            "note": "Manual rotation required - no automatic versioning",
        }


class FlyKMSClientFallback(FlyKMSClient):
    """
    Fallback KMS client for local development.

    Uses a local file to simulate KMS behavior. NOT SECURE - only for dev/testing.
    In production, use FlyKMSClient (single app) or SharedSecretKMSClient (multi-app).
    """

    def __init__(
        self,
        label: str,
        fallback_key: Optional[bytes] = None,
    ):
        """
        Initialize fallback client.

        Args:
            label: Key label (for consistency)
            fallback_key: 32-byte key for local encryption. If None, uses env var.
        """
        super().__init__(label, base_path="/nonexistent")
        self.label = label

        # Get fallback key from env or parameter
        if fallback_key:
            self._fallback_key = fallback_key
        else:
            key_hex = os.getenv("DEV_KMS_FALLBACK_KEY")
            if key_hex:
                self._fallback_key = bytes.fromhex(key_hex)
            else:
                logger.warning(
                    "DEV_KMS_FALLBACK_KEY not set. Using random key - "
                    "data will be unrecoverable after restart!"
                )
                self._fallback_key = os.urandom(32)

        # Use cryptography's Fernet for simplicity in fallback
        from cryptography.fernet import Fernet
        import base64

        # Derive a Fernet key from our 32-byte key
        fernet_key = base64.urlsafe_b64encode(self._fallback_key)
        self._fernet = Fernet(fernet_key)

    @property
    def is_available(self) -> bool:
        """Fallback is always 'available'."""
        return True

    def _check_availability(self) -> None:
        """No-op for fallback."""
        pass

    def encrypt_key(self, plaintext: bytes) -> bytes:
        """Encrypt using local Fernet key."""
        logger.debug(f"[DEV] Fallback KMS encrypting {len(plaintext)} bytes")
        return self._fernet.encrypt(plaintext)

    def decrypt_key(self, ciphertext: bytes) -> bytes:
        """Decrypt using local Fernet key."""
        logger.debug(f"[DEV] Fallback KMS decrypting {len(ciphertext)} bytes")
        return self._fernet.decrypt(ciphertext)

    def get_info(self) -> dict:
        """Return dummy info."""
        return {
            "label": self.label,
            "type": "fallback",
            "version": "0",
        }


# -----------------------------------------------------------------------------
# KMS Mode Configuration
# -----------------------------------------------------------------------------
#
# The system supports three KEK modes:
#
# 1. SHARED_SECRET (recommended for multi-app deployments)
#    - Set HIPAA_KEK_HEX in Fly Secrets (same value in all apps)
#    - Works across server + worker apps
#    - You manage key rotation manually
#
# 2. FLY_KMS (for single-app deployments)
#    - Set KMS_MODE=fly_kms to force this mode
#    - Uses Fly KMS hardware isolation
#    - Automatic key versioning
#    - Keys are app-scoped (won't work with separate worker app)
#
# 3. FALLBACK (local development only)
#    - Set DEV_KMS_FALLBACK_KEY for persistent local dev
#    - Or leave unset for random key (data lost on restart)
#    - NOT secure for production
#
# Priority: HIPAA_KEK_HEX > KMS_MODE=fly_kms > Fly KMS auto-detect > Fallback
# -----------------------------------------------------------------------------


def get_kms_client(label: str) -> FlyKMSClient:
    """
    Factory function to get the appropriate KMS client.

    Selection priority:
    1. If HIPAA_KEK_HEX is set → SharedSecretKMSClient (multi-app production)
    2. If KMS_MODE=fly_kms → FlyKMSClient (single-app, forces KMS even if HIPAA_KEK_HEX unset)
    3. If on Fly.io with KMS available → FlyKMSClient (single-app production)
    4. Otherwise → FlyKMSClientFallback (local development)

    Args:
        label: KMS key label (used for Fly KMS mode, ignored for shared secret)

    Returns:
        Appropriate KMS client instance
    """
    # Check for shared secret mode first (multi-app production)
    shared_secret = os.getenv(SharedSecretKMSClient.ENV_VAR_NAME)
    if shared_secret:
        logger.info(
            f"Using SharedSecretKMSClient (HIPAA_KEK_HEX is set). "
            f"Label '{label}' is for reference only."
        )
        return SharedSecretKMSClient(label)

    # Check for forced Fly KMS mode
    kms_mode = os.getenv("KMS_MODE", "").lower()
    if kms_mode == "fly_kms":
        logger.info(f"KMS_MODE=fly_kms, forcing Fly KMS with label '{label}'")
        return FlyKMSClient(label)

    # Auto-detect: Check if we're on Fly.io with KMS available
    fly_app_name = os.getenv("FLY_APP_NAME")
    kms_path = Path(os.getenv("FLY_KMS_PATH", FlyKMSClient.DEFAULT_BASE_PATH))

    if fly_app_name and kms_path.exists():
        # On Fly.io with KMS - check if the specific key exists
        key_path = kms_path / label
        if key_path.exists():
            logger.info(f"Using Fly KMS with label '{label}'")
            return FlyKMSClient(label)
        else:
            # On Fly but key doesn't exist - this is likely a config error
            logger.warning(
                f"On Fly.io but KMS key '{label}' not found at {key_path}. "
                f"Either create it with 'flyctl secrets keys gen encrypting {label}' "
                f"or set HIPAA_KEK_HEX for shared secret mode. "
                f"Falling back to dev mode (NOT SECURE)."
            )
            return FlyKMSClientFallback(label)

    # Local development - use fallback
    logger.warning(
        f"Not on Fly.io and HIPAA_KEK_HEX not set. "
        f"Using fallback client for '{label}'. "
        f"This is NOT secure for production!"
    )
    return FlyKMSClientFallback(label)


def get_kms_mode() -> str:
    """
    Get the current KMS mode for diagnostics/logging.

    Returns:
        One of: 'shared_secret', 'fly_kms', 'fallback'
    """
    if os.getenv(SharedSecretKMSClient.ENV_VAR_NAME):
        return "shared_secret"

    if os.getenv("KMS_MODE", "").lower() == "fly_kms":
        return "fly_kms"

    fly_app_name = os.getenv("FLY_APP_NAME")
    kms_path = Path(os.getenv("FLY_KMS_PATH", FlyKMSClient.DEFAULT_BASE_PATH))

    if fly_app_name and kms_path.exists():
        return "fly_kms"

    return "fallback"
