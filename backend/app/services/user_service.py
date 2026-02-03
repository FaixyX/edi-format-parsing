from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserToggle
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.models.user import UserType
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from app.services import jwt_service, user_service
from app.db.session import get_db


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    Returns True if the password matches, False otherwise.
    """
    import logging

    logger = logging.getLogger(__name__)

    try:
        if not plain_password or not hashed_password:
            logger.warning(
                "Password verification failed: missing plain_password or hashed_password"
            )
            return False

        # Check if the hash looks valid
        if not (
            hashed_password.startswith("$2b$")
            or hashed_password.startswith("$2a$")
            or hashed_password.startswith("$2y$")
        ):
            logger.warning(
                f"Password hash doesn't look like bcrypt: starts with {hashed_password[:10] if len(hashed_password) > 10 else hashed_password}"
            )
            return False

        result = pwd_context.verify(plain_password, hashed_password)
        if not result:
            logger.debug(
                f"Password verification failed: plain_password length={len(plain_password)}, hash starts with {hashed_password[:10]}"
            )
        return result
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        # Note: Not using exc_info=True to avoid logging full traceback that might contain ePHI
        logger.error(f"Error verifying password: {type(e).__name__}")
        return False


def get_users(db: Session):
    return db.query(User).order_by(User.id).all()


def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user_data: UserCreate):
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        password=hashed_password,
        type=user_data.type,
        enabled=user_data.enabled,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user_data: UserUpdate):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    if user.protected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a protected user",
        )

    update_data = user_data.model_dump(exclude_unset=True)
    password_changed = False

    # Only update password if it's provided and not empty
    if "password" in update_data:
        password_value = update_data.pop("password")
        if password_value and password_value.strip():
            update_data["password"] = get_password_hash(password_value)
            password_changed = True

    for key, value in update_data.items():
        setattr(user, key, value)

    # Increment token_version to invalidate all existing tokens when password is changed
    if password_changed:
        user.token_version = (user.token_version or 0) + 1

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    print(f"Attempting to delete user {user_id}, found: {user is not None}")
    if not user:
        return False

    if user.protected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a protected user",
        )

    # Check if user is admin and if they're the last admin
    if user.type == UserType.ADMIN:
        print("Admin user detected")
        admin_count = db.query(User).filter(User.type == UserType.ADMIN).count()
        if admin_count <= 1:
            print("Last admin user detected")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin user",
            )

    db.delete(user)
    db.commit()
    print(f"User {user_id} deleted successfully")
    return True


def toggle_user_status(db: Session, user_id: int, toggle_data: UserToggle):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    if user.protected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a protected user's status",
        )

    print("toggling user")

    # Check if trying to disable an admin user
    if user.type == UserType.ADMIN and not toggle_data.enabled:
        print("Admin user detected")
        admin_count = (
            db.query(User)
            .filter(User.type == UserType.ADMIN, User.enabled == True)
            .count()
        )
        if admin_count <= 1:
            print("Last active admin user detected")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot disable the last active admin user",
            )

    # If disabling the account, increment token_version to invalidate all existing tokens
    if not toggle_data.enabled and user.enabled:
        user.token_version = (user.token_version or 0) + 1

    user.enabled = toggle_data.enabled
    db.commit()
    db.refresh(user)
    return user


def get_users_by_type(db: Session, user_type: str):
    return (
        db.query(User)
        .filter(User.type == user_type, User.enabled == True)
        .order_by(User.username)
        .all()
    )


# OAuth2 scheme pointing to your login route (even if not strictly OAuth2)
# This tells FastAPI how to find the token (e.g., in 'Authorization: Bearer <token>' header)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = jwt_service.decode_token(token)
    if payload is None:
        print("Token decode failed (invalid signature or other JWT error)")
        raise credentials_exception

    username: str | None = payload.get("sub")
    if username is None:
        print("Token payload missing 'sub' (username)")
        raise credentials_exception

    user = user_service.get_user_by_username(db, username=username)
    if user is None:
        print(f"User '{username}' from token not found in DB")
        raise credentials_exception

    if not user.enabled:
        print(f"User '{username}' is disabled")
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
            print(
                f"Old token rejected for user '{username}': user token_version={user_token_version}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been invalidated. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    # If token has token_version, it must match user's version
    elif token_version != user_token_version:
        print(
            f"Token version mismatch for user '{username}': token={token_version}, user={user_token_version}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    # You could add more checks here if needed (e.g., specific roles)
    # For now, it just ensures the user was fetched correctly by get_current_user
    # and implicitly checks if they are enabled via that function.
    return current_user
