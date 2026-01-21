const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.mpd': 'application/dash+xml',
  '.m4s': 'video/iso.segment',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.draco': 'application/octet-stream'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function createContentServer(contentDir, port) {
  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.setHeader('Cache-Control', 'no-cache');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Parse URL and decode
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(contentDir, urlPath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(contentDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Check if file exists
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (stats.isDirectory()) {
        res.writeHead(403);
        res.end('Directory listing not allowed');
        return;
      }

      const contentType = getMimeType(filePath);
      const fileSize = stats.size;

      // Handle range requests for streaming
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes'
        });

        if (req.method === 'HEAD') {
          res.end();
        } else {
          fs.createReadStream(filePath).pipe(res);
        }
      }
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Content server running at http://127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}`);
      server.listen(port + 1, '127.0.0.1');
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
}

function createWebServer(webDir, port) {
  const server = http.createServer((req, res) => {
    // Parse URL and decode
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(webDir, urlPath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(webDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Check if file exists
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (stats.isDirectory()) {
        res.writeHead(403);
        res.end('Directory listing not allowed');
        return;
      }

      const contentType = getMimeType(filePath);

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Web server running at http://127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}`);
      server.listen(port + 1, '127.0.0.1');
    } else {
      console.error('Web server error:', err);
    }
  });

  return server;
}

module.exports = { createContentServer, createWebServer };
