"""
Main module for Mindmap API.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path

from core.database import db_manager
from services.langgraph_service import get_langgraph_service

from api.user_routes import router as user_router
from api.chat_routes import router as chat_router

import logging

logger = logging.getLogger(__name__)


async def startup_event():
    """Initialize resources on startup."""
    logger.info("Initializing application resources...")

    # Startup: Initialize database and LangGraph components
    await db_manager.initialize()

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

# Include API routers BEFORE mounting static files
app.include_router(user_router, prefix="/api", tags=["users"])
app.include_router(chat_router, prefix="/api", tags=["chats"])

# Mount static files (frontend) - LAST, so it acts as a catch-all
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
else:
    logger.warning(f"Static directory not found at {static_dir}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
