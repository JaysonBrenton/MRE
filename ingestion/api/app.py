# @fileoverview FastAPI application for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description FastAPI app with routes and error handling
# 
# @purpose Provides REST API endpoints for ingestion operations

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ingestion.api.routes import router
from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import IngestionError

logger = get_logger(__name__)

app = FastAPI(
    title="MRE Ingestion Service",
    description="LiveRC ingestion microservice API",
    version="0.1.0",
)

# Configure CORS
# Allow specific origins from environment variable, default to localhost:3001 for development
allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.exception_handler(IngestionError)
async def ingestion_error_handler(request: Request, exc: IngestionError):
    """Handle ingestion errors."""
    logger.error(
        "ingestion_api_error",
        error_code=exc.code,
        error_source=exc.source,
        error_message=exc.message,
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=400,
        content=exc.to_dict(),
    )


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("ingestion_service_startup")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    logger.info("ingestion_service_shutdown")

