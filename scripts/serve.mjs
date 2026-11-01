// 개발용 정적 서버 (의존성 없음): node scripts/serve.mjs [포트]  → http://127.0.0.1:8766/docs/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const port = Number(process.argv[2]) || 8766;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }   // 루트 밖 접근 차단
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("없음"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" }).end(data);
  });
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/docs/`));
