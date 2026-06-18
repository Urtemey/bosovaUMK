"""add section to tests

Revision ID: e9f1a2b3c4d5
Revises: d8e3f4a5b6c7
Create Date: 2026-06-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e9f1a2b3c4d5'
down_revision = 'd8e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('section', sa.String(length=8), nullable=True))
        batch_op.create_index('ix_tests_section', ['section'])

    # Backfill: раскладываем существующие тесты по подразделам по названию/теме.
    # Экзаменационные подразделы привязаны к своим классам.
    op.execute("""
        UPDATE tests
        SET section = 'vpr'
        WHERE grade IN (7, 8)
          AND (title ILIKE '%впр%' OR title ILIKE '%vpr%'
               OR COALESCE(topic, '') ILIKE '%впр%' OR COALESCE(topic, '') ILIKE '%vpr%')
    """)
    op.execute("""
        UPDATE tests
        SET section = 'oge'
        WHERE grade = 9
          AND (title ILIKE '%огэ%' OR title ILIKE '%oge%'
               OR COALESCE(topic, '') ILIKE '%огэ%' OR COALESCE(topic, '') ILIKE '%oge%')
    """)
    op.execute("""
        UPDATE tests
        SET section = 'ege'
        WHERE grade = 11
          AND (title ILIKE '%егэ%' OR title ILIKE '%ege%'
               OR COALESCE(topic, '') ILIKE '%егэ%' OR COALESCE(topic, '') ILIKE '%ege%')
    """)
    # Углублённый уровень — по ключевому слову.
    op.execute("""
        UPDATE tests
        SET section = 'uu'
        WHERE grade IN (7, 8, 9, 11)
          AND section IS NULL
          AND (title ILIKE '%углуб%' OR COALESCE(topic, '') ILIKE '%углуб%')
    """)
    # Остальные тесты классов с подразделами по умолчанию — базовый уровень.
    op.execute("""
        UPDATE tests
        SET section = 'bu'
        WHERE grade IN (7, 8, 9, 11)
          AND section IS NULL
    """)


def downgrade():
    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.drop_index('ix_tests_section')
        batch_op.drop_column('section')
