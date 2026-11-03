// CatuiAdmin: catui 위에 얹는 관리자 확장
//   src/admin/index.json 순서 CSS → dist/admin.css · admin.min.css
//   src/admin/js/bundle.json 순서 JS → dist/catadmin.js(전역, catui.js 뒤에 로드) · catadmin.esm.js · *.min.js(+map) · catadmin.d.ts
//   templates/admin/pages/*.html → docs/admin/templates/*.html (layout·menu.json으로 감싸기, 문서 빌드 뒤 실행)
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import { transformSync } from "esbuild";
import { ROOT, P, fail, read, readJson, write, walk, pkg, bytes } from "./lib.mjs";

const A = { src: path.join(ROOT, "src/admin"), tpl: path.join(ROOT, "templates/admin") };
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const banner = (what) => `/*! CatuiAdmin ${what} ${pkg().version} | MIT License (c) imcatDevs | catui 위에 로드 */`;

// ── CSS ──
export function buildAdminCss() {
  const order = readJson(path.join(A.src, "index.json"));
  const listed = new Set(order);
  for (const f of order) if (!fs.existsSync(path.join(A.src, f))) fail(`admin index.json의 CSS가 없습니다: src/admin/${f}`);
  const orphans = walk(path.join(A.src, "css"), ".css").map((f) => path.relative(A.src, f).replace(/\\/g, "/")).filter((f) => !listed.has(f));
  if (orphans.length) fail(`admin index.json에 없는 CSS: ${orphans.join(", ")}`);
  let css = `${banner("CSS")}\n`;
  const byFile = {};
  for (const f of order) {
    const src = read(path.join(A.src, f));
    if (/#[0-9a-f]{3,8}\b/i.test(noComments(src).replace(/url\([^)]*\)/g, ""))) fail(`admin CSS에 직접 쓴 색(hex)이 있습니다 — 토큰을 쓰세요: src/admin/${f}`);
    css += `${src}\n`;
    byFile[`admin/${f}`] = [...new Set([...noComments(src).matchAll(/\.(Catui_adm-[A-Za-z0-9_-]+)/g)].map((m) => m[1]))].sort();
  }
  // 선택자가 본체 클래스 하나뿐(예: ".Catui_side{…}")이면 본체를 덮어쓰는 것 — 반드시 .Catui_adm… 아래로 한정
  const topSplit = (sel) => { const out = []; let depth = 0, cur = ""; for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
  const bad = [...noComments(css).matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)]
    .flatMap((m) => topSplit(m[1]))
    .filter((s) => /^\.Catui_(?!adm)[A-Za-z0-9_-]+(?:(?::|::)[a-z-]+(?:\([^)]*\))?|\[[^\]]+\])*$/.test(s));
  if (bad.length) fail(`admin.css가 본체 클래스를 단독 선택자로 다시 정의합니다(.Catui_adm 아래로 한정하세요): ${[...new Set(bad)].join(" ")}`);
  // 쓰는 토큰은 본체 tokens.css 또는 admin 토큰(admin CSS 안의 선언)에 있어야 한다
  const known = new Set([...read(path.join(P.css, "foundation/tokens.css")).matchAll(/(--Catui_[A-Za-z0-9_-]+)\s*:/g), ...css.matchAll(/(--Catui_[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]));
  const unknown = [...new Set([...noComments(css).matchAll(/var\((--Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]).filter((v) => !known.has(v)))];
  if (unknown.length) fail(`admin CSS가 쓰는데 정의되지 않은 토큰: ${unknown.join(" ")}`);
  const min = transform({ filename: "admin.css", code: Buffer.from(css), minify: true }).code.toString();
  if (bytes(min) >= bytes(css)) fail("admin.min.css가 admin.css보다 작지 않습니다.");
  write(path.join(P.dist, "admin.css"), css);
  write(path.join(P.dist, "admin.min.css"), min);
  const defined = new Set([...noComments(css).matchAll(/\.(Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  return { css, min, defined, byFile };
}

// ── JS ──
export function buildAdminJs(defined) {
  const dir = path.join(A.src, "js");
  const { order, exports } = readJson(path.join(dir, "bundle.json"));
  const orphans = walk(dir, ".js").map((f) => path.relative(dir, f).replace(/\\/g, "/")).filter((f) => !order.includes(f));
  if (orphans.length) fail(`admin bundle.json에 없는 JS: ${orphans.join(", ")}`);
  let body = "";
  for (const f of order) {
    const full = path.join(dir, f);
    if (!fs.existsSync(full)) fail(`admin JS가 없습니다: src/admin/js/${f}`);
    const src = read(full)
      .replace(/^import\s.+?\sfrom\s+"[^"]+";[ \t]*\r?\n/gm, "")
      .replace(/^export\s+(const|let|function|class|async function)\s/gm, "$1 ");
    const left = src.match(/^\s*(import|export)\s.*$/m);
    if (left) fail(`번들에 남은 import/export (src/admin/js/${f}): ${left[0].trim()}`);
    body += `\n// ── ${f} ──\n${src}`;
  }
  const head = banner("JS");
  const iife = `${head}
(function (global) {
"use strict";
const catui = global.catui;
if (!catui) { console.error("[CatuiAdmin]: catui.js를 먼저 불러와 주세요 — <script src=\\"catui.js\\"></script> 다음에 catadmin.js"); return; }
${body}
})(typeof window !== "undefined" ? window : globalThis);
`;
  const esm = `${head}
import catui from "./catui.esm.js";
${body}
export { ${exports.join(", ")} };
export default admin;
`;
  write(path.join(P.dist, "catadmin.js"), iife);
  write(path.join(P.dist, "catadmin.esm.js"), esm);
  for (const [code, file, format] of [[iife, "catadmin.js"], [esm, "catadmin.esm.js", "esm"]]) {
    const out = transformSync(code, { minify: true, sourcemap: "external", sourcefile: file, target: "es2020", format, legalComments: "inline", charset: "utf8" });
    const name = file.replace(/\.js$/, ".min.js");
    write(path.join(P.dist, name), `${out.code}//# sourceMappingURL=${name}.map\n`);
    const map = JSON.parse(out.map); map.file = name; map.sources = [file];
    write(path.join(P.dist, `${name}.map`), JSON.stringify(map));
  }
  const dts = path.join(ROOT, "src/types/catadmin.d.ts");
  if (fs.existsSync(dts)) write(path.join(P.dist, "catadmin.d.ts"), read(dts));
  const missing = new Set();
  for (const m of body.matchAll(/Catui_[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) {
    const next = body[m.index + m[0].length];
    if (body.slice(m.index - 2, m.index) === "--" || next === "$" || next === "-" || m[0].startsWith("Catui_ic-")) continue;
    if (!defined.has(m[0])) missing.add(m[0]);
  }
  if (missing.size) fail(`catadmin.js가 쓰는데 CSS에 없는 클래스: ${[...missing].join(" ")}`);
  return { iife };
}

// ── 템플릿 ──
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ico = (name, size = 18, cls = "") => `<svg class="Catui_icon${size === 24 ? "" : ` Catui_i${size}`}${cls ? ` ${cls}` : ""}" aria-hidden="true"><use href="{{dist}}/icons.svg?v=2#Catui_ic-${name}"></use></svg>`;

// 페이지 머리 주석: <!-- title: … | menu: … | crumb: 가 / 나 | layout: shell|blank -->
function meta(src, file) {
  const m = /^\s*<!--([\s\S]*?)-->/.exec(src);
  if (!m) fail(`템플릿 머리 주석이 없습니다: ${file}`);
  const o = Object.fromEntries(m[1].split("|").map((p) => p.split(":")).filter((a) => a.length > 1).map(([k, ...v]) => [k.trim(), v.join(":").trim()]));
  if (!o.title) fail(`템플릿 title이 없습니다: ${file}`);
  return { ...o, body: src.slice(m[0].length).trim() };
}

export function buildAdminTemplates({ defined, icons, adminByFile = {} }) {
  if (!fs.existsSync(A.tpl)) return { pages: 0 };
  const menu = readJson(path.join(A.tpl, "menu.json"));
  const layouts = { shell: read(path.join(A.tpl, "layout.html")), blank: read(path.join(A.tpl, "layout-blank.html")) };
  const pagesDir = path.join(A.tpl, "pages");
  const files = walk(pagesDir, ".html").map((f) => path.basename(f, ".html")).sort();
  const exists = new Set(files);
  const out = path.join(P.docs, "admin/templates");
  const dist = "../../../dist";
  const errors = [];
  const used = new Set(Object.values(layouts).flatMap((l) => [...l.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/))));
  const titles = {};
  for (const f of files) titles[f] = meta(read(path.join(pagesDir, `${f}.html`)), f).title;

  // 사이드바: 아직 만들지 않은 화면은 메뉴에 넣지 않는다(깨진 링크 방지)
  const sidebar = (cur) => menu.groups.map((g) => {
    const items = g.items.map((it) => {
      const kids = (it.children || []).filter((k) => exists.has(k.page));
      if (it.children && !kids.length) return "";
      if (!it.children && !exists.has(it.page)) return "";
      const badge = it.badge ? `<span class="Catui_count">${esc(it.badge)}</span>` : "";
      if (!kids.length) return `<a class="Catui_item" href="${it.page}.html"${it.page === cur ? ' aria-current="page"' : ""}>${ico(it.icon)}<span class="Catui_item-label">${esc(it.title)}</span>${badge}</a>`;
      const open = kids.some((k) => k.page === cur);
      return `<details class="Catui_nest Catui_adm-nest" data-catui-adm-key="${esc(it.id)}"${open ? " open" : ""}><summary class="Catui_item${open ? " Catui_adm-item-on" : ""}">${ico(it.icon)}<span class="Catui_item-label">${esc(it.title)}</span>${badge}${ico("chevron-down", 16, "Catui_adm-caret")}</summary>${kids.map((k) => `<a class="Catui_item" href="${k.page}.html"${k.page === cur ? ' aria-current="page"' : ""}><span class="Catui_item-label">${esc(k.title)}</span></a>`).join("")}</details>`;
    }).join("");
    return items ? `<div class="Catui_group">${esc(g.title)}</div>${items}` : "";
  }).join("");
  // 명령 팔레트용 화면 목록 (그룹 · 제목 · 주소)
  const cmdData = JSON.stringify(menu.groups.flatMap((g) => g.items.flatMap((it) => (it.children ? it.children.map((k) => ({ ...k, parent: it.title, icon: it.icon })) : [it]).filter((x) => exists.has(x.page)).map((x) => ({ group: g.title, title: x.parent ? `${x.parent} · ${x.title}` : x.title, href: `${x.page}.html`, icon: x.icon })))));

  for (const f of files) {
    const p = meta(read(path.join(pagesDir, `${f}.html`)), f);
    const crumb = (p.crumb || p.title).split("/").map((s) => s.trim());
    const crumbHtml = `<a href="index.html">홈</a>${crumb.map((c, i) => `<span class="Catui_crumb-sep">/</span>${i === crumb.length - 1 ? `<span aria-current="page">${esc(c)}</span>` : `<span>${esc(c)}</span>`}`).join("")}`;
    // 본문의 실행 스크립트는 catui.js·catadmin.js 뒤({{scripts}})로 옮긴다 (JSON 데이터 스크립트는 제자리)
    const scripts = [];
    const body = p.body.replace(/<script(?![^>]*type="application\/json")[^>]*>[\s\S]*?<\/script>\s*/g, (s) => { scripts.push(s.trim()); return ""; });
    let html = (layouts[p.layout || "shell"] || fail(`없는 layout: ${p.layout} (${f})`))
      .replace(/\{\{content\}\}/g, () => body)
      .replace(/\{\{scripts\}\}/g, () => scripts.join("\n"))
      // 머리 주석 root: 셸 루트에 붙일 속성 (예: root: data-catui-adm-fixed-foot)
      .replace(/\{\{rootattrs\}\}/g, () => (p.root ? ` ${p.root.split(/\s+/).filter((a) => /^data-catui-adm-[a-z-]+$/.test(a)).join(" ")}` : ""))
      .replace(/\{\{sidebar\}\}/g, () => sidebar(f))
      .replace(/\{\{crumb\}\}/g, () => crumbHtml)
      .replace(/\{\{cmd\}\}/g, () => cmdData.replace(/</g, "\\u003c"))
      .replace(/\{\{title\}\}/g, esc(p.title))
      .replace(/\{\{page\}\}/g, f)
      .replace(/\{\{version\}\}/g, pkg().version)
      .replace(/\{\{icon:([a-z0-9-]+)(?::(\d+))?\}\}/g, (_, n, s) => ico(n, s ? Number(s) : 16))
      .replace(/\{\{dist\}\}/g, dist);
    // 검사: 정의 안 된 클래스 · 없는 아이콘 · id 중복 · label for · 템플릿 링크
    const noScript = html.replace(/<script[\s\S]*?<\/script>/g, "");
    for (const m of noScript.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c.startsWith("Catui_") && !defined.has(c)) errors.push(`${f}: 정의 안 된 클래스 ${c}`);
    for (const m of html.matchAll(/#Catui_ic-([a-z0-9-]+)/g)) if (!icons.includes(m[1])) errors.push(`${f}: 없는 아이콘 ${m[1]}`);
    const ids = [...noScript.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dupIds.length) errors.push(`${f}: id 중복 ${[...new Set(dupIds)].join(", ")}`);
    for (const m of noScript.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) if (!ids.includes(m[1])) errors.push(`${f}: label for="${m[1]}" 대상 없음`);
    for (const m of noScript.matchAll(/href="([a-z0-9_-]+)\.html(#[^"]*)?"/g)) if (!exists.has(m[1])) errors.push(`${f}: 없는 템플릿 링크 ${m[1]}.html`);
    if ((noScript.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${f}: h1은 한 개여야 합니다`);
    for (const m of html.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) used.add(c);
    for (const m of html.matchAll(/Catui_adm-[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) used.add(m[0]);   // 템플릿 스크립트가 붙이는 클래스
    write(path.join(out, `${f}.html`), html);
  }
  // admin.css 클래스는 템플릿 어딘가에서 한 번 이상 쓰여야 한다 (JS가 붙이는 상태 클래스는 JS 소스에서 확인)
  const jsSrc = walk(path.join(A.src, "js"), ".js").map(read).join("\n");
  const unused = Object.values(adminByFile).flat().filter((c) => !used.has(c) && !jsSrc.includes(c));
  if (unused.length) errors.push(`템플릿·catadmin.js 어디에도 쓰이지 않은 admin 클래스: ${[...new Set(unused)].join(" ")}`);
  // JSON 모의 데이터: templates/admin/data/*.json → docs/admin/templates/data/ (문법 검사 후 복사)
  for (const f of walk(path.join(A.tpl, "data"), ".json")) {
    const name = path.basename(f);
    try { JSON.parse(read(f)); } catch (e) { errors.push(`data/${name}: JSON 문법 오류 — ${e.message}`); continue; }
    write(path.join(out, "data", name), read(f));
  }
  if (errors.length) fail(`admin 템플릿 검사 실패\n  ${errors.join("\n  ")}`);
  return { pages: files.length, titles };
}
