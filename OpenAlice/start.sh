#!/bin/bash
# WB-Quant startup script
# Starts both the Python sidecar and the Node.js main process

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  if [ -n "$SIDECAR_PID" ]; then
    kill "$SIDECAR_PID" 2>/dev/null || true
    wait "$SIDECAR_PID" 2>/dev/null || true
  fi
  if [ -n "$NODE_PID" ]; then
    kill "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
  fi
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start Python sidecar
echo -e "${GREEN}Starting AKShare sidecar on :5100...${NC}"
cd sidecar
python3 app.py &
SIDECAR_PID=$!
cd ..

# Wait for sidecar to be ready
for i in $(seq 1 10); do
  if curl -s http://localhost:5100/health > /dev/null 2>&1; then
    echo -e "${GREEN}Sidecar ready.${NC}"
    break
  fi
  sleep 1
done

# Start Node.js main process
echo -e "${GREEN}Starting OpenAlice engine...${NC}"
pnpm dev &
NODE_PID=$!

echo -e "${GREEN}WB-Quant is running.${NC}"
echo "  Sidecar PID: $SIDECAR_PID"
echo "  Node PID:    $NODE_PID"
echo "Press Ctrl+C to stop."

wait
