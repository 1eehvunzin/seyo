import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def new_token() -> str:
    return secrets.token_urlsafe(12)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("provider", "provider_sub"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("usr"))
    provider: Mapped[str] = mapped_column(String)  # apple | kakao | dev
    provider_sub: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    plus_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paywall_seen: Mapped[bool] = mapped_column(default=False)

    def is_plus(self) -> bool:
        if not self.plus_until:
            return False
        until = self.plus_until if self.plus_until.tzinfo else self.plus_until.replace(tzinfo=timezone.utc)
        return until > now()


class Page(Base):
    """One page. `doc` is the app's page JSON (name, theme, top, main, side, memo, widget, ...)
    without the sharing fields, which live in columns so permissions can be enforced."""

    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("page"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    doc: Mapped[dict] = mapped_column(JSON)
    invite_token: Mapped[str] = mapped_column(String, unique=True, index=True, default=new_token)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    owner: Mapped[User] = relationship()
    memberships: Mapped[list["Membership"]] = relationship(cascade="all, delete-orphan", back_populates="page")


class Membership(Base):
    __tablename__ = "memberships"

    page_id: Mapped[str] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    page: Mapped[Page] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship()


class AiUsage(Base):
    """Daily count of AI edits per user, for the free-plan limit."""

    __tablename__ = "ai_usage"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[str] = mapped_column(String, primary_key=True)  # YYYY-MM-DD (KST)
    edits: Mapped[int] = mapped_column(Integer, default=0)


class Purchase(Base):
    __tablename__ = "purchases"

    original_transaction_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(String)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    environment: Mapped[str] = mapped_column(String, default="Sandbox")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Device(Base):
    """Expo push token for reminders (밤 9시 알림, 다시 풀기 알림)."""

    __tablename__ = "devices"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
