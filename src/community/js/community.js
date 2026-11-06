// CatuiCommunity — catui.js 위에 얹는 커뮤니티(게시판) 확장 (catui.community)
//   전역: <script src="catui.js"></script><script src="catcommunity.js"></script> → catui.community
//   ESM : import community from "@imcat-ckim/catui/community"
// 화면 루트: <div class="Catui_site Catui_cm" data-catui-cm> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 상태(테마·추천·읽은 글·즐겨찾기 게시판·임시 저장)는 catui.data('community')(localStorage "catui:community")에 기억한다.

const CM_STORE = "community";
const cmGet = (k, d) => { const v = catui.data(CM_STORE)[k]; return v === undefined ? d : v; };
const cmSet = (k, v) => catui.data(CM_STORE, { key: k, value: v });
const cmBatchim = (word) => {
  const s = String(word).replace(/[\s)"'\]」』.,!?…]+$/, "");
  const ch = s.slice(-1);
  if (!ch) return { has: false, rieul: false };
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; return { has: jong > 0, rieul: jong === 8 }; }
  if (/\d/.test(ch)) return { has: "0136780".includes(ch), rieul: "178".includes(ch) };
  if (/[a-z]/i.test(ch)) return { has: /[lmnr]/i.test(ch), rieul: /[lr]/i.test(ch) };
  return { has: false, rieul: false };
};
const cmQuery = () => new URLSearchParams(location.search);

export const community = {
  version: catui.version,
  root: null,
  /** 조사 붙이기: josa('게시판', '을') → '게시판을' */
  josa(word, pair) {
    const b = cmBatchim(word);
    const P = { 을: ["을", "를"], 를: ["을", "를"], 이: ["이", "가"], 가: ["이", "가"], 은: ["은", "는"], 는: ["은", "는"], 과: ["과", "와"], 와: ["과", "와"], 으로: ["으로", "로"], 로: ["으로", "로"] }[pair];
    if (!P) return `${word}${pair}`;
    if (P[0] === "으로") return `${word}${b.has && !b.rieul ? "으로" : "로"}`;
    return `${word}${b.has ? P[0] : P[1]}`;
  },
  store: { get: cmGet, set: cmSet, clear: () => catui.data(CM_STORE, null) },
  /** 이벤트: 'theme' · 'vote' { key, dir } · 'comment' · 'draft' · 'poll' · 'data' */
  on: (evt, fn) => catui.onevent("community", evt, fn),
  emit: (evt, payload) => catui.event("community", evt, null, payload),
  query: cmQuery,
  _offs: [],
  // destroy 뒤에 늦게 도착한 응답(.then 안의 연결)은 등록하지 않는다 — 해제 목록이 이미 비워져 새는 것을 막음
  _on(target, type, fn, opt) { if (!target || this._dead) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
  _seen: new WeakMap(),
  _once(target, key) { let s = this._seen.get(target); if (!s) this._seen.set(target, (s = new Set())); if (s.has(key)) return false; s.add(key); return true; },
};

// ── 테마: 관리 화면과 같은 규칙(저장값 없으면 시스템) ──
community.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => cmGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-cm-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) { cmSet("theme", v); this.apply(v); community.emit("theme", { value: this.get(), saved: v }); },
  init() {
    // <html data-catui-theme-lock>: 다른 쪽(예: 문서 사이트)이 테마를 관리하는 화면 — 덮어쓰지 않는다
    if (document.documentElement.hasAttribute("data-catui-theme-lock")) return;
    this.apply(this.saved());
    if (!community._once(document, "theme")) return;   // 재호출 시 클릭이 두 번 처리돼 토글이 상쇄되지 않게
    const mq = matchMedia("(prefers-color-scheme: dark)");
    community._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    community._on(document, "click", (e) => { if (e.target.closest("[data-catui-cm-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};
