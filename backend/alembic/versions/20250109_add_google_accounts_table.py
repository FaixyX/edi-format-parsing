"""Add google_accounts table

Revision ID: 20250109_google_accounts
Revises: 20251208_token_version
Create Date: 2025-01-09

This migration adds the google_accounts table for storing system-level
Google account credentials for bot automation.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20250109_google_accounts"
down_revision = "20251208_token_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index(
        op.f("ix_google_accounts_id"),
        "google_accounts",
        ["id"],
        unique=False,
        schema="public",
    )
    op.create_index(
        op.f("ix_google_accounts_email"),
        "google_accounts",
        ["email"],
        unique=True,
        schema="public",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_google_accounts_email"),
        table_name="google_accounts",
        schema="public",
    )
    op.drop_index(
        op.f("ix_google_accounts_id"),
        table_name="google_accounts",
        schema="public",
    )
    op.drop_table("google_accounts", schema="public")


