#!/usr/bin/env bash
# ==============================================================================
# Jovyx Shorts Factory Startup Script (Arch Linux)
# ==============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

echo "⚡ Starting Jovyx Shorts Factory..."

# 1. Check Python virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment in $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

# 2. Check / Build Frontend if needed or run in dev mode
MODE="${1:-prod}"

if [ "$MODE" == "--dev" ] || [ "$MODE" == "dev" ]; then
    echo "Starting in DEVELOPMENT mode (Vite dev server + FastAPI backend)..."
    # Start FastAPI backend in background
    "$VENV_DIR/bin/uvicorn" app.main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    
    # Start Vite frontend
    cd "$FRONTEND_DIR"
    npm run dev &
    FRONTEND_PID=$!
    
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
    echo "Backend:  http://localhost:8000"
    echo "Frontend: http://localhost:5173"
    wait
else
    # Check if frontend is built
    if [ ! -d "$FRONTEND_DIR/dist" ]; then
        echo "Building frontend production bundle..."
        cd "$FRONTEND_DIR"
        npm install
        npm run build
        cd "$PROJECT_DIR"
    fi

    echo "🚀 Starting server at http://localhost:8000"
    echo "Press Ctrl+C to stop."
    exec "$VENV_DIR/bin/uvicorn" app.main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port 8000
fi
