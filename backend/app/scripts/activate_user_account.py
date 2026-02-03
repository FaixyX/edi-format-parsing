"""
Script to activate a deactivated user account.

Usage:
    python -c "from app.scripts.activate_user_account import activate_user; activate_user('username')"
"""

import logging
from app.db.session import SessionLocal
from app.services.user_service import get_user_by_username

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def activate_user(username: str):
    """
    Activate a deactivated user account.

    Args:
        username: The username of the user to activate
    """
    db = SessionLocal()
    try:
        user = get_user_by_username(db, username)
        if not user:
            logger.error(f"User '{username}' not found")
            return False

        if user.enabled:
            logger.warning(f"User '{username}' is already activated")
            return True

        # Activate the user account
        user.enabled = True
        db.commit()

        logger.info(f"✅ Account activated successfully for user '{username}'")
        return True
    except Exception as e:
        logger.error(f"❌ Error activating account: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python activate_user_account.py <username>")
        sys.exit(1)

    username = sys.argv[1]
    activate_user(username)
