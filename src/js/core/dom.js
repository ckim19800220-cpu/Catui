import { isRaw, escape } from "./html.js";
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
  toggleClass(c, force) { return this.each((el) => el.classList.toggle(c, force)); }
  hasClass(c) { return this.some((el) => el.classList.contains(c)); }
  text(v) { if (v === undefined) return this[0]?.textContent ?? ""; return this.each((el) => { el.textContent = v; }); }
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
  if (target.length != null) return CatuiQuery.from(target);
  return CatuiQuery.from([]);
}

// 첫 요소 하나 (선택자·요소 모두 허용)
export function el(target, ctx = document) {
  if (!target) return null;
  if (typeof target === "string") return ctx.querySelector(target);
  if (target instanceof CatuiQuery) return target[0] || null;
  return target instanceof Element ? target : null;
}

export function mount(node, markup) {
  if (isRaw(markup)) node.innerHTML = markup.__raw;
  else node.textContent = String(markup ?? "");
  return node;
}

export function delegate(root, type, sel, fn, opts) {
  const handler = sel ? (e) => {
    const t = e.target instanceof Element ? e.target.closest(sel) : null;
    if (t && root.contains(t)) fn.call(t, e, t);
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
  return { __raw: `<svg class="Catui_icon Catui_i${size}${cls ? ` ${escape(cls)}` : ""}" aria-hidden="true"><use href="${escape(getConfig().icons)}#Catui_ic-${escape(name)}"></use></svg>` };
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
