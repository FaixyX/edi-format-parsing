"""Add tenant_keys table for HIPAA encryption

Revision ID: 20251207_tenant_keys
Revises: 20251206_190035_add_task_review_tracking_fields
Create Date: 2025-12-07

This migration adds the tenant_keys table for storing wrapped encryption keys.
Keys are encrypted with Fly KMS before storage.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251207_tenant_keys"
down_revision = "20251206_190035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenant_keys table for storing wrapped encryption keys
    op.create_table(
        "tenant_keys",
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("dek_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("index_key_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("kms_label", sa.String(), nullable=False),
        sa.Column("kms_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("tenant_id"),
        schema="public",
    )

    # Add index on kms_label for potential bulk operations
    op.create_index(
        "ix_tenant_keys_kms_label", "tenant_keys", ["kms_label"], schema="public"
    )


def downgrade() -> None:
    op.drop_index("ix_tenant_keys_kms_label", table_name="tenant_keys", schema="public")
    op.drop_table("tenant_keys", schema="public")
