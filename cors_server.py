#!/usr/bin/env python3
"""Simple HTTP server with CORS headers for local development."""

import http.server
import socketserver
import os
import sys

DIRECTORY = sys.argv[1] if len(sys.argv) > 1 else "."
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8888

# Use ThreadingMixIn for concurrent request handling (required for DASH streaming)
class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True  # Don't block on exit

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    # Add proper MIME types for DASH content
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.mpd': 'application/dash+xml',
        '.m4s': 'video/iso.segment',
        '.m3u8': 'application/vnd.apple.mpegurl',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with ThreadingHTTPServer(("0.0.0.0", PORT), CORSRequestHandler) as httpd:
        print(f"Serving {DIRECTORY} at http://0.0.0.0:{PORT} (multi-threaded)")
        httpd.serve_forever()
