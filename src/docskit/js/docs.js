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

export const docs = {
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
