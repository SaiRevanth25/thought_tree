FROM python:3.13-slim

# Install system dependencies
RUN apt-get update \
    && apt-get -y install gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager)
RUN pip install --no-cache-dir uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv sync

# Copy backend source code
COPY backend ./backend

# Expose backend port
EXPOSE 8000

# Set working directory to backend
WORKDIR /app/backend

# Run FastAPI app
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
