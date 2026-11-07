import path from "node:path";
import { transform } from "lightningcss";
import { transformSync } from "esbuild";
import { ROOT, P, read, readJson, write, walk, fail, pkg, visualErrors } from "./lib.mjs";

const src = path.join(ROOT, "src/drama"), tpl = path.join(ROOT, "templates/drama");
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const banner = () => `/*! CatuiDrama ${pkg().version} | MIT License (c) imcatDevs */\n`;
export function buildDramaCss() {
  const order = readJson(path.join(src, "index.json")), byFile = {}, errors = [];
  const missing = walk(path.join(src, "css"), ".css").filter((f) => !order.includes(path.relative(src, f).replace(/\\/g, "/")));
  if (missing.length) fail(`drama index.json에 없는 CSS: ${missing.join(", ")}`);
  const css = banner() + order.map((f) => {
    const text = read(path.join(src, f));
    if (/#[0-9a-f]{3,8}\b/i.test(text)) errors.push(`${f}: 직접 쓴 색 대신 Catui 토큰을 쓰세요`);
    errors.push(...visualErrors(text, `src/drama/${f}`));
    byFile[`drama/${f}`] = [...new Set([...text.matchAll(/\.(Catui_dr[\w-]*)/g)].map((m) => m[1]))];
    return text;
  }).join("\n");
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)) {
    let depth = 0, current = ""; const selectors = [];
    for (const ch of m[1]) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { selectors.push(current.trim()); current = ""; } else current += ch; }
    selectors.push(current.trim());
    for (const selector of selectors) if (!/^\.Catui_dr(?:$|[-\s.:#\[>+~])/.test(selector)) errors.push(`drama 밖으로 나가는 선택자: ${selector}`);
  }
  const known = new Set([...read(path.join(P.css, "foundation/tokens.css")).matchAll(/(--Catui_[\w-]+)\s*:/g), ...css.matchAll(/(--Catui_[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const m of css.matchAll(/var\((--Catui_[\w-]+)/g)) if (!known.has(m[1])) errors.push(`알 수 없는 토큰: ${m[1]}`);
  if (errors.length) fail(errors.join("\n"));
  const min = transform({ filename: "drama.css", code: Buffer.from(css), minify: true }).code.toString();
  write(path.join(P.dist, "drama.css"), css); write(path.join(P.dist, "drama.min.css"), min);
  return { css, min, byFile, defined: new Set([...css.matchAll(/\.(Catui_[\w-]+)/g)].map((m) => m[1])) };
}
export function buildDramaJs(defined) {
  const dir = path.join(src, "js"), { order } = readJson(path.join(dir, "bundle.json"));
  if (walk(dir, ".js").some((f) => !order.includes(path.basename(f)))) fail("drama bundle.json에 없는 JS가 있습니다");
  const body = order.map((f) => read(path.join(dir, f)).replace(/^export\s+(const|let|function|class)\s/gm, "$1 ")).join("\n");
  for (const m of body.matchAll(/Catui_[\w-]+/g)) if (!m[0].startsWith("Catui_ic-") && !body.slice(m.index - 2, m.index).endsWith("--") && !defined.has(m[0])) fail(`catdrama.js: 정의되지 않은 클래스 ${m[0]}`);
  const global = `${banner()}(function(catui){"use strict";if(!catui){console.error("CatuiDrama: catui.js를 먼저 불러와 주세요");return;}\n${body}\n})(globalThis.catui);\n`;
  const esm = `${banner()}import catui from "./catui.esm.js";\n${body}\nexport { drama };\nexport default drama;\n`;
  for (const [name, code, format] of [["catdrama.js", global, "iife"], ["catdrama.esm.js", esm, "esm"]]) {
    write(path.join(P.dist, name), code);
    const result = transformSync(code, { minify: true, sourcemap: "external", sourcefile: name, target: "es2020", format, charset: "utf8", legalComments: "inline" });
    const min = name.replace(".js", ".min.js");
    write(path.join(P.dist, min), `${result.code}//# sourceMappingURL=${min}.map\n`); write(path.join(P.dist, `${min}.map`), result.map);
  }
  write(path.join(P.dist, "catdrama.d.ts"), read(path.join(ROOT, "src/types/catdrama.d.ts")));
}
export function buildDramaTemplates({ defined, icons }) {
  const menu = readJson(path.join(tpl, "menu.json")), pages = walk(path.join(tpl, "pages"), ".html"), layout = read(path.join(tpl, "layout.html"));
  const files = new Set(pages.map((f) => path.basename(f))), errors = [];
  for (const file of pages) {
    const name = path.basename(file, ".html"), page = menu.pages[name];
    if (!page) fail(`drama 메뉴에 없는 페이지: ${name}`);
    const nav = menu.top.map((it) => `<a class="Catui_hnav-item" href="${esc(it.href)}"${page.nav === it.id ? ' aria-current="page"' : ""}>${esc(it.title)}</a>`).join("");
    const html = layout.replace(/\{\{content\}\}/g, () => read(file)).replace(/\{\{topnav\}\}/g, () => nav).replace(/\{\{title\}\}/g, esc(page.title)).replace(/\{\{page\}\}/g, name).replace(/\{\{dist\}\}/g, "../../../dist").replace(/\{\{version\}\}/g, pkg().version);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    if (new Set(ids).size !== ids.length) errors.push(`${name}: 중복 id`);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${name}: h1 한 개 필요`);
    for (const m of html.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c.startsWith("Catui_") && !defined.has(c)) errors.push(`${name}: 없는 클래스 ${c}`);
    for (const m of html.matchAll(/#Catui_ic-([a-z0-9-]+)/g)) if (!icons.includes(m[1])) errors.push(`${name}: 없는 아이콘 ${m[1]}`);
    for (const m of html.matchAll(/href="([a-z0-9_-]+\.html)(?:[?#][^"]*)?"/g)) if (!files.has(m[1])) errors.push(`${name}: 없는 링크 ${m[1]}`);
    for (const m of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) if (!ids.includes(m[1])) errors.push(`${name}: label 대상 없음 ${m[1]}`);
    if (/\{\{[^}]+\}\}/.test(html)) errors.push(`${name}: 미치환 자리`);
    write(path.join(P.docs, "drama/templates", `${name}.html`), html);
  }
  for (const file of walk(path.join(tpl, "data"), ".json")) { readJson(file); write(path.join(P.docs, "drama/templates/data", path.basename(file)), read(file)); }
  if (errors.length) fail(errors.join("\n"));
  return { pages: pages.length };
}
