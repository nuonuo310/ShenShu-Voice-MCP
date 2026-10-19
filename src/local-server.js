/**
 * Offline-only UI demonstration. Not an MCP endpoint and not a TTS service.
 * Hard-bind loopback. Never put this behind a public reverse proxy.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const base = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(base, '../ui/bubble-preview.html');
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' || req.url !== '/') { res.writeHead(404); res.end('not_found'); return; }
  const html = await readFile(file);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src 'self'; base-uri 'none'; form-action 'none'" });
  res.end(html);
});
server.listen(3187, '127.0.0.1', () => console.log('Preview only: http://127.0.0.1:3187'));
