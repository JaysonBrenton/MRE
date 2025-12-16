# @fileoverview Pytest configuration and fixtures
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Shared pytest fixtures and configuration
# 
# @purpose Provides common test fixtures and setup for ingestion tests

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ingestion.db.models import Base


@pytest.fixture(scope="function")
def db_session():
    """Create a test database session."""
    # Use in-memory SQLite for testing
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)

