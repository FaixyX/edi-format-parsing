"""
PHI Encryption Service for HIPAA-compliant field-level encryption.

This service wraps the CryptoService to provide convenient methods for
encrypting and decrypting Protected Health Information (PHI) fields.

Features:
- Base64 encoding/decoding for storage in String/Text columns
- Detection of already-encrypted data (for migration compatibility)
- Model-specific encryption methods
- JSON encryption for structured data

Usage:
    from app.services.crypto import get_phi_encryption_service

    phi_crypto = get_phi_encryption_service()

    # Encrypt agency credentials
    encrypted_password = phi_crypto.encrypt_credential(password)
    decrypted_password = phi_crypto.decrypt_credential(encrypted_password)

    # Encrypt EDI file data
    encrypted_edi = phi_crypto.encrypt_edi_file(edi_base64_content)
    decrypted_edi = phi_crypto.decrypt_edi_file(encrypted_edi)
"""

import base64
import json
import logging
from typing import Optional, Any, Dict, List
from functools import lru_cache

from .crypto_service import (
    CryptoService,
    is_encrypted,
    CIPHER_VERSION,
    NONCE_SIZE,
    TAG_SIZE,
)

logger = logging.getLogger(__name__)


# Magic prefix to identify encrypted data stored as base64 strings
# Format: "ENCV1:" + base64(ciphertext)
ENCRYPTED_PREFIX = "ENCV1:"


class PHIEncryptionService:
    """
    High-level service for encrypting/decrypting PHI data.

    Provides convenient methods for common encryption scenarios:
    - Agency credentials (username, password, link)
    - EDI file data (base64 encoded files)
    - Patient data (JSON structures)
    - PDF file data
    """

    # Field names for AAD binding (prevents field swapping attacks)
    FIELD_AGENCY_USERNAME = "agency.username"
    FIELD_AGENCY_PASSWORD = "agency.password"
    FIELD_AGENCY_LINK = "agency.link"
    FIELD_AGENCY_NPI = "agency.npi"
    FIELD_EDI_FILE = "background_task.edi_file_data"
    FIELD_EDI_PATIENTS = "background_task.params.edi_patients"
    FIELD_TASK_PARAMS = "background_task.params"
    FIELD_PDF_FILE = "form_submission.pdf_file_data"
    FIELD_ASSESSMENT_DATA = "form_submission.new_assessment_data"
    FIELD_GOOGLE_ACCESS_TOKEN = "google_account.access_token"
    FIELD_GOOGLE_REFRESH_TOKEN = "google_account.refresh_token"

    def __init__(self, crypto_service: CryptoService):
        """
        Initialize PHI encryption service.

        Args:
            crypto_service: CryptoService instance with initialized keys
        """
        self.crypto = crypto_service

    # -------------------------------------------------------------------------
    # Detection helpers
    # -------------------------------------------------------------------------

    def is_data_encrypted(self, data: Optional[str]) -> bool:
        """
        Check if a string value is already encrypted.

        Args:
            data: String value to check (may be base64 encoded ciphertext)

        Returns:
            True if data appears to be encrypted with our format
        """
        if not data:
            return False

        # Check for our magic prefix
        if data.startswith(ENCRYPTED_PREFIX):
            return True

        # Try to detect raw encrypted bytes (for backward compatibility)
        try:
            raw_bytes = base64.b64decode(data)
            return is_encrypted(raw_bytes)
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # Core encryption/decryption with base64 wrapper
    # -------------------------------------------------------------------------

    def _encrypt_to_string(self, field_name: str, plaintext: str) -> str:
        """
        Encrypt a string and return base64-encoded result with prefix.

        Args:
            field_name: Field identifier for AAD binding
            plaintext: String to encrypt

        Returns:
            Encrypted string in format: "ENCV1:" + base64(ciphertext)
        """
        if not plaintext:
            return plaintext

        ciphertext = self.crypto.encrypt_string(None, field_name, plaintext)
        encoded = base64.b64encode(ciphertext).decode("ascii")
        return ENCRYPTED_PREFIX + encoded

    def _decrypt_from_string(self, field_name: str, encrypted: str) -> str:
        """
        Decrypt a string that was encrypted with _encrypt_to_string.

        Handles both:
        - New format: "ENCV1:" + base64(ciphertext)
        - Legacy format: Raw base64 encoded ciphertext
        - Unencrypted data: Returns as-is (for migration compatibility)

        Args:
            field_name: Field identifier for AAD binding
            encrypted: Encrypted string

        Returns:
            Decrypted plaintext string
        """
        if not encrypted:
            return encrypted

        # Check for our magic prefix
        if encrypted.startswith(ENCRYPTED_PREFIX):
            b64_data = encrypted[len(ENCRYPTED_PREFIX) :]
            ciphertext = base64.b64decode(b64_data)
            return self.crypto.decrypt_string(None, field_name, ciphertext)

        # Try legacy format (raw base64 encoded ciphertext)
        try:
            raw_bytes = base64.b64decode(encrypted)
            if is_encrypted(raw_bytes):
                return self.crypto.decrypt_string(None, field_name, raw_bytes)
        except Exception:
            pass

        # Data is not encrypted - return as-is (migration compatibility)
        logger.debug(f"Data for field '{field_name}' is not encrypted, returning as-is")
        return encrypted

    # -------------------------------------------------------------------------
    # Agency credential encryption
    # -------------------------------------------------------------------------

    def encrypt_agency_username(self, username: str) -> str:
        """Encrypt agency login username."""
        return self._encrypt_to_string(self.FIELD_AGENCY_USERNAME, username)

    def decrypt_agency_username(self, encrypted: str) -> str:
        """Decrypt agency login username."""
        return self._decrypt_from_string(self.FIELD_AGENCY_USERNAME, encrypted)

    def encrypt_agency_password(self, password: str) -> str:
        """Encrypt agency login password."""
        return self._encrypt_to_string(self.FIELD_AGENCY_PASSWORD, password)

    def decrypt_agency_password(self, encrypted: str) -> str:
        """Decrypt agency login password."""
        return self._decrypt_from_string(self.FIELD_AGENCY_PASSWORD, encrypted)

    def encrypt_agency_link(self, link: str) -> str:
        """Encrypt agency portal URL."""
        return self._encrypt_to_string(self.FIELD_AGENCY_LINK, link)

    def decrypt_agency_link(self, encrypted: str) -> str:
        """Decrypt agency portal URL."""
        return self._decrypt_from_string(self.FIELD_AGENCY_LINK, encrypted)

    def encrypt_agency_npi(self, npi: str) -> str:
        """Encrypt agency NPI."""
        if not npi:
            return npi
        return self._encrypt_to_string(self.FIELD_AGENCY_NPI, npi)

    def decrypt_agency_npi(self, encrypted: str) -> str:
        """Decrypt agency NPI."""
        return self._decrypt_from_string(self.FIELD_AGENCY_NPI, encrypted)

    def encrypt_agency_credentials(
        self,
        username: str,
        password: str,
        link: str,
        npi: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Encrypt all agency credentials at once.

        Args:
            username: Login username
            password: Login password
            link: Portal URL
            npi: Optional NPI

        Returns:
            Dictionary with encrypted values
        """
        return {
            "username": self.encrypt_agency_username(username),
            "password": self.encrypt_agency_password(password),
            "link": self.encrypt_agency_link(link),
            "npi": self.encrypt_agency_npi(npi) if npi else npi,
        }

    def decrypt_agency_credentials(
        self,
        username: str,
        password: str,
        link: str,
        npi: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Decrypt all agency credentials at once.

        Args:
            username: Encrypted username
            password: Encrypted password
            link: Encrypted link
            npi: Optional encrypted NPI

        Returns:
            Dictionary with decrypted values
        """
        return {
            "username": self.decrypt_agency_username(username),
            "password": self.decrypt_agency_password(password),
            "link": self.decrypt_agency_link(link),
            "npi": self.decrypt_agency_npi(npi) if npi else npi,
        }

    # -------------------------------------------------------------------------
    # EDI file encryption (for BackgroundTask.edi_file_data)
    # -------------------------------------------------------------------------

    def encrypt_edi_file(self, edi_base64: str) -> str:
        """
        Encrypt EDI file data (base64 encoded content).

        Args:
            edi_base64: Base64 encoded EDI file content

        Returns:
            Encrypted string
        """
        return self._encrypt_to_string(self.FIELD_EDI_FILE, edi_base64)

    def decrypt_edi_file(self, encrypted: str) -> str:
        """
        Decrypt EDI file data.

        Args:
            encrypted: Encrypted EDI file data

        Returns:
            Base64 encoded EDI file content
        """
        return self._decrypt_from_string(self.FIELD_EDI_FILE, encrypted)

    # -------------------------------------------------------------------------
    # Patient data encryption (for params.edi_patients)
    # -------------------------------------------------------------------------

    def encrypt_edi_patients(self, patients: List[Dict[str, Any]]) -> str:
        """
        Encrypt patient data from EDI parsing.

        Args:
            patients: List of patient dictionaries

        Returns:
            Encrypted JSON string
        """
        if not patients:
            return json.dumps([])

        json_str = json.dumps(patients)
        return self._encrypt_to_string(self.FIELD_EDI_PATIENTS, json_str)

    def decrypt_edi_patients(self, encrypted: str) -> List[Dict[str, Any]]:
        """
        Decrypt patient data.

        Args:
            encrypted: Encrypted patient data JSON

        Returns:
            List of patient dictionaries
        """
        if not encrypted:
            return []

        # Check if it's encrypted
        if self.is_data_encrypted(encrypted):
            json_str = self._decrypt_from_string(self.FIELD_EDI_PATIENTS, encrypted)
            return json.loads(json_str)

        # Not encrypted - try to parse as JSON directly (migration compatibility)
        try:
            return json.loads(encrypted)
        except Exception:
            return []

    # -------------------------------------------------------------------------
    # PDF file encryption (for FormSubmission.pdf_file_data)
    # -------------------------------------------------------------------------

    def encrypt_pdf_file(self, pdf_base64: str) -> str:
        """
        Encrypt PDF file data (base64 encoded content).

        Args:
            pdf_base64: Base64 encoded PDF file content

        Returns:
            Encrypted string
        """
        return self._encrypt_to_string(self.FIELD_PDF_FILE, pdf_base64)

    def decrypt_pdf_file(self, encrypted: str) -> str:
        """
        Decrypt PDF file data.

        Args:
            encrypted: Encrypted PDF file data

        Returns:
            Base64 encoded PDF file content
        """
        return self._decrypt_from_string(self.FIELD_PDF_FILE, encrypted)

    # -------------------------------------------------------------------------
    # Assessment data encryption (for FormSubmission.new_assessment_data)
    # -------------------------------------------------------------------------

    def encrypt_assessment_data(
        self, assessment: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Encrypt assessment data JSON.

        Args:
            assessment: Assessment data dictionary

        Returns:
            Encrypted JSON string or None
        """
        if not assessment:
            return None

        json_str = json.dumps(assessment)
        return self._encrypt_to_string(self.FIELD_ASSESSMENT_DATA, json_str)

    def decrypt_assessment_data(
        self, encrypted: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Decrypt assessment data JSON.

        Args:
            encrypted: Encrypted assessment data

        Returns:
            Assessment data dictionary or None
        """
        if not encrypted:
            return None

        # Check if it's encrypted
        if self.is_data_encrypted(encrypted):
            json_str = self._decrypt_from_string(self.FIELD_ASSESSMENT_DATA, encrypted)
            return json.loads(json_str)

        # Not encrypted - try to parse as JSON directly (migration compatibility)
        try:
            if isinstance(encrypted, dict):
                return encrypted
            return json.loads(encrypted)
        except Exception:
            return None

    # -------------------------------------------------------------------------
    # Google account token encryption
    # -------------------------------------------------------------------------

    def encrypt_google_access_token(self, token: str) -> str:
        """Encrypt Google OAuth access token."""
        return self._encrypt_to_string(self.FIELD_GOOGLE_ACCESS_TOKEN, token)

    def decrypt_google_access_token(self, encrypted: str) -> str:
        """Decrypt Google OAuth access token."""
        return self._decrypt_from_string(self.FIELD_GOOGLE_ACCESS_TOKEN, encrypted)

    def encrypt_google_refresh_token(self, token: str) -> str:
        """Encrypt Google OAuth refresh token."""
        return self._encrypt_to_string(self.FIELD_GOOGLE_REFRESH_TOKEN, token)

    def decrypt_google_refresh_token(self, encrypted: str) -> str:
        """Decrypt Google OAuth refresh token."""
        return self._decrypt_from_string(self.FIELD_GOOGLE_REFRESH_TOKEN, encrypted)

    # -------------------------------------------------------------------------
    # Task params encryption (selective encryption of sensitive fields)
    # -------------------------------------------------------------------------

    def encrypt_task_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt sensitive fields in task params.

        Encrypts:
        - edi_patients (patient names, claim numbers)

        Keeps in plaintext (for querying/display):
        - filename, npi, provider_name, transaction_type
        - ra_date, bank_check, bank_account, check_number

        Args:
            params: Task parameters dictionary

        Returns:
            Params with sensitive fields encrypted
        """
        result = dict(params)

        # Encrypt patient data
        if "edi_patients" in result and result["edi_patients"]:
            result["edi_patients"] = self.encrypt_edi_patients(result["edi_patients"])
            result["_edi_patients_encrypted"] = True

        return result

    def decrypt_task_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt sensitive fields in task params.

        Args:
            params: Task parameters with encrypted fields

        Returns:
            Params with sensitive fields decrypted
        """
        result = dict(params)

        # Decrypt patient data
        if result.get("_edi_patients_encrypted") or (
            "edi_patients" in result
            and isinstance(result["edi_patients"], str)
            and self.is_data_encrypted(result["edi_patients"])
        ):
            result["edi_patients"] = self.decrypt_edi_patients(result["edi_patients"])
            result.pop("_edi_patients_encrypted", None)

        return result


# -----------------------------------------------------------------------------
# Factory function with caching
# -----------------------------------------------------------------------------

_phi_service_instance: Optional[PHIEncryptionService] = None


def get_phi_encryption_service(db=None) -> PHIEncryptionService:
    """
    Get the PHI encryption service instance.

    - In app context (FastAPI), reuse a singleton.
    - In scripts/CLI, allow passing a db session; if none provided,
      it will create and close its own SessionLocal.
    """
    global _phi_service_instance

    # If caller provides a db session, create a fresh instance (do not cache)
    if db is not None:
        from .dependencies import create_crypto_service

        try:
            crypto_service = create_crypto_service(db)
        except TypeError:
            # Backward-safe: ensure db is passed as keyword if signature changed
            crypto_service = create_crypto_service(db=db)
        return PHIEncryptionService(crypto_service)

    # Singleton path (for API/worker usage)
    if _phi_service_instance is None:
        from .dependencies import create_crypto_service
        from app.db.session import SessionLocal

        # Pass the factory instead of a single Session instance to avoid
        # reusing a potentially broken session across requests.
        try:
            crypto_service = create_crypto_service(SessionLocal)
        except TypeError:
            crypto_service = create_crypto_service(db=SessionLocal)
        _phi_service_instance = PHIEncryptionService(crypto_service)
        logger.info("PHI encryption service initialized")

    return _phi_service_instance


def reset_phi_encryption_service():
    """Reset the singleton instance (for testing)."""
    global _phi_service_instance
    _phi_service_instance = None
