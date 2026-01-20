"""File-related Pydantic models for file upload and RAG functionality."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class FileUploadResponse(BaseModel):
    """Response model for file upload."""

    id: str
    thread_id: str
    user_id: str
    filename: str
    file_size: int
    mime_type: str | None
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class FileListResponse(BaseModel):
    """Response model for listing files."""

    files: list[FileUploadResponse]
    total: int


class FileDeleteResponse(BaseModel):
    """Response model for file deletion."""

    success: bool
    message: str
    file_id: str


class FileUploadRequest(BaseModel):
    """Request model for file upload metadata."""

    thread_id: str = Field(..., description="Thread ID to associate the file with")


class SimilaritySearchRequest(BaseModel):
    """Request model for similarity search."""

    query: str = Field(..., description="Query text to search for similar content")
    top_k: int = Field(3, ge=1, le=10, description="Number of results to return")


class ChunkResult(BaseModel):
    """Model for a single chunk result from similarity search."""

    chunk_id: str
    file_id: str
    filename: str
    chunk_index: int
    text: str
    similarity_score: float
    metadata: dict[str, Any] | None = None


class SimilaritySearchResponse(BaseModel):
    """Response model for similarity search."""

    query: str
    results: list[ChunkResult]
    total_chunks_searched: int
