"""
Service for handling Google OAuth 2.0 authentication flow.
"""

import os
import logging
from typing import Optional, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode
import secrets
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from app.services.google_account_service import GoogleAccountService
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# OAuth 2.0 scopes required for Google Sheets API and user info
# Note: Google automatically adds 'openid' when requesting userinfo.email
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",  # Needed to list spreadsheets via Drive API
    "https://www.googleapis.com/auth/drive.file",  # Needed to create spreadsheets via Drive API
    "https://www.googleapis.com/auth/userinfo.email",  # Needed to get user email
    "openid",  # Required by Google when using userinfo.email
]

# OAuth state storage (in production, use Redis or database)
_oauth_states = {}


class GoogleOAuthService:
    """Service for Google OAuth 2.0 authentication"""

    @staticmethod
    def get_oauth_credentials() -> Tuple[str, str]:
        """
        Get OAuth client ID and secret from environment variables.
        Returns: (client_id, client_secret)
        """
        client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")

        if not client_id or not client_secret:
            raise ValueError(
                "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in environment variables"
            )

        return client_id, client_secret

    @staticmethod
    def get_redirect_uri() -> str:
        """Get OAuth redirect URI from environment or construct from base URL"""
        redirect_uri = os.getenv("GOOGLE_OAUTH_REDIRECT_URI")
        if redirect_uri:
            return redirect_uri

        # Fallback: construct from base URL
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        return f"{base_url}/api/v1/settings/google/callback"

    @staticmethod
    def generate_oauth_url(
        db: Session, redirect_uri: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Generate OAuth authorization URL and state token.
        Returns: (authorization_url, state_token)
        """
        try:
            client_id, client_secret = GoogleOAuthService.get_oauth_credentials()
            redirect_uri = redirect_uri or GoogleOAuthService.get_redirect_uri()

            # Generate state token for CSRF protection
            state_token = secrets.token_urlsafe(32)
            _oauth_states[state_token] = {
                "created_at": datetime.now(),
                "used": False,
            }

            # Create OAuth flow
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [redirect_uri],
                    }
                },
                scopes=SCOPES,
            )
            flow.redirect_uri = redirect_uri

            # Generate authorization URL
            authorization_url, _ = flow.authorization_url(
                access_type="offline",  # Request refresh token
                include_granted_scopes="true",
                state=state_token,
                prompt="consent",  # Force consent screen to get refresh token
            )

            logger.info(f"Generated OAuth URL with state: {state_token[:8]}...")
            return authorization_url, state_token

        except Exception as e:
            logger.error(f"Failed to generate OAuth URL: {str(e)}")
            raise

    @staticmethod
    def validate_state(state: str) -> bool:
        """Validate OAuth state token"""
        logger.info(
            f"Validating OAuth state token: {state[:20]}... (total states in memory: {len(_oauth_states)})"
        )

        if state not in _oauth_states:
            logger.warning(
                f"Invalid OAuth state token: {state[:8]}... (not found in memory)"
            )
            logger.debug(f"Available state tokens: {list(_oauth_states.keys())[:5]}")
            return False

        state_data = _oauth_states[state]
        if state_data["used"]:
            logger.warning(f"OAuth state token already used: {state[:8]}...")
            return False

        # Check if state is not too old (5 minutes)
        age = datetime.now() - state_data["created_at"]
        if age > timedelta(minutes=5):
            logger.warning(f"OAuth state token expired: {state[:8]}... (age: {age})")
            del _oauth_states[state]
            return False

        logger.info(f"OAuth state token validated successfully: {state[:8]}...")
        return True

    @staticmethod
    def mark_state_used(state: str):
        """Mark OAuth state token as used"""
        if state in _oauth_states:
            _oauth_states[state]["used"] = True

    @staticmethod
    def handle_oauth_callback(
        db: Session,
        authorization_code: str,
        state: str,
        redirect_uri: Optional[str] = None,
    ) -> dict:
        """
        Handle OAuth callback and exchange authorization code for tokens.
        Returns: dict with account info
        """
        # Validate state
        if not GoogleOAuthService.validate_state(state):
            raise ValueError("Invalid or expired OAuth state token")

        try:
            client_id, client_secret = GoogleOAuthService.get_oauth_credentials()
            redirect_uri = redirect_uri or GoogleOAuthService.get_redirect_uri()

            # Create OAuth flow
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [redirect_uri],
                    }
                },
                scopes=SCOPES,
            )
            flow.redirect_uri = redirect_uri

            # Exchange authorization code for tokens
            flow.fetch_token(code=authorization_code)

            # Get credentials
            credentials = flow.credentials

            # Verify we got a valid token
            if not credentials or not credentials.token:
                raise ValueError("Failed to obtain access token from Google")

            logger.info(
                f"Successfully obtained access token, expires at: {credentials.expiry}"
            )

            # Get user info
            from googleapiclient.discovery import build

            try:
                service = build("oauth2", "v2", credentials=credentials)
                user_info = service.userinfo().get().execute()
                email = user_info.get("email")
            except Exception as e:
                logger.error(f"Failed to get user info from Google: {str(e)}")
                # Fallback: try to get email from ID token if available
                if hasattr(credentials, "id_token") and credentials.id_token:
                    try:
                        import jwt

                        decoded = jwt.decode(
                            credentials.id_token, options={"verify_signature": False}
                        )
                        email = decoded.get("email")
                        logger.info(f"Got email from ID token: {email}")
                    except Exception as id_token_error:
                        logger.error(
                            f"Failed to decode ID token: {str(id_token_error)}"
                        )
                        raise ValueError(f"Failed to get user email: {str(e)}")
                else:
                    raise ValueError(f"Failed to get user email: {str(e)}")

            if not email:
                raise ValueError("Failed to get user email from Google")

            # Calculate token expiration
            token_expires_at = None
            if credentials.expiry:
                token_expires_at = credentials.expiry

            # Store account
            account = GoogleAccountService.create_or_update_account(
                db=db,
                email=email,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expires_at=token_expires_at,
            )

            # Mark state as used
            GoogleOAuthService.mark_state_used(state)

            logger.info(f"Successfully linked Google account: {email}")

            return {
                "email": email,
                "is_active": account.is_active,
                "created_at": (
                    account.created_at.isoformat() if account.created_at else None
                ),
            }

        except Exception as e:
            logger.error(f"Failed to handle OAuth callback: {str(e)}")
            raise

    @staticmethod
    def refresh_access_token(db: Session) -> bool:
        """
        Refresh the access token for the active Google account.
        Returns: True if successful, False otherwise
        """
        account = GoogleAccountService.get_active_account(db)
        if not account or not account.refresh_token:
            logger.warning("No active Google account with refresh token found")
            return False

        try:
            # Get decrypted tokens
            tokens = GoogleAccountService.get_decrypted_tokens(db)
            if not tokens or not tokens.get("refresh_token"):
                logger.error("Failed to get refresh token")
                return False

            # Create credentials object
            credentials = Credentials(
                token=None,  # Will be refreshed
                refresh_token=tokens["refresh_token"],
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.getenv("GOOGLE_OAUTH_CLIENT_ID"),
                client_secret=os.getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
            )

            # Refresh token
            credentials.refresh(Request())

            # Update stored tokens
            GoogleAccountService.update_tokens(
                db=db,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expires_at=credentials.expiry,
            )

            logger.info(f"Successfully refreshed access token for: {account.email}")
            return True

        except Exception as e:
            logger.error(f"Failed to refresh access token: {str(e)}")
            return False

    @staticmethod
    def get_valid_credentials(db: Session) -> Optional[Credentials]:
        """
        Get valid Google credentials, refreshing if necessary.
        Returns: Credentials object or None
        """
        tokens = GoogleAccountService.get_decrypted_tokens(db)
        if not tokens:
            return None

        client_id, client_secret = GoogleOAuthService.get_oauth_credentials()

        # Create credentials object
        credentials = Credentials(
            token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )

        # Check if token needs refresh
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Update stored tokens
                GoogleAccountService.update_tokens(
                    db=db,
                    access_token=credentials.token,
                    refresh_token=credentials.refresh_token,
                    token_expires_at=credentials.expiry,
                )
                logger.info("Refreshed expired access token")
            except Exception as e:
                logger.error(f"Failed to refresh expired token: {str(e)}")
                return None

        return credentials
