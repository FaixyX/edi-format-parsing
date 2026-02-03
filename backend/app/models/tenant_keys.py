"""
TenantKeys model for storing wrapped encryption keys.

This table stores DEKs and index keys that have been encrypted (wrapped)
with Fly KMS. The actual keys never appear in plaintext in the database.

For a single-tenant app, use tenant_id='GLOBAL'.
"""

from sqlalchemy import Column, String, LargeBinary, Integer, DateTime, func
from app.db.session import Base
from datetime import datetime


class TenantKeys(Base):
    """
    Stores wrapped (encrypted) encryption keys per tenant.

    Columns:
    - tenant_id: Unique identifier (UUID string or 'GLOBAL' for single-tenant)
    - dek_ciphertext: Data Encryption Key wrapped by Fly KMS
    - index_key_ciphertext: HMAC index key wrapped by Fly KMS
    - kms_label: Fly KMS key label used for wrapping
    - kms_version: Tracks which KEK version was used (for rotation)
    """

    __tablename__ = "tenant_keys"

    tenant_id = Column(String, primary_key=True)

    # Wrapped keys (BYTEA in PostgreSQL)
    dek_ciphertext = Column(LargeBinary, nullable=False)
    index_key_ciphertext = Column(LargeBinary, nullable=False)

    # KMS metadata
    kms_label = Column(String, nullable=False)
    kms_version = Column(Integer, nullable=False, default=0)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=func.now()
    )

    __table_args__ = ({"schema": "public"},)

    def __repr__(self):
        return (
            f"<TenantKeys(tenant_id='{self.tenant_id}', kms_label='{self.kms_label}')>"
        )
