# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and config
COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig.json ./
COPY frontend/tsconfig.node.json ./
COPY frontend/public ./public

# Build frontend
RUN npm run build

# Stage 2: Backend with Frontend Assets
FROM python:3.13-slim

RUN apt-get update \
    && apt-get -y install libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Set the working directory
WORKDIR /app

# Copy Python dependencies
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv sync

# Copy backend code
COPY backend ./backend

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/build ./backend/static

# Expose the port
EXPOSE 8000

# Set working directory to backend for running the app
WORKDIR /app/backend

# Command to run the app
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
