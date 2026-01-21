#!/bin/bash
#
# Mesh Editor Launcher (Portable Bundle)
# Starts the content server and web player, then opens browser
#

set -e

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (relative to script directory)
WEB_PLAYER_DIR="${SCRIPT_DIR}/8i-web-player-2"
CORS_SERVER="${SCRIPT_DIR}/cors_server.py"
LOG_DIR="/tmp/mesh-editor-logs"

# Browser configuration - GPU flags for proper acceleration
BROWSER_CMD="google-chrome"
BROWSER_FLAGS="--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers"

# Content (bundled)
CONTENT_DIR="${SCRIPT_DIR}/local-content"
MANIFEST_PATH="finallyworking1201_S01_T01_v01_local/manifest.mpd"
CONTENT_NAME="finallyworking1201 (Finally Working - Bundled)"

# Default ports
WEB_PORT_START=1234
CONTENT_PORT_START=8888

# PIDs for cleanup
CONTENT_SERVER_PID=""
WEB_SERVER_PID=""

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"

    if [ -n "$CONTENT_SERVER_PID" ] && kill -0 "$CONTENT_SERVER_PID" 2>/dev/null; then
        kill "$CONTENT_SERVER_PID" 2>/dev/null || true
        echo -e "${GREEN}Content server stopped${NC}"
    fi

    if [ -n "$WEB_SERVER_PID" ] && kill -0 "$WEB_SERVER_PID" 2>/dev/null; then
        kill "$WEB_SERVER_PID" 2>/dev/null || true
        echo -e "${GREEN}Web server stopped${NC}"
    fi

    # Kill any remaining processes on our ports
    fuser -k "${WEB_PORT}/tcp" 2>/dev/null || true
    fuser -k "${CONTENT_PORT}/tcp" 2>/dev/null || true

    echo -e "${GREEN}Cleanup complete${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Find available port starting from given port
find_available_port() {
    local port=$1
    while true; do
        if ! ss -tuln | grep -q ":${port} "; then
            echo "$port"
            return
        fi
        ((port++))
    done
}

# Wait for server to be ready
wait_for_server() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=0

    echo -n "Waiting for ${name} on port ${port}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:${port}/" > /dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done

    echo -e " ${RED}TIMEOUT${NC}"
    return 1
}

# Open browser
open_browser() {
    local url=$1

    if command -v "$BROWSER_CMD" &> /dev/null; then
        $BROWSER_CMD $BROWSER_FLAGS "$url" &
    elif command -v google-chrome &> /dev/null; then
        google-chrome $BROWSER_FLAGS "$url" &
    elif command -v chromium &> /dev/null; then
        chromium $BROWSER_FLAGS "$url" &
    elif command -v chromium-browser &> /dev/null; then
        chromium-browser $BROWSER_FLAGS "$url" &
    else
        echo -e "${YELLOW}Could not detect browser. Please open: ${url}${NC}"
    fi
}

# Main
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Volumetric Mesh Editor (Portable)  ${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Bundle directory: ${SCRIPT_DIR}"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"

# Check for node_modules
if [ ! -d "${WEB_PLAYER_DIR}/node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Running npm install...${NC}"
    cd "$WEB_PLAYER_DIR"
    npm install
    cd "$SCRIPT_DIR"
fi

echo -e "${GREEN}Loading: ${CONTENT_NAME}${NC}"
echo -e "  Content: ${CONTENT_DIR}"
echo ""

# Verify content directory exists
if [ ! -d "$CONTENT_DIR" ]; then
    echo -e "${RED}Error: Content directory not found: ${CONTENT_DIR}${NC}"
    exit 1
fi

# Verify manifest exists
if [ ! -f "${CONTENT_DIR}/${MANIFEST_PATH}" ]; then
    echo -e "${RED}Error: Manifest not found: ${CONTENT_DIR}/${MANIFEST_PATH}${NC}"
    exit 1
fi

# Find available ports
echo -e "${BLUE}Finding available ports...${NC}"
WEB_PORT=$(find_available_port $WEB_PORT_START)
CONTENT_PORT=$(find_available_port $CONTENT_PORT_START)

echo -e "  Web player port: ${GREEN}${WEB_PORT}${NC}"
echo -e "  Content server port: ${GREEN}${CONTENT_PORT}${NC}"
echo ""

# Start content server
echo -e "${BLUE}Starting content server...${NC}"
python3 "$CORS_SERVER" "$CONTENT_DIR" "$CONTENT_PORT" > "${LOG_DIR}/content-server.log" 2>&1 &
CONTENT_SERVER_PID=$!
echo -e "  PID: ${CONTENT_SERVER_PID}"

# Start web player
echo -e "${BLUE}Starting web player...${NC}"
cd "$WEB_PLAYER_DIR"

# Update vite port if needed
if [ "$WEB_PORT" != "1234" ]; then
    npx vite --host 0.0.0.0 --port "$WEB_PORT" > "${LOG_DIR}/web-player.log" 2>&1 &
else
    npm start > "${LOG_DIR}/web-player.log" 2>&1 &
fi
WEB_SERVER_PID=$!
echo -e "  PID: ${WEB_SERVER_PID}"
echo ""

# Wait for servers to be ready
wait_for_server "$CONTENT_PORT" "content server" || {
    echo -e "${RED}Content server failed to start. Check ${LOG_DIR}/content-server.log${NC}"
    exit 1
}

wait_for_server "$WEB_PORT" "web player" || {
    echo -e "${RED}Web player failed to start. Check ${LOG_DIR}/web-player.log${NC}"
    exit 1
}

# Build URL with parameters
EDITOR_URL="http://localhost:${WEB_PORT}/editor.html?contentPort=${CONTENT_PORT}&manifest=${MANIFEST_PATH}"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Servers are running!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "  Editor URL: ${BLUE}${EDITOR_URL}${NC}"
echo ""
echo -e "  Content: ${MANIFEST_PATH}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Open browser
sleep 1
open_browser "$EDITOR_URL"

# Keep running until Ctrl+C
while true; do
    sleep 1

    # Check if servers are still running
    if ! kill -0 "$CONTENT_SERVER_PID" 2>/dev/null; then
        echo -e "${RED}Content server died unexpectedly${NC}"
        exit 1
    fi

    if ! kill -0 "$WEB_SERVER_PID" 2>/dev/null; then
        echo -e "${RED}Web player died unexpectedly${NC}"
        exit 1
    fi
done
