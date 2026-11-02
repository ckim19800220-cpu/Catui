// 개발용 정적 서버 (의존성 없음): node scripts/serve.mjs [포트]  → http://127.0.0.1:8766/docs/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const port = Number(process.argv[2]) || 8766;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (title, body) => `<!DOCTYPE html><html lang="ko"><meta charset="utf-8"><title>${esc(title)}</title><body style="font:14px/1.7 system-ui,sans-serif;padding:24px;max-width:720px">${body}</body></html>`;

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }   // 루트 밖 접근 차단
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    // 폴더 주소는 끝에 / 를 붙여야 상대 링크가 맞는다
    if (!url.endsWith("/")) { res.writeHead(301, { Location: `${url}/` }).end(); return; }
    const index = path.join(file, "index.html");
    if (!fs.existsSync(index)) {
      // index.html이 없는 폴더(예: /docs/js/modules/)는 안의 문서 목록을 보여 준다 (개발용)
      const items = fs.readdirSync(file, { withFileTypes: true })
        .filter((e) => e.isDirectory() || e.name.endsWith(".html"))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
      const list = items.map((e) => `<li><a href="${esc(encodeURIComponent(e.name))}${e.isDirectory() ? "/" : ""}">${esc(e.name)}${e.isDirectory() ? "/" : ""}</a></li>`).join("");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" })
        .end(page(url, `<p><a href="/docs/">← 문서 처음</a></p><h1 style="font-size:18px">${esc(url)}</h1><ul>${list || "<li>비어 있음</li>"}</ul>`));
      return;
    }
    file = index;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end(page("없음", `<p>${esc(url)} 문서가 없습니다.</p><p><a href="/docs/">문서 처음으로</a></p>`)); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" }).end(data);
  });
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/docs/`));
