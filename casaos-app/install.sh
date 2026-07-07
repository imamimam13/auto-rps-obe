#!/bin/bash
# Auto RPS & OBE AI - Installer untuk Casa OS
# Jalankan: bash install.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Auto RPS & OBE AI - Casa OS       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Cek directory
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/.."

echo -e "${YELLOW}[1/6] Mengecek dependencies...${NC}"

# Cek Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Installing Python3...${NC}"
    sudo apt update && sudo apt install -y python3 python3-pip python3-venv
fi

# Cek Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    sudo apt install -y nodejs npm
fi

# Cek Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}[2/6] Installing Ollama...${NC}"
    curl -fsSL https://ollama.com/install.sh | sh
    sudo systemctl start ollama || ollama serve &
    sleep 2
fi

# Download model AI
echo -e "${YELLOW}[3/6] Download model AI (llama3.1:8b)...${NC}"
ollama pull llama3.1:8b &
OLLAMA_PID=$!

# Setup Backend
echo -e "${YELLOW}[4/6] Setup Backend Python...${NC}"
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q

# Buat .env jika belum ada
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || cat > .env << EOF
DATABASE_URL=sqlite+aiosqlite:///./autorps.db
REDIS_URL=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
EOF
fi

# Setup Frontend
echo -e "${YELLOW}[5/6] Setup Frontend React...${NC}"
cd ../frontend
npm install --silent

cd ..

# Tunggu Ollama selesai download
wait $OLLAMA_PID 2>/dev/null || true

# Jalankan
echo -e "${YELLOW}[6/6] Menjalankan aplikasi...${NC}"

# Kill process lama jika ada
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Backend
cd backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 9810 > /tmp/auto-rps-backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Frontend
cd frontend
nohup npm run dev -- --host 0.0.0.0 --port 9811 > /tmp/auto-rps-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 3

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  INSTALASI BERHASIL!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Frontend: ${BLUE}http://$(hostname -I | awk '{print $1}'):9811${NC}"
echo -e "  Backend:  ${BLUE}http://$(hostname -I | awk '{print $1}'):9810${NC}"
echo -e "  API Docs: ${BLUE}http://$(hostname -I | awk '{print $1}'):9810/docs${NC}"
echo ""

# Simpan PID
echo "$BACKEND_PID" > /tmp/auto-rps-backend.pid
echo "$FRONTEND_PID" > /tmp/auto-rps-frontend.pid

echo -e "  Untuk stop: ${YELLOW}kill \$(cat /tmp/auto-rps-backend.pid) \$(cat /tmp/auto-rps-frontend.pid)${NC}"
echo -e "  Untuk start lagi: jalankan script ini lagi"
echo ""
