"""guest AI usage (onboarding tries before login)

Revision ID: a3c1e7f2b9d4
Revises: 05178aaa64dd
Create Date: 2026-11-18 20:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c1e7f2b9d4'
down_revision: Union[str, Sequence[str], None] = '05178aaa64dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('guest_usage',
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('key', sa.String(), nullable=False),
    sa.Column('day', sa.String(), nullable=False),
    sa.Column('edits', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('kind', 'key', 'day')
    )


def downgrade() -> None:
    op.drop_table('guest_usage')
