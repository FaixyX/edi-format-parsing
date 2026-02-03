"""
Crypto Service for field-level encryption.

Provides:
- AES-256-GCM encryption/decryption for ePHI fields
- HMAC-SHA256 blind indexes for searchable encrypted fields
- Versioned ciphertext format for future algorithm changes

Ciphertext format:
    [version: 1 byte][nonce: 12 bytes][ciphertext+tag: variable]

Where:
- version: Format version (currently 1)
- nonce: Random 12-byte IV (must never repeat for same key)
- ciphertext+tag: AES-GCM output (includes 16-byte auth tag)
"""

import os
import logging
from typing import Optional, Union
from uuid import UUID

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes, hmac as crypto_hmac

from .key_manager import KeyManager

logger = logging.getLogger(__name__)


# Cipher parameters
CIPHER_VERSION = 1
NONCE_SIZE = 12  # 96 bits for AES-GCM
TAG_SIZE = 16  # 128-bit auth tag (included in ciphertext)

# HMAC parameters
HASH_SIZE = 32  # SHA-256 output


class CryptoServiceError(Exception):
    """Base exception for crypto operations."""
    pass


class EncryptionError(CryptoServiceError):
    """Raised when encryption fails."""
    pass


class DecryptionError(CryptoServiceError):
    """Raised when decryption fails (wrong key, tampered data, etc.)."""
    pass


class CryptoService:
    """
    Provides field-level encryption using AES-256-GCM.
    
    Usage:
        crypto = CryptoService(key_manager)
        
        # Encrypt a field
        ciphertext = crypto.encrypt_field(tenant_id, "patient_name", b"John Doe")
        
        # Decrypt a field
        plaintext = crypto.decrypt_field(tenant_id, "patient_name", ciphertext)
        
        # Create blind index for searching
        hash_value = crypto.make_blind_index(tenant_id, "patient_name", "John Doe")
    """
    
    def __init__(self, key_manager: KeyManager):
        """
        Initialize CryptoService.
        
        Args:
            key_manager: KeyManager instance for key retrieval
        """
        self.key_manager = key_manager
    
    # -------------------------------------------------------------------------
    # Encryption
    # -------------------------------------------------------------------------
    
    def encrypt_field(
        self,
        tenant_id: Optional[str | UUID],
        field_name: str,
        plaintext: bytes,
        aad: Optional[bytes] = None,
    ) -> bytes:
        """
        Encrypt a field value using AES-256-GCM.
        
        Args:
            tenant_id: Tenant identifier (None for single-tenant)
            field_name: Name of the field (used in AAD for binding)
            plaintext: Raw bytes to encrypt
            aad: Additional authenticated data (optional, auto-generated if None)
            
        Returns:
            Ciphertext bytes: version || nonce || encrypted_data
            
        Raises:
            EncryptionError: If encryption fails
        """
        try:
            # Get DEK
            dek = self.key_manager.get_dek(tenant_id)
            
            # Create AESGCM cipher
            aesgcm = AESGCM(dek)
            
            # Generate random nonce (MUST be unique per encryption)
            nonce = os.urandom(NONCE_SIZE)
            
            # Build AAD if not provided
            # AAD binds the ciphertext to the field name and version
            if aad is None:
                aad = f"{CIPHER_VERSION}:{field_name}".encode("utf-8")
            
            # Encrypt (returns ciphertext with appended auth tag)
            ct = aesgcm.encrypt(nonce, plaintext, aad)
            
            # Build output: version || nonce || ciphertext
            result = bytes([CIPHER_VERSION]) + nonce + ct
            
            logger.debug(
                f"Encrypted field '{field_name}': "
                f"{len(plaintext)} bytes → {len(result)} bytes"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Encryption failed for field '{field_name}': {e}")
            raise EncryptionError(f"Failed to encrypt field '{field_name}': {e}") from e
    
    def encrypt_string(
        self,
        tenant_id: Optional[str | UUID],
        field_name: str,
        value: str,
    ) -> bytes:
        """
        Convenience method to encrypt a string value.
        
        Args:
            tenant_id: Tenant identifier
            field_name: Name of the field
            value: String to encrypt
            
        Returns:
            Ciphertext bytes
        """
        return self.encrypt_field(tenant_id, field_name, value.encode("utf-8"))
    
    # -------------------------------------------------------------------------
    # Decryption
    # -------------------------------------------------------------------------
    
    def decrypt_field(
        self,
        tenant_id: Optional[str | UUID],
        field_name: str,
        ciphertext: bytes,
        aad: Optional[bytes] = None,
    ) -> bytes:
        """
        Decrypt a field value using AES-256-GCM.
        
        Args:
            tenant_id: Tenant identifier
            field_name: Name of the field (must match what was used for encryption)
            ciphertext: Encrypted bytes from encrypt_field()
            aad: Additional authenticated data (must match encryption if provided)
            
        Returns:
            Original plaintext bytes
            
        Raises:
            DecryptionError: If decryption fails (wrong key, tampered, etc.)
        """
        try:
            # Parse ciphertext format
            if len(ciphertext) < 1 + NONCE_SIZE + TAG_SIZE:
                raise DecryptionError("Ciphertext too short")
            
            version = ciphertext[0]
            nonce = ciphertext[1:1 + NONCE_SIZE]
            ct = ciphertext[1 + NONCE_SIZE:]
            
            # Check version
            if version != CIPHER_VERSION:
                raise DecryptionError(
                    f"Unsupported cipher version: {version}. "
                    f"Expected: {CIPHER_VERSION}"
                )
            
            # Get DEK
            dek = self.key_manager.get_dek(tenant_id)
            
            # Create AESGCM cipher
            aesgcm = AESGCM(dek)
            
            # Build AAD (must match encryption)
            if aad is None:
                aad = f"{version}:{field_name}".encode("utf-8")
            
            # Decrypt (validates auth tag)
            plaintext = aesgcm.decrypt(nonce, ct, aad)
            
            logger.debug(
                f"Decrypted field '{field_name}': "
                f"{len(ciphertext)} bytes → {len(plaintext)} bytes"
            )
            
            return plaintext
            
        except DecryptionError:
            raise
        except Exception as e:
            # Could be: InvalidTag (tampered), wrong key, etc.
            logger.error(f"Decryption failed for field '{field_name}': {e}")
            raise DecryptionError(
                f"Failed to decrypt field '{field_name}'. "
                "Data may be corrupted or tampered with."
            ) from e
    
    def decrypt_string(
        self,
        tenant_id: Optional[str | UUID],
        field_name: str,
        ciphertext: bytes,
    ) -> str:
        """
        Convenience method to decrypt to a string.
        
        Args:
            tenant_id: Tenant identifier
            field_name: Name of the field
            ciphertext: Encrypted bytes
            
        Returns:
            Decrypted string
        """
        return self.decrypt_field(tenant_id, field_name, ciphertext).decode("utf-8")
    
    # -------------------------------------------------------------------------
    # Blind indexes (for searchable encryption)
    # -------------------------------------------------------------------------
    
    def make_blind_index(
        self,
        tenant_id: Optional[str | UUID],
        field_name: str,
        value: str,
        normalize: bool = True,
    ) -> bytes:
        """
        Compute HMAC-SHA256 blind index for equality search.
        
        This allows searching encrypted fields without decrypting:
        1. Store: encrypt(value) in column_enc, hmac(value) in column_hash
        2. Search: compute hmac(search_term), query WHERE column_hash = hmac
        
        Args:
            tenant_id: Tenant identifier
            field_name: Name of the field (used to derive sub-key)
            value: Plaintext value to hash
            normalize: If True, strip whitespace and lowercase
            
        Returns:
            32-byte HMAC hash
        """
        try:
            # Normalize value for consistent hashing
            if normalize:
                value = value.strip().lower()
            
            # Get index key for this field
            index_key = self.key_manager.get_index_key(tenant_id, purpose=field_name)
            
            # Compute HMAC-SHA256
            h = crypto_hmac.HMAC(index_key, hashes.SHA256())
            h.update(value.encode("utf-8"))
            result = h.finalize()
            
            logger.debug(f"Created blind index for field '{field_name}'")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to create blind index for '{field_name}': {e}")
            raise CryptoServiceError(
                f"Failed to create blind index for '{field_name}': {e}"
            ) from e
    
    # -------------------------------------------------------------------------
    # Bulk operations
    # -------------------------------------------------------------------------
    
    def encrypt_dict(
        self,
        tenant_id: Optional[str | UUID],
        data: dict,
        fields_to_encrypt: list[str],
    ) -> dict:
        """
        Encrypt specified fields in a dictionary.
        
        Args:
            tenant_id: Tenant identifier
            data: Dictionary with field values
            fields_to_encrypt: List of field names to encrypt
            
        Returns:
            New dictionary with encrypted fields as bytes
        """
        result = dict(data)
        
        for field in fields_to_encrypt:
            if field in result and result[field] is not None:
                value = result[field]
                if isinstance(value, str):
                    value = value.encode("utf-8")
                result[field] = self.encrypt_field(tenant_id, field, value)
        
        return result
    
    def decrypt_dict(
        self,
        tenant_id: Optional[str | UUID],
        data: dict,
        fields_to_decrypt: list[str],
        as_string: bool = True,
    ) -> dict:
        """
        Decrypt specified fields in a dictionary.
        
        Args:
            tenant_id: Tenant identifier
            data: Dictionary with encrypted field values (bytes)
            fields_to_decrypt: List of field names to decrypt
            as_string: If True, decode decrypted bytes to string
            
        Returns:
            New dictionary with decrypted fields
        """
        result = dict(data)
        
        for field in fields_to_decrypt:
            if field in result and result[field] is not None:
                plaintext = self.decrypt_field(tenant_id, field, result[field])
                result[field] = plaintext.decode("utf-8") if as_string else plaintext
        
        return result


# -----------------------------------------------------------------------------
# Utility functions for working with encrypted data
# -----------------------------------------------------------------------------

def is_encrypted(data: bytes) -> bool:
    """
    Check if data looks like our encrypted format.
    
    Args:
        data: Bytes to check
        
    Returns:
        True if data appears to be encrypted with our format
    """
    if not data or len(data) < 1 + NONCE_SIZE + TAG_SIZE:
        return False
    
    version = data[0]
    return version == CIPHER_VERSION


def get_ciphertext_overhead() -> int:
    """
    Get the overhead added by encryption.
    
    Returns:
        Number of bytes added to plaintext (version + nonce + tag)
    """
    return 1 + NONCE_SIZE + TAG_SIZE  # 29 bytes

