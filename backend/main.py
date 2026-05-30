"""
SentriQ — FastAPI Application Entry Point

Production-grade backend for real-time credit card fraud detection.
Configures CORS, registers all route groups, initializes the ML model,
database, and background scheduler via a lifespan context manager.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load environment variables before anything else
load_dotenv()

# ─── Logging ───
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fraudguard")


# ─── Lifespan Context Manager ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown lifecycle for the FastAPI application.

    Startup:
        1. Initialize database tables
        2. Load ML model (or create mock fallback)
        3. Start APScheduler background jobs

    Shutdown:
        1. Stop APScheduler
        2. Close database connection pool
    """
    logger.info("=" * 60)
    logger.info("🚀 SentriQ — Starting up...")
    logger.info("=" * 60)

    # 1. Initialize database
    from db.database import init_db, close_db
    await init_db()

    # 2. Load ML model
    from services.model_service import model_service
    model_service.load()

    # 3. Start scheduler
    from services.scheduler import scheduler_service
    scheduler_service.start()

    logger.info("=" * 60)
    logger.info("✅ SentriQ — All systems online!")
    logger.info("=" * 60)

    yield

    # Shutdown
    logger.info("🛑 SentriQ — Shutting down...")
    scheduler_service.stop()
    await close_db()
    logger.info("👋 SentriQ — Goodbye!")


# ─── FastAPI App ───

app = FastAPI(
    title="SentriQ API",
    description=(
        "Production-grade REST API for real-time credit card fraud detection. "
        "Powered by XGBoost ML inference, PostgreSQL persistence, JWT authentication, "
        "and Evidently AI drift monitoring."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ─── CORS Middleware ───

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request ID Middleware ───

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Inject a unique request_id into every request for tracing."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ─── Global Exception Handler ───

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Wrap all HTTP exceptions in the standard JSON envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_code": f"HTTP_{exc.status_code}",
            "detail": exc.detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": "INTERNAL_SERVER_ERROR",
            "detail": "An unexpected error occurred. Please try again later.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
        },
    )


# ─── Register Routers ───

from routes.auth import router as auth_router
from routes.predict import router as predict_router
from routes.stats import router as stats_router
from routes.transactions import router as transactions_router
from routes.model import router as model_router

app.include_router(auth_router)
app.include_router(predict_router)
app.include_router(stats_router)
app.include_router(transactions_router)
app.include_router(model_router)


# ─── Root Health Check ───

@app.get(
    "/",
    tags=["System"],
    summary="API root health check",
    description="Returns a simple health check confirming the API is running.",
)
async def root():
    """Root endpoint — confirms the API is live."""
    return {
        "success": True,
        "data": {
            "service": "SentriQ API",
            "version": "1.0.0",
            "status": "online",
            "docs": "/docs",
        },
        "message": "SentriQ API is running.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Uvicorn Entry Point ───

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        loop="asyncio",
    )
