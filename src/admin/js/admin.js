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

export const admin = {
  version: catui.version,
  root: null,
  /** 저장된 상태 읽기/쓰기 */
  store: { get: admGet, set: admSet, clear: () => catui.data(ADM_STORE, null) },
  /** 이벤트: admin.on('theme', ({ value })) · 'collapse' · 'drawer' · 'notify' */
  on: (evt, fn) => catui.onevent("admin", evt, fn),
  emit: (evt, payload) => catui.event("admin", evt, null, payload),
  _offs: [],
  _on(target, type, fn, opt) { if (!target) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
};
