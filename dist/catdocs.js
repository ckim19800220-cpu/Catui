/*! CatuiDocs JS 2.0.0 | MIT License (c) imcatDevs | catui 위에 로드 */
(function (global) {
"use strict";
const catui = global.catui;
if (!catui) { console.error("[CatuiDocs]: catui.js를 먼저 불러와 주세요 — <script src=\"catui.js\"></script> 다음에 catdocs.js"); return; }

// ── docs.js ──
// CatuiDocs — catui.js 위에 얹는 문서·블로그 사이트 키트 (catui.docs)
//   전역: <script src="catui.js"></script><script src="catdocs.js"></script> → catui.docs
//   ESM : import docs from "@imcat-ckim/catui/docs"
// 화면 루트: <div class="Catui_site Catui_dk" data-catui-dk> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 루트가 없는 화면(예: 이 저장소의 문서 사이트)에서는 데이터를 읽지 않고, 순수 함수(md·readTime·search.match)와
// 직접 부르는 부품(toc·code)만 쓸 수 있다.
// 상태(테마·피드백)는 catui.data('docs')(localStorage "catui:docs")에 기억한다.

const DK_STORE = "docs";
const dkGet = (k, d) => { const v = catui.data(DK_STORE)[k]; return v === undefined ? d : v; };
const dkSet = (k, v) => catui.data(DK_STORE, { key: k, value: v });
const dkQuery = () => new URLSearchParams(location.search);
// 숨김 글자(화면 낭독기용) — 역할 없는 span에 aria-label을 달지 않고 이 글자로 의미를 보충한다
const dkClip = (t) => catui.html`<span class="Catui_clip">${t}</span>`;
const dkReduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const docs = {
  version: catui.version,
  root: null,
  /** 규칙 (사이트 정책에 맞게 바꿔 쓴다)
   *  readKo: 한국어 분당 글자 수 · readWords: 영문 등 분당 단어 수 · perPage: 블로그 한 쪽 글 수
   *  related: 관련 글 수 · recent: 홈 최근 글 수 · searchLimit: 검색 결과 최대 수 · tocLevels: 목차에 넣을 제목 */
  rules: { readKo: 500, readWords: 200, perPage: 6, related: 3, recent: 3, searchLimit: 30, tocLevels: "h2, h3" },
  store: { get: dkGet, set: dkSet, clear: () => catui.data(DK_STORE, null) },
  /** 이벤트: 'theme' · 'copy' { text, ok, kind } · 'feedback' { key, value } · 'search' { q, count } · 'filter' { tag, page } · 'version' { href } · 'data' */
  on: (evt, fn) => catui.onevent("docs", evt, fn),
  emit: (evt, payload) => catui.event("docs", evt, null, payload),
  query: dkQuery,
  _offs: [],
  // destroy 뒤에 늦게 도착한 응답(.then 안의 연결)은 등록하지 않는다 — 해제 목록이 이미 비워져 새는 것을 막음
  _on(target, type, fn, opt) { if (!target || this._dead) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
  _seen: new WeakMap(),
  _once(target, key) { let s = this._seen.get(target); if (!s) this._seen.set(target, (s = new Set())); if (s.has(key)) return false; s.add(key); return true; },
};

// ── 화면 낭독기 알림 (한 곳) ──
docs.announce = function (msg) {
  let live = document.querySelector("[data-catui-dk-live]");
  if (!live) {
    live = Object.assign(document.createElement("p"), { className: "Catui_clip" });
    live.setAttribute("aria-live", "polite"); live.setAttribute("data-catui-dk-live", "");
    document.body.appendChild(live);
  }
  live.textContent = "";
  setTimeout(() => { live.textContent = msg; }, 30);   // 같은 문장도 다시 읽히게 비웠다가 넣음
};

// ── 테마: 관리 화면·커뮤니티·쇼핑과 같은 규칙(저장값 없으면 시스템) ──
docs.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => dkGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-dk-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) { dkSet("theme", v); this.apply(v); docs.emit("theme", { value: this.get(), saved: v }); },
  init() {
    // <html data-catui-theme-lock>: 다른 쪽(예: 문서 사이트)이 테마를 관리하는 화면 — 덮어쓰지 않는다
    if (document.documentElement.hasAttribute("data-catui-theme-lock")) return;
    this.apply(this.saved());
    if (!docs._once(document, "theme")) return;   // 재호출 시 클릭이 두 번 처리돼 토글이 상쇄되지 않게
    const mq = matchMedia("(prefers-color-scheme: dark)");
    docs._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    docs._on(document, "click", (e) => { if (e.target.closest("[data-catui-dk-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};

// ── text.js ──
// text — 글자 도구: 안전한 마크다운 일부 · 본문 블록 · 읽는 시간 · 제목 id · 한글 초성 검색
//
// 마크다운(docs.md / docs.mdInline): 먼저 & < > " 를 모두 이스케이프한 뒤 아래만 바꾼다 — 마크업 주입 없음
//   **굵게** · `코드` · [글자](https://주소) (https만, 새 창 + 숨김 글자 "(새 창)") · 빈 줄로 문단 · "- " 목록
//   코드 안(`…`)은 굵게·링크로 바꾸지 않는다. javascript: · http: · 상대 주소 링크는 글자 그대로 둔다.
// 읽는 시간(docs.readTime): 분 = 올림(한글 음절 수 ÷ 500 + 그 밖의 단어 수 ÷ 200), 최소 1분
//   · 한글 음절 = 가–힣, 단어 = 영문·숫자 묶음 · 요소를 넘기면 코드 블록(pre)은 세지 않는다 · rules.readKo/readWords로 바꿈
// 검색 일치(docs.search.match): 본체 command(명령 팔레트)와 같은 규칙 — 띄어쓰기·대소문자 무시, 한글 초성
//   ('ㄷㅅㅂㄷ' · '대ㅅ'(입력 중) · 'ㄷ시' → 대시보드)

const dkEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** 한 줄 마크다운 → HTML 문자열 (이스케이프 후 굵게·코드·https 링크만) */
docs.mdInline = function (src) {
  return dkEsc(src).split(/(`[^`\n]+`)/g).map((seg, i) => (i % 2
    ? `<code>${seg.slice(1, -1)}</code>`
    : seg.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow" target="_blank">$1<span class="Catui_clip"> (새 창)</span></a>'))).join("");
};
/** 여러 줄 마크다운 → HTML 문자열: 빈 줄로 문단, 모든 줄이 "- "면 목록 */
docs.md = function (src) {
  return String(src ?? "").replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim()).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${docs.mdInline(l.slice(2))}</li>`).join("")}</ul>`;
    return `<p>${lines.map((l) => docs.mdInline(l)).join("<br>")}</p>`;
  }).join("");
};

/** 본문 블록(JSON) → 마크업. 글자는 모두 이스케이프(p·list·note는 docs.mdInline)
 *  { h2 } · { h3 } · { p } · { list: [] } · { code, lang } · { note, tone: "tip"|"warn" } */
docs.blocks = function (list = []) {
  const md = (s) => catui.raw(docs.mdInline(s));
  return catui.html`${list.map((b) => {
    if (b.h2) return catui.html`<h2>${b.h2}</h2>`;
    if (b.h3) return catui.html`<h3>${b.h3}</h3>`;
    if (b.list) return catui.html`<ul>${b.list.map((x) => catui.html`<li>${md(x)}</li>`)}</ul>`;
    if (b.code != null) return catui.html`<pre data-lang="${b.lang || ""}"><code>${b.code}</code></pre>`;
    if (b.note) {
      const t = { tip: ["Catui_callout-tip", "팁", "sparkles"], warn: ["Catui_callout-warn", "주의", "alert-triangle"] }[b.tone] || ["", "참고", "info"];
      return catui.html`<div class="Catui_callout ${t[0]}">${catui.icon(t[2], 18)}<p class="Catui_callout-title">${t[1]}</p><p>${md(b.note)}</p></div>`;
    }
    return b.p ? catui.html`<p>${md(b.p)}</p>` : "";
  })}`;
};

/** 읽는 시간 — 글자(문자열) 또는 요소(코드 블록 제외)
 *  → { minutes, ko, words, label: "3분" } */
docs.readTime = function (src) {
  let text = "";
  if (typeof src === "string") text = src;
  else if (src?.nodeType) {
    const w = document.createTreeWalker(src, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest("pre, script, style, .Catui_clip") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) text += ` ${n.nodeValue}`;
  }
  const ko = (text.match(/[가-힣]/g) || []).length;
  const words = (text.replace(/[가-힣]/g, " ").match(/[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g) || []).length;
  const minutes = Math.max(1, Math.ceil(ko / docs.rules.readKo + words / docs.rules.readWords));
  return { minutes, ko, words, label: `${minutes}분` };
};

/** 제목 글자 → id (한글 그대로, 공백·기호는 "-"), 문서 안에서 겹치면 -2, -3 … */
docs.slug = function (text, taken = null) {
  const base = String(text ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "sec";
  let id = base, n = 1;
  const used = (x) => (taken ? taken.has(x) : false) || !!document.getElementById(x);
  while (used(id)) id = `${base}-${++n}`;
  taken?.add(id);
  return id;
};

// ── 한글 초성 (본체 command와 같은 표) ──
const DK_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
docs.chosung = (s) => [...String(s)].map((ch) => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? DK_CHO[Math.floor(k / 588)] : ch; }).join("");

// ── data.js ──
// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API·정적 JSON으로 바꾸면 된다)
//   catui.docs.data('posts').then((rows) => …)   data/posts.json 을 한 번만 읽어 캐시
//   catui.docs.dataBase = '/api/docs/'           주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   파일: nav(문서 메뉴) · pages(문서 본문 블록) · posts · authors · tags · changelog · search-index
docs.dataBase = "data/";
docs._dataCache = new Map();
docs.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiDocs: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
/** "2026-10-28" → "2026.10.28" */
docs.date = (iso, fmt = "yyyy.MM.dd") => catui.util.toDateString(new Date(iso), fmt);
/** 블로그 글·저자·태그를 합쳐 화면 값으로: 글마다 저자 객체·태그 객체, 최신 순 */
docs.blog = function () {
  if (this._blog) return this._blog;
  this._blog = Promise.all(["posts", "authors", "tags"].map((n) => this.data(n))).then(([posts, authors, tags]) => {
    const A = Object.fromEntries(authors.map((a) => [a.id, a]));
    const T = Object.fromEntries(tags.map((t) => [t.id, t]));
    const list = [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => ({ ...p, authorObj: A[p.author] || { id: p.author, name: p.author }, tagObjs: (p.tags || []).map((t) => T[t] || { id: t, name: t }) }));
    const count = Object.fromEntries(tags.map((t) => [t.id, list.filter((p) => (p.tags || []).includes(t.id)).length]));
    const d = { posts: list, byId: Object.fromEntries(list.map((p) => [p.id, p])), authors, A, tags, T, count };
    this.emit("data", { blog: d });
    return d;
  });
  this._blog.catch(() => { this._blog = null; });
  return this._blog;
};
/** 글 본문(블록)의 읽는 시간 — 제목·문단·목록·참고 글자만 센다(코드 제외) */
docs.postTime = (p) => docs.readTime([p.title, p.summary, ...(p.body || []).map((b) => b.h2 || b.h3 || b.p || b.note || (b.list || []).join(" ") || "")].join(" "));

// ── toc.js ──
// toc — 목차 자동 생성 · 제목 앵커(주소 복사) · 코드 블록 복사
//   docs.toc(본문, 상자, { levels: "h2, h3" })  본문의 h2/h3 → 목차 링크(h3는 h2 아래 목록), id 없으면 제목으로 만든다
//     · 스크롤하면 지나간 마지막 제목의 링크에 aria-current="location" (화면 위 30% 선 기준)
//       (본체 site의 [data-catui-spy]는 <section> 단위라 섹션 없는 본문의 h3까지 따라가도록 제목 기준으로 따로 계산)
//     · 제목마다 앵커 버튼(# 모양, 숨김 글자 "… 제목 주소 복사") — 누르면 주소#id를 복사하고 주소창도 바꾼다
//     · [data-catui-dk-notoc] 안의 제목은 넣지 않는다 · 제목이 없으면 상자를 숨긴다
//   docs.code(범위)  범위 안 <pre>마다 머리줄(언어 이름 + 복사 버튼)을 붙인다. 이미 붙인 것은 건너뜀
//     · 복사는 catui.util.copy(비보안 주소에서도 동작), 결과는 버튼 글자("복사됨") + 화면 낭독기 알림 + 'copy' 이벤트
//   선언형: <article data-catui-dk-toc="#목차상자">  ·  <div data-catui-dk-code>
docs._tocs = [];
docs.toc = function (article, box, { levels = docs.rules.tocLevels, title = "이 쪽에서" } = {}) {
  const art = catui.el(article), out = catui.el(box);
  if (!art) return { items: [], el: null };
  const taken = new Set();
  const hs = [...art.querySelectorAll(levels)].filter((h) => !h.closest("[data-catui-dk-notoc]") && h.textContent.trim());
  const items = hs.map((h) => {
    const text = (h.querySelector("[data-dk-text]")?.textContent || h.textContent).trim();
    if (!h.id) h.id = docs.slug(text, taken); else taken.add(h.id);
    if (!h.querySelector(".Catui_dk-anchor")) {
      // 제목 글자는 그대로 두고 끝에 앵커를 붙인다 (제목 글자를 다시 읽을 수 있게 data-dk-text로 감쌈)
      const span = document.createElement("span");
      span.setAttribute("data-dk-text", "");
      while (h.firstChild) span.appendChild(h.firstChild);
      h.appendChild(span);
      const a = document.createElement("a");
      a.className = "Catui_dk-anchor";
      a.href = `#${h.id}`;
      catui.mount(a, catui.html`${catui.icon("link-2", 16)}${dkClip(`${text} 제목 주소 복사`)}`);
      h.appendChild(a);
    }
    return { id: h.id, text, level: Number(h.tagName.slice(1)), el: h };
  });
  if (docs._once(art, "anchor")) docs._on(art, "click", (e) => { const a = e.target.closest(".Catui_dk-anchor"); if (a) { e.preventDefault(); docs.anchor(a.getAttribute("href").slice(1)); } });
  if (!out) return { items, el: null };
  if (!items.length) { out.hidden = true; return { items, el: out }; }
  out.hidden = false;
  // 첫 단계(가장 큰 제목) 아래에 다음 단계를 한 겹 넣는다
  const top = Math.min(...items.map((x) => x.level));
  const groups = [];
  for (const it of items) { if (it.level === top || !groups.length) groups.push({ it, kids: [] }); else groups[groups.length - 1].kids.push(it); }
  const link = (it) => catui.html`<a href="#${it.id}">${it.text}</a>`;
  const mobile = matchMedia("(max-width: 991px)");
  const opened = out.querySelector("details")?.open ?? !mobile.matches;
  catui.mount(out, catui.html`<details class="Catui_dk-toc"${opened ? catui.html` open` : ""}><summary class="Catui_dk-toc-t">${title}${catui.icon("chevron-down", 16)}</summary><nav aria-label="${title}"><ol>${groups.map((g) => catui.html`<li>${link(g.it)}${g.kids.length ? catui.html`<ol>${g.kids.map((k) => catui.html`<li>${link(k)}</li>`)}</ol>` : ""}</li>`)}</ol></nav></details>`);
  if (out.closest(".Catui_dk-docs") && docs._once(out, "toc-layout")) {
    const parent = out.parentElement, next = out.nextSibling;
    const place = () => {
      if (mobile.matches) art.querySelector(":scope > header")?.after(out);
      else parent.insertBefore(out, next?.parentNode === parent ? next : art);
    };
    docs._on(mobile, "change", () => { place(); out.querySelector("details").open = !mobile.matches; });
    place();
  }
  const t = { items, links: [...out.querySelectorAll("a[href^='#']")], box: out };
  docs._tocs = docs._tocs.filter((x) => x.box !== out && x.box.isConnected).concat(t);
  if (docs._once(window, "spy")) {
    let raf = 0;
    const sync = () => { raf = 0; docs.tocSync(); };
    docs._on(window, "scroll", () => { if (!raf) raf = requestAnimationFrame(sync); }, { passive: true });
    docs._on(window, "resize", () => docs.tocSync());
    docs._offs.push(() => cancelAnimationFrame(raf));
  }
  docs.tocSync();
  return { items, el: out };
};
/** 현재 위치 다시 계산 (스크롤·크기 바뀜 때 자동, 내용을 바꾼 뒤 직접 불러도 된다) */
docs.tocSync = function () {
  const line = innerHeight * 0.3, atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
  for (const t of docs._tocs) {
    const live = t.items.filter((x) => x.el.isConnected);
    let cur = null;
    for (const x of live) if (x.el.getBoundingClientRect().top <= line) cur = x;
    if (atEnd && live.length && live[live.length - 1].el.getBoundingClientRect().top < innerHeight) cur = live[live.length - 1];
    t.links.forEach((a) => { if (cur && a.getAttribute("href") === `#${cur.id}`) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  }
};
/** 제목 주소 복사: 주소창을 #id로 바꾸고(기록 안 남김) 전체 주소를 복사 */
docs.anchor = async function (id) {
  const url = `${location.href.split("#")[0]}#${id}`;
  try { history.replaceState(history.state, "", `#${id}`); } catch { /* file:// 등 */ }
  document.getElementById(id)?.scrollIntoView({ behavior: dkReduced() ? "auto" : "smooth", block: "start" });
  const ok = await catui.util.copy(url);
  catui.layer.msg(ok ? "제목 주소를 복사했습니다" : "주소를 복사하지 못했습니다", { icon: ok ? "success" : "warn", time: 1400 });
  docs.emit("copy", { text: url, ok, kind: "anchor" });
  return ok;
};

// ── 코드 블록 ──
docs.code = function (scope = document) {
  const root = scope?.nodeType === 9 ? scope : catui.el(scope);   // 문서(document)도 받는다
  if (!root) return 0;
  let n = 0;
  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.closest(".Catui_dk-code") || pre.closest("[data-catui-dk-nocopy]")) return;
    const wrap = document.createElement("div");
    wrap.className = "Catui_codeblock Catui_dk-code";
    pre.replaceWith(wrap);
    const lang = pre.getAttribute("data-lang") || pre.querySelector("code")?.getAttribute("data-lang") || "코드";
    catui.mount(wrap, catui.html`<div class="Catui_codeblock-h"><span>${lang}</span><button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_dk-copy" type="button" data-catui-dk-copy>${catui.icon("copy", 16)}<span data-label>복사</span>${dkClip(` ${lang} 코드`)}</button></div>`);
    pre.tabIndex = 0;   // 가로로 넘치는 코드를 키보드로도 밀 수 있게
    wrap.appendChild(pre);
    n += 1;
  });
  if (docs._once(root, "copy")) docs._on(root, "click", (e) => { const b = e.target.closest("[data-catui-dk-copy]"); if (b && root.contains(b) && !e.catuiDkCopy) { e.catuiDkCopy = true; docs.copyCode(b); } });   // 겹친 범위에 붙여도 한 번만
  return n;
};
docs.copyCode = async function (btn) {
  const pre = btn.closest(".Catui_dk-code")?.querySelector("pre");
  const text = (pre?.querySelector("code") || pre)?.textContent ?? "";
  const ok = text ? await catui.util.copy(text) : false;
  const label = btn.querySelector("[data-label]");
  if (label) {
    label.textContent = ok ? "복사됨" : "실패";
    clearTimeout(Number(btn.dataset.timer));
    btn.dataset.timer = String(setTimeout(() => { label.textContent = "복사"; }, 1500));
  }
  docs.announce(ok ? "코드를 복사했습니다" : "코드를 복사하지 못했습니다");
  docs.emit("copy", { text, ok, kind: "code" });
  return ok;
};

// ── search.js ──
// search — 문서 검색 (서버 없이 색인 JSON으로)
//   색인 항목: { t: 제목, u: 주소, s: 분류, x: 요약·본문 일부, k: 키워드 }
//   색인 읽기 순서: ① 화면 안 <script type="application/json" data-catui-dk-index>[…]</script>(인라인) ② data/search-index.json
//   점수: 제목에 그대로 있음 4 · 제목 초성 일치 3 · 키워드 2 · 요약·본문 1 (같으면 색인 순서) · 최대 rules.searchLimit개
//   form[data-catui-dk-search]        머리 검색: 빈 값이면 막고 입력칸으로, 한글 조합 중 Enter는 무시
//   form[data-catui-dk-search="live"] 검색 화면: 입력하는 대로 결과(조합이 끝난 뒤) + 주소 ?q= 맞춤(기록 안 남김)
//   [data-catui-dk-results] 결과 목록 · [data-catui-dk-count] 결과 수(role="status")
docs.search = {
  /** 본체 command와 같은 일치 규칙: 띄어쓰기·대소문자 무시 포함 검색 + 한글 초성(자음은 그 자리 글자의 초성과) */
  match(text, q) {
    const flat = String(text ?? "").toLowerCase().replace(/\s+/g, ""), qq = String(q ?? "").toLowerCase().replace(/\s+/g, "");
    if (!qq) return true;
    if (flat.includes(qq)) return true;
    const qa = [...qq];
    if (!qa.some((ch) => /[ㄱ-ㅎ]/.test(ch))) return false;
    const fa = [...flat], ca = [...docs.chosung(flat)];
    for (let s = 0; s + qa.length <= fa.length; s++) if (qa.every((ch, k) => fa[s + k] === ch || (/[ㄱ-ㅎ]/.test(ch) && ca[s + k] === ch))) return true;
    return false;
  },
  score(it, q) {
    const qq = String(q).toLowerCase().replace(/\s+/g, "");
    const title = String(it.t || "").toLowerCase().replace(/\s+/g, "");
    if (title.includes(qq)) return 4;
    if (this.match(it.t, q)) return 3;
    if (this.match(it.k, q)) return 2;
    if (this.match(`${it.x || ""} ${it.s || ""}`, q)) return 1;
    return 0;
  },
  /** 색인에서 찾기 → 점수 순 [{ ...항목, score }] */
  find(index, q, limit = docs.rules.searchLimit) {
    const s = String(q ?? "").trim();
    if (!s) return [];
    return (index || []).map((it, i) => ({ ...it, score: this.score(it, s), i })).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.i - b.i).slice(0, limit).map(({ i, ...x }) => x);
  },
  /** 색인 읽기 (인라인 우선) */
  load(scope = document) {
    const inline = scope.querySelector?.('script[type="application/json"][data-catui-dk-index]');
    if (inline) { try { return Promise.resolve(JSON.parse(inline.textContent)); } catch (err) { catui.hint.error("CatuiDocs: 인라인 검색 색인 JSON 문법 오류", "error", err); } }
    return docs.data("search-index");
  },
  /** 글자 안 검색어(그대로 일치하는 부분)를 <mark>로 — 글자는 이스케이프 */
  highlight(text, q) {
    const s = String(text ?? ""), k = String(q ?? "").trim();
    if (!k) return catui.html`${s}`;
    const at = s.toLowerCase().indexOf(k.toLowerCase());
    if (at < 0) return catui.html`${s}`;
    return catui.html`${s.slice(0, at)}<mark class="Catui_dk-mark">${s.slice(at, at + k.length)}</mark>${s.slice(at + k.length)}`;
  },
  render(box, results, q) {
    catui.mount(box, results.length
      ? catui.html`${results.map((r) => catui.html`<li class="Catui_dk-result"><a href="${r.u}"><span class="Catui_dk-result-s">${r.s || "문서"}</span><b>${this.highlight(r.t, q)}</b></a>${r.x ? catui.html`<p>${this.highlight(r.x, q)}</p>` : ""}</li>`)}`
      : "");
  },
  init(root) {
    root.querySelectorAll("form[data-catui-dk-search]").forEach((f) => {
      const input = f.querySelector("input[name=q]");
      if (!input || !docs._once(f, "search")) return;
      const q0 = docs.query().get("q");
      if (q0 && !input.value) input.value = q0;
      docs._on(input, "keydown", (e) => { if (e.key === "Enter" && catui.imeBusy(e)) e.preventDefault(); });   // 조합을 끝내는 Enter로 제출하지 않음
      if (f.getAttribute("data-catui-dk-search") !== "live") {
        docs._on(f, "submit", (e) => { if (!input.value.trim()) { e.preventDefault(); input.focus(); } });
        return;
      }
      const list = root.querySelector("[data-catui-dk-results]"), count = root.querySelector("[data-catui-dk-count]");
      let index = null, timer = 0;
      const run = () => {
        const q = input.value.trim(), res = this.find(index, q);
        if (list) this.render(list, res, q);
        if (count) count.textContent = !q ? "검색어를 입력해 주세요. 초성(예: ㅁㅊ)으로도 찾습니다." : res.length ? `‘${q}’ 검색 결과 ${res.length}건` : `‘${q}’에 맞는 문서가 없습니다. 다른 낱말이나 초성으로 찾아보세요.`;
        try { const u = new URL(location.href); if (q) u.searchParams.set("q", q); else u.searchParams.delete("q"); history.replaceState(history.state, "", u); } catch { /* file:// 등 */ }
        docs.emit("search", { q, count: res.length });
        return res;
      };
      this.run = run;
      docs._on(f, "submit", (e) => { e.preventDefault(); if (index) run(); });
      docs._on(input, "input", (e) => { if (e.isComposing) return; clearTimeout(timer); timer = setTimeout(() => { if (index) run(); }, 120); });
      docs._on(input, "compositionend", () => { clearTimeout(timer); timer = setTimeout(() => { if (index) run(); }, 120); });
      docs._offs.push(() => clearTimeout(timer));
      const load = () => {
        if (list) list.setAttribute("aria-busy", "true");
        if (count) count.textContent = "검색 데이터를 불러오는 중입니다…";
        return this.load(root).then((ix) => {
          index = ix; this.index = ix; run(); return ix;
        }, () => {
          if (count) count.textContent = "검색 데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.";
          if (list) {
            catui.mount(list, catui.html`<li><button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-retry>다시 시도</button></li>`);
            docs._on(list.querySelector("[data-retry]"), "click", (e) => { e.currentTarget.disabled = true; this.ready = load(); }, { once: true });
          }
          return null;
        }).finally(() => list?.removeAttribute("aria-busy"));
      };
      this.ready = load();
    });
  },
};

// ── blog.js ──
// blog — 블로그 목록(태그 필터·쪽 이동 ↔ 주소) · 글 보기 · 태그 · 저자 · 최근 글 · 변경 이력
//   [data-catui-dk-blog]          목록: 주소 ?tag=&page= ↔ 화면(태그 버튼 aria-pressed · 쪽 번호), 뒤로 가기 따라감
//   [data-catui-dk-post]          글 보기 ?id= (없으면 최신 글): 머리 그림·저자·날짜·읽는 시간·본문·목차·공유·관련 글
//   [data-catui-dk-tagpage]       태그 ?t= : 태그 모음(글 수) + 그 태그 글
//   [data-catui-dk-author]        저자 ?a= (없으면 첫 저자): 소개 + 그 저자 글 + 다른 저자
//   [data-catui-dk-posts="recent"] 최근 글 카드 (data-size, 기본 rules.recent)
//   [data-catui-dk-changelog]     변경 이력(data/changelog.json): 버전마다 추가·변경·고침 배지(글자 + 색), 종류 거르기
const DK_KINDS = { added: ["추가", "Catui_badge-success"], changed: ["변경", "Catui_badge-info"], fixed: ["고침", "Catui_badge-warning"] };
const DK_COVERS = { workspace: "workspace.png", reading: "reading.jpg", keyboard: "keyboard.jpg" };
const dkCover = (p, lg = false) => catui.html`<span class="Catui_dk-cover${lg ? " Catui_dk-cover-lg" : ""}" data-tone="${p.tone || 1}" aria-hidden="true">${catui.icon(p.icon || "book-open", lg ? 24 : 20)}${Object.hasOwn(DK_COVERS, p.cover) ? catui.html`<img src="../../../assets/photos/${DK_COVERS[p.cover]}" alt="" width="960" height="640" loading="${lg ? "eager" : "lazy"}" decoding="async">` : ""}</span>`;
const dkAvatar = (a, size = "md") => catui.html`<span class="Catui_av Catui_av-${size} Catui_dk-av" data-tone="${a.tone || 1}" aria-hidden="true">${String(a.name || "?").slice(0, 1)}</span>`;
const dkTags = (p) => (p.tagObjs?.length ? catui.html`<ul class="Catui_dk-tags" aria-label="태그">${p.tagObjs.map((t) => catui.html`<li><a class="Catui_dk-tag" href="tag.html?t=${encodeURIComponent(t.id)}">#${t.name}</a></li>`)}</ul>` : "");

docs.meta = (p) => catui.html`<p class="Catui_dk-meta"><a href="author.html?a=${encodeURIComponent(p.authorObj.id)}">${p.authorObj.name}</a><span aria-hidden="true">·</span><time datetime="${p.date}">${docs.date(p.date)}</time><span aria-hidden="true">·</span><span>${docs.postTime(p).label} 읽기</span></p>`;
/** 글 카드 (글자는 모두 이스케이프) */
docs.card = (p, { cover = true } = {}) => catui.html`<li class="Catui_dk-card"><a class="Catui_dk-card-link" href="post.html?id=${encodeURIComponent(p.id)}">${cover ? dkCover(p) : ""}<span class="Catui_dk-card-b"><b class="Catui_dk-card-t">${p.title}</b><span class="Catui_dk-card-d">${p.summary || ""}</span></span></a>${docs.meta(p)}${dkTags(p)}</li>`;
docs.empty = (title, text = "") => catui.html`<li class="Catui_dk-wide"><div class="Catui_empty">${catui.icon("file-search", 24)}<p class="Catui_empty-title">${title}</p>${text ? catui.html`<p class="Catui_empty-text">${text}</p>` : ""}</div></li>`;
/** 쪽 이동 버튼 (현재 aria-current="page", 끝에서는 이전/다음 잠김) */
docs.pager = (page, pages) => (pages > 1 ? catui.html`<button class="Catui_pg" type="button" data-page="${page - 1}" aria-label="이전 쪽" ${page <= 1 ? catui.html`disabled` : ""}>${catui.icon("chevron-left", 16)}</button>${Array.from({ length: pages }, (_, i) => i + 1).map((n) => catui.html`<button class="Catui_pg" type="button" data-page="${n}" aria-label="${n}쪽" ${n === page ? catui.html`aria-current="page"` : ""}>${n}</button>`)}<button class="Catui_pg" type="button" data-page="${page + 1}" aria-label="다음 쪽" ${page >= pages ? catui.html`disabled` : ""}>${catui.icon("chevron-right", 16)}</button>` : "");

docs.blogList = {
  /** 주소 → { tag, page } */
  read(qs = docs.query()) { return { tag: qs.get("tag") || "", page: Math.max(1, parseInt(qs.get("page"), 10) || 1) }; },
  /** 거르고 자르기 → { rows, total, pages, page } */
  slice(posts, { tag = "", page = 1 } = {}) {
    const all = tag ? posts.filter((p) => (p.tags || []).includes(tag)) : posts;
    const pages = Math.max(1, Math.ceil(all.length / docs.rules.perPage)), cur = Math.min(Math.max(1, page), pages);
    return { rows: all.slice((cur - 1) * docs.rules.perPage, cur * docs.rules.perPage), total: all.length, pages, page: cur };
  },
  init(root) {
    const box = root.querySelector("[data-catui-dk-blog]");
    if (!box) return;
    this.box = box;
    docs._on(box, "click", (e) => {
      const t = e.target.closest("[data-tag]"), pg = e.target.closest("[data-page]");
      if (t) this.go({ tag: t.dataset.tag, page: 1 }, `[data-tag="${t.dataset.tag}"]`);
      else if (pg && !pg.disabled) this.go({ ...this.read(), page: Number(pg.dataset.page) }, `[data-page="${pg.dataset.page}"]`);
    });
    docs._on(window, "popstate", () => this.draw());
    const load = (retry = false) => {
      box.setAttribute("aria-busy", "true");
      this.d = null;
      return docs.blog().then((d) => {
        if (docs._dead) return null;
        this.d = d; this.draw();
        if (retry) box.querySelector('[data-tag][aria-pressed="true"]')?.focus({ preventScroll: true });
        return d;
      }).catch(() => {
        if (docs._dead) return null;
        const list = box.querySelector("[data-list]"), count = box.querySelector("[data-count]");
        if (count) count.textContent = "글을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.";
        if (list) {
          catui.mount(list, catui.html`<li class="Catui_dk-wide"><div class="Catui_empty" role="alert"><p class="Catui_empty-title">블로그 글을 불러오지 못했습니다</p><p class="Catui_empty-text">연결 상태를 확인하고 다시 시도해 주세요. 선택한 태그와 페이지는 유지됩니다.</p><button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-retry>다시 시도</button></div></li>`);
          docs._on(list.querySelector("[data-retry]"), "click", (e) => { e.currentTarget.disabled = true; this.ready = load(true); }, { once: true });
        }
        return null;
      }).finally(() => box.removeAttribute("aria-busy"));
    };
    this.ready = load();
  },
  /** 상태를 바꾸고 주소에 남긴다(뒤로 가기로 돌아올 수 있게) */
  go(state, focusSel) {
    const u = new URL(location.href);
    if (state.tag) u.searchParams.set("tag", state.tag); else u.searchParams.delete("tag");
    if (state.page > 1) u.searchParams.set("page", String(state.page)); else u.searchParams.delete("page");
    if (u.href !== location.href) history.pushState(null, "", u);
    this.draw(focusSel);
    if (focusSel?.startsWith("[data-page")) this.box.scrollIntoView({ block: "start", behavior: dkReduced() ? "auto" : "smooth" });
  },
  draw(focusSel) {
    if (!this.d) return;
    const d = this.d, st = this.read(), tag = d.T[st.tag] ? st.tag : "", v = this.slice(d.posts, { tag, page: st.page });
    const chips = this.box.querySelector("[data-filter]"), list = this.box.querySelector("[data-list]"), pager = this.box.querySelector("[data-pager]"), count = this.box.querySelector("[data-count]");
    const chip = (id, name, n) => catui.html`<button class="Catui_dk-chip" type="button" data-tag="${id}" aria-pressed="${id === tag}">${id === tag ? catui.icon("check", 16) : ""}${name}<span class="Catui_dk-chip-n">${n}${dkClip("개")}</span></button>`;
    if (chips) catui.mount(chips, catui.html`${chip("", "전체", d.posts.length)}${d.tags.map((t) => chip(t.id, `#${t.name}`, d.count[t.id] || 0))}`);
    if (list) catui.mount(list, v.rows.length ? catui.html`${v.rows.map((p) => docs.card(p, { cover: !this.box.hasAttribute("data-catui-dk-text-only") }))}` : docs.empty("이 태그의 글이 아직 없습니다"));
    if (pager) { catui.mount(pager, docs.pager(v.page, v.pages)); pager.hidden = v.pages <= 1; }
    if (count) count.textContent = `${tag ? `#${d.T[tag].name} ` : ""}글 ${v.total}개 · ${v.page}/${v.pages}쪽`;
    if (focusSel) {
      // 다시 그려도 누른 버튼 자리로 포커스를 돌려준다 (잠긴 이전/다음이면 현재 쪽 번호로)
      const el = this.box.querySelector(focusSel);
      (el && !el.disabled ? el : this.box.querySelector('[aria-current="page"]') || this.box.querySelector("[data-tag]"))?.focus({ preventScroll: true });
    }
    docs.emit("filter", { tag, page: v.page, total: v.total });
  },
};

docs.post = {
  init(root) {
    const art = root.querySelector("[data-catui-dk-post]");
    if (!art) return;
    this.ready = docs.blog().then((d) => {
      const id = docs.query().get("id"), p = d.byId[id] || d.posts[0];
      if (!p) return null;
      const $ = (s) => art.querySelector(s);
      document.title = `${p.title} · Catui 문서`;
      $("[data-title]").textContent = p.title;
      catui.mount($("[data-tags]"), dkTags(p));
      catui.mount($("[data-meta]"), catui.html`${dkAvatar(p.authorObj, "sm")}${docs.meta(p)}`);
      catui.mount($("[data-cover]"), dkCover(p, true));
      catui.mount($("[data-body]"), catui.html`${p.summary ? catui.html`<p class="Catui_lead">${p.summary}</p>` : ""}${docs.blocks(p.body)}`);
      root.querySelectorAll("[data-catui-share]").forEach((b) => b.setAttribute("data-catui-share-title", p.title));
      const who = root.querySelector("[data-author-box]");
      if (who) catui.mount(who, catui.html`${dkAvatar(p.authorObj, "lg")}<div><p class="Catui_dk-who-n"><a href="author.html?a=${encodeURIComponent(p.authorObj.id)}">${p.authorObj.name}</a><span>${p.authorObj.role || ""}</span></p><p>${p.authorObj.bio || ""}</p></div>`);
      const rel = root.querySelector("[data-related]");
      if (rel) {
        const near = d.posts.filter((x) => x.id !== p.id).map((x) => ({ x, n: (x.tags || []).filter((t) => (p.tags || []).includes(t)).length })).filter((o) => o.n > 0).sort((a, b) => b.n - a.n).slice(0, docs.rules.related).map((o) => o.x);
        catui.mount(rel, near.length ? catui.html`${near.map((x) => docs.card(x))}` : docs.empty("관련 글이 없습니다"));
      }
      docs.refresh(art);
      return p;
    }, () => null);
  },
};

docs.tagPage = {
  init(root) {
    const box = root.querySelector("[data-catui-dk-tagpage]");
    if (!box) return;
    this.ready = docs.blog().then((d) => {
      const t = d.T[docs.query().get("t")] || null;
      const $ = (s) => box.querySelector(s);
      catui.mount($("[data-cloud]"), catui.html`${d.tags.map((x) => catui.html`<li><a class="Catui_dk-tag" href="tag.html?t=${encodeURIComponent(x.id)}" ${t && x.id === t.id ? catui.html`aria-current="page"` : ""}>#${x.name}<span class="Catui_dk-chip-n">${d.count[x.id] || 0}${dkClip("개")}</span></a></li>`)}`);
      if (t) { $("[data-title]").textContent = `#${t.name}`; $("[data-desc]").textContent = t.desc || ""; document.title = `#${t.name} · Catui 문서`; }
      const rows = t ? d.posts.filter((p) => (p.tags || []).includes(t.id)) : d.posts;
      catui.mount($("[data-list]"), rows.length ? catui.html`${rows.map((p) => docs.card(p))}` : docs.empty("이 태그의 글이 아직 없습니다"));
      return t;
    }, () => null);
  },
};

docs.authorPage = {
  init(root) {
    const box = root.querySelector("[data-catui-dk-author]");
    if (!box) return;
    this.ready = docs.blog().then((d) => {
      const a = d.A[docs.query().get("a")] || d.authors[0];
      if (!a) return null;
      const $ = (s) => box.querySelector(s);
      $("[data-title]").textContent = a.name;
      document.title = `${a.name} · Catui 문서`;
      catui.mount($("[data-profile]"), catui.html`${dkAvatar(a, "xl")}<div><p class="Catui_dk-who-n"><span>${a.role || ""}</span></p><p>${a.bio || ""}</p>${a.site ? catui.html`<p><a class="Catui_link" href="${a.site}" rel="noopener" target="_blank">${a.site.replace(/^https:\/\//, "")}${dkClip(" (새 창)")}</a></p>` : ""}</div>`);
      const rows = d.posts.filter((p) => p.author === a.id);
      catui.mount($("[data-list]"), rows.length ? catui.html`${rows.map((p) => docs.card(p))}` : docs.empty("아직 쓴 글이 없습니다"));
      const others = $("[data-others]");
      if (others) catui.mount(others, catui.html`${d.authors.filter((x) => x.id !== a.id).map((x) => catui.html`<li><a href="author.html?a=${encodeURIComponent(x.id)}">${dkAvatar(x, "sm")}<span>${x.name}</span></a></li>`)}`);
      return a;
    }, () => null);
  },
};

docs.recent = {
  init(root) {
    const boxes = root.querySelectorAll('[data-catui-dk-posts="recent"]');
    if (!boxes.length) return;
    this.ready = docs.blog().then((d) => boxes.forEach((b) => catui.mount(b, catui.html`${d.posts.slice(0, Number(b.dataset.size) || docs.rules.recent).map((p) => docs.card(p))}`)), () => null);
  },
};

docs.changelog = {
  kinds: DK_KINDS,
  /** 종류 배지: 글자("추가")와 색을 함께 */
  badge: (kind) => { const k = DK_KINDS[kind] || [kind, "Catui_badge-neutral"]; return catui.html`<span class="Catui_badge ${k[1]} Catui_dk-kind">${k[0]}</span>`; },
  init(root) {
    const box = root.querySelector("[data-catui-dk-changelog]");
    if (!box) return;
    this.ready = docs.data("changelog").then((rows) => {
      const list = box.querySelector("[data-list]") || box;
      catui.mount(list, catui.html`${rows.map((r, i) => catui.html`<section class="Catui_dk-release" aria-labelledby="v-${String(r.version).replace(/\W/g, "-")}"><h2 id="v-${String(r.version).replace(/\W/g, "-")}">v${r.version}</h2><p class="Catui_dk-meta"><time datetime="${r.date}">${docs.date(r.date)}</time>${i === 0 ? catui.html`<span class="Catui_pill Catui_pill-success">최신</span>` : ""}</p><ul class="Catui_dk-changes">${(r.items || []).map((it) => catui.html`<li data-kind="${it.type}">${this.badge(it.type)}<span>${catui.raw(docs.mdInline(it.text))}</span></li>`)}</ul></section>`)}`);
      const f = box.querySelector("[data-kinds]");
      if (f && docs._once(f, "kinds")) {
        const paint = (k) => {
          f.querySelectorAll("[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
          list.querySelectorAll("[data-kind]").forEach((li) => { li.hidden = !!k && li.dataset.kind !== k; });
          list.querySelectorAll(".Catui_dk-release").forEach((s) => { s.hidden = !s.querySelector("[data-kind]:not([hidden])"); });
        };
        docs._on(f, "click", (e) => { const b = e.target.closest("[data-k]"); if (b) paint(b.dataset.k); });
        paint("");
      }
      docs.refresh(box.closest("article") || box);
      return rows;
    }, () => null);
  },
};

// ── shell.js ──
// shell — 문서 셸: 왼쪽 메뉴(data/nav.json) · 문서 본문(data/pages.json) · 이전/다음 · 피드백 · 버전 선택 · 읽는 시간
//   [data-catui-dk-nav]                  왼쪽 문서 메뉴 — 지금 쪽(파일 이름 + ?p=)에 aria-current="page"
//   <details class="Catui_dk-side">      좁은 화면(991px 이하)에서는 접어서 시작, 넓으면 펼침
//   [data-catui-dk-page="intro"]         문서 본문을 pages.json에서 그림(주소 ?p= 가 우선): 제목·마지막 수정일·편집 링크·본문 블록
//   [data-catui-dk-pager]                이전·다음 문서 (nav.json 순서)
//   <article data-catui-dk-toc="#상자">  본문을 다 그린 뒤 목차·제목 앵커·코드 복사를 붙인다(docs.refresh)
//   [data-catui-dk-readtime="#본문"]     읽는 시간 글자 "3분 읽기" (값이 없으면 가장 가까운 article)
//   [data-catui-dk-feedback="키"]        "도움이 되었나요?" 예/아니오(aria-pressed) — 키마다 기억, 다시 열어도 표시
//   select[data-catui-dk-version]        버전 선택: option value(주소)로 이동, ?v= 에 맞는 항목을 고르고 옛 버전이면 [data-catui-dk-old] 안내를 보임
docs.pageKey = (href = location.href) => { const u = new URL(href, location.href); const f = u.pathname.split("/").pop() || "index.html"; const p = u.searchParams.get("p"); return p ? `${f}?p=${p}` : f; };

/** 본문을 바꾼 뒤 부르기: 코드 복사 · 목차 · 읽는 시간 */
docs.refresh = function (article) {
  const art = catui.el(article);
  if (!art) return;
  docs.code(art);
  const sel = art.getAttribute("data-catui-dk-toc");
  if (sel != null) docs.toc(art, sel ? document.querySelector(sel) : null);
  docs.readTimeFill(document);
};
docs.readTimeFill = function (scope = document) {
  scope.querySelectorAll("[data-catui-dk-readtime]").forEach((el) => {
    const sel = el.getAttribute("data-catui-dk-readtime");
    let t = null;
    try { t = sel ? document.querySelector(sel) : el.closest("article"); } catch { t = null; }
    if (t) el.textContent = `${docs.readTime(t).label} 읽기`;
  });
};

docs.shell = {
  init(root) {
    const topnav = root.querySelector(".Catui_dk-nav");
    if (topnav && docs._once(topnav, "current-visible")) {
      const layout = () => {
        const active = topnav.querySelector('[aria-current="page"]');
        if (!active) return;
        const outer = topnav.getBoundingClientRect(), item = active.getBoundingClientRect();
        if (item.left < outer.left) topnav.scrollLeft += item.left - outer.left;
        else if (item.right > outer.right) topnav.scrollLeft += item.right - outer.right;
      };
      docs._on(window, "resize", layout);
      layout();
    }
    if (docs._once(root, "cover-error")) docs._on(root, "error", (e) => { if (e.target.matches?.(".Catui_dk-cover img")) e.target.hidden = true; }, true);
    // 좁은 화면은 메뉴를 접어서 시작 (스크립트가 없으면 펼친 그대로)
    root.querySelectorAll("details.Catui_dk-side").forEach((d) => { d.open = !matchMedia("(max-width: 991px)").matches; });
    root.querySelectorAll("[data-catui-dk-toc]").forEach((art) => { if (!art.hasAttribute("data-catui-dk-page")) docs.refresh(art); });
    if (!root.querySelector("[data-catui-dk-toc]")) docs.code(root.querySelector(".Catui_dk-main") || root);
    docs.readTimeFill(root);
    const nav = root.querySelector("[data-catui-dk-nav]"), pager = root.querySelector("[data-catui-dk-pager]"), page = root.querySelector("[data-catui-dk-page]");
    if (!nav && !pager && !page) return;
    const content = page?.querySelector("[data-body]") || nav;
    const footer = page ? [...page.querySelectorAll(".Catui_dk-doc-f, [data-catui-dk-feedback]")] : [];
    const load = () => {
      if (docs._dead || !root.isConnected) return Promise.resolve(null);
      content?.setAttribute("aria-busy", "true");
      footer.forEach((el) => { el.hidden = true; });
      if (page?.querySelector("[data-desc]")) page.querySelector("[data-desc]").textContent = "문서 정보를 불러오는 중입니다…";
      return Promise.all([docs.data("nav"), page ? docs.data("pages") : null]).then(([groups, pages]) => {
      if (docs._dead || !root.isConnected) return null;
      const flat = groups.flatMap((g) => g.items);
      footer.forEach((el) => { el.hidden = false; });
      let key = docs.pageKey();
      if (page) {
        const id = pages[docs.query().get("p")] ? docs.query().get("p") : page.getAttribute("data-catui-dk-page");
        key = `${location.pathname.split("/").pop() || "doc.html"}?p=${id}`;
        this.drawPage(page, pages[id], id);
      }
      if (nav) catui.mount(nav, catui.html`${groups.map((g, i) => catui.html`<div class="Catui_dk-nav-g"><p class="Catui_dk-nav-t" id="dk-nav-g${i}">${g.title}</p><ul aria-labelledby="dk-nav-g${i}">${g.items.map((it) => catui.html`<li><a href="${it.href}" ${docs.pageKey(it.href) === key ? catui.html`aria-current="page"` : ""}>${it.title}</a></li>`)}</ul></div>`)}`);
      if (pager) {
        const i = flat.findIndex((it) => docs.pageKey(it.href) === key), prev = flat[i - 1], next = i < 0 ? null : flat[i + 1];
        catui.mount(pager, catui.html`${prev ? catui.html`<a class="Catui_dk-pn" href="${prev.href}"><span>${catui.icon("arrow-left", 16)}이전</span><b>${prev.title}</b></a>` : catui.html`<span></span>`}${next ? catui.html`<a class="Catui_dk-pn Catui_dk-pn-next" href="${next.href}"><span>다음${catui.icon("arrow-right", 16)}</span><b>${next.title}</b></a>` : ""}`);
      }
      if (page && location.hash) return new Promise((resolve) => requestAnimationFrame(() => {
        if (docs._dead || !page.isConnected) return resolve(groups);
        let anchor;
        try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { anchor = ""; }
        const target = anchor && document.getElementById(anchor);
        if (target && page.contains(target)) {
          const head = root.querySelector(".Catui_dk-head");
          const gap = parseFloat(getComputedStyle(page).getPropertyValue("--Catui_space-4")) || 0;
          scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + scrollY - (head?.getBoundingClientRect().height || 0) - gap), behavior: "instant" });
        }
        resolve(groups);
      }));
      return groups;
      }, () => {
        if (docs._dead || !root.isConnected) return null;
        if (page?.querySelector("[data-desc]")) page.querySelector("[data-desc]").textContent = "문서 정보를 불러오지 못했습니다.";
        if (nav && nav !== content) nav.textContent = "문서 메뉴를 불러오지 못했습니다. 본문에서 다시 시도해 주세요.";
        if (content) {
          catui.mount(content, catui.html`<div class="Catui_empty" role="alert"><p class="Catui_empty-title">문서 정보를 불러오지 못했습니다</p><p class="Catui_empty-text">연결 상태를 확인하고 다시 시도해 주세요.</p><button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-retry>다시 시도</button></div>`);
          docs._on(content.querySelector("[data-retry]"), "click", (e) => { e.currentTarget.disabled = true; this.ready = load(); }, { once: true });
        }
        return null;
      }).finally(() => content?.removeAttribute("aria-busy"));
    };
    this.ready = load();
  },
  /** pages.json 한 쪽 → 제목·수정일·편집 링크·본문 */
  drawPage(box, pg, id) {
    if (!pg) return;
    const $ = (s) => box.querySelector(s);
    if ($("[data-title]")) $("[data-title]").textContent = pg.title;
    if ($("[data-crumb]")) $("[data-crumb]").textContent = pg.group || "문서";
    if ($("[data-desc]")) $("[data-desc]").textContent = pg.desc || "";
    document.title = `${pg.title} · Catui 문서`;
    catui.mount($("[data-body]"), docs.blocks(pg.blocks));
    box.closest("[data-catui-dk]")?.querySelectorAll("[data-updated]").forEach((t) => { t.setAttribute("datetime", pg.updated); t.textContent = docs.date(pg.updated); });
    box.closest("[data-catui-dk]")?.querySelectorAll("[data-edit]").forEach((a) => { if (/^https:\/\//.test(pg.edit || "")) a.href = pg.edit; });
    box.closest("[data-catui-dk]")?.querySelectorAll("[data-catui-dk-feedback]").forEach((f) => { f.setAttribute("data-catui-dk-feedback", `doc:${id}`); docs.feedback.paint(f); });
    docs.refresh(box);
  },
};

docs.feedback = {
  get: (key) => (dkGet("helped", {}) || {})[key] || "",
  set(key, value) { const all = { ...(dkGet("helped", {}) || {}) }; if (value) all[key] = value; else delete all[key]; dkSet("helped", all); docs.emit("feedback", { key, value }); },
  keyOf: (box) => box.getAttribute("data-catui-dk-feedback") || docs.pageKey(),
  paint(box) {
    const v = this.get(this.keyOf(box));
    box.querySelectorAll("[data-vote]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vote === v)));
    const msg = box.querySelector("[data-msg]");
    if (msg) msg.textContent = v === "yes" ? "알려 주셔서 고맙습니다. 다음 문서도 이렇게 쓰겠습니다." : v === "no" ? "고맙습니다. 무엇이 부족했는지 ‘이 쪽 고치기’로 알려 주시면 바로 손보겠습니다." : "";
  },
  init(root) {
    root.querySelectorAll("[data-catui-dk-feedback]").forEach((box) => {
      this.paint(box);
      if (!docs._once(box, "fb")) return;
      docs._on(box, "click", (e) => {
        const b = e.target.closest("[data-vote]");
        if (!b) return;
        const key = this.keyOf(box), v = this.get(key) === b.dataset.vote ? "" : b.dataset.vote;   // 같은 답을 다시 누르면 취소
        this.set(key, v);
        this.paint(box);
      });
    });
  },
};

docs.version = {
  /** 이동 (테스트·SPA에서 바꿔 끼울 수 있게 함수로 둔다) */
  go: (href) => location.assign(href),
  init(root) {
    root.querySelectorAll("select[data-catui-dk-version]").forEach((sel) => {
      const v = docs.query().get("v");
      const opts = [...sel.options], cur = opts.find((o) => new URL(o.value, location.href).searchParams.get("v") === v) || opts[0];
      if (cur) sel.value = cur.value;
      const latest = opts[0] && cur === opts[0];
      root.querySelectorAll("[data-catui-dk-old]").forEach((n) => { n.hidden = latest; const b = n.querySelector("[data-ver]"); if (b && cur) b.textContent = cur.textContent.trim(); });
      root.querySelectorAll("[data-catui-dk-vername]").forEach((n) => { if (cur) n.textContent = cur.textContent.replace(/\s*\(.*\)$/, "").trim(); });
      if (!docs._once(sel, "ver")) return;
      docs._on(sel, "change", () => { docs.emit("version", { href: sel.value }); this.go(sel.value); });
    });
  },
};

// ── init.js ──
// 초기화 — 테마는 어느 화면에서나, 셸·검색·블로그·변경 이력·피드백·버전은 [data-catui-dk] 루트가 있을 때
//   루트가 없는 화면(예: 문서)에서는 데이터를 읽지 않는다 — md·readTime·search.match 같은 순수 함수와 toc·code만 쓸 수 있다
docs.init = function (scope = document) {
  this._dead = false;
  this.theme.init();
  const root = scope.matches?.("[data-catui-dk]") ? scope : scope.querySelector?.("[data-catui-dk]");
  if (root && !root.hasAttribute("data-catui-dk-ready")) {
    root.setAttribute("data-catui-dk-ready", "");
    this.root = root;
    const parts = ["shell", "search", "feedback", "version", "blogList", "post", "tagPage", "authorPage", "recent", "changelog"];
    for (const part of parts) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiDocs: ${part} 연결 실패`, "error", err); }
    }
    // 모든 부품이 데이터를 다 그린 뒤 풀린다
    this.ready = Promise.all(parts.map((p) => this[p]?.ready)).then(() => this, () => this);
  } else this.ready = Promise.resolve(this);
  return this;
};
docs.destroy = function () {
  this._dead = true;
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this._seen = new WeakMap();
  this._tocs = [];
  this.ready = undefined;
  this.root?.removeAttribute("data-catui-dk-ready");
  this.root = null;
};

catui.extend({ docs });
catui.use(() => { if (catui.config().autoInit !== false) docs.init(); });

})(typeof window !== "undefined" ? window : globalThis);
