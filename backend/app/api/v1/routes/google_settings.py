"""
API routes for Google account management (admin-only).
"""
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.services.google_oauth_service import GoogleOAuthService
from app.services.google_account_service import GoogleAccountService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/settings/google/status")
def get_google_account_status(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get the status of the linked Google account (admin-only).
    Returns account info without sensitive tokens.
    """
    try:
        account_info = GoogleAccountService.get_account_info(db)
        if not account_info:
            return {"linked": False, "account": None}

        return {"linked": True, "account": account_info}
    except Exception as e:
        logger.error(f"Error getting Google account status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get Google account status",
        )


@router.get("/settings/google/authorize")
def initiate_google_oauth(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    redirect_uri: str = Query(None, description="Optional redirect URI override"),
):
    """
    Initiate Google OAuth flow (admin-only).
    Returns the authorization URL for the frontend to redirect to.
    """
    try:
        authorization_url, state_token = GoogleOAuthService.generate_oauth_url(
            db, redirect_uri
        )
        logger.info(f"Generated OAuth URL for user: {current_user.username}")
        return {"authorization_url": authorization_url}
    except ValueError as e:
        logger.error(f"OAuth configuration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth configuration error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error initiating OAuth: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate Google OAuth",
        )


@router.get("/settings/google/callback")
def handle_google_oauth_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="State token for CSRF protection"),
    error: str = Query(None, description="Error from Google OAuth"),
    db: Session = Depends(get_db),
    redirect_uri: str = Query(None, description="Optional redirect URI override"),
):
    """
    Handle Google OAuth callback.
    This endpoint is public (no auth required) because Google redirects here.
    Security is provided by state token validation (CSRF protection).
    Exchanges authorization code for tokens and stores them.
    Redirects to frontend with success/error status.
    """
    # Check for OAuth errors
    if error:
        logger.error(f"Google OAuth error: {error}")
        frontend_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/control-panel?google_oauth=error&error={error}"
        return RedirectResponse(url=frontend_url)

    try:
        logger.info(f"OAuth callback received - code: {code[:20]}..., state: {state[:20]}...")
        
        # Handle OAuth callback
        account_info = GoogleOAuthService.handle_oauth_callback(
            db, code, state, redirect_uri
        )

        # Redirect to frontend with success
        frontend_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/control-panel?google_oauth=success&email={account_info['email']}"
        logger.info(f"Google account linked successfully: {account_info['email']}, redirecting to: {frontend_url}")
        return RedirectResponse(url=frontend_url)

    except ValueError as e:
        error_msg = str(e)
        logger.error(f"OAuth validation error: {error_msg}")
        frontend_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/control-panel?google_oauth=error&error={error_msg}"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        error_msg = f"Failed to link Google account: {str(e)}"
        logger.error(f"Error handling OAuth callback: {error_msg}", exc_info=True)
        # URL encode the error message
        import urllib.parse
        encoded_error = urllib.parse.quote(error_msg)
        frontend_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/control-panel?google_oauth=error&error={encoded_error}"
        return RedirectResponse(url=frontend_url)


@router.post("/settings/google/unlink")
def unlink_google_account(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Unlink the Google account (admin-only).
    """
    try:
        success = GoogleAccountService.unlink_account(db)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Google account found to unlink",
            )

        return {"success": True, "message": "Google account unlinked successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unlinking Google account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unlink Google account",
        )


@router.post("/settings/google/refresh-token")
def refresh_google_token(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Manually refresh the Google access token (admin-only).
    """
    try:
        success = GoogleOAuthService.refresh_access_token(db)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to refresh token. Please re-link your Google account.",
            )

        return {"success": True, "message": "Token refreshed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh Google token",
        )

