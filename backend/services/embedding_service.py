"""Embedding service using OpenAI's text-embedding-3-small model."""

from typing import List

import structlog
from openai import AsyncOpenAI

from core.config import settings

logger = structlog.getLogger(__name__)


class EmbeddingService:
    """Service for generating embeddings using OpenAI API."""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.EMBEDDING_MODEL
        self.dimension = settings.EMBEDDING_DIMENSION

    async def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding for a single text string.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector
        """
        try:
            # Clean and truncate text if necessary
            text = text.strip()
            if not text:
                raise ValueError("Cannot embed empty text")

            response = await self.client.embeddings.create(
                model=self.model,
                input=text,
                dimensions=self.dimension,
            )

            return response.data[0].embedding

        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise

    async def embed_batch(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batches.

        Args:
            texts: List of texts to embed
            batch_size: Number of texts to embed in each API call

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        all_embeddings = []

        # Process in batches to avoid API limits
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            # Clean texts
            batch = [t.strip() for t in batch if t.strip()]

            if not batch:
                continue

            try:
                response = await self.client.embeddings.create(
                    model=self.model,
                    input=batch,
                    dimensions=self.dimension,
                )

                # Extract embeddings in order
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)

                logger.debug(
                    f"Embedded batch {i // batch_size + 1}, "
                    f"texts: {len(batch)}, total so far: {len(all_embeddings)}"
                )

            except Exception as e:
                logger.error(f"Failed to embed batch starting at index {i}: {e}")
                raise

        return all_embeddings

    def get_dimension(self) -> int:
        """Return the embedding dimension."""
        return self.dimension


# Singleton instance
embedding_service = EmbeddingService()
