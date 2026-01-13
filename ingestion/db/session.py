# @fileoverview Database session management for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description SQLAlchemy session factory and connection pooling
# 
# @purpose Provides database session management with connection pooling
#          and proper lifecycle handling for the ingestion service.

import os
from contextlib import contextmanager
from typing import Generator
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from ingestion.db.models import Base


# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Parse URL to extract SQLAlchemy-specific parameters
# These parameters (connection_limit, pool_timeout) are not valid psycopg2 DSN options
# and need to be extracted and passed separately to create_engine()
parsed = urlparse(DATABASE_URL)
query_params = parse_qs(parsed.query)

# Extract SQLAlchemy engine parameters from query string
# connection_limit is not a valid SQLAlchemy parameter - pool_size handles this
# pool_timeout is a valid SQLAlchemy parameter
pool_timeout = None

if "connection_limit" in query_params:
    # connection_limit is not a valid psycopg2 or SQLAlchemy parameter
    # Remove it from query params (pool_size already handles connection limits)
    del query_params["connection_limit"]

if "pool_timeout" in query_params:
    pool_timeout = int(query_params["pool_timeout"][0])
    # Remove from query params so it's not in the URL
    del query_params["pool_timeout"]

# Reconstruct URL without the SQLAlchemy-specific parameters
clean_query = urlencode(query_params, doseq=True)
clean_url = urlunparse((
    parsed.scheme,
    parsed.netloc,
    parsed.path,
    parsed.params,
    clean_query,
    parsed.fragment
))

# Create engine with connection pooling
# Pool size and max overflow are configurable via environment variables
pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))

# Build engine kwargs
engine_kwargs = {
    "pool_size": pool_size,
    "max_overflow": max_overflow,
    "pool_pre_ping": True,  # Verify connections before using
    "echo": False,  # Set to True for SQL debugging
}

# Add pool_timeout if it was in the URL
if pool_timeout is not None:
    engine_kwargs["pool_timeout"] = pool_timeout

engine = create_engine(clean_url, **engine_kwargs)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function for FastAPI to get database session.
    
    Yields:
        Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    
    Usage:
        with db_session() as session:
            # Use session
            pass
    
    Yields:
        Database session
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Initialize database tables (create if they don't exist)."""
    Base.metadata.create_all(bind=engine)

