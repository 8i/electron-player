Volumetric Mesh Viewer - Portable Bundle
========================================

Contents:
- 8i-web-player-2/     Web application (Three.js + DASH player)
- local-content/       Bundled content (finallyworking1201, 2.8GB)
- cors_server.py       Python CORS-enabled HTTP server
- mesh-editor-launcher.sh  Launcher script

Requirements:
- Node.js (v18+) and npm
- Python 3
- Google Chrome or Chromium
- NVIDIA GPU with proper drivers for hardware acceleration

Setup:
1. Extract this bundle anywhere
2. cd mesh-viewer-bundle
3. ./mesh-editor-launcher.sh

The script will:
- Auto-install npm dependencies on first run
- Start the content server (port 8888)
- Start the web player (port 1234)
- Open Chrome with GPU acceleration flags

GPU Verification:
- Open chrome://gpu to verify hardware acceleration is enabled
- Check "WebGL" and "Hardware acceleration" show as enabled
- If using NVIDIA, ensure you have nvidia-driver and nvidia-settings installed

Troubleshooting:
- If Chrome uses CPU instead of GPU, try:
  google-chrome --ignore-gpu-blocklist --enable-gpu-rasterization --use-gl=desktop
- Check logs at /tmp/mesh-editor-logs/
