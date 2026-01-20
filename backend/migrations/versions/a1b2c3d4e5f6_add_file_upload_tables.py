"""Add file upload and chunk tables with pgvector

Revision ID: a1b2c3d4e5f6
Revises: 7694fe2276c8
Create Date: 2026-01-20 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "7694fe2276c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create file_upload table
    op.create_table(
        "file_upload",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "thread_id",
            sa.Text(),
            sa.ForeignKey("thread.thread_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Text(),
            sa.ForeignKey("user.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), default=0),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # Create file_chunk table with vector column
    op.create_table(
        "file_chunk",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "file_id",
            sa.Text(),
            sa.ForeignKey("file_upload.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes for file_upload
    op.create_index("idx_file_upload_thread", "file_upload", ["thread_id"])
    op.create_index("idx_file_upload_user", "file_upload", ["user_id"])
    op.create_index(
        "idx_file_upload_unique",
        "file_upload",
        ["thread_id", "filename"],
        unique=True,
    )

    # Create indexes for file_chunk
    op.create_index("idx_file_chunk_file", "file_chunk", ["file_id"])
    op.create_index(
        "idx_file_chunk_unique",
        "file_chunk",
        ["file_id", "chunk_index"],
        unique=True,
    )

    # Create IVFFlat index for vector similarity search
    # This index is optimized for cosine similarity
    op.execute(
        """
        CREATE INDEX idx_file_chunk_embedding 
        ON file_chunk 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("idx_file_chunk_embedding", table_name="file_chunk")
    op.drop_index("idx_file_chunk_unique", table_name="file_chunk")
    op.drop_index("idx_file_chunk_file", table_name="file_chunk")
    op.drop_index("idx_file_upload_unique", table_name="file_upload")
    op.drop_index("idx_file_upload_user", table_name="file_upload")
    op.drop_index("idx_file_upload_thread", table_name="file_upload")

    # Drop tables
    op.drop_table("file_chunk")
    op.drop_table("file_upload")

    # Note: We don't drop the vector extension as other tables might use it
