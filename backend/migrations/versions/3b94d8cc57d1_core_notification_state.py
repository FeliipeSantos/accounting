"""core notification state

Revision ID: 3b94d8cc57d1
Revises: b3c1d2e4f5a6
Create Date: 2026-11-08 15:29:15.757757

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b94d8cc57d1'
down_revision = 'b3c1d2e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('core_notification_state',
    sa.Column('username', sa.Text(), nullable=False),
    sa.Column('seen_at', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['username'], ['core_users.username'], onupdate='CASCADE', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('username')
    )


def downgrade():
    op.drop_table('core_notification_state')
