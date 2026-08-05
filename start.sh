#!/bin/bash
# Simple Auto RPS & OBE AI Start Script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=${BACKEND_PORT:-9810}
FRONTEND_PORT=${FRONTEND_PORT:-9811}

echo "Stopping existing services..."
pkill -9 -f "uvicorn app.main" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
sleep 2

# Resolve absolute Python binary
PY_BIN=""
if [ -f "$ROOT_DIR/backend/venv/bin/python3" ]; then
    PY_BIN="$ROOT_DIR/backend/venv/bin/python3"
elif [ -f "$ROOT_DIR/backend/venv/bin/python" ]; then
    PY_BIN="$ROOT_DIR/backend/venv/bin/python"
elif [ -f "$ROOT_DIR/backend/.venv/bin/python3" ]; then
    PY_BIN="$ROOT_DIR/backend/.venv/bin/python3"
elif [ -f "$ROOT_DIR/backend/.venv/bin/python" ]; then
    PY_BIN="$ROOT_DIR/backend/.venv/bin/python"
else
    PY_BIN="$(command -v python3)"
fi

echo "Starting Backend on port $BACKEND_PORT using $PY_BIN..."
cd "$ROOT_DIR/backend"
nohup "$PY_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT > /tmp/auto-rps-backend.log 2>&1 &
BACKEND_PID=$!

echo "Building Frontend for production..."
cd "$ROOT_DIR/frontend"
npx vite build 2>&1 || echo "⚠️  Build gagal, memakai dist lama jika ada"

echo "Starting Frontend on port $FRONTEND_PORT..."
nohup npx vite preview --host 0.0.0.0 --port $FRONTEND_PORT > /tmp/auto-rps-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3

if kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✅ Aplikasi berhasil dinyalakan!"
    echo "Backend:  http://localhost:$BACKEND_PORT"
    echo "Frontend: http://localhost:$FRONTEND_PORT"
else
    echo "❌ Gagal menyalakan aplikasi. Log backend:"
    tail -n 15 /tmp/auto-rps-backend.log 2>/dev/null || true
fi
