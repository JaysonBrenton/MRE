# @fileoverview Main entry point for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Uvicorn server configuration and startup
# 
# @purpose Serves the FastAPI application for ingestion operations

import os
import uvicorn

from ingestion.api.app import app
from ingestion.common.logging import configure_logging

if __name__ == "__main__":
    # Configure logging
    log_level = os.getenv("LOG_LEVEL", "INFO")
    configure_logging(log_level)
    
    # Get configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    # Run server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level.lower(),
    )

