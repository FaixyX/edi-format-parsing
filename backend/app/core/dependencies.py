"""
Authentication and authorization dependencies for FastAPI routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserType
from app.services.user_service import get_user_by_username
from app.services.jwt_service import decode_token
from typing import Optional

# Security scheme for JWT tokens
security = HTTPBearer()


def get_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate user from JWT token in Authorization header.
    This is used internally by other dependency functions.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Extract token from credentials
    token = credentials.credentials
    
    # Decode and validate token
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    username: str | None = payload.get("sub")
    if username is None:
        raise credentials_exception

    user = get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception

    if not user.enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check token version to invalidate old tokens
    # Backward compatibility: old tokens without token_version are valid if user's token_version is 0
    user_token_version = user.token_version or 0
    token_version = payload.get("token_version")
    
    # If token doesn't have token_version (old token), only allow if user is still at version 0
    if token_version is None:
        if user_token_version > 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been invalidated. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    # If token has token_version, it must match user's version
    elif token_version != user_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Optional authentication dependency that returns the current user if authenticated,
    or None if not authenticated. This is useful for endpoints that can work with or without auth.
    """
    if not credentials:
        return None

    try:
        return get_user_from_token(credentials, db)
    except HTTPException:
        return None


def get_required_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Required authentication dependency that raises an exception if the user is not authenticated.
    This is the main dependency to use for protected endpoints.
    """
    return get_user_from_token(credentials, db)


def get_current_admin_user(
    current_user: User = Depends(get_required_current_user),
) -> User:
    """
    Dependency that requires the current user to be an Admin.
    Raises 403 Forbidden if the user is not an Admin.
    """
    if current_user.type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. This endpoint is restricted to administrators only.",
        )
    return current_user


# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = {
    # Auth endpoints
    "POST /api/v1/login",
    "POST /api/v1/login/",  # With trailing slash
    # Health check endpoints
    "GET /",
    "GET /health",
    "GET /health/background",
    # Google OAuth callback (public because Google redirects here without auth header)
    "GET /api/v1/settings/google/callback",
    "GET /api/v1/settings/google/callback/",  # With trailing slash
}


def is_public_endpoint(method: str, path: str) -> bool:
    """
    Check if an endpoint should be publicly accessible without authentication.
    """
    # Check exact match first
    endpoint_key = f"{method.upper()} {path}"
    if endpoint_key in PUBLIC_ENDPOINTS:
        return True

    # Check for path parameter matches (e.g., /public/agencies/123 matches /public/agencies/{agency_id})
    for public_endpoint in PUBLIC_ENDPOINTS:
        public_method, public_path = public_endpoint.split(" ", 1)
        if public_method == method.upper():
            # Convert path parameters to regex pattern
            import re

            pattern = re.sub(r"\{[^}]+\}", r"[^/]+", public_path)
            if re.match(f"^{pattern}$", path):
                return True

    return False
