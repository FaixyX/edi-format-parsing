from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv
from sqlalchemy.exc import OperationalError
import time

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("No DATABASE_URL environment variable found")


def create_db_engine(retries=3, delay=1):
    for attempt in range(retries):
        try:
            # For local development, don't require SSL
            connect_args = {}

            # Only use SSL for production environments
            if "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
                connect_args["sslmode"] = "require"

            connect_args["connect_timeout"] = 60  # Increased from 30

            engine = create_engine(
                DATABASE_URL,
                connect_args=connect_args,
                pool_pre_ping=True,
                pool_recycle=300,  # 5 minutes to prevent memory buildup
                # Pool settings to support 100 concurrent worker threads
                # Each thread may need a DB connection, so we need enough connections
                pool_size=50,  # Base pool size for 100 threads (50% of threads)
                max_overflow=50,  # Allow overflow up to 100 total connections
                pool_timeout=60,  # Timeout for getting a connection from pool
                pool_reset_on_return="commit",  # Reset connections properly
                echo=False,  # Disable SQL echo for performance
            )
            # Test the connection
            engine.connect()
            return engine
        except OperationalError as e:
            if "data transfer quota" in str(e).lower():
                print(f"⚠️  DATABASE QUOTA EXCEEDED: {e}")
                print("Please upgrade your Neon plan to continue.")
                raise
            if attempt == retries - 1:
                raise
            time.sleep(delay)


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
