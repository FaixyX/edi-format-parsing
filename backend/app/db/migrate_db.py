from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from app.models.agency import Agency
from app.models.user import User
from app.db.session import Base


def migrate_databases():
    # Old database connection
    OLD_DATABASE_URL = ""

    # New database connection (from environment variable)
    NEW_DATABASE_URL = os.getenv("DATABASE_URL")

    # Create engine and session for old database
    connect_args_old = {}
    if "localhost" not in OLD_DATABASE_URL and "127.0.0.1" not in OLD_DATABASE_URL:
        connect_args_old["sslmode"] = "require"

    old_engine = create_engine(OLD_DATABASE_URL, connect_args=connect_args_old)
    OldSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=old_engine)
    old_db = OldSessionLocal()

    # Create engine and session for new database
    connect_args_new = {}
    if "localhost" not in NEW_DATABASE_URL and "127.0.0.1" not in NEW_DATABASE_URL:
        connect_args_new["sslmode"] = "require"

    new_engine = create_engine(NEW_DATABASE_URL, connect_args=connect_args_new)
    NewSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)
    new_db = NewSessionLocal()

    try:
        # Create all tables in new database
        Base.metadata.create_all(bind=new_engine)

        # Migrate Users
        old_users = old_db.query(User).all()
        for user in old_users:
            # Check if user already exists
            existing_user = (
                new_db.query(User).filter(User.username == user.username).first()
            )
            if not existing_user:
                new_user = User(
                    username=user.username,
                    password=user.password,
                    type=user.type,
                    enabled=user.enabled,
                    protected=user.protected,
                )
                new_db.add(new_user)
                print(f"Migrating user: {user.username}")
            else:
                print(f"Skipping existing user: {user.username}")

        # Migrate Agencies
        old_agencies = old_db.query(Agency).all()
        for agency in old_agencies:
            existing_agency = (
                new_db.query(Agency)
                .filter(Agency.agency_id == agency.agency_id)
                .first()
            )
            if not existing_agency:
                new_agency = Agency(
                    name=agency.name,
                    type=agency.type,
                    link=agency.link,
                    agency_id=agency.agency_id,
                    username=agency.username,
                    password=agency.password,
                    submission_form_link=agency.submission_form_link,
                )
                new_db.add(new_agency)
                print(f"Migrating agency: {agency.name}")
            else:
                print(f"Skipping existing agency: {agency.name}")


        # Commit all changes
        new_db.commit()
        print("Migration completed successfully!")

    except Exception as e:
        print(f"Error during migration: {str(e)}")
        new_db.rollback()
        raise
    finally:
        old_db.close()
        new_db.close()
