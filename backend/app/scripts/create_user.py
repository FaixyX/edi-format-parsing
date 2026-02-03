"""
Script to create a new user account.

Usage:
    python -c "from app.scripts.create_user import create_user; create_user('username', 'password', 'Admin')"
    python -c "from app.scripts.create_user import create_user; create_user('username', 'password', 'Member')"
"""

import logging
from app.db.session import SessionLocal
from app.services.user_service import get_user_by_username, get_password_hash
from app.models.user import User
from app.models.user import UserType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_user(
    username: str,
    password: str,
    user_type: str,
    enabled: bool = True,
    protected: bool = False,
):
    """
    Create a new user account.

    Args:
        username: The username for the new user
        password: The password for the new user
        user_type: The user type ('Admin' or 'Member')
        enabled: Whether the user account is enabled (default: True)
        protected: Whether the user account is protected (default: False)
    """
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = get_user_by_username(db, username)
        if existing_user:
            logger.error(f"User '{username}' already exists")
            return False

        # Validate user type
        try:
            user_type_enum = UserType(user_type)
        except ValueError:
            logger.error(
                f"Invalid user type '{user_type}'. Must be 'Admin' or 'Member'"
            )
            return False

        # Hash the password
        hashed_password = get_password_hash(password)

        # Create the user
        db_user = User(
            username=username,
            password=hashed_password,
            type=user_type_enum,
            enabled=enabled,
            protected=protected,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        logger.info(
            f"✅ User '{username}' created successfully (Type: {user_type}, Enabled: {enabled}, Protected: {protected})"
        )
        return True
    except Exception as e:
        logger.error(f"❌ Error creating user: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 4:
        print(
            "Usage: python create_user.py <username> <password> <user_type> [enabled] [protected]"
        )
        print("  user_type: 'Admin' or 'Member'")
        print("  enabled: 'true' or 'false' (default: true)")
        print("  protected: 'true' or 'false' (default: false)")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    user_type = sys.argv[3]
    enabled = sys.argv[4].lower() == "true" if len(sys.argv) > 4 else True
    protected = sys.argv[5].lower() == "true" if len(sys.argv) > 5 else False

    create_user(username, password, user_type, enabled, protected)
