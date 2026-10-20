// 涩谷雨夜的本地服务：只听 127.0.0.1，只读文件（夜版在 /night/，和 vendor 共用上一级目录）。
// 用法：node night/serve.cjs [端口]   然后打开 http://127.0.0.1:8852/night/
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..'), PORT = Number(process.argv[2]) || 8852;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.vrm': 'model/gltf-binary', '.fbx': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.md': 'text/plain; charset=utf-8' };
const inside = (t, b) => t === b || t.startsWith(b + path.sep);
http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '/night') { res.writeHead(302, { Location: '/night/' + url.search }); return res.end(); }   // (so the page's own relative paths resolve inside night/)
  if (p.endsWith('/')) p += 'index.html';
  const f = path.resolve(ROOT, '.' + p);
  if (!inside(f, ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`涩谷雨夜 http://127.0.0.1:${PORT}/night/`));
