"""
Script to reset a user's password.

Usage:
    python -c "from app.scripts.reset_user_password import reset_password; reset_password('username', 'new_password')"
"""

import logging
from app.db.session import SessionLocal
from app.services.user_service import get_user_by_username, get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def reset_password(username: str, new_password: str):
    """
    Reset a user's password.

    Args:
        username: The username of the user
        new_password: The new password to set
    """
    db = SessionLocal()
    try:
        user = get_user_by_username(db, username)
        if not user:
            logger.error(f"User '{username}' not found")
            return False

        # Hash the new password
        hashed_password = get_password_hash(new_password)

        # Update the user's password
        user.password = hashed_password
        db.commit()

        logger.info(f"✅ Password reset successfully for user '{username}'")
        return True
    except Exception as e:
        logger.error(f"❌ Error resetting password: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python reset_user_password.py <username> <new_password>")
        sys.exit(1)

    username = sys.argv[1]
    new_password = sys.argv[2]
    reset_password(username, new_password)
