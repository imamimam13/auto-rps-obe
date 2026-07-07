#!/bin/bash
# Auto RPS & OBE AI - Universal Installer
# Support: macOS & Linux
# Jalankan: bash <(curl -sL https://raw.githubusercontent.com/imamimam13/auto-rps-obe/main/install.sh)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_PORT=${BACKEND_PORT:-9810}
FRONTEND_PORT=${FRONTEND_PORT:-9811}

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Auto RPS & OBE AI - Installer      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

OS="$(uname -s)"

# Cek Python
echo -e "${YELLOW}[1/4] Cek Python & Node.js...${NC}"
if ! command -v python3 &> /dev/null; then
    echo "Installing Python3..."
    if [ "$OS" = "Darwin" ]; then brew install python@3.12
    else sudo apt update && sudo apt install -y python3 python3-pip python3-venv; fi
fi
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    if [ "$OS" = "Darwin" ]; then brew install node
    else curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs; fi
fi

# Ollama (opsional)
echo -e "${YELLOW}[2/4] Setup AI (Ollama - opsional)...${NC}"
if command -v ollama &> /dev/null; then
    ollama serve &>/dev/null &
    echo "  Ollama sudah terinstall"
else
    echo -e "  ${YELLOW}Ollama tidak ditemukan. Lewati.${NC}"
    echo "  (AI features tidak akan aktif, tapi app tetap jalan)"
fi

# Setup project
echo -e "${YELLOW}[3/4] Setup project...${NC}"
cd /tmp
rm -rf auto-rps-obe
git clone --depth 1 https://github.com/imamimam13/auto-rps-obe.git 2>/dev/null
cd auto-rps-obe

cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
cat > .env << EOF
DATABASE_URL=sqlite+aiosqlite:///./autorps.db
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
PORT=$BACKEND_PORT
EOF
cd ..

cd frontend
npm install --silent
cd ..

echo -e "${YELLOW}[4/4] Menjalankan aplikasi...${NC}"

pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

cd backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT > /tmp/auto-rps-backend.log 2>&1 &
cd ..

cd frontend
nohup npx vite --host 0.0.0.0 --port $FRONTEND_PORT > /tmp/auto-rps-frontend.log 2>&1 &
cd ..

sleep 3

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  INSTALASI BERHASIL!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Frontend: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo -e "  API Docs: ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
echo ""
echo -e "  Stop: ${YELLOW}pkill -f 'uvicorn app.main' && pkill -f 'vite'${NC}"
echo ""
