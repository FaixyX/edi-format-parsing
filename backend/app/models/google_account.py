from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.db.session import Base


class GoogleAccount(Base):
    """
    System-level Google account for bot automation.
    Only one active account should exist at a time.
    """

    __tablename__ = "google_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True)  # Google account email
    access_token = Column(Text, nullable=True)  # Encrypted OAuth access token
    refresh_token = Column(Text, nullable=True)  # Encrypted OAuth refresh token
    token_expires_at = Column(DateTime, nullable=True)  # When access token expires
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
