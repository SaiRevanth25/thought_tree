"""
Main module for Mindmap API.
"""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import sentry_sdk

from core.database import db_manager
from services.langgraph_service import get_langgraph_service

from api.user_routes import router as user_router
from api.chat_routes import router as chat_router
from api.file_routes import router as file_router

import logging

logger = logging.getLogger(__name__)

# Static files directory (built frontend)
STATIC_DIR = Path(__file__).parent / "static"


async def startup_event():
    """Initialize resources on startup."""
    logger.info("Initializing application resources...")

    # Startup: Initialize database and LangGraph components
    await db_manager.initialize()

    sentry_sdk.init(
        dsn="https://5abcd86bc88e67c95c74bb4fcfab2b18@o4510726618939392.ingest.us.sentry.io/4510726621626368",
        # Add data like request headers and IP for users,
        # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
        send_default_pii=True,
        # Enable sending logs to Sentry
        enable_logs=True,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for tracing.
        traces_sample_rate=1.0,
        # Set profile_session_sample_rate to 1.0 to profile 100%
        # of profile sessions.
        profile_session_sample_rate=1.0,
        # Set profile_lifecycle to "trace" to automatically
        # run the profiler on when there is an active transaction
        profile_lifecycle="trace",
    )

    langgraph_service = get_langgraph_service()
    await langgraph_service.initialize()


async def shutdown_event():
    """Cleanup resources on shutdown."""
    logger.info("Shutting down application...")

    await db_manager.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    # Startup event
    await startup_event()

    yield

    # Shutdown event
    await shutdown_event()


app = FastAPI(title="Mindmap Agent", lifespan=lifespan)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
def health():
    return {"status": "ok"}

# Include API routers
app.include_router(user_router, prefix="/api", tags=["users"])
app.include_router(chat_router, prefix="/api", tags=["chats"])
app.include_router(file_router, prefix="/api", tags=["files"])

# Serve static frontend files in production
if STATIC_DIR.exists():
    logger.info(f"Static directory found at {STATIC_DIR}, mounting frontend files")
    
    # Mount static assets (JS, CSS, images)
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    # Catch-all route for SPA - must be after API routes
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the SPA for all non-API routes."""
        # Check if it's a static file request
        static_file = STATIC_DIR / full_path
        if static_file.exists() and static_file.is_file():
            return FileResponse(static_file)
        # Return index.html for client-side routing
        index_html = STATIC_DIR / "index.html"
        if index_html.exists():
            return FileResponse(index_html)
        # Fallback if index.html doesn't exist
        logger.error(f"Static files not found. Expected directory: {STATIC_DIR}")
        return {"error": "Frontend not built. Run 'npm run build' in the frontend directory."}
else:
    logger.warning(f"Static directory not found at {STATIC_DIR}. Frontend will not be served.")
    
    @app.get("/{full_path:path}")
    async def frontend_not_available(request: Request, full_path: str):
        """Fallback when frontend is not built."""
        return {
            "error": "Frontend not available",
            "message": "Frontend files not found. Make sure to build the frontend and copy to backend/static",
            "expected_path": str(STATIC_DIR)
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
