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

// 영역 안에서 선택자에 맞는 요소들 — 영역 요소 자신이 맞아도 포함한다(catui.init(요소)·모듈.enhance(요소) 공통)
export function within(scope, sel) {
  const list = [...(scope?.querySelectorAll?.(sel) || [])];
  if (scope instanceof Element && scope.matches(sel)) list.unshift(scope);
  return list;
}

export function mount(node, markup) {
  if (isRaw(markup)) node.innerHTML = markup.__raw;
  else if (typeof Node !== "undefined" && markup instanceof Node) node.replaceChildren(markup);
  else if (Array.isArray(markup)) {
    // 배열: 노드는 그대로, html``은 마크업으로, 나머지는 글자로 (null·false는 건너뜀)
    node.replaceChildren(...markup.flat(Infinity).filter((m) => m != null && m !== false).map((m) => {
      if (m instanceof Node) return m;
      if (!isRaw(m)) return document.createTextNode(String(m));
      const t = document.createElement("template"); t.innerHTML = m.__raw; return t.content;
    }));
  }
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

// 띄우는 패널(달력·자동완성·메뉴·툴팁)의 부모. 열린 모달 <dialog> 안에서 띄우면 그 dialog 안에 붙인다 —
// showModal()은 dialog 밖을 모두 inert로 만들어 body > .Catui_layer에 붙이면 보여도 클릭·포커스가 안 된다
export function floatRoot(anchor) {
  return anchor?.closest?.("dialog[open]") || layerRoot();
}

// position:fixed 요소를 화면 좌표 (x, y)에 둔다. transform이 있는 조상(가운데 정렬한 dialog 등) 안에서는
// fixed의 기준이 화면이 아니라 그 조상이 되므로, 실제로 놓인 위치와의 차이만큼 되돌려 맞춘다
export function placeFixed(node, x, y) {
  const L = Math.round(x), T = Math.round(y);
  node.style.left = `${L}px`; node.style.top = `${T}px`;
  const r = node.getBoundingClientRect(), dx = Math.round(r.left - L), dy = Math.round(r.top - T);
  if (dx || dy) { node.style.left = `${L - dx}px`; node.style.top = `${T - dy}px`; }
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

// 페이지 전체 움직임 일시정지: <html data-catui-paused> (fx.pause()/resume()이 켜고 끈다)
export const pagePaused = () => { const v = document.documentElement.getAttribute("data-catui-paused"); return v != null && v !== "false"; };

// 공용 프레임 티커 — 반복 갱신을 requestAnimationFrame 하나로 모은다. fn(dt, now), dt는 ms(최대 64).
// 요소를 넘기면 화면 밖(여유 120px)에서는 부르지 않고, 탭이 숨으면 루프를 멈추고, 페이지 일시정지 중에는 건너뛴다.
const catuiTasks = new Set(), catuiSuspend = new WeakMap();
let catuiRaf = 0, catuiLast = 0, catuiSuspendIO = null;
function catuiLoop(now) {
  const dt = Math.min(64, now - catuiLast);
  catuiLast = now;
  if (!pagePaused()) for (const t of [...catuiTasks]) if (t.on) { try { t.fn(dt, now); } catch (err) { console.error("[Catui error]: frame 처리 중 오류", err); } }
  catuiRaf = catuiTasks.size && !document.hidden ? requestAnimationFrame(catuiLoop) : 0;
}
function catuiFrameStart() {
  if (catuiRaf || !catuiTasks.size || document.hidden) return;
  catuiLast = performance.now();
  catuiRaf = requestAnimationFrame(catuiLoop);
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(catuiRaf); catuiRaf = 0; } else catuiFrameStart(); });
export function frame(fn, el) {
  const t = { fn, on: true };
  catuiTasks.add(t);
  if (el && typeof IntersectionObserver === "function") {
    catuiSuspendIO ||= new IntersectionObserver((es) => es.forEach((e) => catuiSuspend.get(e.target)?.forEach((x) => { x.on = e.isIntersecting; })), { rootMargin: "120px" });
    let set = catuiSuspend.get(el);
    if (!set) { set = new Set(); catuiSuspend.set(el, set); catuiSuspendIO.observe(el); }
    set.add(t);
  }
  catuiFrameStart();
  return () => {
    catuiTasks.delete(t);
    const set = el && catuiSuspend.get(el);
    if (set) { set.delete(t); if (!set.size) { catuiSuspend.delete(el); catuiSuspendIO.unobserve(el); } }
  };
}

export const FOCUSABLE = 'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type=hidden]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),summary:not([tabindex="-1"]),[contenteditable="true"]:not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';

// 실제로 포커스할 수 있는 요소만 (숨김·inert·닫힌 details 안 제외)
export function focusables(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((n) => !n.closest("[hidden],[inert]") && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden");
}
