# ==============================================================================
# Stage 1: Build React Frontend
# ==============================================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Python Runtime with FFmpeg
# ==============================================================================
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies: FFmpeg, fonts, and OpenCV headless runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend source code and test fixtures if needed
COPY backend/ ./backend/
COPY pytest.ini ./

# Copy compiled frontend from frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure storage directories exist and have proper permissions
RUN mkdir -p /app/backend/storage/originals \
             /app/backend/storage/thumbnails \
             /app/backend/storage/previews \
             /app/backend/storage/renders \
             /app/backend/storage/exports \
    && useradd -u 1000 -m -s /bin/bash appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
