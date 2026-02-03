"""Add token_version to users table

Revision ID: 20251208_token_version
Revises: 20251207_tenant_keys
Create Date: 2025-12-08

This migration adds the token_version field to the users table.
This field is used to invalidate JWT tokens when a user's password is changed,
account is deactivated, or account is deleted.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251208_token_version"
down_revision = "20251207_tenant_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add token_version column to users table with default value of 0
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        schema="public",
    )


def downgrade() -> None:
    # Remove token_version column from users table
    op.drop_column("users", "token_version", schema="public")
