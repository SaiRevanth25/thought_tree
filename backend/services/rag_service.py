"""RAG service for similarity search using pgvector."""

from typing import List, Optional

import structlog
from pgvector.sqlalchemy import Vector
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.orm import FileChunk, FileUpload
from models.files import ChunkResult
from services.embedding_service import embedding_service

logger = structlog.getLogger(__name__)


class RAGService:
    """Service for RAG (Retrieval Augmented Generation) operations."""

    def __init__(self):
        self.top_k = settings.TOP_K_RESULTS
        self.similarity_threshold = settings.SIMILARITY_THRESHOLD

    async def search_similar_chunks(
        self,
        session: AsyncSession,
        query: str,
        thread_id: str,
        top_k: Optional[int] = None,
    ) -> List[ChunkResult]:
        """
        Search for similar chunks in a thread's uploaded files.

        Args:
            session: Database session
            query: Query text to find similar content
            thread_id: Thread ID to search within
            top_k: Number of results to return (defaults to settings.TOP_K_RESULTS)

        Returns:
            List of ChunkResult objects with similarity scores
        """
        top_k = top_k or self.top_k

        try:
            # Generate embedding for the query
            query_embedding = await embedding_service.embed_text(query)

            # Use SQLAlchemy ORM with pgvector's cosine_distance function
            # cosine_distance returns distance, so 1 - distance = similarity
            similarity_score = (
                1 - FileChunk.embedding.cosine_distance(query_embedding)
            ).label("similarity_score")

            stmt = (
                select(
                    FileChunk.id.label("chunk_id"),
                    FileChunk.file_id,
                    FileUpload.filename,
                    FileChunk.chunk_index,
                    FileChunk.text,
                    FileChunk.metadata_json,
                    similarity_score,
                )
                .join(FileUpload, FileChunk.file_id == FileUpload.id)
                .where(FileUpload.thread_id == thread_id)
                .where(FileChunk.embedding.isnot(None))
                .order_by(FileChunk.embedding.cosine_distance(query_embedding))
                .limit(top_k)
            )

            result = await session.execute(stmt)

            rows = result.fetchall()

            # Filter by similarity threshold and convert to ChunkResult
            chunks = []
            for row in rows:
                if row.similarity_score >= self.similarity_threshold:
                    chunks.append(
                        ChunkResult(
                            chunk_id=row.chunk_id,
                            file_id=row.file_id,
                            filename=row.filename,
                            chunk_index=row.chunk_index,
                            text=row.text,
                            similarity_score=float(row.similarity_score),
                            metadata=row.metadata_json,
                        )
                    )

            logger.info(
                f"Found {len(chunks)} relevant chunks for query in thread {thread_id}"
            )
            return chunks

        except Exception as e:
            logger.error(f"Failed to search similar chunks: {e}")
            raise

    async def get_context_for_query(
        self,
        session: AsyncSession,
        query: str,
        thread_id: str,
        top_k: Optional[int] = None,
    ) -> str:
        """
        Get formatted context string from similar chunks for LLM injection.

        Args:
            session: Database session
            query: Query text
            thread_id: Thread ID
            top_k: Number of chunks to retrieve

        Returns:
            Formatted context string ready for LLM system prompt
        """
        chunks = await self.search_similar_chunks(session, query, thread_id, top_k)

        if not chunks:
            return ""

        # Format chunks into a context string
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"[Source {i}: {chunk.filename} (chunk {chunk.chunk_index + 1})]"
                f"\n{chunk.text}"
            )

        context = "\n\n---\n\n".join(context_parts)

        return f"""
The following context is retrieved from the user's uploaded documents. 
Use this information to help answer the user's question or create visualizations:

{context}

---
End of retrieved context.
"""

    async def has_files_in_thread(
        self,
        session: AsyncSession,
        thread_id: str,
    ) -> bool:
        """
        Check if a thread has any uploaded files with embeddings.

        Args:
            session: Database session
            thread_id: Thread ID to check

        Returns:
            True if files exist with embeddings
        """
        stmt = (
            select(FileUpload.id)
            .where(FileUpload.thread_id == thread_id)
            .limit(1)
        )
        result = await session.scalar(stmt)
        return result is not None

    async def get_total_chunks_in_thread(
        self,
        session: AsyncSession,
        thread_id: str,
    ) -> int:
        """
        Get total number of chunks in a thread's files.

        Args:
            session: Database session
            thread_id: Thread ID

        Returns:
            Total chunk count
        """
        stmt = (
            select(func.count(FileChunk.id))
            .join(FileUpload, FileChunk.file_id == FileUpload.id)
            .where(FileUpload.thread_id == thread_id)
        )
        result = await session.scalar(stmt)
        return result or 0


# Singleton instance
rag_service = RAGService()
