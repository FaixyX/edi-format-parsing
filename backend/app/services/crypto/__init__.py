# HIPAA-compliant encryption services using Fly KMS + AES-256-GCM
from .fly_kms_client import (
    FlyKMSClient,
    FlyKMSClientFallback,
    SharedSecretKMSClient,
    get_kms_client,
    get_kms_mode,
)
from .key_manager import KeyManager
from .crypto_service import (
    CryptoService,
    CryptoServiceError,
    EncryptionError,
    DecryptionError,
)
from .tenant_keys_repository import TenantKeysRepository
from .dependencies import (
    get_crypto_service,
    get_key_manager,
    get_kms_client_dep,
    get_tenant_keys_repo,
    create_crypto_service,
    ensure_encryption_keys,
)
from .phi_encryption_service import (
    PHIEncryptionService,
    get_phi_encryption_service,
    reset_phi_encryption_service,
    ENCRYPTED_PREFIX,
)

__all__ = [
    # Core classes (3 modes: Fly KMS, Shared Secret, Fallback)
    "FlyKMSClient",  # Single-app production (Fly KMS hardware)
    "SharedSecretKMSClient",  # Multi-app production (shared Fly Secret)
    "FlyKMSClientFallback",  # Local development only
    "KeyManager",
    "CryptoService",
    "TenantKeysRepository",
    # PHI encryption service (high-level API)
    "PHIEncryptionService",
    "get_phi_encryption_service",
    "reset_phi_encryption_service",
    "ENCRYPTED_PREFIX",
    # Exceptions
    "CryptoServiceError",
    "EncryptionError",
    "DecryptionError",
    # Factory functions
    "get_kms_client",  # Auto-selects the right client
    "get_kms_mode",  # Returns current mode for diagnostics
    # FastAPI dependencies
    "get_crypto_service",
    "get_key_manager",
    "get_kms_client_dep",
    "get_tenant_keys_repo",
    # Standalone factory
    "create_crypto_service",
    "ensure_encryption_keys",
]
