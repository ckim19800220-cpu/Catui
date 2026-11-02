import { isRaw, escape, raw } from "./html.js";
import { getConfig } from "./base.js";

// 작은 DOM 도우미 (layui의 $ 역할). 체이닝 가능한 배열 래퍼.
class CatuiQuery extends Array {
  find(sel) { return $(this.flatMap((el) => [...el.querySelectorAll(sel)])); }
  each(fn) { this.forEach((el, i) => fn.call(el, el, i)); return this; }
  attr(name, value) {
    if (value === undefined) return this[0]?.getAttribute(name) ?? null;
    return this.each((el) => (value === null ? el.removeAttribute(name) : el.setAttribute(name, value)));
  }
  addClass(c) { return this.each((el) => el.classList.add(...c.split(/\s+/).filter(Boolean))); }
  removeClass(c) { return this.each((el) => el.classList.remove(...c.split(/\s+/).filter(Boolean))); }
  toggleClass(c, force) { return this.each((el) => c.split(/\s+/).filter(Boolean).forEach((x) => el.classList.toggle(x, force))); }
  hasClass(c) { return this.some((el) => el.classList.contains(c)); }
  text(v) { if (v === undefined) return this[0]?.textContent ?? ""; return this.each((el) => { el.textContent = v ?? ""; }); }
  // html(): html``/raw() 결과만 마크업으로, 일반 문자열은 글자로 넣는다(XSS 방지)
  html(v) { if (v === undefined) return this[0]?.innerHTML ?? ""; return this.each((el) => mount(el, v)); }
  // on(type, [selector], fn) → 해제 함수 반환
  on(type, sel, fn) {
    if (typeof sel === "function") { fn = sel; sel = null; }
    const offs = this.map((el) => delegate(el, type, sel, fn));
    return () => offs.forEach((off) => off());
  }
}

export function $(target, ctx = document) {
  if (target instanceof CatuiQuery) return target;
  if (!target) return CatuiQuery.from([]);
  if (typeof target === "string") return CatuiQuery.from(ctx.querySelectorAll(target));
  if (target instanceof Element || target === document || target === window) return CatuiQuery.from([target]);
  // NodeList·배열 등 목록만. 함수도 length가 있으므로 제외하고, 노드가 아닌 항목은 걸러 낸다
  if (typeof target !== "function" && target.length != null) return CatuiQuery.from(Array.from(target).filter((n) => n instanceof Node || n === window));
  return CatuiQuery.from([]);
}

// 첫 요소 하나 (선택자·요소 모두 허용)
export function el(target, ctx = document) {
  if (!target) return null;
  if (typeof target === "string") return ctx.querySelector(target);
  if (target instanceof CatuiQuery) return target[0] || null;
  return target instanceof Element ? target : null;
}

// 검색 범위: 비우면 document, 문서·조각은 그대로, 나머지는 el() (못 찾으면 null)
export function scopeOf(scope) {
  if (scope == null || scope === document) return document;
  if (scope instanceof Document || scope instanceof DocumentFragment) return scope;
  return el(scope);
}

export function mount(node, markup) {
  if (isRaw(markup)) node.innerHTML = markup.__raw;
  else node.textContent = String(markup ?? "");
  return node;
}

// 버블링하지 않는 이벤트(focus·blur·mouseenter 등)는 선택자 위임이 되도록 캡처 단계로 듣는다
const catuiNoBubble = /^(focus|blur|mouseenter|mouseleave|pointerenter|pointerleave|load|error|scroll)$/;
export function delegate(root, type, sel, fn, opts) {
  if (sel && opts === undefined && catuiNoBubble.test(type)) opts = true;
  const handler = sel ? (e) => {
    const t = e.target instanceof Element ? e.target.closest(sel) : null;
    if (t && (root === window || root.contains(t))) fn.call(t, e, t);
  } : (e) => fn.call(root, e, root);
  root.addEventListener(type, handler, opts);
  return () => root.removeEventListener(type, handler, opts);
}

let catuiUid = 0;
export function uid(prefix = "catui") { catuiUid += 1; return `${prefix}-${catuiUid}`; }

// 오버레이 루트: body 아래 .Catui_layer 하나 (리셋·글꼴 스코프)
export function layerRoot() {
  let root = document.querySelector("body > .Catui_layer");
  if (!root) {
    root = document.createElement("div");
    root.className = "Catui_layer";
    document.body.appendChild(root);
  }
  return root;
}

export function icon(name, size = 16, cls = "") {
  return raw(`<svg class="Catui_icon Catui_i${size}${cls ? ` ${escape(cls)}` : ""}" aria-hidden="true"><use href="${escape(getConfig().icons)}#Catui_ic-${escape(name)}"></use></svg>`);
}

// 한글·일본어 IME 조합 판정. Windows IME는 Esc·Enter를 누르면 compositionend를 먼저 보내고
// isComposing=false인 keydown을 뒤이어 보내므로, 조합이 막 끝난 직후(짧은 시간)도 조합 중으로 본다.
// <dialog>의 cancel처럼 키 이벤트가 없는 경우는 imeBusy()로 호출한다.
let catuiComposing = false, catuiCompEnd = -Infinity;
if (typeof document !== "undefined") {
  document.addEventListener("compositionstart", () => { catuiComposing = true; }, true);
  document.addEventListener("compositionend", () => { catuiComposing = false; catuiCompEnd = performance.now(); }, true);
  // 조합 중 입력칸이 지워지면 compositionend가 오지 않을 수 있다 → 포커스가 빠지면 상태를 풀어 Esc가 영영 막히지 않게
  document.addEventListener("focusout", () => { catuiComposing = false; }, true);
}
export function imeBusy(e) {
  const recent = performance.now() - catuiCompEnd < 150;
  // 키 이벤트가 있으면 이벤트 자체 정보를 믿고, 없을 때(cancel 등)만 추적 상태를 쓴다
  return e ? !!(e.isComposing || e.keyCode === 229 || recent) : catuiComposing || recent;
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const FOCUSABLE = 'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type=hidden]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),summary:not([tabindex="-1"]),[contenteditable="true"]:not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';

// 실제로 포커스할 수 있는 요소만 (숨김·inert·닫힌 details 안 제외)
export function focusables(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((n) => !n.closest("[hidden],[inert]") && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden");
}
