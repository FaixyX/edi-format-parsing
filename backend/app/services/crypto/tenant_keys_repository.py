"""
Repository for TenantKeys database operations.

Abstracts database access for the KeyManager.
"""

import logging
from contextlib import contextmanager
from typing import Optional, Callable, Union
from sqlalchemy.orm import Session, sessionmaker

from app.models.tenant_keys import TenantKeys

logger = logging.getLogger(__name__)


class TenantKeysRepository:
    """
    Database repository for TenantKeys.

    Handles CRUD operations for wrapped encryption keys.
    Supports both long-lived sessions and session factories.
    """

    def __init__(self, db: Union[Session, sessionmaker, Callable[..., Session]]):
        """
        Initialize repository.

        Args:
            db: SQLAlchemy session or a callable that returns a Session
                (e.g., SessionLocal factory). Using a factory avoids keeping
                stale sessions around in long-lived singletons.
        """
        self._db = db if isinstance(db, Session) else None
        self._db_factory = None if isinstance(db, Session) else db

    @contextmanager
    def _get_session(self) -> Session:
        """Yield a session and clean up when using a factory."""
        if self._db_factory:
            session = self._db_factory()
            try:
                yield session
            except Exception:
                try:
                    session.rollback()
                except Exception:
                    logger.exception("Failed to rollback tenant keys session")
                raise
            finally:
                try:
                    session.close()
                except Exception:
                    logger.exception("Failed to close tenant keys session")
        else:
            yield self._db

    def get_tenant_keys(self, tenant_id: str) -> Optional[TenantKeys]:
        """
        Get keys for a tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            TenantKeys record or None if not found
        """
        with self._get_session() as db:
            return (
                db.query(TenantKeys).filter(TenantKeys.tenant_id == tenant_id).first()
            )

    def insert_tenant_keys(
        self,
        tenant_id: str,
        dek_ciphertext: bytes,
        index_key_ciphertext: bytes,
        kms_label: str,
        kms_version: int = 0,
    ) -> TenantKeys:
        """
        Insert new tenant keys.

        Args:
            tenant_id: Tenant identifier
            dek_ciphertext: Wrapped DEK
            index_key_ciphertext: Wrapped index key
            kms_label: KMS key label used
            kms_version: KMS key version

        Returns:
            Created TenantKeys record
        """
        with self._get_session() as db:
            record = TenantKeys(
                tenant_id=tenant_id,
                dek_ciphertext=dek_ciphertext,
                index_key_ciphertext=index_key_ciphertext,
                kms_label=kms_label,
                kms_version=kms_version,
            )

            db.add(record)
            db.commit()
            db.refresh(record)

            logger.info(f"Inserted tenant keys for {tenant_id}")
            return record

    def update_dek(
        self,
        tenant_id: str,
        dek_ciphertext: bytes,
        kms_label: str,
        kms_version: Optional[int] = None,
    ) -> Optional[TenantKeys]:
        """
        Update DEK for a tenant (used during rotation).

        Args:
            tenant_id: Tenant identifier
            dek_ciphertext: New wrapped DEK
            kms_label: KMS key label used
            kms_version: New KMS key version (optional)

        Returns:
            Updated TenantKeys record or None if not found
        """
        with self._get_session() as db:
            record = (
                db.query(TenantKeys).filter(TenantKeys.tenant_id == tenant_id).first()
            )
            if not record:
                logger.warning(f"Cannot update DEK: tenant {tenant_id} not found")
                return None

            record.dek_ciphertext = dek_ciphertext
            record.kms_label = kms_label
            if kms_version is not None:
                record.kms_version = kms_version

            db.commit()
            db.refresh(record)

            logger.info(f"Updated DEK for tenant {tenant_id}")
            return record

    def update_index_key(
        self,
        tenant_id: str,
        index_key_ciphertext: bytes,
        kms_label: str,
    ) -> Optional[TenantKeys]:
        """
        Update index key for a tenant.

        Args:
            tenant_id: Tenant identifier
            index_key_ciphertext: New wrapped index key
            kms_label: KMS key label used

        Returns:
            Updated TenantKeys record or None if not found
        """
        with self._get_session() as db:
            record = (
                db.query(TenantKeys).filter(TenantKeys.tenant_id == tenant_id).first()
            )
            if not record:
                logger.warning(f"Cannot update index key: tenant {tenant_id} not found")
                return None

            record.index_key_ciphertext = index_key_ciphertext
            record.kms_label = kms_label

            db.commit()
            db.refresh(record)

            logger.info(f"Updated index key for tenant {tenant_id}")
            return record

    def delete_tenant_keys(self, tenant_id: str) -> bool:
        """
        Delete keys for a tenant.

        WARNING: This will make all encrypted data unrecoverable!

        Args:
            tenant_id: Tenant identifier

        Returns:
            True if deleted, False if not found
        """
        with self._get_session() as db:
            record = (
                db.query(TenantKeys).filter(TenantKeys.tenant_id == tenant_id).first()
            )
            if not record:
                return False

            db.delete(record)
            db.commit()

            logger.warning(f"Deleted tenant keys for {tenant_id}")
            return True

    def list_all_tenants(self) -> list[str]:
        """
        List all tenant IDs with stored keys.

        Returns:
            List of tenant IDs
        """
        with self._get_session() as db:
            records = db.query(TenantKeys.tenant_id).all()
            return [r.tenant_id for r in records]
