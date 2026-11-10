"""intel: Notas Técnicas classified as technical documents

Revision ID: b3c1d2e4f5a6
Revises: 7deeca8a7820
Create Date: 2026-11-08 15:10:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b3c1d2e4f5a6"
down_revision = "7deeca8a7820"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE intel_publications SET norm_type = 'Documento técnico', effective_date = NULL WHERE act_type LIKE 'Nota T%cnica%'")


def downgrade():
    op.execute(
        "UPDATE intel_publications SET norm_type = 'Norma publicada (vigência não identificada no trecho)' "
        "WHERE norm_type = 'Documento técnico'"
    )
