"""add teacher role

Revision ID: c1d2e3f4a5b6
Revises: b494c4a18980
Create Date: 2026-05-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c1d2e3f4a5b6'
down_revision = 'b494c4a18980'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('teachers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('role', sa.String(length=20), nullable=False, server_default='teacher'))

    # Existing teacher accounts used to have admin-level permissions.
    op.execute("UPDATE teachers SET role = 'admin'")

    with op.batch_alter_table('teachers', schema=None) as batch_op:
        batch_op.alter_column('role', server_default=None)


def downgrade():
    with op.batch_alter_table('teachers', schema=None) as batch_op:
        batch_op.drop_column('role')
