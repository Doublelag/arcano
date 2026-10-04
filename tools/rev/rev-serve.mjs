// Servidor estático mínimo para probar cookie y service worker (file:// no tiene ninguno de los dos).
// Uso: node tools/rev/rev-serve.mjs <puerto> ; la carpeta servida se cambia con GET /__root?dir=<ruta absoluta>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const PORT = +process.argv[2] || 8453;
let root = process.argv[3] || 'E:/PROYECTOS/arcano/public';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const block = new Set();
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__root') { root = u.searchParams.get('dir'); res.end('root=' + root); return; }
  if (u.pathname === '/__block') { const f = u.searchParams.get('f'); if (u.searchParams.get('on') === '1') block.add(f); else block.delete(f); res.end('block=' + [...block]); return; }
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const name = p.slice(1);
  if (block.has(name)) { res.statusCode = 404; res.end('blocked'); return; }
  const f = path.join(root, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.statusCode = 404; res.end('nf'); return; }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  });
}).listen(PORT, () => console.log('serving', root, 'on', PORT));
