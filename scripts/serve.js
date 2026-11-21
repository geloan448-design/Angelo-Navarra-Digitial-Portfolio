// Minimal zero-dependency static file server used by Playwright and Lighthouse.
// Usage: node scripts/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Only the site's own files are served (never node_modules, tests, reports).
const BLOCKED = /^\/(node_modules|tests|scripts|test-results|playwright-report|reports)(\/|$)/;

const handler = (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || BLOCKED.test(rel)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
};

/** Start the server; resolves with { server, url }. Port 0 picks a free port. */
function start(port = 4173) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

if (require.main === module) {
  start(Number(process.argv[2] || process.env.PORT || 4173)).then(({ url }) => console.log(`Portfolio served at ${url}`));
}

module.exports = { start };
