from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# this is the Alembic Config object
config = context.config

# Set the database URL in the alembic configuration
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)
elif config.get_main_option("sqlalchemy.url"):
    # Use the URL from alembic.ini if DATABASE_URL env var is not set
    pass
else:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Please set it before running migrations."
    )

# Import all your models here
from app.models.agency import Agency
from app.models.user import User
from app.models.form_submission import FormSubmission
from app.models.background_task import BackgroundTask
from app.models.system_configuration import SystemConfiguration
from app.db.session import Base

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
