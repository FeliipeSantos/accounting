"""intel ai summaries: Resumo IA generated on request through the person's subscription

Revision ID: b8e2f4a6c1d3
Revises: 7a1d3c5e9f20
Create Date: 2026-11-11 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b8e2f4a6c1d3"
down_revision = "7a1d3c5e9f20"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intel_ai_summaries",
        sa.Column("publication_id", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("source_hash", sa.Text(), nullable=False),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("partial", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("requested_by", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["publication_id"], ["intel_publications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by"], ["core_users.username"], onupdate="CASCADE", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("publication_id"),
    )
    # a IA passou a usar a assinatura da pessoa: as chaves de API cadastradas antes saem do banco
    op.execute("DELETE FROM core_settings WHERE key IN ('ai.anthropic_api_key', 'ai.openai_api_key')")
    op.execute("DELETE FROM core_settings WHERE key = 'ai.provider' AND value NOT IN ('claude', 'codex')")


def downgrade():
    op.drop_table("intel_ai_summaries")
