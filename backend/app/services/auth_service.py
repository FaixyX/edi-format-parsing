from datetime import timedelta
from fastapi import HTTPException, status
from app.schemas.auth import LoginRequest, LoginResponse
from app.services.jwt_service import create_access_token
from app.services.user_service import get_user_by_username, verify_password
from sqlalchemy.orm import Session


def authenticate_user(login_data: LoginRequest, db: Session) -> LoginResponse:
    import logging

    logger = logging.getLogger(__name__)

    user = get_user_by_username(db, login_data.username)

    # First check if user exists
    if not user:
        logger.warning(
            f"Login attempt with non-existent username: {login_data.username}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Then check if account is disabled
    if not user.enabled:
        logger.warning(f"Login attempt for disabled user: {login_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been disabled. Please contact an administrator if you believe this is an error.",
        )

    # Debug: Check if password looks encrypted (starts with encryption prefix) or hashed (bcrypt starts with $2b$)
    stored_password = user.password
    is_bcrypt_hash = (
        stored_password.startswith("$2b$")
        or stored_password.startswith("$2a$")
        or stored_password.startswith("$2y$")
    )
    logger.info(
        f"Password check for user {login_data.username}: is_bcrypt_hash={is_bcrypt_hash}, password_length={len(stored_password)}, starts_with={stored_password[:10] if len(stored_password) > 10 else stored_password}"
    )
    logger.info(
        f"Provided password length: {len(login_data.password)}, first_char: {login_data.password[0] if login_data.password else 'None'}"
    )

    # Finally check password
    password_valid = verify_password(login_data.password, stored_password)
    logger.info(
        f"Password verification result for user {login_data.username}: {password_valid}"
    )

    if not password_valid:
        logger.warning(f"Failed password verification for user: {login_data.username}")
        # Don't log the actual password for security, but log that verification failed
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    expires = timedelta(days=30) if login_data.keepLoggedIn else timedelta(hours=2)
    access_token = create_access_token(
        {
            "sub": user.username,
            "type": user.type,
            "user_id": user.id,
            "token_version": user.token_version or 0,
        },
        expires,
    )

    return LoginResponse(
        token=access_token,
        user={"id": user.id, "username": user.username, "type": user.type},
    )
