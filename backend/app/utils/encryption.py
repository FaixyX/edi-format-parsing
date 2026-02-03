"""
Encryption utilities for securing sensitive data in production.
"""

import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import logging

logger = logging.getLogger(__name__)


def generate_encryption_key():
    """Generate a new encryption key for Fernet"""
    return Fernet.generate_key()


def derive_key_from_password(password: str, salt: bytes = None) -> tuple:
    """
    Derive a key from a password using PBKDF2.

    Args:
        password: The password to derive the key from
        salt: Optional salt bytes. If None, a new salt will be generated

    Returns:
        Tuple of (key, salt)
    """
    if salt is None:
        salt = os.urandom(16)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key, salt


def get_encryption_key():
    """Get the encryption key from environment variables"""
    encryption_key = os.getenv("ENCRYPTION_KEY")
    if not encryption_key:
        logger.error(
            "ENCRYPTION_KEY not found in environment variables. This will cause encryption/decryption failures!"
        )
        # Generate a fallback key (not recommended for production)
        encryption_key = generate_encryption_key()
        # SECURITY: Never log encryption keys - only log that a fallback was generated
        logger.error("Generated fallback encryption key")
        logger.error(
            "WARNING: This fallback key will change on each restart, causing decryption failures!"
        )

    return (
        encryption_key.encode() if isinstance(encryption_key, str) else encryption_key
    )


def encrypt_data(data: dict) -> str:
    """
    Encrypt sensitive data dictionary.

    Args:
        data: Dictionary containing sensitive data

    Returns:
        Base64 encoded encrypted string
    """
    try:
        key = get_encryption_key()
        f = Fernet(key)

        # Convert dictionary to JSON string
        json_data = json.dumps(data)

        # Encrypt the JSON string
        encrypted_data = f.encrypt(json_data.encode())

        # Return base64 encoded string
        return base64.b64encode(encrypted_data).decode()

    except Exception as e:
        logger.error(f"Error encrypting data: {str(e)}")
        raise


def decrypt_data(encrypted_data: str) -> dict:
    """
    Decrypt sensitive data.

    Args:
        encrypted_data: Base64 encoded encrypted string

    Returns:
        Decrypted dictionary
    """
    try:
        key = get_encryption_key()
        f = Fernet(key)

        # Decode base64 string
        encrypted_bytes = base64.b64decode(encrypted_data.encode())

        # Decrypt the data
        decrypted_bytes = f.decrypt(encrypted_bytes)

        # Parse JSON back to dictionary
        return json.loads(decrypted_bytes.decode())

    except Exception as e:
        logger.error(f"Error decrypting data: {str(e)}")
        raise


def encrypt_agency_credentials(credentials: dict) -> str:
    """
    Encrypt agency credentials specifically.

    Args:
        credentials: Dictionary containing agency credentials (url, username, password)

    Returns:
        Encrypted credentials string
    """
    # Only encrypt sensitive fields
    sensitive_data = {
        "url": credentials.get("url", ""),
        "username": credentials.get("username", ""),
        "password": credentials.get("password", ""),
    }

    return encrypt_data(sensitive_data)


def decrypt_agency_credentials(encrypted_credentials: str) -> dict:
    """
    Decrypt agency credentials.

    Args:
        encrypted_credentials: Encrypted credentials string

    Returns:
        Decrypted credentials dictionary
    """
    return decrypt_data(encrypted_credentials)
