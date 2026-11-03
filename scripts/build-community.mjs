// CatuiCommunity: catui 위에 얹는 커뮤니티(게시판) 확장 — CatuiAdmin과 같은 구조
//   src/community/index.json 순서 CSS → dist/community.css · community.min.css
//   src/community/js/bundle.json 순서 JS → dist/catcommunity.js(전역, catui.js 뒤에 로드) · catcommunity.esm.js · *.min.js(+map) · catcommunity.d.ts
//   templates/community/pages/*.html → docs/community/templates/*.html (layout·menu.json으로 감싸기, 문서 빌드 뒤 실행)
//   templates/community/data/*.json → docs/community/templates/data/ (JSON 모의 데이터)
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import { transformSync } from "esbuild";
import { ROOT, P, fail, read, readJson, write, walk, pkg, bytes } from "./lib.mjs";

const C = { src: path.join(ROOT, "src/community"), tpl: path.join(ROOT, "templates/community") };
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const banner = (what) => `/*! CatuiCommunity ${what} ${pkg().version} | MIT License (c) imcatDevs | catui 위에 로드 */`;
const CLASS_ATTR = /(?<![\w-])class="([^"]+)"/g;

// ── CSS ──
export function buildCommunityCss() {
  if (!fs.existsSync(C.src)) return { css: "", min: "", defined: new Set(), byFile: {} };
  const order = readJson(path.join(C.src, "index.json"));
  const listed = new Set(order);
  for (const f of order) if (!fs.existsSync(path.join(C.src, f))) fail(`community index.json의 CSS가 없습니다: src/community/${f}`);
  const orphans = walk(path.join(C.src, "css"), ".css").map((f) => path.relative(C.src, f).replace(/\\/g, "/")).filter((f) => !listed.has(f));
  if (orphans.length) fail(`community index.json에 없는 CSS: ${orphans.join(", ")}`);
  let css = `${banner("CSS")}\n`;
  const byFile = {};
  for (const f of order) {
    const src = read(path.join(C.src, f));
    if (/#[0-9a-f]{3,8}\b/i.test(noComments(src).replace(/url\([^)]*\)/g, ""))) fail(`community CSS에 직접 쓴 색(hex)이 있습니다 — 토큰을 쓰세요: src/community/${f}`);
    css += `${src}\n`;
    byFile[`community/${f}`] = [...new Set([...noComments(src).matchAll(/\.(Catui_cm-[A-Za-z0-9_-]+)/g)].map((m) => m[1]))].sort();
  }
  // 선택자가 본체 클래스 하나뿐이면 본체를 덮어쓰는 것 — 반드시 .Catui_cm… 아래로 한정
  const topSplit = (sel) => { const out = []; let depth = 0, cur = ""; for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
  const bad = [...noComments(css).matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)]
    .flatMap((m) => topSplit(m[1]))
    .filter((s) => /^\.Catui_(?!cm)[A-Za-z0-9_-]+(?:(?::|::)[a-z-]+(?:\([^)]*\))?|\[[^\]]+\])*$/.test(s));
  if (bad.length) fail(`community.css가 본체 클래스를 단독 선택자로 다시 정의합니다(.Catui_cm 아래로 한정하세요): ${[...new Set(bad)].join(" ")}`);
  const known = new Set([...read(path.join(P.css, "foundation/tokens.css")).matchAll(/(--Catui_[A-Za-z0-9_-]+)\s*:/g), ...css.matchAll(/(--Catui_[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]));
  const unknown = [...new Set([...noComments(css).matchAll(/var\((--Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]).filter((v) => !known.has(v)))];
  if (unknown.length) fail(`community CSS가 쓰는데 정의되지 않은 토큰: ${unknown.join(" ")}`);
  const min = transform({ filename: "community.css", code: Buffer.from(css), minify: true }).code.toString();
  if (bytes(min) >= bytes(css)) fail("community.min.css가 community.css보다 작지 않습니다.");
  write(path.join(P.dist, "community.css"), css);
  write(path.join(P.dist, "community.min.css"), min);
  const defined = new Set([...noComments(css).matchAll(/\.(Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  return { css, min, defined, byFile };
}

// ── JS ──
export function buildCommunityJs(defined) {
  const dir = path.join(C.src, "js");
  if (!fs.existsSync(dir)) return null;
  const { order, exports } = readJson(path.join(dir, "bundle.json"));
  const orphans = walk(dir, ".js").map((f) => path.relative(dir, f).replace(/\\/g, "/")).filter((f) => !order.includes(f));
  if (orphans.length) fail(`community bundle.json에 없는 JS: ${orphans.join(", ")}`);
  let body = "";
  for (const f of order) {
    const full = path.join(dir, f);
    if (!fs.existsSync(full)) fail(`community JS가 없습니다: src/community/js/${f}`);
    const src = read(full)
      .replace(/^import\s.+?\sfrom\s+"[^"]+";[ \t]*\r?\n/gm, "")
      .replace(/^export\s+(const|let|function|class|async function)\s/gm, "$1 ");
    const left = src.match(/^\s*(import|export)\s.*$/m);
    if (left) fail(`번들에 남은 import/export (src/community/js/${f}): ${left[0].trim()}`);
    body += `\n// ── ${f} ──\n${src}`;
  }
  const head = banner("JS");
  const iife = `${head}
(function (global) {
"use strict";
const catui = global.catui;
if (!catui) { console.error("[CatuiCommunity]: catui.js를 먼저 불러와 주세요 — <script src=\\"catui.js\\"></script> 다음에 catcommunity.js"); return; }
${body}
})(typeof window !== "undefined" ? window : globalThis);
`;
  const esm = `${head}
import catui from "./catui.esm.js";
${body}
export { ${exports.join(", ")} };
export default community;
`;
  write(path.join(P.dist, "catcommunity.js"), iife);
  write(path.join(P.dist, "catcommunity.esm.js"), esm);
  for (const [code, file, format] of [[iife, "catcommunity.js"], [esm, "catcommunity.esm.js", "esm"]]) {
    const out = transformSync(code, { minify: true, sourcemap: "external", sourcefile: file, target: "es2020", format, legalComments: "inline", charset: "utf8" });
    const name = file.replace(/\.js$/, ".min.js");
    write(path.join(P.dist, name), `${out.code}//# sourceMappingURL=${name}.map\n`);
    const map = JSON.parse(out.map); map.file = name; map.sources = [file];
    write(path.join(P.dist, `${name}.map`), JSON.stringify(map));
  }
  const dts = path.join(ROOT, "src/types/catcommunity.d.ts");
  if (fs.existsSync(dts)) write(path.join(P.dist, "catcommunity.d.ts"), read(dts));
  const missing = new Set();
  for (const m of body.matchAll(/Catui_[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) {
    const next = body[m.index + m[0].length];
    if (body.slice(m.index - 2, m.index) === "--" || next === "$" || next === "-" || m[0].startsWith("Catui_ic-")) continue;
    if (!defined.has(m[0])) missing.add(m[0]);
  }
  if (missing.size) fail(`catcommunity.js가 쓰는데 CSS에 없는 클래스: ${[...missing].join(" ")}`);
  return { iife };
}

// ── 템플릿 ──
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ico = (name, size = 18, cls = "") => `<svg class="Catui_icon${size === 24 ? "" : ` Catui_i${size}`}${cls ? ` ${cls}` : ""}" aria-hidden="true"><use href="{{dist}}/icons.svg?v=2#Catui_ic-${name}"></use></svg>`;

function meta(src, file) {
  const m = /^\s*<!--([\s\S]*?)-->/.exec(src);
  if (!m) fail(`템플릿 머리 주석이 없습니다: ${file}`);
  const o = Object.fromEntries(m[1].split("|").map((p) => p.split(":")).filter((a) => a.length > 1).map(([k, ...v]) => [k.trim(), v.join(":").trim()]));
  if (!o.title) fail(`템플릿 title이 없습니다: ${file}`);
  return { ...o, body: src.slice(m[0].length).trim() };
}

// menu.json: { gnb: [{ title, href, page, match? }], tabs: [{ title, page, icon }], more: [{ title, href, page }] }
//   gnb  = 상단 게시판 메뉴 (href에 ?b=게시판 가능, page는 현재 위치 표시용)
//   tabs = 767px 이하 하단 탭 바
export function buildCommunityTemplates({ defined, icons, communityByFile = {} }) {
  if (!fs.existsSync(C.tpl)) return { pages: 0 };
  const menu = readJson(path.join(C.tpl, "menu.json"));
  const layouts = { site: read(path.join(C.tpl, "layout.html")), blank: read(path.join(C.tpl, "layout-blank.html")) };
  const pagesDir = path.join(C.tpl, "pages");
  const files = walk(pagesDir, ".html").map((f) => path.basename(f, ".html")).sort();
  const exists = new Set(files);
  const out = path.join(P.docs, "community/templates");
  const dist = "../../../dist";
  const errors = [];
  const used = new Set(Object.values(layouts).flatMap((l) => [...l.matchAll(CLASS_ATTR)].flatMap((m) => m[1].split(/\s+/))));
  const pageOf = (href) => href.split(/[?#]/)[0].replace(/\.html$/, "");
  const live = (list) => (list || []).filter((x) => exists.has(pageOf(x.href || `${x.page}.html`)));
  // 상단 게시판 메뉴: 현재 화면(nav: 머리 주석)과 같은 항목에 aria-current
  const gnb = (nav) => live(menu.gnb).map((it) => `<a class="Catui_cm-gnb-item" href="${esc(it.href)}"${it.tone ? ` data-tone="${Number(it.tone)}"` : ""}${it.id === nav ? ' aria-current="page"' : ""}>${esc(it.title)}</a>`).join("");
  const more = () => live(menu.more).map((it) => `<a class="Catui_dd-item" href="${esc(it.href)}">${esc(it.title)}</a>`).join("");
  const tabs = (nav) => live(menu.tabs).map((it) => `<a class="Catui_cm-tab" href="${esc(it.href)}"${it.id === nav ? ' aria-current="page"' : ""}>${ico(it.icon, 20)}<span>${esc(it.title)}</span></a>`).join("");

  for (const f of files) {
    const p = meta(read(path.join(pagesDir, `${f}.html`)), f);
    const scripts = [];
    const body = p.body.replace(/<script(?![^>]*type="application\/json")[^>]*>[\s\S]*?<\/script>\s*/g, (s) => { scripts.push(s.trim()); return ""; });
    let html = (layouts[p.layout || "site"] || fail(`없는 layout: ${p.layout} (${f})`))
      .replace(/\{\{content\}\}/g, () => body)
      .replace(/\{\{scripts\}\}/g, () => scripts.join("\n"))
      .replace(/\{\{aside\}\}/g, () => (p.aside === "none" ? "" : '<aside class="Catui_cm-aside" aria-label="인기·공지" data-catui-cm-aside></aside>'))
      .replace(/\{\{rootattrs\}\}/g, () => (p.aside === "none" ? " data-catui-cm-wide" : ""))
      .replace(/\{\{gnb\}\}/g, () => gnb(p.nav))
      .replace(/\{\{more\}\}/g, () => more())
      .replace(/\{\{tabs\}\}/g, () => tabs(p.nav))
      .replace(/\{\{title\}\}/g, esc(p.title))
      .replace(/\{\{page\}\}/g, f)
      .replace(/\{\{version\}\}/g, pkg().version)
      .replace(/\{\{icon:([a-z0-9-]+)(?::(\d+))?\}\}/g, (_, n, s) => ico(n, s ? Number(s) : 16))
      .replace(/\{\{dist\}\}/g, dist);
    const noScript = html.replace(/<script[\s\S]*?<\/script>/g, "");
    for (const m of noScript.matchAll(CLASS_ATTR)) for (const c of m[1].split(/\s+/)) if (c.startsWith("Catui_") && !defined.has(c)) errors.push(`${f}: 정의 안 된 클래스 ${c}`);
    for (const m of html.matchAll(/#Catui_ic-([a-z0-9-]+)/g)) if (!icons.includes(m[1])) errors.push(`${f}: 없는 아이콘 ${m[1]}`);
    const ids = [...noScript.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dupIds.length) errors.push(`${f}: id 중복 ${[...new Set(dupIds)].join(", ")}`);
    for (const m of noScript.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) if (!ids.includes(m[1])) errors.push(`${f}: label for="${m[1]}" 대상 없음`);
    for (const m of noScript.matchAll(/href="([a-z0-9_-]+)\.html([?#][^"]*)?"/g)) if (!exists.has(m[1])) errors.push(`${f}: 없는 템플릿 링크 ${m[1]}.html`);
    if ((noScript.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${f}: h1은 한 개여야 합니다`);
    for (const m of html.matchAll(CLASS_ATTR)) for (const c of m[1].split(/\s+/)) used.add(c);
    for (const m of html.matchAll(/Catui_cm-[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) used.add(m[0]);
    write(path.join(out, `${f}.html`), html);
  }
  const jsSrc = walk(path.join(C.src, "js"), ".js").map(read).join("\n");
  const unused = Object.values(communityByFile).flat().filter((c) => !used.has(c) && !jsSrc.includes(c));
  if (unused.length) errors.push(`템플릿·catcommunity.js 어디에도 쓰이지 않은 community 클래스: ${[...new Set(unused)].join(" ")}`);
  for (const f of walk(path.join(C.tpl, "data"), ".json")) {
    const name = path.basename(f);
    try { JSON.parse(read(f)); } catch (e) { errors.push(`data/${name}: JSON 문법 오류 — ${e.message}`); continue; }
    write(path.join(out, "data", name), read(f));
  }
  if (errors.length) fail(`community 템플릿 검사 실패\n  ${errors.join("\n  ")}`);
  return { pages: files.length };
}
