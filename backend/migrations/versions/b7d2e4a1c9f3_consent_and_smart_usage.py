"""one-time 14+/terms consent per account, and a monthly count of plus (Sonnet) page creates

Revision ID: b7d2e4a1c9f3
Revises: a3c1e7f2b9d4
Create Date: 2026-11-26 12:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d2e4a1c9f3'
down_revision: Union[str, Sequence[str], None] = 'a3c1e7f2b9d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('agreed_at', sa.DateTime(timezone=True), nullable=True))
    # everyone who signed up so far checked the 14+/terms box on the login sheet
    op.execute("UPDATE users SET agreed_at = created_at")
    op.add_column('ai_usage', sa.Column('smart', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('ai_usage', 'smart')
    op.drop_column('users', 'agreed_at')
