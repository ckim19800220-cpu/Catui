// CatuiBooking: catui 위에 얹는 예약·일정 확장 — CatuiShop · CatuiDocs와 같은 구조
//   src/booking/index.json 순서 CSS → dist/booking.css · booking.min.css
//   src/booking/js/bundle.json 순서 JS → dist/catbooking.js(전역, catui.js 뒤에 로드) · catbooking.esm.js · *.min.js(+map) · catbooking.d.ts
//   templates/booking/pages/*.html → docs/booking/templates/*.html (layout·menu.json으로 감싸기, 문서 빌드 뒤 실행)
//   templates/booking/data/*.json → docs/booking/templates/data/ (JSON 모의 데이터)
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import { transformSync } from "esbuild";
import { ROOT, P, fail, read, readJson, write, walk, pkg, bytes, visualErrors, sharedAccount } from "./lib.mjs";

const C = { src: path.join(ROOT, "src/booking"), tpl: path.join(ROOT, "templates/booking") };
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const banner = (what) => `/*! CatuiBooking ${what} ${pkg().version} | MIT License (c) imcatDevs | catui 위에 로드 */`;
const CLASS_ATTR = /(?<![\w-])class="([^"]+)"/g;

// ── CSS ──
export function buildBookingCss() {
  if (!fs.existsSync(C.src)) return { css: "", min: "", defined: new Set(), byFile: {} };
  const order = readJson(path.join(C.src, "index.json"));
  const listed = new Set(order);
  for (const f of order) if (!fs.existsSync(path.join(C.src, f))) fail(`booking index.json의 CSS가 없습니다: src/booking/${f}`);
  const orphans = walk(path.join(C.src, "css"), ".css").map((f) => path.relative(C.src, f).replace(/\\/g, "/")).filter((f) => !listed.has(f));
  if (orphans.length) fail(`booking index.json에 없는 CSS: ${orphans.join(", ")}`);
  let css = `${banner("CSS")}\n`;
  const byFile = {};
  for (const f of order) {
    const src = read(path.join(C.src, f));
    if (/#[0-9a-f]{3,8}\b/i.test(noComments(src).replace(/url\([^)]*\)/g, ""))) fail(`booking CSS에 직접 쓴 색(hex)이 있습니다 — 토큰을 쓰세요: src/booking/${f}`);
    { const ve = visualErrors(src, `src/booking/${f}`); if (ve.length) fail(`booking CSS 시각 원칙 검사 실패\n  ${ve.join("\n  ")}`); }   // 1px 선 · 모서리 토큰 · 유리 폴백 (lib.mjs)
    css += `${src}\n`;
    byFile[`booking/${f}`] = [...new Set([...noComments(src).matchAll(/\.(Catui_bk-[A-Za-z0-9_-]+)/g)].map((m) => m[1]))].sort();
  }
  // 선택자가 본체 클래스 하나뿐이면 본체를 덮어쓰는 것 — 반드시 .Catui_bk… 아래로 한정
  const topSplit = (sel) => { const out = []; let depth = 0, cur = ""; for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
  const bad = [...noComments(css).matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)]
    .flatMap((m) => topSplit(m[1]))
    .filter((s) => /^\.Catui_(?!bk\b)[A-Za-z0-9_-]+(?:(?::|::)[a-z-]+(?:\([^)]*\))?|\[[^\]]+\])*$/.test(s));
  if (bad.length) fail(`booking.css가 본체 클래스를 단독 선택자로 다시 정의합니다(.Catui_bk 아래로 한정하세요): ${[...new Set(bad)].join(" ")}`);
  const known = new Set([...read(path.join(P.css, "foundation/tokens.css")).matchAll(/(--Catui_[A-Za-z0-9_-]+)\s*:/g), ...css.matchAll(/(--Catui_[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]));
  const unknown = [...new Set([...noComments(css).matchAll(/var\((--Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]).filter((v) => !known.has(v)))];
  if (unknown.length) fail(`booking CSS가 쓰는데 정의되지 않은 토큰: ${unknown.join(" ")}`);
  const min = transform({ filename: "booking.css", code: Buffer.from(css), minify: true }).code.toString();
  if (bytes(min) >= bytes(css)) fail("booking.min.css가 booking.css보다 작지 않습니다.");
  write(path.join(P.dist, "booking.css"), css);
  write(path.join(P.dist, "booking.min.css"), min);
  const defined = new Set([...noComments(css).matchAll(/\.(Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  return { css, min, defined, byFile };
}

// ── JS ──
export function buildBookingJs(defined) {
  const dir = path.join(C.src, "js");
  if (!fs.existsSync(dir)) return null;
  const { order, exports } = readJson(path.join(dir, "bundle.json"));
  const orphans = walk(dir, ".js").map((f) => path.relative(dir, f).replace(/\\/g, "/")).filter((f) => !order.includes(f));
  if (orphans.length) fail(`booking bundle.json에 없는 JS: ${orphans.join(", ")}`);
  let body = "";
  for (const f of order) {
    const full = path.join(dir, f);
    if (!fs.existsSync(full)) fail(`booking JS가 없습니다: src/booking/js/${f}`);
    const src = read(full)
      .replace(/^import\s.+?\sfrom\s+"[^"]+";[ \t]*\r?\n/gm, "")
      .replace(/^export\s+(const|let|function|class|async function)\s/gm, "$1 ");
    const left = src.match(/^\s*(import|export)\s.*$/m);
    if (left) fail(`번들에 남은 import/export (src/booking/js/${f}): ${left[0].trim()}`);
    body += `\n// ── ${f} ──\n${src}`;
  }
  const head = banner("JS");
  const iife = `${head}
(function (global) {
"use strict";
const catui = global.catui;
if (!catui) { console.error("[CatuiBooking]: catui.js를 먼저 불러와 주세요 — <script src=\\"catui.js\\"></script> 다음에 catbooking.js"); return; }
${body}
})(typeof window !== "undefined" ? window : globalThis);
`;
  const esm = `${head}
import catui from "./catui.esm.js";
${body}
export { ${exports.join(", ")} };
export default booking;
`;
  write(path.join(P.dist, "catbooking.js"), iife);
  write(path.join(P.dist, "catbooking.esm.js"), esm);
  for (const [code, file, format] of [[iife, "catbooking.js"], [esm, "catbooking.esm.js", "esm"]]) {
    const out = transformSync(code, { minify: true, sourcemap: "external", sourcefile: file, target: "es2020", format, legalComments: "inline", charset: "utf8" });
    const name = file.replace(/\.js$/, ".min.js");
    write(path.join(P.dist, name), `${out.code}//# sourceMappingURL=${name}.map\n`);
    const map = JSON.parse(out.map); map.file = name; map.sources = [file];
    write(path.join(P.dist, `${name}.map`), JSON.stringify(map));
  }
  const dts = path.join(ROOT, "src/types/catbooking.d.ts");
  if (!fs.existsSync(dts)) fail("타입 선언이 없습니다: src/types/catbooking.d.ts (package.json types가 가리킴)");
  write(path.join(P.dist, "catbooking.d.ts"), read(dts));
  const missing = new Set();
  for (const m of body.matchAll(/Catui_[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) {
    const next = body[m.index + m[0].length];
    if (body.slice(m.index - 2, m.index) === "--" || next === "$" || next === "-" || m[0].startsWith("Catui_ic-")) continue;
    if (!defined.has(m[0])) missing.add(m[0]);
  }
  if (missing.size) fail(`catbooking.js가 쓰는데 CSS에 없는 클래스: ${[...missing].join(" ")}`);
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

// menu.json: { top: [{ id, title, href }], foot: [{ title, href }] }
//   top  = 머리 메뉴 — 본체 .Catui_hnav-line 항목(.Catui_hnav-item, 글자만 · 확장 4종 공통). 머리 주석 nav와 id가 같으면 aria-current="page"
//          좁은 화면에서는 둘째 줄 가로 스크롤(.Catui_hnav-scroll)
//   foot = 바닥글 링크
export function buildBookingTemplates({ defined, icons, bookingByFile = {} }) {
  if (!fs.existsSync(C.tpl)) return { pages: 0 };
  const menu = readJson(path.join(C.tpl, "menu.json"));
  const layouts = { site: read(path.join(C.tpl, "layout.html")), blank: read(path.join(C.tpl, "layout-blank.html")) };
  const pagesDir = path.join(C.tpl, "pages");
  const files = walk(pagesDir, ".html").map((f) => path.basename(f, ".html")).sort();
  const exists = new Set(files);
  const out = path.join(P.docs, "booking/templates");
  const dist = "../../../dist";
  const errors = [];
  const used = new Set(Object.values(layouts).flatMap((l) => [...l.matchAll(CLASS_ATTR)].flatMap((m) => m[1].split(/\s+/))));
  const pageOf = (href) => href.split(/[?#]/)[0].replace(/\.html$/, "");
  const live = (list) => (list || []).filter((x) => exists.has(pageOf(x.href)));
  const topnav = (nav) => live(menu.top).map((it) => `<a class="Catui_hnav-item" href="${esc(it.href)}"${it.id === nav ? ' aria-current="page"' : ""}>${esc(it.title)}</a>`).join("");
  const foot = () => live(menu.foot).map((it) => `<a href="${esc(it.href)}">${esc(it.title)}</a>`).join("");
  const packs = readJson(path.join(C.tpl, "data/packs.json"));
  const services = Object.fromEntries(readJson(path.join(C.tpl, "data/services.json")).map((s) => [s.id, s]));
  const branches = Object.fromEntries(readJson(path.join(C.tpl, "data/branches.json")).map((b) => [b.id, b]));
  const maps = readJson(path.join(C.tpl, "data/seats.json")), rooms = readJson(path.join(C.tpl, "data/rooms.json")).rooms;
  const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;
  const from = (s) => {
    if (s.kind === "room") { const r = [...rooms].sort((a, b) => a.price - b.price)[0]; return r ? `평일 1박 · 기준 ${r.base}인 ${won(r.price)}부터` : "객실 요금 확인"; }
    if (s.kind === "seat" && maps[s.map]?.grades) return `성인 1인 ${won(Math.min(...maps[s.map].grades.map((g) => g.price)))}부터`;
    return `${s.kind === "seat" ? "예약금" : "수업료"} 성인 1인 ${won(s.price)}`;
  };
  const offers = (p, primary = false) => p.offers.map((o, i) => {
    const s = services[o.svc], b = branches[o.branch];
    if (!s || !b || !s.branches.includes(o.branch) || (o.date && s.dates && !s.dates.includes(o.date))) fail(`템플릿 팩의 서비스·지점·날짜 연결이 잘못되었습니다: ${o.svc}/${o.branch}`);
    const q = new URLSearchParams({ svc: o.svc, branch: o.branch, ...(o.date ? { date: o.date } : {}) });
    const href = `${s.kind === "room" ? "rooms" : "date"}.html?${q}`;
    return `<li class="Catui_bk-box"><h3 class="Catui_h3">${esc(s.name)}</h3><p>${esc(s.desc)}</p><p class="Catui_num"><b>${esc(from(s))}</b></p><p>${esc(b.name)} · ${esc(b.addr)}</p><a class="Catui_btn Catui_btn-md Catui_btn-${primary && i === 0 ? "primary" : "secondary"}" data-pack-booking href="${esc(href)}">${esc(s.kind === "room" ? "기간·객실 고르기" : "회차·남은 자리 확인")}</a></li>`;
  }).join("");
  const packParts = (key, page) => {
    const p = packs[key];
    if (!p || !/^[a-z-]+\.(png|jpe?g|webp)$/.test(p.photo) || !fs.existsSync(path.join(ROOT, "assets/photos", p.photo))) fail(`템플릿 팩 또는 로컬 사진이 없습니다: ${key}`);
    const eventPages = [["event", "행사 소개"], ["event-program", "프로그램"], ["event-speakers", "연사"], ["event-guide", "참가 안내"]];
    const nav = key === "event" ? eventPages.map(([href, title]) => `<a class="Catui_btn Catui_btn-sm Catui_btn-${href === page ? "secondary" : "ghost"}" href="${href}.html"${href === page ? ' aria-current="page"' : ""}>${title}</a>`).join("") : '<a class="Catui_link" href="packs.html">다른 템플릿 팩 보기</a>';
    const program = (p.program || []).map((s, i) => {
      const who = s.speaker ? p.speakers.find((v) => v.id === s.speaker) : null;
      if (s.speaker && !who) fail(`행사 프로그램의 연사가 없습니다: ${s.speaker}`);
      return `<li class="Catui_bk-box"><p class="Catui_num">${esc(s.time)}</p><h3 class="Catui_h3" id="program-${i}">${esc(s.title)}</h3><p>${esc(s.text)}</p>${who ? `<a class="Catui_link" href="event-speakers.html#speaker-${esc(who.id)}">${esc(who.name)} · ${esc(who.role)}</a>` : ""}</li>`;
    }).join("");
    const speakers = (p.speakers || []).map((s) => {
      if (!/^[a-z0-9-]+$/.test(s.id)) fail(`연사 id가 잘못되었습니다: ${s.id}`);
      return `<li class="Catui_bk-box" id="speaker-${s.id}"><h3 class="Catui_h3">${esc(s.name)} <small class="Catui_bk-muted">가상 연사</small></h3><p><b>${esc(s.role)}</b></p><p>${esc(s.bio)}</p><a class="Catui_link" href="event-program.html">발표 프로그램 보기</a></li>`;
    }).join("");
    return { ...Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, esc(v)])), nav, offers: offers(p, page.startsWith("event-")), program: program || '<li class="Catui_bk-box">프로그램을 준비하고 있습니다. 참가 안내에서 공개 여부를 확인해 주세요.</li>', speakers: speakers || '<li class="Catui_bk-box">연사 소개를 준비하고 있습니다.</li>', guide: p.guide.map(([title, text]) => `<details class="Catui_bk-box"><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join("") };
  };
  const packCards = Object.entries(packs).map(([key, p]) => `<li class="Catui_bk-svc"><img class="Catui_bk-photo" src="../../../assets/photos/${esc(p.photo)}" width="640" height="280" alt="" loading="lazy" decoding="async"><div class="Catui_bk-svc-b"><h2 class="Catui_h3"><a class="Catui_link" href="${key}.html">${esc(p.title)}</a></h2><p>${esc(p.intro)}</p><p class="Catui_bk-muted">${esc(p.summary)}</p></div><a class="Catui_btn Catui_btn-md Catui_btn-secondary" href="${key}.html">${esc(p.title)} 둘러보기</a></li>`).join("");

  for (const f of files) {
    const p = meta(read(path.join(pagesDir, `${f}.html`)), f);
    const parts = p.pack ? packParts(p.pack, f) : {};
    const scripts = [];
    const body = p.body.replace(/<script(?![^>]*type="application\/json")[^>]*>[\s\S]*?<\/script>\s*/g, (s) => { scripts.push(s.trim()); return ""; });
    let html = (layouts[p.layout || "site"] || fail(`없는 layout: ${p.layout} (${f})`))
      .replace(/\{\{content\}\}/g, () => sharedAccount(body, "booking", f))
      .replace(/\{\{scripts\}\}/g, () => scripts.join("\n"))
      .replace(/\{\{topnav\}\}/g, () => topnav(p.nav))
      .replace(/\{\{foot\}\}/g, () => foot())
      .replace(/\{\{title\}\}/g, esc(p.title))
      .replace(/\{\{page\}\}/g, f)
      .replace(/\{\{pack:([a-zA-Z]+)\}\}/g, (_, k) => k === "cards" ? packCards : parts[k] ?? fail(`없는 팩 항목: ${f}/${k}`))
      .replace(/\{\{version\}\}/g, pkg().version)
      .replace(/\{\{icon:([a-z0-9-]+)(?::(\d+))?\}\}/g, (_, n, s) => ico(n, s ? Number(s) : 16))
      .replace(/\{\{dist\}\}/g, dist);
    const left = html.match(/\{\{[a-z:-]+\}\}/);
    if (left) errors.push(`${f}: 치환되지 않은 자리 ${left[0]}`);
    const noScript = html.replace(/<script[\s\S]*?<\/script>/g, "");
    for (const m of noScript.matchAll(CLASS_ATTR)) for (const c of m[1].split(/\s+/)) if (c.startsWith("Catui_") && !defined.has(c)) errors.push(`${f}: 정의 안 된 클래스 ${c}`);
    for (const m of html.matchAll(/#Catui_ic-([a-z0-9-]+)/g)) if (!icons.includes(m[1])) errors.push(`${f}: 없는 아이콘 ${m[1]}`);
    const ids = [...noScript.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dupIds.length) errors.push(`${f}: id 중복 ${[...new Set(dupIds)].join(", ")}`);
    for (const m of noScript.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) if (!ids.includes(m[1])) errors.push(`${f}: label for="${m[1]}" 대상 없음`);
    for (const m of noScript.matchAll(/href="([a-z0-9_-]+)\.html([?#][^"]*)?"/g)) if (!exists.has(m[1])) errors.push(`${f}: 없는 템플릿 링크 ${m[1]}.html`);
    if ((noScript.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${f}: h1은 한 개여야 합니다`);
    for (const m of noScript.matchAll(/<span(?![^>]*\srole=)[^>]*\saria-label=/g)) errors.push(`${f}: 역할 없는 span의 aria-label은 읽히지 않습니다 — .Catui_clip 숨김 글자를 쓰세요 (${m[0].slice(0, 60)})`);
    // 보기 전용 달력·일정표에 role="grid" 금지 — 키보드로 움직이는 격자(data-catui-bk-grid)만 grid 패턴을 쓴다
    for (const m of noScript.matchAll(/<[a-z]+(?![^>]*data-catui-bk-grid)[^>]*\srole="grid"/g)) errors.push(`${f}: 키보드 격자(data-catui-bk-grid)가 아닌 곳의 role="grid" (${m[0].slice(0, 60)})`);
    for (const m of html.matchAll(CLASS_ATTR)) for (const c of m[1].split(/\s+/)) used.add(c);
    for (const m of html.matchAll(/Catui_bk-[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) used.add(m[0]);
    write(path.join(out, `${f}.html`), html);
  }
  const jsSrc = walk(path.join(C.src, "js"), ".js").map(read).join("\n");
  const unused = Object.values(bookingByFile).flat().filter((c) => !used.has(c) && !jsSrc.includes(c));
  if (unused.length) errors.push(`템플릿·catbooking.js 어디에도 쓰이지 않은 booking 클래스: ${[...new Set(unused)].join(" ")}`);
  for (const m of jsSrc.matchAll(/<span(?![^>]*\srole=)[^>]*\saria-label=/g)) errors.push(`catbooking.js: 역할 없는 span의 aria-label (${m[0].slice(0, 60)})`);
  for (const f of walk(path.join(C.tpl, "data"), ".json")) {
    const name = path.basename(f);
    try { JSON.parse(read(f)); } catch (e) { errors.push(`data/${name}: JSON 문법 오류 — ${e.message}`); continue; }
    write(path.join(out, "data", name), read(f));
  }
  if (errors.length) fail(`booking 템플릿 검사 실패\n  ${errors.join("\n  ")}`);
  return { pages: files.length };
}
