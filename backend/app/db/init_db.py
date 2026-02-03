import os
from app.db.session import Base, engine, SessionLocal
from app.models.agency import Agency
from app.models.user import User, UserType
from app.services.user_service import create_user
from app.schemas.user import UserCreate


def init_db():
    Base.metadata.create_all(bind=engine)

    # Create initial admin user if it doesn't exist
    db = SessionLocal()
    try:
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_user = db.query(User).filter(User.username == admin_username).first()
        if not admin_user:
            admin = UserCreate(
                username=admin_username,
                password=os.getenv("ADMIN_PASSWORD", "admin"),
                type=UserType.ADMIN,
                enabled=True,
                protected=True,
            )
            create_user(db, admin)

    finally:
        db.close()
