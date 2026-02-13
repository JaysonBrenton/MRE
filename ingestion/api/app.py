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
from pydantic import ValidationError

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
    allow_methods=["GET", "POST", "OPTIONS"],  # Only required methods
    allow_headers=["Content-Type", "Authorization"],  # Only required headers
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


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors."""
    logger.error(
        "validation_error",
        errors=exc.errors(),
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(TimeoutError)
async def timeout_error_handler(request: Request, exc: TimeoutError):
    """Handle timeout errors."""
    logger.error(
        "timeout_error",
        error_message=str(exc),
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=504,
        content={
            "error": {
                "code": "TIMEOUT_ERROR",
                "message": "Request timed out",
                "details": {"message": str(exc)},
            }
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    logger.error(
        "unexpected_error",
        error_type=type(exc).__name__,
        error_message=str(exc),
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("ingestion_service_startup")
    # Start ingestion queue workers when queue mode is enabled
    from ingestion.api.job_queue import is_queue_enabled, start_workers
    if is_queue_enabled():
        start_workers(num_workers=1)
        logger.info("ingestion_queue_enabled", workers=1)


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    logger.info("ingestion_service_shutdown")

