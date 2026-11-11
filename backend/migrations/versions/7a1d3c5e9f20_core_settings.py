"""core settings: installation settings changed on the screen (AI API key)

Revision ID: 7a1d3c5e9f20
Revises: 4c7e1f2a9b3d
Create Date: 2026-11-10 21:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7a1d3c5e9f20"
down_revision = "4c7e1f2a9b3d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "core_settings",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["core_users.username"], onupdate="CASCADE", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade():
    op.drop_table("core_settings")
