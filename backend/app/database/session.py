from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_database_url
from app.core.logging import get_logger


logger = get_logger(__name__)


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine = None
_session_factory: async_sessionmaker = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        from app.core.config import get_config
        cfg = get_config()["database"]
        _engine = create_async_engine(
            get_database_url(),
            echo=cfg["echo"],
            pool_size=cfg["pool_size"],
            max_overflow=cfg["max_overflow"],
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    return _engine


def get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    from app.models import user, invoice, audit_log  # noqa: F401 - registers metadata
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully")


async def dispose_engine() -> None:
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
