"""
Script to make a user account protected.

Usage:
    python -c "from app.scripts.make_user_protected import make_user_protected; make_user_protected('username')"
"""

import logging
from app.db.session import SessionLocal
from app.services.user_service import get_user_by_username

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def make_user_protected(username: str):
    """
    Make a user account protected.

    Args:
        username: The username of the user to make protected
    """
    db = SessionLocal()
    try:
        user = get_user_by_username(db, username)
        if not user:
            logger.error(f"User '{username}' not found")
            return False

        if user.protected:
            logger.warning(f"User '{username}' is already protected")
            return True

        # Make the user protected
        user.protected = True
        db.commit()

        logger.info(f"✅ User '{username}' is now protected")
        return True
    except Exception as e:
        logger.error(f"❌ Error making user protected: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python make_user_protected.py <username>")
        sys.exit(1)

    username = sys.argv[1]
    make_user_protected(username)

