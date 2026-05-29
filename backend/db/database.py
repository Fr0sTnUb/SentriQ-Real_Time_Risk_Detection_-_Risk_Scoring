"""
Async SQLAlchemy database engine and session factory.

Uses asyncpg driver for PostgreSQL async connectivity.
All DB operations across the app use the `get_db` dependency.
"""

import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/fraudguard")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"server_settings": {"jit": "off"}} if "asyncpg" in DATABASE_URL else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables defined by ORM models. Called on app startup."""
    async with engine.begin() as conn:
        from db.models import User, Transaction, Prediction, ModelMetric  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created / verified successfully.")


async def close_db():
    """Dispose the engine connection pool. Called on app shutdown."""
    await engine.dispose()
    logger.info("🔌 Database connection pool closed.")
