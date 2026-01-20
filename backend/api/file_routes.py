"""File upload endpoints for RAG functionality."""

from typing import List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from core.config import settings
from core.orm import (
    FileUpload as FileUploadORM,
    FileChunk as FileChunkORM,
    Thread as ThreadORM,
    User,
    get_session,
)
from models.files import (
    FileUploadResponse,
    FileListResponse,
    FileDeleteResponse,
    SimilaritySearchRequest,
    SimilaritySearchResponse,
)
from services.file_processor import file_processor
from services.embedding_service import embedding_service
from services.rag_service import rag_service
from utils.user_utils import get_current_user

router = APIRouter()
logger = structlog.getLogger(__name__)


@router.post("/files/upload", response_model=List[FileUploadResponse])
async def upload_files(
    thread_id: str = Form(...),
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Upload files to a thread for RAG functionality.

    - Maximum 3 files per thread
    - Maximum 10MB per file
    - Supported formats: PDF, TXT, DOCX, MD
    """
    # Validate thread exists and belongs to user
    stmt = select(ThreadORM).where(
        ThreadORM.thread_id == thread_id,
        ThreadORM.user_id == user.user_id,
    )
    thread = await session.scalar(stmt)
    if not thread:
        raise HTTPException(404, f"Thread '{thread_id}' not found")

    # Check existing file count
    existing_count_stmt = select(func.count(FileUploadORM.id)).where(
        FileUploadORM.thread_id == thread_id
    )
    existing_count = await session.scalar(existing_count_stmt) or 0

    if existing_count + len(files) > settings.MAX_UPLOAD_FILES:
        raise HTTPException(
            400,
            f"Maximum {settings.MAX_UPLOAD_FILES} files per thread. "
            f"Currently have {existing_count}, trying to add {len(files)}.",
        )

    # Validate files
    max_size_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    for file in files:
        # Check MIME type
        if file.content_type not in settings.ALLOWED_MIME_TYPES:
            raise HTTPException(
                400,
                f"Unsupported file type: {file.content_type}. "
                f"Supported types: PDF, TXT, DOCX, MD",
            )

        # Check file size by reading content
        content = await file.read()
        await file.seek(0)  # Reset for later reading

        if len(content) > max_size_bytes:
            raise HTTPException(
                413,
                f"File '{file.filename}' exceeds maximum size of {settings.MAX_FILE_SIZE_MB}MB",
            )

    uploaded_files = []

    for file in files:
        try:
            # Check if file already exists in thread
            existing_stmt = select(FileUploadORM).where(
                FileUploadORM.thread_id == thread_id,
                FileUploadORM.filename == file.filename,
            )
            existing_file = await session.scalar(existing_stmt)
            if existing_file:
                # Delete existing file and its chunks
                await session.execute(
                    delete(FileChunkORM).where(FileChunkORM.file_id == existing_file.id)
                )
                await session.execute(
                    delete(FileUploadORM).where(FileUploadORM.id == existing_file.id)
                )
                await session.commit()
                logger.info(f"Replaced existing file: {file.filename}")

            # Read file content
            content = await file.read()
            file_size = len(content)

            # Extract text from file
            logger.info(f"Extracting text from {file.filename}")
            text = await file_processor.extract_text(content, file.content_type)

            if not text.strip():
                raise HTTPException(
                    422, f"Could not extract any text from '{file.filename}'"
                )

            # Chunk the text
            logger.info(f"Chunking text from {file.filename}")
            chunks = file_processor.chunk_text(text)

            if not chunks:
                raise HTTPException(
                    422, f"Could not create chunks from '{file.filename}'"
                )

            # Generate embeddings for all chunks
            logger.info(f"Generating embeddings for {len(chunks)} chunks")
            embeddings = await embedding_service.embed_batch(chunks)

            # Create file record
            file_id = str(uuid4())
            file_orm = FileUploadORM(
                id=file_id,
                thread_id=thread_id,
                user_id=user.user_id,
                filename=file.filename,
                file_size=file_size,
                mime_type=file.content_type,
                chunk_count=len(chunks),
            )
            session.add(file_orm)
            # Flush to ensure the file record exists before adding chunks (for FK constraint)
            await session.flush()

            # Create chunk records with embeddings
            for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_orm = FileChunkORM(
                    id=str(uuid4()),
                    file_id=file_id,
                    chunk_index=i,
                    text=chunk_text,
                    embedding=embedding,
                    metadata_json={
                        "filename": file.filename,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "token_count": file_processor.count_tokens(chunk_text),
                    },
                )
                session.add(chunk_orm)

            await session.commit()
            await session.refresh(file_orm)

            uploaded_files.append(
                FileUploadResponse(
                    id=file_orm.id,
                    thread_id=file_orm.thread_id,
                    user_id=file_orm.user_id,
                    filename=file_orm.filename,
                    file_size=file_orm.file_size,
                    mime_type=file_orm.mime_type,
                    chunk_count=file_orm.chunk_count,
                    created_at=file_orm.created_at,
                )
            )

            logger.info(
                f"Successfully uploaded {file.filename}: "
                f"{file_orm.chunk_count} chunks, {file_size} bytes"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to process file {file.filename}: {e}")
            await session.rollback()
            raise HTTPException(500, f"Failed to process file '{file.filename}': {str(e)}")

    return uploaded_files


@router.get("/files/{thread_id}", response_model=FileListResponse)
async def list_files(
    thread_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all files uploaded to a thread."""
    # Validate thread exists and belongs to user
    stmt = select(ThreadORM).where(
        ThreadORM.thread_id == thread_id,
        ThreadORM.user_id == user.user_id,
    )
    thread = await session.scalar(stmt)
    if not thread:
        raise HTTPException(404, f"Thread '{thread_id}' not found")

    # Get files
    files_stmt = (
        select(FileUploadORM)
        .where(FileUploadORM.thread_id == thread_id)
        .order_by(FileUploadORM.created_at.desc())
    )
    result = await session.execute(files_stmt)
    files = result.scalars().all()

    return FileListResponse(
        files=[
            FileUploadResponse(
                id=f.id,
                thread_id=f.thread_id,
                user_id=f.user_id,
                filename=f.filename,
                file_size=f.file_size,
                mime_type=f.mime_type,
                chunk_count=f.chunk_count,
                created_at=f.created_at,
            )
            for f in files
        ],
        total=len(files),
    )


@router.delete("/files/{file_id}", response_model=FileDeleteResponse)
async def delete_file(
    file_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete an uploaded file and its chunks."""
    # Get file and verify ownership
    stmt = select(FileUploadORM).where(
        FileUploadORM.id == file_id,
        FileUploadORM.user_id == user.user_id,
    )
    file = await session.scalar(stmt)
    if not file:
        raise HTTPException(404, f"File '{file_id}' not found")

    filename = file.filename

    # Delete chunks first (cascade should handle this, but be explicit)
    await session.execute(
        delete(FileChunkORM).where(FileChunkORM.file_id == file_id)
    )

    # Delete file record
    await session.execute(
        delete(FileUploadORM).where(FileUploadORM.id == file_id)
    )

    await session.commit()

    logger.info(f"Deleted file {filename} (id: {file_id})")

    return FileDeleteResponse(
        success=True,
        message=f"File '{filename}' deleted successfully",
        file_id=file_id,
    )


@router.post("/files/{thread_id}/search", response_model=SimilaritySearchResponse)
async def search_files(
    thread_id: str,
    request: SimilaritySearchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Search for similar content in thread's uploaded files."""
    # Validate thread exists and belongs to user
    stmt = select(ThreadORM).where(
        ThreadORM.thread_id == thread_id,
        ThreadORM.user_id == user.user_id,
    )
    thread = await session.scalar(stmt)
    if not thread:
        raise HTTPException(404, f"Thread '{thread_id}' not found")

    # Check if thread has files
    has_files = await rag_service.has_files_in_thread(session, thread_id)
    if not has_files:
        return SimilaritySearchResponse(
            query=request.query,
            results=[],
            total_chunks_searched=0,
        )

    # Search for similar chunks
    results = await rag_service.search_similar_chunks(
        session, request.query, thread_id, request.top_k
    )

    total_chunks = await rag_service.get_total_chunks_in_thread(session, thread_id)

    return SimilaritySearchResponse(
        query=request.query,
        results=results,
        total_chunks_searched=total_chunks,
    )
