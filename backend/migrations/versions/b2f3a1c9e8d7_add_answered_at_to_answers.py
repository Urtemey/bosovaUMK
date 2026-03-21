"""add answered_at to answers

Revision ID: b2f3a1c9e8d7
Revises: 4577752c417b
Create Date: 2026-03-17 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2f3a1c9e8d7'
down_revision = '4577752c417b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('answers', sa.Column('answered_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('answers', 'answered_at')
