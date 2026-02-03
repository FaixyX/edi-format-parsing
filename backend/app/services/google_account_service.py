"""
Service for managing system-level Google account.
Only one active account should exist at a time.
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.google_account import GoogleAccount
from app.services.crypto import get_phi_encryption_service

logger = logging.getLogger(__name__)


class GoogleAccountService:
    """Service for managing Google account credentials"""

    @staticmethod
    def get_active_account(db: Session) -> Optional[GoogleAccount]:
        """Get the active Google account"""
        return (
            db.query(GoogleAccount)
            .filter(GoogleAccount.is_active == True)
            .first()
        )

    @staticmethod
    def get_account_by_email(db: Session, email: str) -> Optional[GoogleAccount]:
        """Get Google account by email"""
        return db.query(GoogleAccount).filter(GoogleAccount.email == email).first()

    @staticmethod
    def is_account_linked(db: Session) -> bool:
        """Check if a Google account is linked"""
        account = GoogleAccountService.get_active_account(db)
        return account is not None and account.access_token is not None

    @staticmethod
    def create_or_update_account(
        db: Session,
        email: str,
        access_token: str,
        refresh_token: str,
        token_expires_at: Optional[datetime] = None,
    ) -> GoogleAccount:
        """
        Create or update Google account.
        Deactivates any existing active accounts.
        """
        # Encrypt tokens
        phi_crypto = get_phi_encryption_service()
        encrypted_access_token = phi_crypto.encrypt_google_access_token(access_token)
        encrypted_refresh_token = phi_crypto.encrypt_google_refresh_token(refresh_token)

        # Deactivate all existing accounts
        db.query(GoogleAccount).update({"is_active": False})
        db.flush()

        # Check if account with this email exists
        existing_account = GoogleAccountService.get_account_by_email(db, email)

        if existing_account:
            # Update existing account
            existing_account.access_token = encrypted_access_token
            existing_account.refresh_token = encrypted_refresh_token
            existing_account.token_expires_at = token_expires_at
            existing_account.is_active = True
            existing_account.updated_at = datetime.now()
            db.commit()
            db.refresh(existing_account)
            logger.info(f"Updated Google account: {email}")
            return existing_account
        else:
            # Create new account
            new_account = GoogleAccount(
                email=email,
                access_token=encrypted_access_token,
                refresh_token=encrypted_refresh_token,
                token_expires_at=token_expires_at,
                is_active=True,
            )
            db.add(new_account)
            db.commit()
            db.refresh(new_account)
            logger.info(f"Created new Google account: {email}")
            return new_account

    @staticmethod
    def get_decrypted_tokens(db: Session) -> Optional[dict]:
        """
        Get decrypted access and refresh tokens.
        Returns None if no active account exists.
        """
        account = GoogleAccountService.get_active_account(db)
        if not account or not account.access_token:
            return None

        try:
            phi_crypto = get_phi_encryption_service()
            access_token = phi_crypto.decrypt_google_access_token(account.access_token)
            refresh_token = (
                phi_crypto.decrypt_google_refresh_token(account.refresh_token)
                if account.refresh_token
                else None
            )

            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expires_at": account.token_expires_at,
                "email": account.email,
            }
        except Exception as e:
            logger.error(f"Failed to decrypt Google account tokens: {str(e)}")
            return None

    @staticmethod
    def update_tokens(
        db: Session,
        access_token: str,
        refresh_token: Optional[str] = None,
        token_expires_at: Optional[datetime] = None,
    ) -> bool:
        """Update tokens for the active account"""
        account = GoogleAccountService.get_active_account(db)
        if not account:
            return False

        try:
            phi_crypto = get_phi_encryption_service()
            account.access_token = phi_crypto.encrypt_google_access_token(access_token)
            if refresh_token:
                account.refresh_token = phi_crypto.encrypt_google_refresh_token(refresh_token)
            if token_expires_at:
                account.token_expires_at = token_expires_at
            account.updated_at = datetime.now()
            db.commit()
            db.refresh(account)
            logger.info(f"Updated tokens for Google account: {account.email}")
            return True
        except Exception as e:
            logger.error(f"Failed to update Google account tokens: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    def unlink_account(db: Session) -> bool:
        """Unlink (deactivate) the active Google account"""
        account = GoogleAccountService.get_active_account(db)
        if not account:
            return False

        account.is_active = False
        account.updated_at = datetime.now()
        db.commit()
        logger.info(f"Unlinked Google account: {account.email}")
        return True

    @staticmethod
    def get_account_info(db: Session) -> Optional[dict]:
        """Get account info without sensitive tokens"""
        account = GoogleAccountService.get_active_account(db)
        if not account:
            return None

        return {
            "email": account.email,
            "is_active": account.is_active,
            "has_tokens": account.access_token is not None,
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "updated_at": account.updated_at.isoformat() if account.updated_at else None,
        }

