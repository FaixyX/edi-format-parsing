"""add task review tracking fields

Revision ID: 20251206_190035
Revises:
Create Date: 2025-12-06 19:00:35.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251206_190035"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add review tracking fields to background_tasks table.

    These fields allow users to mark tasks as checked and add notes
    for collaboration and tracking purposes.
    """
    # Add is_checked column
    op.add_column(
        "background_tasks",
        sa.Column("is_checked", sa.Boolean(), nullable=False, server_default="false"),
        schema="public",
    )

    # Add note column
    op.add_column(
        "background_tasks", sa.Column("note", sa.Text(), nullable=True), schema="public"
    )

    # Add checked_by column
    op.add_column(
        "background_tasks",
        sa.Column("checked_by", sa.String(), nullable=True),
        schema="public",
    )

    # Add checked_at column
    op.add_column(
        "background_tasks",
        sa.Column("checked_at", sa.DateTime(), nullable=True),
        schema="public",
    )

    # Add note_by column
    op.add_column(
        "background_tasks",
        sa.Column("note_by", sa.String(), nullable=True),
        schema="public",
    )

    # Add note_at column
    op.add_column(
        "background_tasks",
        sa.Column("note_at", sa.DateTime(), nullable=True),
        schema="public",
    )


def downgrade() -> None:
    """
    Remove review tracking fields from background_tasks table.
    """
    # Remove columns in reverse order
    op.drop_column("background_tasks", "note_at", schema="public")
    op.drop_column("background_tasks", "note_by", schema="public")
    op.drop_column("background_tasks", "checked_at", schema="public")
    op.drop_column("background_tasks", "checked_by", schema="public")
    op.drop_column("background_tasks", "note", schema="public")
    op.drop_column("background_tasks", "is_checked", schema="public")
