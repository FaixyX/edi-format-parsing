"""
FastAPI dependency injection for crypto services.

Usage in routes:
    from app.services.crypto.dependencies import get_crypto_service

    @router.post("/patients")
    def create_patient(
        data: PatientCreate,
        crypto: CryptoService = Depends(get_crypto_service),
    ):
        encrypted_name = crypto.encrypt_string(None, "patient_name", data.name)
        ...
"""

import os
import logging
from functools import lru_cache
from typing import Generator, Callable, Union

from fastapi import Depends
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_db
from .fly_kms_client import get_kms_client, FlyKMSClient
from .key_manager import KeyManager
from .crypto_service import CryptoService
from .tenant_keys_repository import TenantKeysRepository

logger = logging.getLogger(__name__)


# Environment variable for KMS key label
KMS_LABEL_ENV = "FLY_KMS_LABEL"
DEFAULT_KMS_LABEL = "ephi_master_kek"


@lru_cache()
def get_kms_label() -> str:
    """Get the KMS key label from environment or default."""
    return os.getenv(KMS_LABEL_ENV, DEFAULT_KMS_LABEL)


def get_tenant_keys_repo(db: Session = Depends(get_db)) -> TenantKeysRepository:
    """
    Get TenantKeysRepository instance.

    Args:
        db: SQLAlchemy session from FastAPI dependency

    Returns:
        TenantKeysRepository instance
    """
    return TenantKeysRepository(db)


def get_kms_client_dep() -> FlyKMSClient:
    """
    Get FlyKMSClient instance.

    Returns real client on Fly.io, fallback client locally.

    Returns:
        FlyKMSClient or FlyKMSClientFallback instance
    """
    label = get_kms_label()
    return get_kms_client(label)


def get_key_manager(
    kms_client: FlyKMSClient = Depends(get_kms_client_dep),
    repo: TenantKeysRepository = Depends(get_tenant_keys_repo),
) -> KeyManager:
    """
    Get KeyManager instance.

    Args:
        kms_client: FlyKMSClient from dependency
        repo: TenantKeysRepository from dependency

    Returns:
        KeyManager instance
    """
    return KeyManager(kms_client=kms_client, tenant_keys_repo=repo)


def get_crypto_service(
    key_manager: KeyManager = Depends(get_key_manager),
) -> CryptoService:
    """
    Get CryptoService instance.

    This is the main dependency to use in routes for encryption/decryption.

    Args:
        key_manager: KeyManager from dependency

    Returns:
        CryptoService instance
    """
    return CryptoService(key_manager=key_manager)


# -----------------------------------------------------------------------------
# Standalone factory (for use outside FastAPI request context)
# -----------------------------------------------------------------------------


def create_crypto_service(
    db: Union[Session, sessionmaker, Callable[..., Session]],
) -> CryptoService:
    """
    Create a CryptoService instance outside of FastAPI request context.

    Useful for:
    - Background tasks (Dramatiq)
    - CLI scripts
    - Database migrations

    Args:
        db: SQLAlchemy session OR a callable that returns a Session
            (e.g., SessionLocal factory) to avoid long-lived stale sessions.

    Returns:
        Configured CryptoService instance
    """
    label = get_kms_label()
    kms_client = get_kms_client(label)
    repo = TenantKeysRepository(db)
    key_manager = KeyManager(kms_client=kms_client, tenant_keys_repo=repo)
    return CryptoService(key_manager=key_manager)


def ensure_encryption_keys(db: Session, tenant_id: str = "GLOBAL") -> None:
    """
    Ensure encryption keys exist for a tenant, creating them if needed.

    Call this during app startup or tenant onboarding.

    Args:
        db: SQLAlchemy session
        tenant_id: Tenant identifier (default 'GLOBAL' for single-tenant)
    """
    label = get_kms_label()
    kms_client = get_kms_client(label)
    repo = TenantKeysRepository(db)
    key_manager = KeyManager(kms_client=kms_client, tenant_keys_repo=repo)

    try:
        key_manager.ensure_tenant_keys(tenant_id)
        logger.info(f"Encryption keys ready for tenant '{tenant_id}'")
    except Exception as e:
        logger.error(f"Failed to ensure encryption keys for tenant '{tenant_id}': {e}")
        raise
