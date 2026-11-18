from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


def _normalize(url: str) -> str:
    # Supabase/Railway hand out postgres:// or postgresql:// URLs; use the psycopg 3 driver.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


_settings = get_settings()
DATABASE_URL = _normalize(_settings.database_url)
IS_SQLITE = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {"prepare_threshold": None},  # Supabase pooler (transaction mode) can't keep prepared statements
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Local SQLite only. Postgres schema is managed by Alembic (`alembic upgrade head`)."""
    if not IS_SQLITE:
        return
    from . import models  # noqa: F401  (register tables)

    Base.metadata.create_all(engine)
