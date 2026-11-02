// Line 01 아이콘(iconsforfree.com, CC0 1.0 — Andreas Dittes) 원본 SVG를 src/icons/line01/에 내려받는다.
//   node scripts/fetch-line01.mjs        (이미 있는 파일은 건너뜀, --force로 다시 받기)
// 빌드는 내려받은 파일만 쓰므로 네트워크 없이 재현된다. 라이선스: src/icons/line01/LICENSE.txt
import fs from "node:fs";
import path from "node:path";
import { P, fail, write } from "./lib.mjs";

const BASE = "https://iconsforfree.com";
const dir = path.join(P.icons, "line01");
const force = process.argv.includes("--force");
fs.mkdirSync(dir, { recursive: true });

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const slugs = [...new Set([...xml.matchAll(/<loc>[^<]*\/icons\/([a-z0-9-]+)\/<\/loc>/g)].map((m) => m[1]))].sort();
if (!slugs.length) fail("sitemap에서 아이콘을 찾지 못했습니다");

let got = 0, skip = 0;
const bad = [];
const queue = [...slugs];
const worker = async () => {
  for (let slug = queue.shift(); slug; slug = queue.shift()) {
    const file = path.join(dir, `${slug}.svg`);
    if (!force && fs.existsSync(file)) { skip++; continue; }
    let svg = "";
    for (let t = 0; t < 3 && !svg; t++) {
      try { const r = await fetch(`${BASE}/icons/${slug}.svg`); if (r.ok) svg = await r.text(); } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    // 받은 원본 검사: 24×24 선 아이콘 · 스크립트·이벤트·외부 참조 없음
    if (!svg || !/viewBox="0 0 24 24"/.test(svg) || /<script|\son\w+=|href=["'](?!#)|<foreignObject/i.test(svg)) { bad.push(slug); continue; }
    fs.writeFileSync(file, `${svg.trim()}\n`);
    got++;
  }
};
await Promise.all(Array.from({ length: 6 }, worker));

write(path.join(dir, "LICENSE.txt"), `Line 01 icons — https://iconsforfree.com
Author: Andreas Dittes

The original Line 01 icons are dedicated to the public domain under
CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/legalcode).
Copy, modify, distribute and use, including commercially, without asking permission.
Attribution is not required. CC0 does not grant trademark rights to the "iconsforfree" name or logo.

Source list: ${BASE}/sitemap.xml (${slugs.length} icons) · fetched ${new Date().toISOString().slice(0, 10)}
`);
console.log(`Line 01: 전체 ${slugs.length} · 받음 ${got} · 이미 있음 ${skip} · 실패 ${bad.length}${bad.length ? ` (${bad.join(", ")})` : ""}`);
if (bad.length) process.exit(1);
