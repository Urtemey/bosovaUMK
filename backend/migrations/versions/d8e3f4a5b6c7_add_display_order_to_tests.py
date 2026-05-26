"""add display_order to tests

Revision ID: d8e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd8e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'))
        batch_op.create_index('ix_tests_display_order', ['display_order'])

    # Seed initial order per grade based on id so the catalog stays stable.
    op.execute("""
        UPDATE tests AS t
        SET display_order = sub.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY grade ORDER BY id) AS rn
            FROM tests
        ) AS sub
        WHERE t.id = sub.id
    """)

    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.alter_column('display_order', server_default=None)


def downgrade():
    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.drop_index('ix_tests_display_order')
        batch_op.drop_column('display_order')
