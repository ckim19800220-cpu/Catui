// CatuiAdmin — catui.js 위에 얹는 관리자 확장 (catui.admin)
//   전역: <script src="catui.js"></script><script src="catadmin.js"></script> → catui.admin
//   ESM : import admin from "@imcat-ckim/catui/admin"
// 화면 루트: <div class="Catui_app Catui_adm" data-catui-adm> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 상태(사이드바 접힘·하위 메뉴·테마)는 catui.data('admin')(localStorage "catui:admin")에 기억한다.

const ADM_STORE = "admin";
const admGet = (k, d) => { const v = catui.data(ADM_STORE)[k]; return v === undefined ? d : v; };
const admSet = (k, v) => catui.data(ADM_STORE, { key: k, value: v });
const admJson = (id) => {
  const n = document.getElementById(id);
  if (!n) return null;
  try { return JSON.parse(n.textContent); } catch (err) { catui.hint.error(`CatuiAdmin: #${id}의 JSON을 읽지 못했습니다`, "error", err); return null; }
};
// 보이는 포커스 대상 (서랍 Tab 가두기)
const admFocusables = (box) => [...box.querySelectorAll('a[href],button:not([disabled]),summary,input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])')]
  .filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");

// 받침 판단: 한글은 종성, 숫자는 읽는 소리(영·일·삼·육·칠·팔·십), 영문은 l·m·n·r 끝을 받침으로 본다
const admBatchim = (word) => {
  const s = String(word).replace(/[\s)"'\]」』.,!?…]+$/, "");
  const ch = s.slice(-1);
  if (!ch) return { has: false, rieul: false };
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; return { has: jong > 0, rieul: jong === 8 }; }
  if (/\d/.test(ch)) return { has: "0136780".includes(ch), rieul: "178".includes(ch) };
  if (/[a-z]/i.test(ch)) return { has: /[lmnr]/i.test(ch), rieul: /[lr]/i.test(ch) };
  return { has: false, rieul: false };
};

export const admin = {
  version: catui.version,
  /** 조사 붙이기: josa('주문', '을') → '주문을', josa('파일', '로') → '파일로', josa('진행', '으로') → '진행으로' */
  josa(word, pair) {
    const b = admBatchim(word);
    const P = { 을: ["을", "를"], 를: ["을", "를"], 이: ["이", "가"], 가: ["이", "가"], 은: ["은", "는"], 는: ["은", "는"], 과: ["과", "와"], 와: ["과", "와"], 으로: ["으로", "로"], 로: ["으로", "로"] }[pair];
    if (!P) return `${word}${pair}`;
    if (P[0] === "으로") return `${word}${b.has && !b.rieul ? "으로" : "로"}`;
    return `${word}${b.has ? P[0] : P[1]}`;
  },
  root: null,
  /** 저장된 상태 읽기/쓰기 */
  store: { get: admGet, set: admSet, clear: () => catui.data(ADM_STORE, null) },
  /** 이벤트: admin.on('theme', ({ value })) · 'collapse' · 'drawer' · 'notify' */
  on: (evt, fn) => catui.onevent("admin", evt, fn),
  emit: (evt, payload) => catui.event("admin", evt, null, payload),
  _offs: [],
  _on(target, type, fn, opt) { if (!target) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
  // 같은 대상·같은 연결을 한 번만 (init 재호출 시 리스너 중복 방지). destroy가 기록을 비운다
  _seen: new WeakMap(),
  _once(target, key) { let s = this._seen.get(target); if (!s) this._seen.set(target, (s = new Set())); if (s.has(key)) return false; s.add(key); return true; },
};
