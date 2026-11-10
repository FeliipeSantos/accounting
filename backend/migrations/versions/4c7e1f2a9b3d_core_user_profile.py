"""core user profile: name, avatar and photo

Revision ID: 4c7e1f2a9b3d
Revises: 0582abbea864
Create Date: 2026-11-10 15:40:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4c7e1f2a9b3d"
down_revision = "0582abbea864"
branch_labels = None
depends_on = None

COLUMNS = ("display_name", "avatar", "avatar_image", "avatar_mime")


def upgrade():
    # ADD COLUMN direto (sem recriar a tabela): core_users é referenciada por várias tabelas
    op.add_column("core_users", sa.Column("display_name", sa.Text(), nullable=True))
    op.add_column("core_users", sa.Column("avatar", sa.Text(), nullable=True))
    op.add_column("core_users", sa.Column("avatar_image", sa.LargeBinary(), nullable=True))
    op.add_column("core_users", sa.Column("avatar_mime", sa.Text(), nullable=True))


def downgrade():
    for column in reversed(COLUMNS):
        op.drop_column("core_users", column)
