// 문서: docs-src(조각 + nav.json + layout.html) → docs/ 정적 사이트
// 조각 문법
//   <catui-example title="제목">마크업(+<script>)</catui-example>  → 미리보기 + 코드(같은 원본에서 생성)
//   <catui-tokens match="^color-"></catui-tokens>                 → 토큰 표(이름·값·견본)
//   <catui-icons></catui-icons>                                    → 아이콘 목록
//   href="doc:css/components/button#id"                            → 문서 간 상대 링크
//   {{dist}}                                                       → dist 폴더 상대 경로
// 페이지 머리(h1·설명·견본 계약)와 "클래스" 표·목차·이전/다음·사이드바는 빌드가 만든다.
import fs from "node:fs";
import path from "node:path";
import { P, ROOT, fail, read, readJson, write, walk, rel, pkg } from "./lib.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function dedent(s) {
  const lines = s.replace(/^\n+|\s+$/g, "").split("\n");
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(pad)).join("\n");
}

export function buildDocs({ css, icons }) {
  const nav = readJson(path.join(P.docsSrc, "nav.json"));
  const layout = read(path.join(P.docsSrc, "layout.html"));
  const tokensSrc = read(path.join(P.css, "foundation/tokens.css"));
  const tokens = [...tokensSrc.matchAll(/--Catui_([A-Za-z0-9_-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
  const version = pkg().version;

  // 페이지 목록 (nav 순서)
  const pages = [];
  for (const sec of nav.sections) for (const g of sec.groups) for (const p of g.pages) pages.push({ ...p, section: sec, group: g });
  const byPath = new Map(pages.map((p) => [p.path, p]));
  if (byPath.size !== pages.length) fail("nav.json에 같은 path가 두 번 있습니다.");

  // 고아 조각 검사
  const fragFiles = walk(P.docsSrc, ".html").map((f) => path.relative(P.docsSrc, f).replace(/\\/g, "/").replace(/\.html$/, ""));
  const orphans = fragFiles.filter((f) => !byPath.has(f) && f !== "layout" && f !== "index");
  if (orphans.length) fail(`nav.json에 없는 문서 조각: ${orphans.join(", ")}`);

  const errors = [];
  const relTo = (fromPath, target) => {
    const depth = fromPath.split("/").length - 1;
    return `${"../".repeat(depth)}${target}`;
  };
  const distRel = (fromPath) => `${"../".repeat(fromPath.split("/").length)}dist`;   // docs/ 한 단계 위

  function transform(html, page) {
    let n = 0;
    // 예제 블록
    html = html.replace(/<catui-example([^>]*)>([\s\S]*?)<\/catui-example>/g, (_, attrs, body) => {
      n += 1;
      const title = (attrs.match(/title="([^"]*)"/) || [])[1] || `예제 ${n}`;
      const code = dedent(body).replace(/\{\{dist\}\}/g, "dist");   // 코드 예시는 프로젝트 기준 경로로 보여 준다
      return `<figure class="doc-example">
<figcaption class="doc-example-title">${esc(title)}</figcaption>
<div class="doc-example-preview">${body}</div>
<details class="doc-example-code"><summary>코드</summary><button class="doc-copy" type="button" aria-label="${esc(title)} 코드 복사">복사</button><pre><code>${esc(code)}</code></pre></details>
</figure>`;
    });
    // 토큰 표
    html = html.replace(/<catui-tokens\s+match="([^"]+)"\s*><\/catui-tokens>/g, (_, re) => {
      const rows = tokens.filter(([k]) => new RegExp(re).test(k));
      if (!rows.length) errors.push(`${page.path}: 토큰 패턴 '${re}'에 맞는 토큰이 없습니다`);
      const isColor = (v) => /^#|^rgb|^hsl|color-mix|var\(--Catui_color/.test(v);
      return `<div class="doc-table-wrap"><table class="Catui_tbl doc-tokens"><caption class="Catui_clip">토큰 ${esc(re)}</caption><thead><tr><th scope="col">변수</th><th scope="col">값</th><th scope="col">견본</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td><code>--Catui_${esc(k)}</code></td><td><code>${esc(v)}</code></td><td>${isColor(v) ? `<span class="doc-swatch" style="background:var(--Catui_${esc(k)})" aria-hidden="true"></span>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
    });
    // 아이콘 목록
    html = html.replace(/<catui-icons><\/catui-icons>/g, () => `<ul class="doc-icons">${icons.names.map((name) => `<li><svg class="Catui_icon Catui_i20" aria-hidden="true"><use href="{{dist}}/icons.svg?v=2#Catui_ic-${name}"></use></svg><code>${name}</code></li>`).join("")}</ul>`);
    // 문서 링크
    html = html.replace(/href="doc:([^"#]+)(#[^"]*)?"/g, (_, target, hash = "") => {
      if (!byPath.has(target) && target !== "index") errors.push(`${page.path}: 없는 문서 링크 doc:${target}`);
      return `href="${relTo(page.path, `${target}.html`)}${hash}"`;
    });
    return html.replace(/\{\{dist\}\}/g, distRel(page.path));
  }

  function sidebar(page) {
    return page.section.groups.map((g) => `<div class="doc-side-group"><p class="doc-side-title">${esc(g.title)}</p><ul>${g.pages.map((p) => `<li><a href="${relTo(page.path, `${p.path}.html`)}"${p.path === page.path ? ' aria-current="page"' : ""}>${esc(p.title)}</a></li>`).join("")}</ul></div>`).join("");
  }

  function head(page) {
    const rules = (page.rules || []).map(([k, t]) => `<li><span class="Catui_pill ${k === "MUST" ? "Catui_pill-success" : k === "NEVER" ? "Catui_pill-danger" : "Catui_pill-info"}">${esc(k)}</span> ${esc(t)}</li>`).join("");
    return `<p class="doc-eyebrow">${esc(page.section.title)} · ${esc(page.group.title)}</p>
<h1 class="Catui_h1">${esc(page.title)}</h1>
${page.desc ? `<p class="Catui_lead">${esc(page.desc)}</p>` : ""}
${rules ? `<ul class="doc-rules" aria-label="견본 계약">${rules}</ul>` : ""}`;
  }

  function classTable(page) {
    if (!page.css?.length) return "";
    const items = page.css.map((f) => {
      if (!css.byFile[f]) { errors.push(`${page.path}: nav.json css 파일이 index.json에 없습니다 (${f})`); return ""; }
      return `<li><span class="doc-src">src/css/${esc(f)}</span>${css.byFile[f].map((c) => `<code>.${esc(c)}</code>`).join(" ")}</li>`;
    }).join("");
    return `<section aria-labelledby="classes"><h2 id="classes">클래스</h2><p>소스 CSS에서 자동으로 모은 목록입니다.</p><ul class="doc-classes">${items}</ul></section>`;
  }

  function render(page, bodyHtml, { home = false } = {}) {
    const toc = [...bodyHtml.replace(/<figure class="doc-example">[\s\S]*?<\/figure>/g, "").matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => `<li><a href="#${m[1]}">${m[2].replace(/<[^>]+>/g, "")}</a></li>`).join("");
    const flat = home ? [] : pages.filter((p) => p.section === page.section);
    const i = flat.indexOf(page);
    const prev = flat[i - 1], next = flat[i + 1];
    const pager = home ? "" : `<nav class="doc-pager" aria-label="이전·다음 문서">${prev ? `<a href="${relTo(page.path, `${prev.path}.html`)}"><span>이전</span>${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="doc-pager-next" href="${relTo(page.path, `${next.path}.html`)}"><span>다음</span>${esc(next.title)}</a>` : ""}</nav>`;
    const tabs = nav.sections.map((s) => {
      const first = pages.find((p) => p.section === s);
      return `<a href="${relTo(page.path, `${first.path}.html`)}"${!home && s === page.section ? ' aria-current="page"' : ""}>${esc(s.title)}</a>`;
    }).join("");
    const out = layout
      .replace(/\{\{title\}\}/g, esc(home ? "Catui 문서" : `${page.title} · ${page.section.title} · Catui`))
      .replace(/\{\{desc\}\}/g, esc(page.desc || nav.desc || ""))
      .replace(/\{\{home\}\}/g, relTo(page.path, "index.html"))
      .replace(/\{\{assets\}\}/g, relTo(page.path, "assets"))
      .replace(/\{\{tabs\}\}/g, tabs)
      .replace(/\{\{version\}\}/g, esc(version))
      .replace(/\{\{shellClass\}\}/g, home ? "doc-shell doc-shell-home" : "doc-shell")
      .replace(/\{\{sidebar\}\}/g, home ? "" : `<details class="doc-side" open><summary>${esc(page.section.title)} 메뉴</summary><nav aria-label="${esc(page.section.title)} 문서">${sidebar(page)}</nav></details>`)
      .replace(/\{\{content\}\}/g, home ? bodyHtml : `${head(page)}\n${bodyHtml}\n${classTable(page)}\n${pager}`)
      .replace(/\{\{toc\}\}/g, toc && !home ? `<aside class="doc-toc" aria-label="이 페이지"><p class="doc-side-title">이 페이지</p><ul>${toc}${page.css?.length ? '<li><a href="#classes">클래스</a></li>' : ""}</ul></aside>` : "")
      .replace(/\{\{scripts\}\}/g, (home ? false : page.section.id === "js" || page.js) ? `<script src="${distRel(page.path)}/catui.js"></script>` : "")
      .replace(/\{\{dist\}\}/g, distRel(page.path));
    return out;
  }

  // 문서 폴더 새로 쓰기 (assets 포함)
  fs.rmSync(P.docs, { recursive: true, force: true });
  for (const f of walk(path.join(P.docsSrc, "assets"))) write(path.join(P.docs, "assets", path.relative(path.join(P.docsSrc, "assets"), f)), fs.readFileSync(f));

  const outputs = [];
  for (const page of pages) {
    const src = path.join(P.docsSrc, `${page.path}.html`);
    if (!fs.existsSync(src)) { errors.push(`문서 조각이 없습니다: docs-src/${page.path}.html`); continue; }
    const frag = read(src);
    const prose = frag.replace(/<catui-example[\s\S]*?<\/catui-example>/g, "");   // 예제 미리보기 안 제목은 제외
    if (/<h1[\s>]/.test(frag)) errors.push(`${page.path}: 조각에 h1을 쓰지 마세요(빌드가 만듭니다, 예제 안이면 h2 이하로)`);
    for (const m of prose.matchAll(/<h2(?![^>]*\sid=)[^>]*>/g)) errors.push(`${page.path}: id 없는 h2 — 목차 앵커에 필요합니다 (${m[0]})`);
    const html = render(page, transform(frag, page));
    outputs.push([page.path, html]);
  }
  const homeSrc = path.join(P.docsSrc, "index.html");
  const homePage = { path: "index", title: "Catui 문서", desc: nav.desc, section: nav.sections[0], group: { title: "" } };
  outputs.push(["index", render(homePage, transform(read(homeSrc), homePage), { home: true })]);

  // 출력 검사: 클래스 정의, id 중복, label for, 로컬 링크, 아이콘 심볼
  const iconSet = new Set(icons.names);
  const planned = new Set(outputs.map(([p]) => path.join(P.docs, `${p}.html`)));   // 아직 쓰기 전이므로 생성 예정 목록과 대조
  for (const [p, html] of outputs) {
    const file = path.join(P.docs, `${p}.html`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) errors.push(`${p}: 같은 id ${[...new Set(dup)].join(", ")}`);
    const idSet = new Set(ids);
    for (const m of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) if (!idSet.has(m[1])) errors.push(`${p}: label for="${m[1]}"에 맞는 id가 없습니다`);
    for (const m of html.matchAll(/class="([^"]*)"/g)) for (const t of m[1].split(/\s+/)) {
      if (/^Catui_[A-Za-z0-9_-]+$/.test(t) && !css.defined.has(t)) errors.push(`${p}: CSS에 없는 클래스 .${t}`);
    }
    for (const m of html.matchAll(/#Catui_ic-([a-z0-9-]+)/g)) if (!iconSet.has(m[1])) errors.push(`${p}: 스프라이트에 없는 아이콘 ${m[1]}`);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${p}: h1은 하나여야 합니다`);
    for (const m of html.matchAll(/href="#([^"]+)"/g)) if (!idSet.has(m[1])) errors.push(`${p}: 페이지 안 앵커 #${m[1]}가 없습니다`);
    const live = html.replace(/<pre[\s\S]*?<\/pre>/g, "");   // 코드 예시 안의 글자는 링크가 아니다
    for (const m of live.matchAll(/(?:href|src)="((?:\.\.\/|[a-z0-9-]+\/)[^"#?:]+)/g)) {
      const target = path.resolve(path.dirname(file), m[1]);
      if (!planned.has(target) && !fs.existsSync(target)) errors.push(`${p}: 깨진 링크 ${m[1]}`);
    }
  }
  // 예제 누락 검사: CSS에 정의된 모든 Catui_ 클래스는 어느 문서의 <catui-example>에든 한 번 이상 쓰여야 한다
  const exampleUsed = new Set();
  for (const f of walk(P.docsSrc, ".html")) {
    for (const ex of read(f).matchAll(/<catui-example[\s\S]*?<\/catui-example>/g)) {
      for (const m of ex[0].matchAll(/Catui_[A-Za-z0-9_-]+/g)) exampleUsed.add(m[0]);
    }
  }
  const SCOPE_ROOTS = new Set(["Catui_app", "Catui_site", "Catui_layer"]);   // 루트 스코프는 예제 대상이 아님
  const noExample = [...css.defined].filter((c) => !exampleUsed.has(c) && !SCOPE_ROOTS.has(c)).sort();
  if (noExample.length) errors.push(`예제가 없는 CSS 클래스 ${noExample.length}개 — docs-src/css 해당 문서에 <catui-example>를 추가하세요: ${noExample.join(" ")}`);

  if (errors.length) fail(`문서 검사 실패 ${errors.length}건\n  ${[...new Set(errors)].slice(0, 40).join("\n  ")}`);
  for (const [p, html] of outputs) write(path.join(P.docs, `${p}.html`), html);
  return { pages: outputs.length, root: rel(P.docs) };
}

export { ROOT };
