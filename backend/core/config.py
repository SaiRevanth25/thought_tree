import secrets
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    # API Settings
    API_TITLE: str = "Mindmap Agent"
    API_DESCRIPTION: str = "Mindmap Agent"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = secrets.token_urlsafe(32)

    # Database Settings
    DATABASE_URL: str

    GPT_4_MINI_MODEL: str = "openai/gpt-4.1-mini-2025-04-14"
    GEMINI_MODEL: str = "google-genai/gemini-2.5-flash"

    # Models for open router
    OR_OPENAI_o3: str = "openai/o3"
    OR_GOOGLE_MODEL: str = "google/gemini-2.5-pro"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="allow"
    )

    # Env settings for logging customization
    ENV_MODE: str = "LOCAL"
    LOG_LEVEL: str = "INFO"

    # File upload settings
    MAX_UPLOAD_FILES: int = 3
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/markdown",
    ]

    # Chunking settings
    CHUNK_SIZE: int = 1000  # tokens
    CHUNK_OVERLAP: int = 200  # tokens

    # Embedding settings
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536

    # RAG settings
    TOP_K_RESULTS: int = 3
    SIMILARITY_THRESHOLD: float = 0.5


settings = Settings()
