#!/bin/bash
# Auto RPS & OBE AI - Casa OS Installer
# Jalankan: bash <(curl -sL https://raw.githubusercontent.com/imamimam13/auto-rps-obe/main/casaos-app/install.sh)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

BACKEND_PORT=${BACKEND_PORT:-9810}
FRONTEND_PORT=${FRONTEND_PORT:-9811}

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Auto RPS & OBE AI - Casa OS       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}[1/4] Cek Python & Node.js...${NC}"
if ! command -v python3 &> /dev/null; then
    echo "  Instal Python3..."
    sudo apt update && sudo apt install -y python3 python3-pip python3-venv
fi
if ! command -v node &> /dev/null; then
    echo "  Instal Node.js..."
    sudo apt install -y nodejs npm
fi
echo "  ✅ Python & Node.js OK"

echo -e "${YELLOW}[2/4] Setup AI (Ollama - opsional)...${NC}"
if command -v ollama &> /dev/null; then
    ollama serve &>/dev/null &
    echo "  ✅ Ollama tersedia"
else
    echo "  ⚠️  Ollama tidak ada (AI fitur nonaktif)"
fi

echo -e "${YELLOW}[3/4] Setup project (mungkin butuh beberapa menit)...${NC}"

INSTALL_DIR="$HOME/auto-rps-obe"
if [ -d "$INSTALL_DIR" ]; then
    echo "  Update project..."
    cd "$INSTALL_DIR" && git pull 2>/dev/null || true
else
    echo "  Clone repo..."
    git clone --depth 1 https://github.com/imamimam13/auto-rps-obe.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

echo "  Setup backend (install Python packages)..."
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || true
pip install -r requirements.txt 2>&1
if [ ! -f .env ]; then
cat > .env << EOF
DATABASE_URL=sqlite+aiosqlite:///./autorps.db
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
PORT=$BACKEND_PORT
EOF
else
    echo "  .env sudah ada, mempertahankan konfigurasi..."
fi
cd ..

echo "  Setup frontend..."
cd frontend
npm install 2>&1 | tail -3
cd ..

echo -e "${YELLOW}[4/4] Menjalankan aplikasi...${NC}"
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

cd backend
source venv/bin/activate 2>/dev/null || true
nohup uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT > /tmp/auto-rps-backend.log 2>&1 &
BACKEND_PID=$!
cd ..

cd frontend
nohup npx vite --host 0.0.0.0 --port $FRONTEND_PORT > /tmp/auto-rps-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 3
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP" ] && IP="localhost"

if kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅  INSTALASI BERHASIL!            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Frontend: ${BLUE}http://$IP:$FRONTEND_PORT${NC}"
    echo -e "  Backend:  ${BLUE}http://$IP:$BACKEND_PORT${NC}"
    echo -e "  API Docs: ${BLUE}http://$IP:$BACKEND_PORT/docs${NC}"
    echo ""
    echo -e "  Folder: $INSTALL_DIR"
    echo -e "  Stop: ${YELLOW}pkill -f 'uvicorn app.main' && pkill -f 'vite'${NC}"
else
    echo ""
    echo -e "${RED}╔══════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌  GAGAL - Cek log di bawah       ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Backend:  ${YELLOW}cat /tmp/auto-rps-backend.log${NC}"
    echo -e "  Frontend: ${YELLOW}cat /tmp/auto-rps-frontend.log${NC}"
fi
echo ""
