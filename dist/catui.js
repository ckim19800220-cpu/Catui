/*! Catui UI framework 1.0.0 | 아이콘 Line 01(CC0) */
(function (global) {
"use strict";
if (global.catui) console.warn("[Catui warn]: catui가 이미 있습니다. 덮어씁니다.");
const BASE = (() => { const s = document.currentScript; return s && s.src ? new URL(".", s.src).href : ""; })();
const VERSION = "1.0.0";

// ── core/html.js ──
// 안전한 마크업 조립. html`...`의 ${값}은 자동 escape되고, raw()로 감싼 신뢰 마크업만 그대로 들어간다.
function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 신뢰 마크업 표식은 raw()가 만든 객체에만 붙는다. 서버 JSON의 { "__raw": "..." } 같은 위조 객체는 글자로 escape된다.
const catuiRawMarks = new WeakSet();

function raw(markup) {
  const out = Object.freeze({ __raw: String(markup ?? "") });
  catuiRawMarks.add(out);
  return out;
}

function isRaw(value) {
  return !!value && typeof value === "object" && catuiRawMarks.has(value);
}

function html(strings, ...values) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i >= values.length) return;
    const v = values[i];
    if (v == null || v === false) return;
    if (Array.isArray(v)) out += v.flat(Infinity).map((x) => (x == null || x === false ? "" : isRaw(x) ? x.__raw : escape(x))).join("");
    else out += isRaw(v) ? v.__raw : escape(v);
  });
  return raw(out);
}

// ── core/base.js ──

// 전역 설정 + 기본 유틸 (layui의 config / data / url / device / hint에 해당)
const catuiSettings = {
  icons: `${BASE}icons.svg?v=2`, // 아이콘 스프라이트 경로
  autoInit: true,                // DOMContentLoaded에 data-catui-* 자동 초기화
  autoDestroy: true,             // DOM에서 빠진 요소의 컴포넌트 인스턴스 자동 정리
  debug: true,                   // 콘솔 출력: true 경고·오류 / false 오류만(운영) / "silent" 모두 끔
  csrf: { meta: "csrf-token", header: "X-CSRF-Token" },   // 같은 출처 쓰기 요청에 붙일 CSRF 토큰 (false = 끔)
};

function getConfig() {
  return catuiSettings;
}

function config(options) {
  if (options && typeof options === "object") Object.assign(catuiSettings, options);
  return catuiSettings;
}

// 콘솔 출력 단계는 config.debug로 조절한다. detail(오류 객체·요소)은 콘솔에서 펼쳐 볼 수 있게 함께 넘긴다.
const catuiHintSeen = new Set();
const catuiHintOn = (type) => {
  const d = catuiSettings.debug;
  if (d === "silent") return false;
  return type === "error" || d !== false;
};
const hint = {
  error(msg, type = "warn", ...detail) {
    if (!catuiHintOn(type)) return;
    (type === "error" ? console.error : console.warn)(`[Catui ${type}]: ${msg}`, ...detail);
  },
  errorOnce(msg, type = "warn", ...detail) {
    if (!catuiHintOn(type) || catuiHintSeen.has(msg)) return;
    if (catuiHintSeen.size > 100) catuiHintSeen.clear();
    catuiHintSeen.add(msg);
    hint.error(msg, type, ...detail);
  },
};

// CSRF: <meta name="csrf-token" content="…">의 값을 헤더로. 토큰 유출을 막기 위해
// 같은 출처(origin)이면서 상태를 바꾸는 요청(GET·HEAD·OPTIONS 제외)에만 붙인다.
function csrfHeaders(url, method = "GET") {
  const c = catuiSettings.csrf;
  if (!c || /^(GET|HEAD|OPTIONS)$/i.test(method)) return {};
  let same = false;
  try { same = new URL(url, location.href).origin === location.origin; } catch { same = false; }
  if (!same) return {};
  const token = document.querySelector(`meta[name="${CSS.escape(c.meta || "csrf-token")}"]`)?.getAttribute("content");
  return token ? { [c.header || "X-CSRF-Token"]: token } : {};
}

// localStorage / sessionStorage 래퍼. data('표') 읽기, data('표', {key, value}) 쓰기,
// data('표', {key, remove:true}) 삭제, data('표', null) 표 삭제.
// 저장소를 못 쓰는 환경(사파리 비공개 창·쿠키 차단·용량 초과)에서도 예외를 던지지 않는다.
function catuiStore(kind, table, settings) {
  if (!table) return {};
  let storage;
  try { storage = window[kind]; } catch { storage = null; }
  if (!storage) { hint.errorOnce(`${kind}를 쓸 수 없는 환경입니다`); return {}; }
  const key = `catui:${table}`;
  let all = {};
  try { all = JSON.parse(storage.getItem(key) || "{}") || {}; } catch { all = {}; }
  try {
    if (settings === null) { storage.removeItem(key); return {}; }
    if (settings && typeof settings === "object" && "key" in settings) {
      if (settings.remove) delete all[settings.key];
      else all[settings.key] = settings.value;
      storage.setItem(key, JSON.stringify(all));
    }
  } catch (err) {
    hint.error(`data('${table}') 저장 실패: ${err?.name || err}`);
  }
  return all;
}
function data(table, settings) {
  return catuiStore("localStorage", table, settings);
}
function sessionData(table, settings) {
  return catuiStore("sessionStorage", table, settings);
}

// URL 해석: pathname 배열, search 객체, hash의 path/search
function url(href = location.href) {
  const u = new URL(href, location.href);
  const search = Object.fromEntries(u.searchParams);
  const h = u.hash.replace(/^#/, "");
  const [hPath, hQuery = ""] = h.split("?");
  return {
    pathname: u.pathname.split("/").filter(Boolean),
    search,
    hash: {
      path: hPath.split("/").filter(Boolean),
      search: Object.fromEntries(new URLSearchParams(hQuery)),
      href: h,
    },
  };
}

// 실행 환경 정보. device('MYAPP')처럼 UA 표식도 검사한다.
function device(key) {
  const ua = navigator.userAgent;
  // iPhone UA에는 "like Mac OS X"가, iPadOS 13+는 "Macintosh"가 들어 있으므로 ios를 mac보다 먼저 본다
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const info = {
    os: /windows/i.test(ua) ? "windows" : android ? "android" : ios ? "ios" : /mac/i.test(ua) ? "mac" : /linux/i.test(ua) ? "linux" : "",
    android,
    ios,
    mobile: /mobile/i.test(ua) || android || ios,
  };
  if (key) info[key] = new RegExp(`${String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(ua);
  return info;
}

// ── core/dom.js ──

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

function $(target, ctx = document) {
  if (target instanceof CatuiQuery) return target;
  if (!target) return CatuiQuery.from([]);
  if (typeof target === "string") return CatuiQuery.from(ctx.querySelectorAll(target));
  if (target instanceof Element || target === document || target === window) return CatuiQuery.from([target]);
  // NodeList·배열 등 목록만. 함수도 length가 있으므로 제외하고, 노드가 아닌 항목은 걸러 낸다
  if (typeof target !== "function" && target.length != null) return CatuiQuery.from(Array.from(target).filter((n) => n instanceof Node || n === window));
  return CatuiQuery.from([]);
}

// 첫 요소 하나 (선택자·요소 모두 허용)
function el(target, ctx = document) {
  if (!target) return null;
  if (typeof target === "string") return ctx.querySelector(target);
  if (target instanceof CatuiQuery) return target[0] || null;
  return target instanceof Element ? target : null;
}

// 검색 범위: 비우면 document, 문서·조각은 그대로, 나머지는 el() (못 찾으면 null)
function scopeOf(scope) {
  if (scope == null || scope === document) return document;
  if (scope instanceof Document || scope instanceof DocumentFragment) return scope;
  return el(scope);
}

function mount(node, markup) {
  if (isRaw(markup)) node.innerHTML = markup.__raw;
  else node.textContent = String(markup ?? "");
  return node;
}

// 버블링하지 않는 이벤트(focus·blur·mouseenter 등)는 선택자 위임이 되도록 캡처 단계로 듣는다
const catuiNoBubble = /^(focus|blur|mouseenter|mouseleave|pointerenter|pointerleave|load|error|scroll)$/;
function delegate(root, type, sel, fn, opts) {
  if (sel && opts === undefined && catuiNoBubble.test(type)) opts = true;
  const handler = sel ? (e) => {
    const t = e.target instanceof Element ? e.target.closest(sel) : null;
    if (t && (root === window || root.contains(t))) fn.call(t, e, t);
  } : (e) => fn.call(root, e, root);
  root.addEventListener(type, handler, opts);
  return () => root.removeEventListener(type, handler, opts);
}

let catuiUid = 0;
function uid(prefix = "catui") { catuiUid += 1; return `${prefix}-${catuiUid}`; }

// 오버레이 루트: body 아래 .Catui_layer 하나 (리셋·글꼴 스코프)
function layerRoot() {
  let root = document.querySelector("body > .Catui_layer");
  if (!root) {
    root = document.createElement("div");
    root.className = "Catui_layer";
    document.body.appendChild(root);
  }
  return root;
}

function icon(name, size = 16, cls = "") {
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
function imeBusy(e) {
  const recent = performance.now() - catuiCompEnd < 150;
  // 키 이벤트가 있으면 이벤트 자체 정보를 믿고, 없을 때(cancel 등)만 추적 상태를 쓴다
  return e ? !!(e.isComposing || e.keyCode === 229 || recent) : catuiComposing || recent;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FOCUSABLE = 'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type=hidden]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),summary:not([tabindex="-1"]),[contenteditable="true"]:not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';

// 실제로 포커스할 수 있는 요소만 (숨김·inert·닫힌 details 안 제외)
function focusables(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((n) => !n.closest("[hidden],[inert]") && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden");
}

// ── core/events.js ──
// 이벤트 허브 — layui와 같은 "이벤트(필터)" 문법.
// form.on('submit(login)', fn) / table.on('tool(orders)', fn) / tabs.on('tab', fn)(필터 없음 = 전체)
// on()은 해제 함수를 돌려준다(누수 방지).

const catuiHandlers = new Map(); // "모듈:이벤트" → [{ filter, fn }]

function catuiParse(evt) {
  const m = /^([\w-]+)(?:\(([^)]*)\))?$/.exec(String(evt).trim());
  if (!m) throw new Error(`잘못된 이벤트 이름: ${evt}`);
  return { name: m[1], filter: m[2] ?? null };
}

function onEvent(mod, evt, fn) {
  const { name, filter } = catuiParse(evt);
  // 함수가 아니면 등록하지 않는다 (emit 때마다 TypeError가 나는 것보다 등록 시점에 알리는 편이 찾기 쉽다)
  if (typeof fn !== "function") { hint.error(`${mod}.on('${evt}')에 함수가 아닌 값을 넘겼습니다`); return () => {}; }
  const key = `${mod}:${name}`;
  if (!catuiHandlers.has(key)) catuiHandlers.set(key, []);
  const entry = { filter, fn };
  catuiHandlers.get(key).push(entry);
  return () => {
    const list = catuiHandlers.get(key) || [];
    const i = list.indexOf(entry);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) catuiHandlers.delete(key);
  };
}

// off('submit') = 그 이벤트 전부, off('submit(login)') = 그 필터만
function offEvent(mod, evt) {
  const { name, filter } = catuiParse(evt);
  const key = `${mod}:${name}`;
  if (filter == null) { catuiHandlers.delete(key); return; }
  const rest = (catuiHandlers.get(key) || []).filter((h) => h.filter !== filter);
  if (rest.length) catuiHandlers.set(key, rest); else catuiHandlers.delete(key);
}

// 필터가 같은 핸들러 + 필터 없는 핸들러를 호출. 하나라도 false를 돌려주면 false.
function emit(mod, name, filter, payload, thisArg) {
  let result = true;
  for (const h of [...(catuiHandlers.get(`${mod}:${name}`) || [])]) {
    if (h.filter != null && h.filter !== filter) continue;
    try {
      if (h.fn.call(thisArg ?? payload?.elem ?? null, payload) === false) result = false;
    } catch (err) {
      hint.error(`${mod}.on('${name}${h.filter ? `(${h.filter})` : ""}') 처리 중 오류`, "error", err);
    }
  }
  return result;
}

function hasHandlers(mod, name, filter) {
  return (catuiHandlers.get(`${mod}:${name}`) || []).some((h) => h.filter == null || h.filter === filter);
}

// ── core/component.js ──

// 컴포넌트 빌더 (layui.component에 해당). 모든 렌더형 컴포넌트가 같은 인터페이스를 갖는다:
//   comp.render(options) → 인스턴스 { id, config, reload(opts), destroy() }
//   comp.reload(id, opts) / comp.getThis(id) / comp.destroy(id) / comp.on(evt, fn) / comp.set(defaults)
// 정의: component({ name, config, render(inst), destroy?(inst), ...extra })
function component(def) {
  const name = def.name;
  const defaults = { ...(def.config || {}) };
  const instances = new Map();
  const byElem = new WeakMap();   // id 없는 대상에 다시 렌더해도 이전 인스턴스를 찾아 정리하기 위함

  class Instance {
    constructor(options) {
      this.config = { ...defaults, ...options };
      this.elem = el(this.config.elem);
      if (this.config.elem && !this.elem) hint.error(`${name}: elem을 찾을 수 없습니다 (${this.config.elem})`);
      this.id = this.config.id || this.elem?.id || uid(name);
      this.filter = this.config.filter || this.elem?.getAttribute("data-catui-filter") || this.id;
      this.cleanups = [];
    }
    use(fn) { if (typeof fn === "function") this.cleanups.push(fn); return fn; }
    emit(evt, payload) { return emit(name, evt, this.filter, { ...payload, config: this.config }, this.elem); }
    reload(options = {}) {
      this.teardown();
      this.config = { ...this.config, ...options };
      if ("elem" in options) {
        if (byElem.get(this.elem) === this) byElem.delete(this.elem);
        this.elem = el(this.config.elem);
        if (this.elem) byElem.set(this.elem, this);
      }
      def.render(this);
      return this;
    }
    teardown() {
      this.cleanups.splice(0).reverse().forEach((f) => { try { f(); } catch { /* 해제 실패 무시 */ } });
    }
    destroy() {
      this.teardown();
      def.destroy?.(this);
      if (instances.get(this.id) === this) instances.delete(this.id);
      if (this.elem && byElem.get(this.elem) === this) byElem.delete(this.elem);
    }
  }

  const api = {
    CONST: { MOD_NAME: name, ...(def.CONST || {}) },
    Class: Instance,
    render(options = {}) {
      const target = el(options.elem);
      const prev = instances.get(options.id || target?.id) || (target && byElem.get(target));
      if (prev) prev.destroy();              // 같은 대상에 다시 렌더하면 이전 인스턴스 정리
      const inst = new Instance(options);
      def.beforeRender?.(inst);
      try { def.render(inst); } catch (err) { inst.teardown(); throw err; }   // 그리다 실패하면 붙인 리스너 회수
      instances.set(inst.id, inst);
      if (inst.elem) byElem.set(inst.elem, inst);
      // done = 렌더 완료 콜백. 단, done을 자기 의미(날짜 선택·업로드 완료 등)로 쓰는 모듈은 ownDone: true로 건너뛴다
      if (!def.ownDone) inst.config.done?.call(inst, inst);
      return inst;
    },
    reload(id, options) { const inst = instances.get(id); if (!inst) { hint.error(`${name}: id '${id}' 인스턴스가 없습니다`); return null; } return inst.reload(options); },
    getThis(id) { return instances.get(id) || null; },
    destroy(id) { instances.get(id)?.destroy(); },
    // 모든 인스턴스 정리 (catui.destroy · SPA 화면 전환용). DOM에서 빠진 대상만 정리하려면 destroyDetached()
    destroyAll() { [...instances.values()].forEach((i) => i.destroy()); },
    // keep: true로 렌더한 인스턴스는 잠시 떼었다 다시 붙이는 용도(탭 캐시 등)로 보고 남긴다
    destroyDetached() { [...instances.values()].forEach((i) => { if (i.elem && !i.elem.isConnected && !i.config.keep) i.destroy(); }); },
    on(evt, fn) { return onEvent(name, evt, fn); },
    off(evt) { offEvent(name, evt); },
    set(options) { Object.assign(defaults, options); return api; },
    get config() { return { ...defaults }; },
  };
  for (const [k, v] of Object.entries(def)) {
    if (!["name", "config", "render", "destroy", "beforeRender", "CONST", "ownDone"].includes(k)) api[k] = v;
  }
  return api;
}

// ── core/init.js ──

// CSS 체크박스 모달·드로어(마크업만으로 동작하는 kit 패턴) 향상 — 견본: "스크림·포커스 트랩은 JS 영역".
// 열리면 패널 첫 요소로 포커스, Tab 가두기, Esc 닫기, 닫히면 토글 체크박스로 포커스 복귀.
function bindToggleOverlays() {
  const TOGGLE = ".Catui_modal-toggle, .Catui_drawer-toggle";
  const PANEL = ".Catui_modal, .Catui_drawer";
  // CSS가 `토글:checked ~ 패널` 형제 선택자이므로, 토글 다음 형제 중 첫 패널 / 패널 앞 형제 중 가장 가까운 토글이 짝이다
  const panelOf = (t) => { for (let n = t.nextElementSibling; n; n = n.nextElementSibling) { if (n.matches(TOGGLE)) return null; if (n.matches(PANEL)) return n; } return null; };
  const openToggles = () => [...document.querySelectorAll(TOGGLE)].filter((t) => t.checked && panelOf(t));
  const close = (t) => { t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true })); };

  const onChange = (e) => {
    const t = e.target;
    if (!t.matches?.(TOGGLE)) return;
    const panel = panelOf(t);
    if (t.checked) { if (panel) (focusables(panel)[0] || panel).focus({ preventScroll: true }); }  // focus()가 스타일을 동기 재계산하므로 바로 호출
    else if (!panel || panel.contains(document.activeElement) || document.activeElement === document.body) t.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key !== "Escape" && e.key !== "Tab") return;
    if (e.key === "Escape" && imeBusy(e)) return;          // 한글 조합 중(·직후) Esc는 조합 취소일 뿐
    if (e.target.closest?.("dialog")) return;            // <dialog>(layer)는 브라우저가 처리
    const open = openToggles();
    if (!open.length) return;
    const toggle = open[open.length - 1];                 // 문서 순서상 마지막 = 위에 그려진 패널
    const panel = panelOf(toggle);
    if (e.key === "Escape") {
      if (e.defaultPrevented) return;                     // 패널 안 드롭다운·달력이 먼저 Esc를 썼으면 패널은 그대로
      e.preventDefault();
      close(toggle);
      return;
    }
    const list = focusables(panel);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1], active = document.activeElement;
    if (!panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  // 닫기 라벨(label.Catui_close / 취소 label)도 키보드로: 포커스 가능하게 + Enter/Space
  const onKeyLabel = (e) => {
    const lab = e.target.closest?.(".Catui_modal label[for], .Catui_drawer label[for]");
    if (!lab || imeBusy(e) || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    lab.click();
  };
  const prepare = (scope = document) => {
    scope.querySelectorAll?.(".Catui_modal label[for]:not([tabindex]), .Catui_drawer label[for]:not([tabindex])").forEach((l) => {
      l.tabIndex = 0;
      if (!l.matches(".Catui_btn")) l.setAttribute("role", "button");
    });
    scope.querySelectorAll?.(PANEL).forEach((p) => { if (!p.hasAttribute("tabindex")) p.tabIndex = -1; });   // 포커스할 요소가 없는 패널도 포커스 받게
  };
  prepare();
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
  document.addEventListener("keydown", onKeyLabel);
  return {
    prepare,
    off() {
      document.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onKeyLabel);
    },
  };
}

// ── modules/layer.js ──

// layer — 팝업 레이어. 모든 함수는 레이어 index(숫자)를 돌려주고 layer.close(index)로 닫는다.
//   layer.msg('저장했습니다', { icon: 'success', position: 'tr', action: { text: '되돌리기', onClick } })
//   layer.confirm('삭제할까요?', { danger: true }, (index) => { ...; layer.close(index); })
//   layer.open({ title, content, area: 'md'|'xl'|'full'|['600px','400px'], btn: ['저장', '취소'], maxmin, move, resize, time, yes(index, el) {} })
//   layer.open({ type: 'drawer', offset: 'l'|'r'|'b' }) · layer.open({ type: 'iframe', content: '/page.html' })
//   layer.tips('설명', '#btn', { side: 'top' }) · layer.photos({ items: [{ src, alt, caption }], start }) · layer.tab({ tabs: [{ title, content }] })
//   await layer.ask('삭제할까요?') → true/false · await layer.input({ title }) → 값 | null
//   layer.setContent(i, c) · layer.style(i, { width, height }) · layer.full(i) · layer.restore(i) · layer.progress(i, 0~100)
const layer = (() => {
  let seq = 0;
  const opened = new Map(); // index → { type, node, close(reason) }
  const ICON = { success: "check", info: "info", warn: "alert-triangle", danger: "alert-circle" };
  const TOAST_KIND = { success: "", info: " Catui_toast-info", warn: " Catui_toast-warn", danger: " Catui_toast-danger" };
  const POS = { br: "", tr: " Catui_toasts-tr", tc: " Catui_toasts-tc", bc: " Catui_toasts-bc" };
  const AREA = ["sm", "md", "lg", "xl", "full"];

  // content: 일반 문자열은 글자로, html``·raw()는 마크업으로, Element는 그대로 옮긴다
  const fill = (node, content) => {
    if (content instanceof Element) node.appendChild(content);
    else if (isRaw(content)) mount(node, content);
    else {
      const p = document.createElement("p");
      p.textContent = String(content ?? "");
      node.appendChild(p);
    }
  };
  // iframe 주소는 같은 사이트 상대 경로 또는 http·https만 허용 (javascript:·data: 차단)
  const safeUrl = (u) => {
    try { const url = new URL(String(u), location.href); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
  };

  function toastBox(pos = "br") {
    const root = layerRoot();
    const key = POS[pos] != null ? pos : "br";
    let box = root.querySelector(`:scope > .Catui_toasts[data-pos="${key}"]`);
    if (!box) {
      box = document.createElement("div");
      box.className = `Catui_toasts${POS[key]}`;
      box.dataset.pos = key;
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      root.appendChild(box);
    }
    return box;
  }

  // 토스트 메시지. options: { icon, body, time(ms, 0=수동), max, position:'br'|'tr'|'tc'|'bc', action:{ text, onClick }, progress } / end 콜백
  function msg(content, options = {}, end) {
    if (typeof options === "function") { end = options; options = {}; }
    const kind = ICON[options.icon] ? options.icon : "info";
    const index = ++seq;
    const box = toastBox(options.position);
    const node = document.createElement("div");
    node.className = `Catui_toast${TOAST_KIND[kind]}`;
    const time = options.time ?? (options.action ? 5000 : 3000);
    mount(node, html`${icon(ICON[kind], 18)}<div><p class="Catui_toast-title">${content}</p>${options.body ? html`<p class="Catui_toast-body">${options.body}</p>` : ""}</div>${options.action ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_toast-action" type="button">${options.action.text}</button>` : ""}${options.progress && time > 0 ? html`<span class="Catui_toast-bar" aria-hidden="true" style="--Catui_toast-time:${time}ms"></span>` : ""}`);
    box.appendChild(node);
    const max = options.max ?? 3;
    while (box.children.length > max) {
      const oldest = [...opened.entries()].find(([, v]) => v.type === "msg" && v.node.parentNode === box);
      if (!oldest) { box.firstElementChild.remove(); break; }
      close(oldest[0]);
    }
    let timer = 0, gone = false;
    // 한 번만 닫힌다 — 마우스·포커스 재개 타이머가 겹쳐도 end 콜백이 두 번 불리지 않게
    const done = () => { if (gone) return; gone = true; clearTimeout(timer); node.remove(); opened.delete(index); end?.(); };
    opened.set(index, { type: "msg", node, close: done });
    node.querySelector(".Catui_toast-action")?.addEventListener("click", () => { options.action.onClick?.(index); done(); });
    if (time > 0) {
      timer = setTimeout(done, time);
      // 마우스를 올리거나 키보드 포커스가 들어오면 멈춤 (읽을 시간 확보)
      const pause = () => clearTimeout(timer), resume = () => { clearTimeout(timer); timer = setTimeout(done, 1500); };
      node.addEventListener("mouseenter", pause); node.addEventListener("mouseleave", resume);
      node.addEventListener("focusin", pause); node.addEventListener("focusout", resume);
    }
    return index;
  }

  // 범용 레이어. type: 'dialog'(기본) | 'drawer' | 'iframe'
  function open(options = {}) {
    const o = { type: "dialog", title: "", area: "md", btn: [], closeBtn: true, shadeClose: true, offset: "r", ...options };
    const index = ++seq;
    const titleId = `catui-layer-${index}-t`;
    const dlg = document.createElement("dialog");
    const isDrawer = o.type === "drawer", isFrame = o.type === "iframe";
    const size = Array.isArray(o.area) ? "md" : AREA.includes(o.area) ? o.area : "md";
    dlg.className = isDrawer
      ? `Catui_drawer${o.offset === "l" ? " Catui_drawer-left" : o.offset === "b" ? " Catui_drawer-bottom" : ""}`
      : `Catui_modal Catui_modal-${size}${o.move ? " Catui_layer-move" : ""}${o.resize ? " Catui_layer-resize" : ""}`;
    if (o.skin) dlg.classList.add(...String(o.skin).split(/\s+/).filter(Boolean));
    if (Array.isArray(o.area) && !isDrawer) { dlg.style.width = `min(${o.area[0]}, calc(100% - 32px))`; if (o.area[1]) dlg.style.height = o.area[1]; }
    if (o.title) dlg.setAttribute("aria-labelledby", titleId); else dlg.setAttribute("aria-label", o.label || "대화상자");
    if (o.id) dlg.id = o.id;
    const H = isDrawer ? "Catui_drawer-h" : "Catui_modal-h", B = isDrawer ? "Catui_drawer-b" : "Catui_modal-b";
    const tools = o.maxmin && !isDrawer;
    mount(dlg, html`
${o.title || o.closeBtn || tools ? html`<header class="${H}"><span id="${titleId}">${o.title}</span><span class="Catui_layer-tools">${tools ? html`<button class="Catui_close" type="button" data-catui-layer="max" aria-pressed="false" aria-label="최대화">${icon("maximize-2", 16)}</button>` : ""}${o.closeBtn ? html`<button class="Catui_close" type="button" data-catui-layer="close" aria-label="닫기">${icon("x", 16)}</button>` : ""}</span></header>` : ""}
<div class="${B}" data-catui-layer="body"></div>
${o.btn.length ? html`<footer class="Catui_modal-f">${[...o.btn].reverse().map((label, ri) => {
  const i = o.btn.length - 1 - ri;
  const kind = i === 0 ? (o.danger ? "Catui_btn-danger" : "Catui_btn-primary") : "Catui_btn-secondary";
  return html`<button class="Catui_btn Catui_btn-md ${kind}" type="button" data-catui-btn="${i}">${label}</button>`;
})}</footer>` : ""}`);
    const body = dlg.querySelector('[data-catui-layer="body"]');
    if (isFrame) {
      const src = safeUrl(o.content);
      body.style.padding = "0";
      if (src) { const f = document.createElement("iframe"); f.className = "Catui_layer-frame"; f.src = src; f.title = o.title || o.label || "삽입된 페이지"; f.loading = "lazy"; body.appendChild(f); }
      else fill(body, "열 수 없는 주소입니다.");
    } else fill(body, o.content);
    layerRoot().appendChild(dlg);

    let closed = false, timer = 0;
    const offs = [];
    const close = (reason) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      offs.forEach((f) => f());
      if (dlg.open) dlg.close(reason);
      dlg.remove();                         // 열기 전 포커스 요소로의 복귀는 dialog가 처리
      opened.delete(index);
      o.end?.(index, reason);
    };
    opened.set(index, { type: isDrawer ? "drawer" : o.loading ? "load" : isFrame ? "iframe" : o.kind || "dialog", node: dlg, close });

    const tryCancel = () => { if (o.cancel?.(index, dlg) !== false) close("cancel"); };
    const maxBtn = dlg.querySelector('[data-catui-layer="max"]');
    const setMax = (on) => {
      dlg.classList.toggle("Catui_layer-max", on);
      if (on) { dlg.dataset.catuiPos = dlg.style.cssText; dlg.style.left = dlg.style.top = ""; dlg.style.transform = ""; }
      else if (dlg.dataset.catuiPos != null) { dlg.style.cssText = dlg.dataset.catuiPos; delete dlg.dataset.catuiPos; }
      if (maxBtn) { maxBtn.setAttribute("aria-pressed", String(on)); maxBtn.setAttribute("aria-label", on ? "원래 크기" : "최대화"); }
      o.full?.(index, on);
    };
    opened.get(index).setMax = setMax;
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) { if (o.shadeClose) tryCancel(); return; }  // 스크림(바깥) 클릭
      const b = e.target.closest("[data-catui-btn], [data-catui-layer=close], [data-catui-layer=max]");
      if (!b) return;
      if (b.dataset.catuiLayer === "close") { tryCancel(); return; }
      if (b.dataset.catuiLayer === "max") { setMax(!dlg.classList.contains("Catui_layer-max")); return; }
      const i = Number(b.dataset.catuiBtn);
      const cb = i === 0 ? o.yes : o[`btn${i + 1}`] ?? (i === 1 ? o.cancel : null);
      // 콜백이 false를 돌려주면 열린 채 유지(검증 실패 등). 첫 버튼에 콜백이 없으면 닫는다.
      const keep = cb ? cb(index, dlg) === false : false;
      if (!keep && !(i === 0 && o.yes)) close(i === 0 ? "yes" : "cancel");
    });
    // Esc: dialog 기본 동작(cancel 이벤트)을 가로채 cancel 콜백 존중
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (o.loading) return;               // 로딩 레이어는 Esc로 닫지 않음
      if (imeBusy()) return;               // 한글 조합 중(·직후) Esc는 조합만 끝내고 레이어는 유지
      tryCancel();
    });
    // cancel 이전 단계에서도 막는다: Esc keydown의 기본 동작을 취소하면 브라우저가 cancel/close를 보내지 않는다
    // (Chrome close-watcher는 cancel만 막으면 반복 Esc에서 강제로 닫을 수 있음)
    dlg.addEventListener("keydown", (e) => { if (e.key === "Escape" && imeBusy(e)) e.preventDefault(); }, true);
    // 머리를 끌어 옮기기 (최대화 중에는 안 함). 화면 밖으로 나가지 않게 제한
    if (o.move && !isDrawer) {
      const head = dlg.querySelector(".Catui_modal-h");
      let sx = 0, sy = 0, bx = 0, by = 0, drag = false;
      const down = (e) => {
        if (e.button || e.target.closest("button") || dlg.classList.contains("Catui_layer-max")) return;
        const r = dlg.getBoundingClientRect();
        drag = true; sx = e.clientX; sy = e.clientY; bx = r.left; by = r.top;
        dlg.style.transform = "none"; dlg.style.left = `${bx}px`; dlg.style.top = `${by}px`;
        head.setPointerCapture?.(e.pointerId);
      };
      const move = (e) => {
        if (!drag) return;
        const r = dlg.getBoundingClientRect();
        dlg.style.left = `${Math.min(innerWidth - 40, Math.max(40 - r.width, bx + e.clientX - sx))}px`;
        dlg.style.top = `${Math.min(innerHeight - 40, Math.max(0, by + e.clientY - sy))}px`;
      };
      const up = () => { drag = false; };
      head?.addEventListener("pointerdown", down); head?.addEventListener("pointermove", move);
      head?.addEventListener("pointerup", up); head?.addEventListener("pointercancel", up);
      offs.push(() => { head?.removeEventListener("pointerdown", down); head?.removeEventListener("pointermove", move); head?.removeEventListener("pointerup", up); head?.removeEventListener("pointercancel", up); });
    }

    dlg.showModal();
    if (size === "full") setMax(false);
    // 첫 포커스: Tab으로 갈 수 있는 요소만 (탭 목록의 비선택 탭처럼 tabindex="-1"인 것은 제외)
    const reach = `:is(${FOCUSABLE}):not([tabindex="-1"]):not([readonly])`;
    const first = dlg.querySelector(`[data-catui-layer="body"] ${reach}`) || dlg.querySelector('[data-catui-btn="0"]') || dlg.querySelector(reach);
    first?.focus();
    if (o.time > 0) timer = setTimeout(() => close("time"), o.time);
    o.success?.(dlg, index);
    return index;
  }

  function alert(content, options = {}, yes) {
    if (typeof options === "function") { yes = options; options = {}; }
    return open({ title: "알림", area: "sm", btn: ["확인"], ...options, content, yes: yes ? (i, d) => yes(i, d) : undefined });
  }

  function confirm(content, options = {}, yes, cancel) {
    if (typeof options === "function") { cancel = yes; yes = options; options = {}; }
    return open({ title: "확인", area: "sm", btn: [options.okText || "확인", options.cancelText || "취소"], ...options, content, yes, cancel });
  }

  // 입력 받기. options: { title, formType: 'text'|'password'|'textarea', value, maxlength, placeholder, required }
  function prompt(options = {}, yes) {
    if (typeof options === "function") { yes = options; options = {}; }
    const fid = `catui-prompt-${seq + 1}`;
    const field = options.formType === "textarea"
      ? html`<textarea class="Catui_input" id="${fid}" rows="4" maxlength="${options.maxlength || 500}" placeholder="${options.placeholder || ""}">${options.value || ""}</textarea>`
      : html`<input class="Catui_input" id="${fid}" type="${options.formType === "password" ? "password" : "text"}" maxlength="${options.maxlength || 200}" value="${options.value || ""}" placeholder="${options.placeholder || ""}" autocomplete="off">`;
    return open({
      title: options.title || "입력",
      area: "sm",
      btn: ["확인", "취소"],
      ...options,
      content: html`<div class="Catui_field"><label class="Catui_label" for="${fid}">${options.label || options.title || "값"}</label>${field}<p class="Catui_error" id="${fid}-err" hidden>값을 입력해 주세요.</p></div>`,
      success(dlg, index) {
        dlg.querySelector(`#${fid}`).addEventListener("keydown", (e) => {
          // 한글 조합 중 Enter는 글자 확정일 뿐 — 제출하지 않는다
          if (e.key === "Enter" && !imeBusy(e) && options.formType !== "textarea") { e.preventDefault(); dlg.querySelector('[data-catui-btn="0"]').click(); }
        });
        options.success?.(dlg, index);
      },
      yes(index, dlg) {
        const input = dlg.querySelector(`#${fid}`), value = input.value;
        const bad = options.required !== false && !value.trim();
        input.setAttribute("aria-invalid", String(bad));
        if (bad) input.setAttribute("aria-describedby", `${fid}-err`); else input.removeAttribute("aria-describedby");
        dlg.querySelector(`#${fid}-err`).hidden = !bad;
        if (bad) { input.focus(); return false; }
        if (yes) return yes(value, index, dlg);
        close(index);
      },
    });
  }

  // 로딩. options.progress: true면 진행률 막대(layer.progress(index, 0~100)로 갱신)
  function load(text = "불러오는 중…", options = {}) {
    if (typeof text === "object") { options = text; text = options.text || "불러오는 중…"; }
    const bar = options.progress ? `<div class="Catui_prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${""}"><i class="Catui_pc1" style="width:0%"></i></div>` : "";
    return open({ area: "sm", closeBtn: false, shadeClose: false, loading: true, label: text, ...options,
      content: raw(`<div class="Catui_layer-load" role="status"><span class="Catui_spin" aria-hidden="true"></span><span></span></div>${bar ? `<div style="padding:0 var(--Catui_modal-pad) var(--Catui_modal-pad)">${bar}</div>` : ""}`),
      success(dlg, index) {
        dlg.querySelector(".Catui_layer-load span:last-child").textContent = text;
        dlg.querySelector(".Catui_modal-b").style.padding = "0";
        dlg.querySelector('[role="progressbar"]')?.setAttribute("aria-label", text);
        options.success?.(dlg, index);
      },
    });
  }
  function progress(index, pct) {
    const n = opened.get(index)?.node, p = n?.querySelector('[role="progressbar"]');
    if (!p) return;
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    p.setAttribute("aria-valuenow", String(v));
    p.querySelector("i").style.width = `${v}%`;
    const label = n.querySelector(".Catui_layer-load span:last-child");
    if (label) label.textContent = `${n.getAttribute("aria-label")} ${v}%`;
  }

  // 말풍선: 대상 옆에 잠깐 띄움. options: { side:'top'|'bottom'|'left'|'right', time(ms, 0=수동) }
  function tips(content, target, options = {}) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return 0;
    const index = ++seq;
    const tip = document.createElement("div");
    tip.className = "Catui_layer-tip";
    tip.id = `catui-tip-${index}`;
    tip.setAttribute("role", "tooltip");
    fill(tip, content);
    layerRoot().appendChild(tip);
    const place = () => {
      const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), g = 8;
      let side = options.side || "top";
      const fits = { top: r.top - t.height - g > 0, bottom: r.bottom + t.height + g < innerHeight, left: r.left - t.width - g > 0, right: r.right + t.width + g < innerWidth };
      if (!fits[side]) side = { top: "bottom", bottom: "top", left: "right", right: "left" }[side];
      const pos = {
        top: [r.left + r.width / 2 - t.width / 2, r.top - t.height - g], bottom: [r.left + r.width / 2 - t.width / 2, r.bottom + g],
        left: [r.left - t.width - g, r.top + r.height / 2 - t.height / 2], right: [r.right + g, r.top + r.height / 2 - t.height / 2],
      }[side];
      tip.dataset.side = side;
      tip.style.left = `${Math.round(Math.min(innerWidth - t.width - 8, Math.max(8, pos[0])))}px`;
      tip.style.top = `${Math.round(Math.max(8, pos[1]))}px`;
    };
    place();
    const prev = el.getAttribute("aria-describedby");
    el.setAttribute("aria-describedby", [prev, tip.id].filter(Boolean).join(" "));
    let timer = 0;
    const key = (e) => { if (e.key === "Escape" && !imeBusy(e) && !e.defaultPrevented) { e.preventDefault(); done(); } };   // 캡처 단계: 팁만 닫고 아래 모달은 유지
    const outside = (e) => { if (!tip.contains(e.target) && !el.contains(e.target)) done(); };
    const done = () => {
      clearTimeout(timer); tip.remove(); opened.delete(index);
      if (prev) el.setAttribute("aria-describedby", prev); else el.removeAttribute("aria-describedby");
      document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", outside, true);
      removeEventListener("resize", place); removeEventListener("scroll", place, true);
      options.end?.(index);
    };
    document.addEventListener("keydown", key, true); document.addEventListener("pointerdown", outside, true);
    addEventListener("resize", place); addEventListener("scroll", place, true);
    const time = options.time ?? 3000;
    if (time > 0) timer = setTimeout(done, time);
    opened.set(index, { type: "tips", node: tip, close: done });
    return index;
  }

  // 사진 보기: items [{ src, alt, caption }], start. ←→ 키·버튼으로 이동
  function photos(options = {}) {
    const items = (options.items || []).filter((p) => safeUrl(p.src) || /^data:image\//.test(p.src || ""));
    if (!items.length) return 0;
    let k = Math.max(0, Math.min(items.length - 1, options.start || 0));
    const fig = document.createElement("figure");
    fig.className = "Catui_layer-photo";
    mount(fig, html`<img alt=""><figcaption><span></span><span aria-live="polite"></span></figcaption><button class="Catui_layer-nav" type="button" data-dir="prev" aria-label="이전 사진">${icon("chevron-right", 20)}</button><button class="Catui_layer-nav" type="button" data-dir="next" aria-label="다음 사진">${icon("chevron-right", 20)}</button>`);
    const img = fig.querySelector("img"), [cap, num] = fig.querySelectorAll("figcaption span");
    const prevB = fig.querySelector('[data-dir="prev"]'), nextB = fig.querySelector('[data-dir="next"]');
    const show = () => {
      const p = items[k];
      img.src = p.src; img.alt = p.alt || p.caption || `사진 ${k + 1}`;
      cap.textContent = p.caption || p.alt || ""; num.textContent = `${k + 1} / ${items.length}`;
      prevB.disabled = k === 0; nextB.disabled = k === items.length - 1;
      if (items.length < 2) prevB.hidden = nextB.hidden = true;
      options.change?.(k);
    };
    const go = (d) => { const n = k + d; if (n >= 0 && n < items.length) { k = n; show(); } };
    fig.addEventListener("click", (e) => { const b = e.target.closest(".Catui_layer-nav"); if (b) go(b.dataset.dir === "next" ? 1 : -1); });
    show();
    return open({
      title: options.title || "사진", area: "full", skin: "Catui_layer-photos", ...options, content: fig, kind: "photos",
      success(dlg, index) {
        dlg.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          else if (e.key === "Home") { e.preventDefault(); k = 0; show(); } else if (e.key === "End") { e.preventDefault(); k = items.length - 1; show(); }
        });
        (items.length > 1 ? nextB : dlg.querySelector('[data-catui-layer="close"]'))?.focus();
        options.success?.(dlg, index);
      },
    });
  }

  // 탭 대화상자: tabs [{ title, content }]. ←→·Home·End로 탭 이동
  function tab(options = {}) {
    const tabs = options.tabs || [];
    const id = `catui-ltab-${seq + 1}`;
    const wrap = document.createElement("div");
    const list = document.createElement("div");
    const vertical = !!options.vertical;
    list.className = vertical ? "Catui_layer-tabs Catui_layer-tabs-v" : options.card ? "Catui_layer-tabs Catui_layer-tabs-card" : "Catui_layer-tabs";
    list.setAttribute("role", "tablist"); list.setAttribute("aria-label", options.title || "탭");
    if (vertical) { list.setAttribute("aria-orientation", "vertical"); wrap.className = "Catui_layer-vtabs"; }
    wrap.appendChild(list);
    const stage = vertical ? document.createElement("div") : wrap;
    if (vertical) { stage.className = "Catui_layer-vtabs-panels"; wrap.appendChild(stage); }
    const panels = tabs.map((t, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = `${id}-t${i}`; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", `${id}-p${i}`);
      b.textContent = t.title; list.appendChild(b);
      const p = document.createElement("div");
      p.id = `${id}-p${i}`; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", b.id); p.tabIndex = 0;
      fill(p, t.content); stage.appendChild(p);
      return p;
    });
    const sel = (i, focus) => {
      [...list.children].forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; });
      if (focus) list.children[i].focus();
      options.change?.(i);
    };
    list.addEventListener("click", (e) => { const b = e.target.closest('[role="tab"]'); if (b) sel([...list.children].indexOf(b)); });
    list.addEventListener("keydown", (e) => {
      const n = list.children.length, i = [...list.children].indexOf(document.activeElement);
      const next = vertical ? "ArrowDown" : "ArrowRight", prev = vertical ? "ArrowUp" : "ArrowLeft";
      const to = { [next]: (i + 1) % n, [prev]: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to != null) { e.preventDefault(); sel(to, true); }
    });
    sel(options.start || 0);
    return open({ area: "lg", ...options, content: wrap, kind: "tab" });
  }

  // 양식 대화상자: fields로 입력 칸을 만들고 검사한 뒤 값 객체를 돌려줌(Promise, 취소는 null).
  //   submit(values, index)가 false를 돌려주거나 오류를 던지면 열린 채 유지(저장 중에는 버튼이 바쁨 상태)
  //   type: text·email·password·number·tel·url·date·time·textarea·select·radio·checkbox(options 있으면 여러 개)·switch
  //   field: { name, label, type, required, placeholder, value, options, help, min, max, minlength, maxlength, pattern, autocomplete, cols(1~12), rows, validate(v, values) → 오류 문구, messages }
  // 내용을 바꾸지 않고 뒤에 덧붙임 (mount는 교체)
  const append = (node, markup) => { if (isRaw(markup)) node.insertAdjacentHTML("beforeend", markup.__raw); else node.append(String(markup ?? "")); return node; };
  const FORM_MSG = { valueMissing: "필수 항목입니다.", typeMismatch: "형식이 올바르지 않습니다.", patternMismatch: "형식이 올바르지 않습니다.", tooShort: "너무 짧습니다.", tooLong: "너무 깁니다.", rangeUnderflow: "값이 너무 작습니다.", rangeOverflow: "값이 너무 큽니다.", badInput: "숫자를 입력해 주세요." };
  function form(options = {}) {
    return new Promise((resolve) => {
      const fid = `catui-form-${seq + 1}`, fields = options.fields || [];
      const opts = (fl) => (fl.options || []).map((o) => (typeof o === "object" ? o : { value: o, label: o }));
      const kindOf = (fl) => {
        const t = fl.type || "text";
        return t === "radio" || (t === "checkbox" && fl.options) ? "group" : t === "checkbox" || t === "switch" ? "single" : t;
      };
      const reqMark = () => html` <span class="Catui_req" aria-hidden="true">*</span>`;
      const control = (fl, id) => {
        const t = fl.type || "text", k = kindOf(fl), req = !!fl.required;
        const a = (el) => {
          const attrs = { id, name: fl.name, placeholder: fl.placeholder, min: fl.min, max: fl.max, minlength: fl.minlength, maxlength: fl.maxlength, pattern: fl.pattern, autocomplete: fl.autocomplete };
          Object.entries(attrs).forEach(([n, v]) => { if (v != null && v !== "") el.setAttribute(n, v); });
          if (req) el.required = true;
          if (fl.readonly) el.readOnly = true;
          if (fl.disabled) el.disabled = true;
          return el;
        };
        if (t === "textarea") { const x = a(document.createElement("textarea")); x.className = "Catui_input"; x.rows = fl.rows || 4; x.value = fl.value ?? ""; return x; }
        if (t === "select") {
          const w = document.createElement("div"); w.className = "Catui_select-wrap";
          const x = a(document.createElement("select")); x.className = "Catui_input Catui_select";
          if (fl.placeholder) x.add(new Option(fl.placeholder, ""));
          opts(fl).forEach((o) => x.add(new Option(o.label, o.value)));
          x.value = fl.value != null ? String(fl.value) : "";
          w.appendChild(x); append(w, icon("chevron-down", 16)); return w;
        }
        if (k === "group") {
          const fs = document.createElement("fieldset"); fs.className = "Catui_choices";
          const lg = document.createElement("legend"); lg.className = "Catui_label"; lg.textContent = fl.label;
          if (req) append(lg, reqMark());
          fs.appendChild(lg);
          const val = [].concat(fl.value ?? []).map(String);
          opts(fl).forEach((o, n) => {
            const iid = `${id}-${n}`;
            append(fs, html`<span class="Catui_choice"><input class="Catui_clip" type="${t}" id="${iid}" name="${fl.name}" value="${o.value}"><label class="${t === "radio" ? "Catui_radio" : "Catui_cbx"}" for="${iid}">${t === "radio" ? "" : icon("check", 12)}</label><label for="${iid}">${o.label}</label></span>`);
            fs.querySelector(`#${iid}`).checked = val.includes(String(o.value));
          });
          return fs;
        }
        if (k === "single") {
          const w = document.createElement("span"); w.className = "Catui_choice";
          append(w, html`<input class="Catui_clip" type="checkbox" id="${id}" name="${fl.name}"><label class="${t === "switch" ? "Catui_tgl" : "Catui_cbx"}" for="${id}">${t === "switch" ? "" : icon("check", 12)}</label><label for="${id}">${fl.label}</label>`);
          const x = w.querySelector("input"); x.checked = !!fl.value; x.required = req;
          if (t === "switch") x.setAttribute("role", "switch");
          if (req) append(w.lastElementChild, reqMark());
          return w;
        }
        const x = a(document.createElement("input")); x.className = "Catui_input"; x.type = t; if (fl.value != null) x.value = fl.value; return x;
      };

      const horizontal = options.layout === "horizontal";
      const el = document.createElement("form");
      el.className = horizontal ? "Catui_layer-form Catui_layer-form-h" : "Catui_layer-form"; el.noValidate = true; el.id = fid;
      if (options.labelWidth) el.style.setProperty("--Catui_form-label-w", typeof options.labelWidth === "number" ? `${options.labelWidth}px` : options.labelWidth);
      const sum = document.createElement("div");
      sum.className = "Catui_banner Catui_banner-danger"; sum.setAttribute("role", "alert"); sum.tabIndex = -1; sum.hidden = true;
      el.appendChild(sum);
      fields.forEach((fl, i) => {
        const id = `${fid}-${fl.name || i}`, k = kindOf(fl);
        const box = document.createElement("div");
        box.className = "Catui_field"; box.style.setProperty("--Catui_span", String(Math.min(12, Math.max(1, fl.cols || 12)))); box.dataset.name = fl.name;
        const top = fl.type === "textarea" ? " Catui_label-top" : "";
        if (k !== "group" && k !== "single") append(box, html`<label class="Catui_label${top}" for="${id}">${fl.label}${fl.required ? reqMark() : ""}</label>`);
        // 가로 배치의 묶음 칸: 보이는 라벨은 왼쪽 열에, legend는 화면 리더용으로
        if (horizontal && k === "group") append(box, html`<span class="Catui_label Catui_label-top" aria-hidden="true">${fl.label}${fl.required ? reqMark() : ""}</span>`);
        let ctl = control(fl, id);
        if (horizontal && k === "group") ctl.querySelector("legend").className = "Catui_clip";
        // 입력 옆 아이콘 버튼 (예: 비밀번호 새로 만들기). onClick(입력 요소, 현재 값들)
        if (fl.addon && k !== "group" && k !== "single") {
          const g = document.createElement("div"); g.className = "Catui_igroup";
          g.appendChild(ctl);
          append(g, html`<button class="Catui_btn Catui_btn-md Catui_btn-secondary Catui_btn-icon" type="button" aria-label="${fl.addon.label || "실행"}" title="${fl.addon.label || ""}">${icon(fl.addon.icon || "refresh-cw", 16)}</button>`);
          const input = ctl.matches?.("input,select,textarea") ? ctl : ctl.querySelector("input,select,textarea");
          g.lastElementChild.addEventListener("click", () => { fl.addon.onClick?.(input, read()); input.dispatchEvent(new Event("input", { bubbles: true })); });
          ctl = g;
        }
        box.appendChild(ctl);
        if (fl.help) append(box, html`<p class="Catui_help" id="${id}-h">${fl.help}</p>`);
        append(box, html`<p class="Catui_error" id="${id}-e" hidden></p>`);
        el.appendChild(box);
      });

      const read = () => Object.fromEntries(fields.filter((fl) => fl.name).map((fl) => {
        const t = fl.type || "text", ins = [...el.querySelectorAll(`[name="${CSS.escape(fl.name)}"]`)];
        if (t === "checkbox" && fl.options) return [fl.name, ins.filter((x) => x.checked).map((x) => x.value)];
        if (t === "checkbox" || t === "switch") return [fl.name, !!ins[0]?.checked];
        if (t === "radio") return [fl.name, ins.find((x) => x.checked)?.value ?? ""];
        if (t === "number") return [fl.name, ins[0].value === "" ? null : Number(ins[0].value)];
        return [fl.name, ins[0]?.value ?? ""];
      }));
      const check = () => {
        const values = read(), bad = [];
        fields.forEach((fl) => {
          const box = el.querySelector(`[data-name="${CSS.escape(String(fl.name))}"]`);
          if (!box) return;
          const ins = [...box.querySelectorAll("input,select,textarea")], err = box.querySelector(".Catui_error"), k = kindOf(fl);
          let m = "";
          if (fl.required && k === "group" && !(fl.type === "radio" ? values[fl.name] : values[fl.name].length)) m = fl.type === "radio" ? "하나를 고르세요." : "하나 이상 고르세요.";
          else if (k !== "group") {
            const inv = ins.find((x) => !x.checkValidity());
            if (inv) { const key = Object.keys(FORM_MSG).find((n) => inv.validity[n]); m = fl.messages?.[key] || FORM_MSG[key] || "값을 확인해 주세요."; }
            // 브라우저는 스크립트·자동 완성으로 채운 값에는 tooShort를 표시하지 않으므로 길이는 직접 검사
            const len = String(values[fl.name] ?? "").length;
            if (!m && len && fl.minlength && len < fl.minlength) m = fl.messages?.tooShort || `${fl.minlength}자 이상 입력해 주세요.`;
            if (!m && fl.maxlength && len > fl.maxlength) m = fl.messages?.tooLong || `${fl.maxlength}자 이하로 입력해 주세요.`;
          }
          if (!m && fl.validate) m = fl.validate(values[fl.name], values) || "";
          err.textContent = m; err.hidden = !m;
          ins.forEach((x) => x.setAttribute("aria-invalid", String(!!m)));
          const target = k === "group" ? box.querySelector("fieldset") : ins[0];
          const desc = [fl.help ? err.id.replace(/-e$/, "-h") : "", m ? err.id : ""].filter(Boolean).join(" ");
          if (desc) target.setAttribute("aria-describedby", desc); else target.removeAttribute("aria-describedby");
          if (m) bad.push({ label: fl.label, focus: k === "group" ? target.querySelector("input") : ins[0] });
        });
        sum.hidden = !bad.length;
        sum.textContent = bad.length ? `입력을 확인해 주세요 (${bad.length}건): ${bad.map((b) => b.label).join(", ")}` : "";
        bad[0]?.focus.focus();
        return bad.length ? null : values;
      };
      // 처음 값이 있는 칸에서도 help만 설명으로 연결
      fields.forEach((fl, i) => {
        if (!fl.help) return;
        const id = `${fid}-${fl.name || i}`, box = el.querySelector(`[data-name="${CSS.escape(String(fl.name))}"]`);
        (kindOf(fl) === "group" ? box.querySelector("fieldset") : box.querySelector("input,select,textarea"))?.setAttribute("aria-describedby", `${id}-h`);
      });

      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
      const index = open({
        title: options.title || "입력", area: options.area || "md", btn: [options.okText || "확인", options.cancelText || "취소"], ...options,
        content: el, kind: "form",
        end(i, reason) { finish(null); options.end?.(i, reason); },
        yes() { el.requestSubmit(); return false; },
      });
      const ok = getNode(index).querySelector('[data-catui-btn="0"]');
      // 제출 버튼이 폼 밖(꼬리)에 있으므로 한 줄 입력 칸의 Enter는 직접 제출
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !imeBusy(e) && e.target.matches("input:not([type=checkbox]):not([type=radio])")) { e.preventDefault(); el.requestSubmit(); }
      });
      el.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (ok.disabled) return;
        const values = check();
        if (!values) return;
        if (options.submit) {
          const label = ok.textContent;
          ok.disabled = true; ok.setAttribute("aria-busy", "true");
          ok.textContent = ""; mount(ok, html`<span class="Catui_spin" aria-hidden="true"></span>${label}`);
          let r;
          try { r = await options.submit(values, index); }
          catch (err) { r = false; sum.hidden = false; sum.textContent = err?.message || "저장하지 못했습니다. 다시 시도해 주세요."; sum.focus(); }
          ok.disabled = false; ok.removeAttribute("aria-busy"); ok.textContent = label;
          if (r === false) return;
        }
        finish(values); close(index);
      });
    });
  }

  // Promise로 받기
  const ask = (content, options = {}) => new Promise((resolve) => {
    let answered = false;
    confirm(content, { ...options, end: () => { if (!answered) resolve(false); options.end?.(); } },
      (index) => { answered = true; resolve(true); close(index); },
      () => { answered = true; resolve(false); });
  });
  const input = (options = {}) => new Promise((resolve) => {
    let answered = false;
    prompt({ ...options, end: () => { if (!answered) resolve(null); options.end?.(); } }, (value, index) => { answered = true; resolve(value); close(index); });
  });

  function close(index) { opened.get(index)?.close("close"); }
  function closeAll(type) { [...opened.entries()].forEach(([i, v]) => { if (!type || v.type === type) close(i); }); }
  function closeLast(type) { const last = [...opened.entries()].reverse().find(([, v]) => !type || v.type === type); if (last) close(last[0]); }
  function title(index, text) { const n = opened.get(index)?.node.querySelector("header > span:first-child"); if (n) n.textContent = text; }
  function getNode(index) { return opened.get(index)?.node || null; }
  function setContent(index, content) {
    const b = opened.get(index)?.node.querySelector('[data-catui-layer="body"]');
    if (!b) return;
    b.textContent = ""; fill(b, content);
  }
  function style(index, css = {}) {
    const n = opened.get(index)?.node;
    if (!n) return;
    Object.entries(css).forEach(([k, v]) => { n.style[k] = typeof v === "number" ? `${v}px` : v; });
  }
  const full = (index) => opened.get(index)?.setMax?.(true);
  const restore = (index) => opened.get(index)?.setMax?.(false);
  // 열린 레이어 목록 (type 별)
  const list = (type) => [...opened.entries()].filter(([, v]) => !type || v.type === type).map(([i, v]) => ({ index: i, type: v.type, node: v.node }));

  return { msg, open, alert, confirm, prompt, load, progress, tips, photos, tab, form, ask, input, close, closeAll, closeLast, title, getNode, setContent, style, full, restore, list, get count() { return opened.size; } };
})();

// ── modules/form.js ──

// form — 선언형 폼 검증·제출 이벤트. 마크업만으로 동작한다:
//   <form data-catui-form data-catui-filter="login">
//     <input class="Catui_input" name="email" data-catui-verify="required|email">
//     <button class="Catui_btn ..." data-catui-submit>로그인</button>
//   form.on('submit(login)', (data) => { data.field; return false; })   // false = 기본 제출 막기
// 선택 컨트롤: form.on('checkbox(f)') / 'switch(f)' / 'radio(f)' / 'select(f)' — 필터는 요소의 data-catui-filter
const form = (() => {
  const MOD = "form";
  const rules = {
    required: [/[\S]+/, "필수 항목입니다."],
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "이메일 형식이 아닙니다. 예: name@company.com"],
    phone: [/^01[016789]-?\d{3,4}-?\d{4}$/, "휴대전화 번호 형식이 아닙니다. 예: 010-1234-5678"],
    tel: [/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "전화번호 형식이 아닙니다. 예: 02-123-4567"],
    zip: [/^\d{5}$/, "우편번호는 숫자 5자리입니다."],
    url: [/^https?:\/\/[^\s/$.?#].[^\s]*$/i, "주소 형식이 아닙니다. 예: https://example.com"],
    number: (v) => (v === "" || Number.isFinite(Number(v)) ? "" : "숫자만 입력해 주세요."),
    int: [/^-?\d+$/, "정수만 입력해 주세요."],
    date: [/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "날짜 형식이 아닙니다. 예: 2026-10-31"],
    id: [/^[a-zA-Z][a-zA-Z0-9_]{3,15}$/, "영문으로 시작하는 4~16자 영문·숫자·밑줄입니다."],
    password: (v) => (/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v) ? "" : "영문과 숫자를 포함해 8자 이상 입력해 주세요."),
    hangul: [/^[가-힣\s]+$/, "한글만 입력해 주세요."],
    alpha: [/^[A-Za-z]+$/, "영문만 입력해 주세요."],
    alnum: [/^[A-Za-z0-9]+$/, "영문과 숫자만 입력해 주세요."],
    // 매개변수 규칙 — "이름:값"으로 쓴다. fn(value, field, arg, root)
    min: (v, f, n) => (v !== "" && Number.isFinite(Number(v)) && Number(v) >= Number(n) ? "" : `${n} 이상의 숫자를 입력해 주세요.`),
    max: (v, f, n) => (v !== "" && Number.isFinite(Number(v)) && Number(v) <= Number(n) ? "" : `${n} 이하의 숫자를 입력해 주세요.`),
    minlen: (v, f, n) => (v.length >= Number(n) ? "" : `${n}자 이상 입력해 주세요.`),
    maxlen: (v, f, n) => (v.length <= Number(n) ? "" : `${n}자 이하로 입력해 주세요.`),
    len: (v, f, n) => (v.length === Number(n) ? "" : `${n}자로 입력해 주세요.`),
    same: (v, f, name, root) => {
      const other = name ? (root || document).querySelector(`[name="${CSS.escape(name)}"]`) : null;
      if (!other) return "";
      return v === other.value ? "" : "값이 서로 다릅니다.";
    },
  };

  // 사용자 규칙 추가: form.verify({ name: [정규식, '메시지'] | (value, elem, arg, root) => '오류 메시지' | '' })
  function verify(more) { Object.assign(rules, more || {}); return rules; }

  const fieldValue = (f) => (f.type === "checkbox" || f.type === "radio" ? (f.checked ? f.value : "") : f.value);
  const formRoot = (f) => f.closest("[data-catui-form], [data-catui-filter]") || f.form || document;

  function check(field) {
    const spec = field.getAttribute("data-catui-verify");
    if (!spec) return "";
    const root = formRoot(field);
    let value = fieldValue(field);
    // 같은 name이 여러 개면 그룹 — required는 하나 이상 선택으로 본다
    if ((field.type === "checkbox" || field.type === "radio") && field.name) {
      const group = root.querySelectorAll(`[name="${CSS.escape(field.name)}"]`);
      if (group.length > 1) value = [...group].some((g) => g.checked) ? field.value || "on" : "";
    }
    for (const token of spec.split("|").map((s) => s.trim()).filter(Boolean)) {
      const [name, arg] = token.split(/:(.+)/).map((s) => s.trim());   // "min:5" → min + "5"
      if (name !== "required" && value === "") continue;       // 빈 값은 required만 검사
      const rule = rules[name];
      if (!rule) { hint.errorOnce(`form: '${name}' 검증 규칙이 없습니다`); continue; }
      let msg = "";
      if (typeof rule === "function") msg = rule(value, field, arg, root) || "";
      else if (!rule[0].test(value)) msg = rule[1];
      if (msg) {
        if (name === "required" && field.getAttribute("data-catui-reqtext")) return field.getAttribute("data-catui-reqtext");
        return field.getAttribute("data-catui-errtext") || msg;
      }
    }
    return "";
  }

  // 오류 표시: aria-invalid + 에러 문장(.Catui_error, 없으면 생성) + aria-describedby 연결
  function showError(field, msg) {
    if (!field.id) field.id = uid("catui-f");
    const errId = `${field.id}-err`;
    let err = document.getElementById(errId);
    if (!err && msg) {
      err = document.createElement("p");
      err.className = "Catui_error";
      err.id = errId;
      const host = field.closest(".Catui_field");
      if (host) host.appendChild(err); else field.insertAdjacentElement("afterend", err);
    }
    const described = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== errId);
    if (msg) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", [...described, errId].join(" "));
      err.textContent = msg;
      err.hidden = false;
    } else {
      field.removeAttribute("aria-invalid");
      if (described.length) field.setAttribute("aria-describedby", described.join(" ")); else field.removeAttribute("aria-describedby");
      if (err) err.hidden = true;
    }
  }

  // 필터 이름으로 폼 찾기 — 같은 필터를 쓰는 컨트롤(select 등)보다 폼·영역을 먼저
  function findRoot(filter) {
    const q = `[data-catui-filter="${CSS.escape(String(filter))}"]`;
    return document.querySelector(`form${q}, [data-catui-form]${q}`) || document.querySelector(q);
  }

  // 영역: 요소·선택자·document 또는 필터 이름. 대상을 못 찾으면 통과시키지 않는다.
  function validate(scope) {
    let root = null;
    try { root = scopeOf(scope); } catch { /* 선택자가 아닌 필터 이름 */ }
    if (!root && typeof scope === "string") root = findRoot(scope);
    if (!root) { hint.error(`form.validate: 영역을 찾을 수 없습니다 (${scope})`); return false; }
    let first = null;
    for (const f of root.querySelectorAll("[data-catui-verify]")) {
      if (f.disabled) continue;
      const msg = check(f);
      showError(f, msg);
      if (msg && !first) first = f;
    }
    if (first) first.focus();
    return !first;
  }

  // 값 읽기/쓰기. form.val('login') → { name: value }, form.val('login', { name: 'x' })
  function val(filter, values) {
    const root = findRoot(filter);
    if (!root) { hint.error(`form.val: data-catui-filter="${filter}" 요소가 없습니다`); return {}; }
    if (values) {
      for (const [name, v] of Object.entries(values)) {
        root.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((f) => {
          if (f.type === "file") return;              // 파일 입력은 보안상 값을 넣을 수 없다(InvalidStateError)
          if (f.multiple && f.tagName === "SELECT") [...f.options].forEach((o) => { o.selected = [].concat(v).map(String).includes(o.value); });
          else if (f.type === "checkbox") f.checked = Array.isArray(v) ? v.includes(f.value) : !!v && (v === true || v === f.value || v === "on");
          else if (f.type === "radio") f.checked = f.value === String(v);
          else f.value = v ?? "";
        });
      }
    }
    return collect(root);
  }

  // 같은 name이 여러 개(체크박스 묶음)면 배열로. 파일 입력은 제외.
  function collect(root) {
    const out = {};
    const add = (k, v) => { if (k in out) out[k] = [].concat(out[k], v); else out[k] = v; };
    if (root instanceof HTMLFormElement) {
      for (const [k, v] of new FormData(root).entries()) if (!(v instanceof File)) add(k, v);
      return out;
    }
    root.querySelectorAll("[name]").forEach((f) => {
      if (f.disabled || f.type === "file" || ((f.type === "checkbox" || f.type === "radio") && !f.checked)) return;
      add(f.name, f.value);
    });
    return out;
  }

  // form.reset('login') — 기본값으로 돌리고 남은 오류 표시를 지운다
  function reset(filter) {
    const root = findRoot(filter);
    if (!root) { hint.error(`form.reset: data-catui-filter="${filter}" 요소가 없습니다`); return; }
    // name="reset"인 칸이 form.reset을 가리는 DOM clobbering을 피해 원형 메서드로 호출
    if (root instanceof HTMLFormElement) HTMLFormElement.prototype.reset.call(root);
    else root.querySelectorAll("[name]").forEach((f) => {
      if (f.type === "checkbox" || f.type === "radio") f.checked = f.defaultChecked;
      else if (f.tagName === "SELECT") [...f.options].forEach((o) => { o.selected = o.defaultSelected; });
      else if (f.type !== "file") f.value = f.defaultValue ?? "";
    });
    root.querySelectorAll("[data-catui-verify]").forEach((f) => showError(f, ""));
  }

  // form.serialize('login') → "a=1&b=2" (같은 name은 반복 키)
  function serialize(filter) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(val(filter))) for (const x of [].concat(v)) q.append(k, x);
    return q.toString();
  }

  // data-catui-ajax[=url] 폼: 검증·submit 이벤트 통과 뒤 fetch로 보내고 done/fail 이벤트
  const sending = new WeakSet();   // 보내는 중인 폼 — Enter 연타·버튼 없는 제출도 막는다
  async function send(f, filter, submitter) {
    if (sending.has(f)) return;
    sending.add(f);
    // f.action은 name="action"인 칸이 가릴 수 있어(DOM clobbering) 속성으로 읽는다
    const url = f.getAttribute("data-catui-ajax") || f.getAttribute("action") || location.href;
    const method = (f.getAttribute("method") || "post").toUpperCase();
    if (submitter) { submitter.disabled = true; submitter.setAttribute("aria-busy", "true"); }
    f.setAttribute("aria-busy", "true");
    let data;
    try { data = submitter?.name ? new FormData(f, submitter) : new FormData(f); } catch { data = new FormData(f); }   // 누른 버튼의 name=value 포함
    const base = { elem: submitter || null, form: f, field: collect(f) };
    // 응답이 오지 않으면 버튼이 영영 잠기지 않도록 시간 제한 (data-catui-timeout, ms, 기본 30초, 0 = 없음)
    const ms = Number(f.getAttribute("data-catui-timeout") ?? 30000);
    const ctrl = new AbortController();
    const timer = ms > 0 ? setTimeout(() => ctrl.abort(), ms) : 0;
    try {
      let target = url, body = data;
      if (method === "GET") { target += (target.includes("?") ? "&" : "?") + new URLSearchParams(data); body = null; }
      const res = await fetch(target, { method, body, signal: ctrl.signal, headers: { Accept: "application/json, text/plain", ...csrfHeaders(target, method) } });
      const text = await res.text();
      let parsed = text;
      if ((res.headers.get("content-type") || "").includes("json") && text) { try { parsed = JSON.parse(text); } catch { /* 글자로 둔다 */ } }
      if (!res.ok) throw Object.assign(new Error(`요청 실패 (HTTP ${res.status})`), { status: res.status, data: parsed });
      emit(MOD, "done", filter, { ...base, res: parsed, status: res.status }, submitter || f);
    } catch (err) {
      const error = err?.name === "AbortError" ? Object.assign(new Error(`응답 시간이 초과되었습니다 (${ms / 1000}초)`), { timeout: true }) : err;
      emit(MOD, "fail", filter, { ...base, error }, submitter || f);
    } finally {
      clearTimeout(timer);
      sending.delete(f);
      f.removeAttribute("aria-busy");
      if (submitter) { submitter.disabled = false; submitter.removeAttribute("aria-busy"); }
    }
  }

  // select.Catui_select에 화살표 아이콘이 없으면 붙인다 (견본 규칙)
  function render(scope = document) {
    const root = el(scope) || document;
    root.querySelectorAll(".Catui_select-wrap").forEach((w) => {
      if (!w.querySelector(".Catui_icon")) w.insertAdjacentHTML("beforeend", icon("chevron-down", 16).__raw);
    });
  }

  // 전역 위임 (catui.init에서 1회 연결)
  function bind() {
    const offs = [];
    const onSubmit = (e) => {
      const f = e.target;
      if (!(f instanceof HTMLFormElement) || !f.matches("[data-catui-form]")) return;
      if (sending.has(f)) { e.preventDefault(); return; }   // Ajax 응답 대기 중 재제출 무시
      if (e.submitter && f.querySelector("[data-catui-submit]") && !e.submitter.matches("[data-catui-submit]")) return;
      if (!validate(f)) { e.preventDefault(); return; }
      const filter = e.submitter?.getAttribute("data-catui-filter") || f.getAttribute("data-catui-filter");
      const ok = emit(MOD, "submit", filter, { elem: e.submitter || null, form: f, field: collect(f) }, e.submitter || f);
      if (!ok) { e.preventDefault(); return; }
      if (f.hasAttribute("data-catui-ajax")) { e.preventDefault(); send(f, filter, e.submitter || f.querySelector("[data-catui-submit]")); }
    };
    document.addEventListener("submit", onSubmit);
    offs.push(() => document.removeEventListener("submit", onSubmit));

    // 한 번 틀린 칸은 입력할 때마다 다시 검사 (고치면 즉시 오류 해제)
    const onInput = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches("[data-catui-verify][aria-invalid=true]")) showError(t, check(t));
      // same:이름 으로 이 칸을 참조하는 확인 칸도 다시 검사
      if (t.name) formRoot(t).querySelectorAll(`[data-catui-verify*="same:${CSS.escape(t.name)}"][aria-invalid=true]`).forEach((c) => showError(c, check(c)));
      if (t.matches("input:not([type=checkbox]):not([type=radio]), textarea") && t.closest("[data-catui-form], [data-catui-filter]")) {
        const filter = t.getAttribute("data-catui-filter") || t.closest("[data-catui-filter]")?.getAttribute("data-catui-filter");
        emit(MOD, "input", filter, { elem: t, value: t.value, name: t.name });
      }
    };
    const onBlur = (e) => {
      const t = e.target;
      if (t.matches?.("[data-catui-verify]") && t.closest("[data-catui-form]") && t.value !== "") showError(t, check(t));
    };
    document.addEventListener("input", onInput);
    document.addEventListener("focusout", onBlur);
    offs.push(() => document.removeEventListener("input", onInput), () => document.removeEventListener("focusout", onBlur));

    const onChange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement) || !t.closest("[data-catui-form], [data-catui-filter]")) return;
      if (t.matches(".Catui_modal-toggle, .Catui_drawer-toggle")) return;   // 폼 안 모달 열기 체크박스는 폼 값이 아니다
      const filter = t.getAttribute("data-catui-filter") || t.closest("[data-catui-filter]")?.getAttribute("data-catui-filter");
      // 그룹 선택이 바뀌면 같은 name 중 오류 표시된 칸을 다시 검사
      if ((t.type === "checkbox" || t.type === "radio") && t.name) formRoot(t).querySelectorAll(`[name="${CSS.escape(t.name)}"][data-catui-verify][aria-invalid=true]`).forEach((c) => showError(c, check(c)));
      const base = { elem: t, value: t.value, othis: t };
      if (t.type === "checkbox") emit(MOD, t.getAttribute("role") === "switch" || t.nextElementSibling?.classList.contains("Catui_tgl") ? "switch" : "checkbox", filter, { ...base, checked: t.checked });
      else if (t.type === "radio") emit(MOD, "radio", filter, base);
      else if (t.tagName === "SELECT") emit(MOD, "select", filter, base);
    };
    document.addEventListener("change", onChange);
    offs.push(() => document.removeEventListener("change", onChange));
    return () => offs.forEach((f) => f());
  }

  return {
    verify, validate, val, render, bind, check, reset, serialize,
    on: (evt, fn) => onEvent(MOD, evt, fn),
    off: (evt) => offEvent(MOD, evt),
    // 프로그램 제출: form.submit('login', cb?) → 검증 후 submit 이벤트 발생 (data-catui-ajax 폼은 이어서 전송)
    submit(filter, cb) {
      const f = findRoot(filter);
      if (!f) { hint.error(`form.submit: data-catui-filter="${filter}" 요소가 없습니다`); return false; }
      if (sending.has(f) || !validate(f)) return false;
      const data = { elem: null, form: f, field: collect(f) };
      if (cb) { cb(data); return true; }
      if (emit(MOD, "submit", filter, data, f) && f instanceof HTMLFormElement && f.hasAttribute("data-catui-ajax")) send(f, filter, f.querySelector("[data-catui-submit]"));
      return true;
    },
    setError: (field, msg) => { const t = el(field); if (t) showError(t, msg); },
    clearError: (field) => { const t = el(field); if (t) showError(t, ""); },
  };
})();

// ── modules/laypage.js ──

// laypage — 페이지 이동.
//   laypage.render({ elem: '#pager', count: 120, limit: 10, curr: 1, jump(obj, first) { obj.curr; obj.limit } })
//   layout: ['count', 'prev', 'page', 'next', 'limit', 'skip'] 중 고른 순서대로 (기본 prev·page·next)
//     count 총 건수 · limit 쪽 크기 고르기(limits: [10, 20, 50, 100]) · skip 쪽 번호 입력해 바로 가기
const laypage = component({
  name: "laypage",
  config: { count: 0, limit: 10, curr: 1, groups: 5, label: "페이지", layout: null, limits: [10, 20, 50, 100], alwaysShow: false, jump: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box) return;
    const uidBase = uid("catui-pg");
    // limit이 0·음수·숫자 아님이면 쪽 수가 Infinity가 되므로 1 이상으로
    const lim = () => Math.max(1, Math.floor(Number(c.limit)) || 10);
    const pages = () => Math.max(1, Math.ceil((Number(c.count) || 0) / lim()));
    const layout = () => (Array.isArray(c.layout) && c.layout.length ? c.layout : ["prev", "page", "next"]);
    const info = () => ({ curr: c.curr, limit: lim(), count: c.count, pages: pages() });
    const draw = () => {
      const total = pages();
      c.curr = Math.min(Math.max(1, Number(c.curr) || 1), total);
      // 현재 쪽을 가운데 두는 번호 묶음 + 처음/끝, 사이가 비면 …
      const groups = Math.max(1, Number(c.groups) || 5);
      const half = Math.floor(groups / 2);
      let start = Math.max(1, c.curr - half), end = Math.min(total, start + groups - 1);
      start = Math.max(1, end - groups + 1);
      const nums = [];
      if (start > 1) nums.push(1, start > 2 ? "…" : null);
      for (let i = start; i <= end; i++) nums.push(i);
      if (end < total) nums.push(end < total - 1 ? "…" : null, total);
      box.classList.add("Catui_pager");
      if (box.tagName !== "NAV") box.setAttribute("role", "navigation");
      box.setAttribute("aria-label", c.label);
      const parts = layout();
      // 쪽이 하나뿐이면 숨기되, 총 건수·쪽 크기를 보여 줘야 하는 레이아웃이면 남긴다
      const hide = total < 2 && !c.alwaysShow && !parts.some((p) => p === "count" || p === "limit");
      const limits = [...new Set([...(c.limits || []), lim()].map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
      const part = {
        count: () => html`<span class="Catui_help Catui_num">총 ${Number(c.count) || 0}건</span>`,
        prev: () => html`<button class="Catui_pg" type="button" data-catui-page="${c.curr - 1}" aria-label="이전 페이지" ${c.curr === 1 ? "disabled" : ""}>${icon("chevron-right", 16, "Catui_pg-prev")}</button>`,
        next: () => html`<button class="Catui_pg" type="button" data-catui-page="${c.curr + 1}" aria-label="다음 페이지" ${c.curr === total ? "disabled" : ""}>${icon("chevron-right", 16)}</button>`,
        page: () => nums.filter((n) => n !== null).map((n) => (n === "…"
          ? html`<span class="Catui_help" aria-hidden="true">…</span>`
          : html`<button class="Catui_pg${n === c.curr ? " Catui_pg-active" : ""}" type="button" data-catui-page="${n}" ${n === c.curr ? html`aria-current="page"` : ""} aria-label="${n}쪽">${n}</button>`)),
        limit: () => html`<span class="Catui_select-wrap"><select class="Catui_input Catui_input-sm Catui_select" id="${uidBase}-limit" data-catui-limit aria-label="쪽당 개수">${limits.map((n) => html`<option value="${n}" ${n === lim() ? "selected" : ""}>${n}개씩</option>`)}</select>${icon("chevron-down", 16)}</span>`,
        skip: () => html`<span style="display:inline-flex;align-items:center;gap:var(--Catui_space-1)"><input class="Catui_input Catui_input-sm Catui_num" id="${uidBase}-skip" type="number" inputmode="numeric" min="1" max="${total}" value="${c.curr}" style="width:64px" aria-label="이동할 쪽 (1~${total})" data-catui-skip><button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-catui-go>이동</button></span>`,
      };
      mount(box, hide ? html`` : html`${parts.filter((p) => part[p]).map((p) => part[p]())}`);
    };
    const go = (n, focusSel) => {
      const next = Math.min(Math.max(1, Math.floor(Number(n)) || 1), pages());
      if (next === c.curr && !focusSel) return;
      c.curr = next;
      draw();
      box.querySelector(focusSel || `[data-catui-page="${c.curr}"][aria-current]`)?.focus();
      c.jump?.call(inst, info(), false);
      inst.emit("jump", { curr: c.curr, limit: lim() });
    };
    const onClick = (e) => {
      const b = e.target.closest("[data-catui-page]");
      if (b && !b.disabled) { go(b.dataset.catuiPage); return; }
      if (e.target.closest("[data-catui-go]")) go(box.querySelector("[data-catui-skip]")?.value, "[data-catui-skip]");
    };
    const onKey = (e) => { if (e.key === "Enter" && !imeBusy(e) && e.target.matches("[data-catui-skip]")) { e.preventDefault(); go(e.target.value, "[data-catui-skip]"); } };
    const onChange = (e) => {
      if (!e.target.matches("[data-catui-limit]")) return;
      // 쪽 크기를 바꿔도 지금 보던 첫 항목이 들어 있는 쪽으로 이동
      const first = (c.curr - 1) * lim();
      c.limit = Number(e.target.value);
      c.curr = Math.floor(first / lim()) + 1;
      go(c.curr, "[data-catui-limit]");
    };
    draw();
    box.addEventListener("click", onClick);
    box.addEventListener("keydown", onKey);
    box.addEventListener("change", onChange);
    inst.use(() => { box.removeEventListener("click", onClick); box.removeEventListener("keydown", onKey); box.removeEventListener("change", onChange); });
    c.jump?.call(inst, info(), true);
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
});

// ── modules/table.js ──

// table — 데이터 표.
//   table.render({
//     elem: '#orders', id: 'orders',
//     cols: [{ type: 'checkbox' }, { field: 'id', title: '번호', sort: true },
//            { field: 'status', title: '상태', templet: (d) => html`<span class="Catui_pill">${d.status}</span>` },
//            { title: '동작', toolbar: [{ event: 'edit', text: '수정', icon: 'pen-line' }] }],
//     data: [...] | url: '/api/orders', page: true, limit: 10,
//   });
//   table.on('tool(orders)', (obj) => { obj.event; obj.data; obj.del(); obj.update({...}) });
// templet이 돌려준 일반 문자열은 escape된다. 마크업은 html``로 돌려준다.
const table = component({
  name: "table",
  config: {
    cols: [], data: null, url: null, method: "GET", where: {}, headers: {}, parseData: null,
    page: false, limit: 10, caption: "", initSort: null, loading: true,
    text: { none: "데이터가 없습니다." },
  },
  CONST: { ELEM: "Catui_tbl" },
  render(inst) {
    const c = inst.config;
    const host = inst.elem;
    if (!host) return;
    // 상태는 reload 사이에 유지 (정렬·쪽·선택)
    const s = (inst.state ||= { rows: [], count: 0, curr: 1, sort: c.initSort ? { ...c.initSort } : null, checked: new Set(), loading: false, error: "", req: null, where: undefined, limit: 0 });
    if (c.page && typeof c.page === "object" && c.page.curr && s.where === undefined) s.curr = c.page.curr;
    // 검색 조건(where)이 바뀌면 1쪽부터 — 5쪽을 보다가 결과가 1쪽뿐인 검색을 하면 빈 표가 되는 문제 방지
    const whereKey = JSON.stringify(c.where || {});
    if (s.where !== undefined && s.where !== whereKey) { s.curr = 1; s.checked.clear(); }
    s.where = whereKey;
    if (c.data) s.checked = new Set([...s.checked].filter((r) => c.data.includes(r)));
    // 쪽 크기: 옵션이 바뀌면 따르고, 그 사이 사용자가 고른 크기(limits)는 상태로 유지
    const baseLimit = Math.max(1, Number((typeof c.page === "object" && c.page.limit) || c.limit) || 10);
    if (s.baseLimit !== baseLimit) { s.baseLimit = baseLimit; s.limit = baseLimit; }
    const pageOpt = typeof c.page === "object" ? c.page : {};
    const cols = c.cols.filter((col) => !col.hide);
    const capId = uid("catui-tbl-cap");

    mount(host, html`<div class="Catui_table-wrap" data-catui-table-body></div>${c.page ? html`<div data-catui-table-pager></div>` : ""}`);
    const body = host.querySelector("[data-catui-table-body]");
    const pagerEl = host.querySelector("[data-catui-table-pager]");

    const cellValue = (col, row, i) => {
      if (col.type === "numbers") return String((c.page ? (s.curr - 1) * s.limit : 0) + i + 1);
      if (col.templet) { const v = col.templet(row, i); return isRaw(v) ? v : escape(v); }
      if (col.toolbar) return html`<div class="Catui_actions">${col.toolbar.map((b) => html`<button class="Catui_btn Catui_btn-sm ${b.danger ? "Catui_btn-danger" : "Catui_btn-ghost"}" type="button" data-catui-event="${b.event}" aria-label="${b.text}${row[c.labelField || "id"] != null ? ` ${row[c.labelField || "id"]}` : ""}">${b.icon ? icon(b.icon, 16) : ""}${b.icon && !b.showText ? "" : b.text}</button>`)}</div>`;
      return escape(row[col.field]);
    };
    const asCell = (v) => (isRaw(v) ? v : raw(v));

    // 로컬 데이터: 정렬·쪽 나누기를 여기서. 원격: 서버가 처리했다고 보고 그대로.
    const sorted = () => {
      const rows = [...(c.data || [])];
      if (s.sort?.field && s.sort.type) {
        const f = s.sort.field, dir = s.sort.type === "asc" ? 1 : -1;
        rows.sort((a, b) => {
          const x = a[f], y = b[f];
          const nx = Number(x), ny = Number(y);
          const cmp = Number.isFinite(nx) && Number.isFinite(ny) && x !== "" && y !== "" ? nx - ny : String(x ?? "").localeCompare(String(y ?? ""), "ko");
          return cmp * dir;
        });
      }
      return rows;
    };
    const view = () => {
      if (c.url) return s.rows;
      const rows = sorted();
      s.count = rows.length;
      // 데이터가 줄어 현재 쪽이 범위를 벗어나면 마지막 쪽으로
      s.curr = Math.min(Math.max(1, s.curr), Math.max(1, Math.ceil(s.count / s.limit)));
      return c.page ? rows.slice((s.curr - 1) * s.limit, s.curr * s.limit) : rows;
    };

    const draw = () => {
      const rows = view();
      inst.rows = rows;
      const allOn = rows.length > 0 && rows.every((r) => s.checked.has(r));
      const someOn = rows.some((r) => s.checked.has(r));
      const colspan = cols.length;
      mount(body, html`
<table class="Catui_tbl" ${c.caption ? html`aria-labelledby="${capId}"` : ""} aria-busy="${s.loading}">
${c.caption ? html`<caption id="${capId}">${c.caption}</caption>` : ""}
<thead><tr>${cols.map((col) => {
  const w = col.width ? html` style="width:${typeof col.width === "number" ? `${col.width}px` : col.width}"` : "";
  if (col.type === "checkbox") return html`<th scope="col"${w}><label class="Catui_choice"><input class="Catui_clip" type="checkbox" data-catui-check="all" aria-label="이 쪽 전체 선택" ${allOn ? "checked" : ""}><span class="Catui_cbx">${icon("check", 12)}</span></label></th>`;
  if (col.type === "numbers") return html`<th scope="col" class="Catui_num"${w}><span class="Catui_clip">순번</span>#</th>`;
  const active = !!s.sort && col.field != null && s.sort.field === col.field && s.sort.type;
  const align = col.align === "right" ? " Catui_num" : "";
  if (!col.sort) return html`<th scope="col" class="${align.trim()}"${w}>${col.title}</th>`;
  return html`<th scope="col" class="${active ? "Catui_sort" : ""}${align}" aria-sort="${active ? (s.sort.type === "asc" ? "ascending" : "descending") : "none"}"${w}><button type="button" data-catui-sort="${col.field}" style="font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit">${col.title}${active ? icon(s.sort.type === "asc" ? "chevron-up" : "chevron-down", 12) : ""}</button></th>`;
})}</tr></thead>
<tbody>${s.error
  ? html`<tr><td colspan="${colspan}"><div class="Catui_banner Catui_banner-danger" role="alert">${icon("alert-circle", 16)}<span>${s.error}</span></div></td></tr>`
  : s.loading
    ? html`<tr><td colspan="${colspan}"><div class="Catui_skeleton Catui_skeleton-text"></div><div class="Catui_skeleton Catui_skeleton-text"></div></td></tr>`
    : rows.length
      ? rows.map((row, i) => html`<tr data-catui-index="${i}">${cols.map((col) => (col.type === "checkbox"
          ? html`<td><label class="Catui_choice"><input class="Catui_clip" type="checkbox" data-catui-check="${i}" aria-label="${i + 1}번째 행 선택" ${s.checked.has(row) ? "checked" : ""}><span class="Catui_cbx">${icon("check", 12)}</span></label></td>`
          : html`<td class="${col.align === "right" || col.type === "numbers" ? "Catui_num" : ""}">${asCell(cellValue(col, row, i))}</td>`))}</tr>`)
      : html`<tr><td colspan="${colspan}"><div class="Catui_empty">${icon("inbox", 16)}<p class="Catui_empty-title">${c.text.none}</p></div></td></tr>`}
</tbody></table>`);
      const all = body.querySelector('[data-catui-check="all"]');
      if (all) all.indeterminate = someOn && !allOn;
      if (pagerEl && !s.loading) {
        // 페이지 컴포넌트는 한 번만 만들고 이후엔 reload로 갱신 (정리 함수 누적 방지)
        if (!pager) {
          // page: { layout, limits } 는 laypage로 그대로 넘긴다 (예: layout: ['count','prev','page','next','limit','skip'])
          pager = laypage.render({ elem: pagerEl, id: `${inst.id}-pager`, layout: pageOpt.layout, limits: pageOpt.limits, count: s.count, limit: s.limit, curr: s.curr,
            jump(obj, first) { if (first) return; s.curr = obj.curr; s.limit = obj.limit; c.url ? load() : draw(); } });
          inst.use(() => pager.destroy());
        } else pager.reload({ count: s.count, curr: s.curr, limit: s.limit });
      }
    };
    let pager = null;

    const load = async () => {
      if (!c.url) { draw(); return; }
      s.req?.abort();
      const ac = (s.req = new AbortController());
      s.loading = c.loading; s.error = ""; draw();
      try {
        const q = new URLSearchParams({ ...c.where, ...(c.page ? { page: s.curr, limit: s.limit } : {}), ...(s.sort?.type ? { field: s.sort.field, order: s.sort.type } : {}) });
        const isGet = c.method.toUpperCase() === "GET";
        const res = await fetch(isGet ? `${c.url}${c.url.includes("?") ? "&" : "?"}${q}` : c.url, {
          method: c.method, signal: ac.signal, headers: { Accept: "application/json", ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }), ...csrfHeaders(c.url, c.method), ...c.headers },
          body: isGet ? undefined : q,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let json = await res.json();
        if (c.parseData) json = c.parseData(json);
        if (json.code != null && Number(json.code) !== 0) throw new Error(json.msg || "데이터를 불러오지 못했습니다.");
        s.rows = json.data || [];
        s.count = Number(json.count ?? s.rows.length);
        s.checked.clear();
        // 지우기 등으로 전체 건수가 줄어 현재 쪽이 사라졌으면 마지막 쪽을 다시 요청
        const last = Math.max(1, Math.ceil(s.count / s.limit));
        if (c.page && !s.rows.length && s.count > 0 && s.curr > last) { s.curr = last; queueMicrotask(load); }
      } catch (err) {
        if (err.name === "AbortError") return;
        s.error = `데이터를 불러오지 못했습니다. ${err.message}`;
      } finally {
        if (s.req === ac) { s.req = null; s.loading = false; draw(); inst.emit("done", { data: s.rows, count: s.count }); }
      }
    };

    const onClick = (e) => {
      const sortBtn = e.target.closest("[data-catui-sort]");
      if (sortBtn) {
        const field = sortBtn.dataset.catuiSort;
        const next = s.sort?.field !== field ? "asc" : s.sort.type === "asc" ? "desc" : s.sort.type === "desc" ? null : "asc";
        s.sort = { field, type: next };
        s.curr = 1;
        if (inst.emit("sort", { field, type: next }) !== false) (c.url ? load() : draw());
        body.querySelector(`[data-catui-sort="${CSS.escape(field)}"]`)?.focus();
        return;
      }
      const tr = e.target.closest("tr[data-catui-index]");
      if (!tr) return;
      const index = Number(tr.dataset.catuiIndex), row = inst.rows[index];
      const evBtn = e.target.closest("[data-catui-event]");
      if (evBtn) {
        inst.emit("tool", {
          event: evBtn.dataset.catuiEvent, data: row, index, tr, elem: evBtn,
          del() { if (c.data) { c.data.splice(c.data.indexOf(row), 1); s.checked.delete(row); } else s.rows.splice(index, 1); s.count -= c.url ? 1 : 0; draw(); },
          update(fields) { Object.assign(row, fields); draw(); },
        });
        return;
      }
      if (!e.target.closest("label, button, a, input")) inst.emit("row", { data: row, index, tr });
    };
    const onChange = (e) => {
      const cb = e.target.closest("[data-catui-check]");
      if (!cb) return;
      const rows = inst.rows;
      if (cb.dataset.catuiCheck === "all") {
        rows.forEach((r) => (cb.checked ? s.checked.add(r) : s.checked.delete(r)));
        inst.emit("checkbox", { checked: cb.checked, type: "all", data: rows });
      } else {
        const row = rows[Number(cb.dataset.catuiCheck)];
        cb.checked ? s.checked.add(row) : s.checked.delete(row);
        inst.emit("checkbox", { checked: cb.checked, type: "one", data: row });
      }
      draw();
      body.querySelector(`[data-catui-check="${cb.dataset.catuiCheck}"]`)?.focus();
    };
    inst.redraw = draw;
    inst.cellValue = cellValue;
    inst.cols = cols;
    // 내보내기용 전체 행: 로컬은 정렬만 적용한 전체, 원격은 지금 받은 쪽
    inst.allRows = () => (c.url ? s.rows : sorted());
    body.addEventListener("click", onClick);
    body.addEventListener("change", onChange);
    inst.use(() => { body.removeEventListener("click", onClick); body.removeEventListener("change", onChange); s.req?.abort(); });
    load();
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },

  // 선택 상태: { data: [...], isAll }
  checkStatus(id) {
    const inst = table.getThis(id);
    if (!inst) return { data: [], isAll: false };
    const data = [...inst.state.checked];
    return { data, isAll: inst.rows.length > 0 && inst.rows.every((r) => inst.state.checked.has(r)) };
  },
  getData(id) { return table.getThis(id)?.rows || []; },
  clearChecked(id) {
    const inst = table.getThis(id);
    if (!inst) return;
    inst.state.checked.clear();
    inst.redraw?.();
  },

  // CSV 내보내기: table.exportFile('orders', '주문.csv', { checked: true })
  //   checked: 선택한 행만 / rows: 직접 넘긴 행. 체크·동작 열은 빼고, templet의 마크업은 글자만 남긴다.
  //   엑셀 한글 깨짐 방지 BOM, =·+·-·@로 시작하는 글자는 수식으로 실행되지 않게 앞에 '를 붙인다(CSV 인젝션 방지).
  exportFile(id, filename = "table.csv", opts = {}) {
    const inst = table.getThis(id);
    if (!inst) return false;
    const cols = inst.cols.filter((col) => col.type !== "checkbox" && !col.toolbar);
    const rows = opts.rows || (opts.checked ? [...inst.state.checked] : inst.allRows());
    const text = (v) => {
      // template은 내용이 실행·로드되지 않는(inert) 문서 조각이라 마크업에서 글자만 안전하게 뽑을 수 있다
      const t = document.createElement("template");
      t.innerHTML = isRaw(v) ? v.__raw : String(v ?? "");   // escape된 글자도 원래 글자로 되돌림
      return t.content.textContent.replace(/\s+/g, " ").trim();
    };
    const cell = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map((col) => cell(col.type === "numbers" ? col.title || "순번" : col.title ?? col.field ?? "")).join(",")];
    rows.forEach((row, i) => lines.push(cols.map((col) => cell(col.type === "numbers" ? i + 1 : text(inst.cellValue(col, row, i)))).join(",")));
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  },

  // 정적 표 향상: <table data-catui-table data-catui-filter="x"> 안의 <th data-catui-sort="number|text">
  enhance(scope = document) {
    scope.querySelectorAll("table[data-catui-table]:not([data-catui-ready])").forEach((t) => {
      t.setAttribute("data-catui-ready", "");
      t.querySelectorAll("th[data-catui-sort]").forEach((th) => {
        if (th.querySelector("button")) return;
        th.setAttribute("aria-sort", "none");
        const label = th.textContent.trim();
        th.textContent = "";
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText = "font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit";
        th.appendChild(b);
      });
    });
  },
  bindStatic() {
    const onClick = (e) => {
      const b = e.target.closest?.("table[data-catui-table] th[data-catui-sort] > button");
      if (!b) return;
      const th = b.parentElement, t = th.closest("table"), tbody = t.tBodies[0];
      const col = [...th.parentElement.children].indexOf(th);
      const type = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      t.querySelectorAll("th[data-catui-sort]").forEach((x) => { x.setAttribute("aria-sort", "none"); x.classList.remove("Catui_sort"); x.querySelector(".Catui_icon")?.remove(); });
      th.setAttribute("aria-sort", type);
      th.classList.add("Catui_sort");
      b.insertAdjacentHTML("beforeend", icon(type === "ascending" ? "chevron-up" : "chevron-down", 12).__raw);
      const num = th.getAttribute("data-catui-sort") === "number";
      const key = (tr) => { const v = tr.children[col]?.textContent.trim() ?? ""; return num ? Number(v.replace(/[^\d.-]/g, "")) : v; };
      const rows = [...tbody.rows].sort((a, b2) => { const x = key(a), y = key(b2); return (num ? x - y : String(x).localeCompare(String(y), "ko")) * (type === "ascending" ? 1 : -1); });
      rows.forEach((r) => tbody.appendChild(r));
      emit("table", "sort", t.getAttribute("data-catui-filter"), { field: th.textContent.trim(), type: type === "ascending" ? "asc" : "desc", elem: t });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  },
});

// ── modules/tabs.js ──

// tabs — 탭. CSS만으로도 동작하는 radio 구조(.Catui_tabs)를 그대로 쓰고, JS는 이벤트·추가·삭제·전환을 더한다.
//   마크업: <div class="Catui_tabs" data-catui-filter="doc"> <input type=radio> <label class="Catui_tab"> <div class="Catui_panel"> ...
//   tabs.on('tab(doc)', ({ index, title }) => {})
//   tabs.render({ elem: '#box', data: [{ title: '개요', content: '...' }], index: 0 })
//   tabs.change('doc', 1) / tabs.add('doc', { title, content, change: true }) / tabs.close('doc', 0)
const tabs = component({
  name: "tabs",
  config: { data: [], index: 0, label: "" },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    const name = uid("catui-tabs");
    mount(inst.elem, html`<div class="Catui_tabs" data-catui-filter="${inst.filter}" ${c.label ? html`role="group" aria-label="${c.label}"` : ""}></div>`);
    const box = inst.elem.firstElementChild;
    box.dataset.catuiName = name;
    c.data.forEach((item) => catuiTabsAppend(box, item));
    catuiTabsSelect(box, c.index, false);
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },

  change(filter, index) { const box = catuiTabsFind(filter); if (box) catuiTabsSelect(box, index, true); },
  add(filter, item = {}) {
    const box = catuiTabsFind(filter);
    if (!box) return -1;
    catuiTabsAppend(box, item);
    const i = box.querySelectorAll(":scope > input[type=radio]").length - 1;
    if (item.change !== false) catuiTabsSelect(box, i, true);
    return i;
  },
  close(filter, index) {
    const box = catuiTabsFind(filter);
    if (!box) return;
    const inputs = [...box.querySelectorAll(":scope > input[type=radio]")];
    const input = inputs[index];
    if (!input) return;
    const wasOn = input.checked;
    const label = box.querySelector(`:scope > label[for="${CSS.escape(input.id)}"]`);
    const panel = label?.nextElementSibling?.classList.contains("Catui_panel") ? label.nextElementSibling : null;
    [input, label, panel].forEach((n) => n?.remove());
    emit("tabs", "close", box.getAttribute("data-catui-filter"), { index, elem: box });
    if (wasOn && inputs.length > 1) catuiTabsSelect(box, Math.max(0, index - 1), true);
  },
  // 전역 위임: radio가 바뀌면 tab(filter) 이벤트
  bind() {
    const onChange = (e) => {
      const r = e.target;
      if (!(r instanceof HTMLInputElement) || r.type !== "radio" || !r.parentElement?.classList.contains("Catui_tabs")) return;
      const box = r.parentElement;
      const inputs = [...box.querySelectorAll(":scope > input[type=radio]")];
      const index = inputs.indexOf(r);
      emit("tabs", "tab", box.getAttribute("data-catui-filter"), { index, title: box.querySelector(`:scope > label[for="${CSS.escape(r.id)}"]`)?.textContent.trim() ?? "", elem: box });
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  },
});

function catuiTabsFind(filter) {
  const box = document.querySelector(`.Catui_tabs[data-catui-filter="${CSS.escape(filter)}"]`) || document.getElementById(filter)?.querySelector(".Catui_tabs");
  if (!box) hint.error(`tabs: data-catui-filter="${filter}" 탭이 없습니다`);
  return box;
}

function catuiTabsAppend(box, item) {
  const name = box.dataset.catuiName || box.querySelector(":scope > input[type=radio]")?.name || (box.dataset.catuiName = uid("catui-tabs"));
  const id = item.id || uid(`${name}-t`);
  const input = Object.assign(document.createElement("input"), { className: "Catui_clip", type: "radio", name, id });
  const label = Object.assign(document.createElement("label"), { className: "Catui_tab", htmlFor: id, textContent: item.title ?? "" });
  const panel = Object.assign(document.createElement("div"), { className: "Catui_panel" });
  if (item.content instanceof Element) panel.appendChild(item.content);
  else if (isRaw(item.content)) mount(panel, item.content);
  else panel.appendChild(Object.assign(document.createElement("p"), { textContent: String(item.content ?? "") }));
  box.append(input, label, panel);
}

function catuiTabsSelect(box, index, fire) {
  const r = box.querySelectorAll(":scope > input[type=radio]")[index];
  if (!r) return;
  r.checked = true;
  if (fire) r.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── modules/dropdown.js ──

// dropdown — 버튼에 붙는 메뉴. 키보드(↑↓·Home·End·Esc·Tab), 바깥 클릭 닫기, 화면 끝에서 위로 뒤집기.
//   dropdown.render({ elem: '#more', data: [{ id: 'edit', title: '수정', icon: 'pen-line' }, { type: '-' },
//                    { id: 'del', title: '삭제', danger: true }], click(item, trigger) {} })
//   dropdown.on('click(more)', ({ data }) => {})
// 또, 마크업의 <details class="Catui_dd"> 메뉴도 자동으로 하나만 열기·바깥 클릭·Esc 닫기가 붙는다(bindDetails).
const dropdown = component({
  name: "dropdown",
  // trigger: 'click'(기본) | 'contextmenu'(대상 영역 우클릭·Shift+F10·메뉴 키 위치에 열기)
  // 항목: { id, title, icon, danger, disabled, href, target } — href가 있으면 링크로 이동
  config: { data: [], align: "left", width: "md", label: "", trigger: "click", click: null },
  render(inst) {
    const c = inst.config;
    const trigger = inst.elem;
    if (!trigger) return;
    const menuId = uid("catui-dd");
    const ctx = c.trigger === "contextmenu";
    if (!ctx) {
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", menuId);
    }
    let panel = null, offs = [], point = null, back = null;

    const items = () => [...panel.querySelectorAll("[role=menuitem]:not([disabled]):not([aria-disabled=true])")];
    const place = () => {
      // 우클릭 메뉴는 누른 지점 기준 (0 크기 사각형)
      const r = point ? { left: point.x, right: point.x, top: point.y, bottom: point.y, width: 0 } : trigger.getBoundingClientRect();
      // 너비 옵션이 없으면 메뉴를 여는 버튼과 같은 너비로 (내용이 더 길면 그만큼 넓어짐)
      if (!c.width && !point) panel.style.minWidth = `${Math.round(r.width)}px`;
      const p = panel.getBoundingClientRect();
      const below = innerHeight - r.bottom, up = below < p.height + 8 && r.top > p.height + 8;
      panel.style.top = `${Math.round(up ? r.top - p.height - 4 : r.bottom + 4)}px`;
      const left = c.align === "right" ? r.right - p.width : r.left;
      panel.style.left = `${Math.round(Math.min(Math.max(8, left), innerWidth - p.width - 8))}px`;
    };
    const close = (focusTrigger) => {
      if (!panel) return;
      offs.forEach((f) => f()); offs = [];
      panel.remove(); panel = null;
      if (!ctx) trigger.setAttribute("aria-expanded", "false");
      if (focusTrigger) (ctx && back?.isConnected ? back : trigger).focus?.();
      point = null;
    };
    const open = (at) => {
      if (panel) return;
      point = at || null;
      back = document.activeElement;
      panel = document.createElement("div");
      panel.id = menuId;
      panel.className = `Catui_dd-menu Catui_dd-float${c.width === "sm" ? " Catui_dd-sm" : c.width === "lg" ? " Catui_dd-lg" : ""}`;
      panel.setAttribute("role", "menu");
      panel.setAttribute("aria-label", c.label || trigger.getAttribute("aria-label") || trigger.textContent.trim() || "메뉴");
      mount(panel, html`${c.data.map((d, i) => (d.type === "-"
        ? html`<div class="Catui_dd-sep" role="separator"></div>`
        : d.type === "group"
          ? html`<p class="Catui_dd-group" role="presentation">${d.title}</p>`
          : d.href && !d.disabled && catuiSafeHref(d.href)
            ? html`<a class="Catui_dd-item${d.danger ? " Catui_dd-danger" : ""}" role="menuitem" tabindex="-1" data-catui-i="${i}" href="${catuiSafeHref(d.href)}" ${d.target ? html`target="${d.target}" rel="noopener noreferrer"` : ""}>${d.icon ? icon(d.icon, 16) : ""}${d.title}</a>`
            : html`<button class="Catui_dd-item${d.danger ? " Catui_dd-danger" : ""}" type="button" role="menuitem" tabindex="-1" data-catui-i="${i}" ${d.disabled ? "disabled" : ""}>${d.icon ? icon(d.icon, 16) : ""}${d.title}</button>`))}`);
      layerRoot().appendChild(panel);
      if (!ctx) trigger.setAttribute("aria-expanded", "true");
      place();
      items()[0]?.focus();
      const onDoc = (e) => { if (!panel.contains(e.target) && (ctx || !trigger.contains(e.target))) close(false); };
      let typed = "", typedAt = 0;
      const onKey = (e) => {
        const list = items(), i = list.indexOf(document.activeElement);
        // 글자 검색: 글자를 치면 그 글자로 시작하는 다음 항목으로 (0.5초 안에 이어 치면 이어서 검색)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " " && !imeBusy(e)) {
          const now = Date.now();
          typed = now - typedAt < 500 ? typed + e.key.toLowerCase() : e.key.toLowerCase();
          typedAt = now;
          const order = [...list.slice(i + 1), ...list.slice(0, i + 1)];
          (order.find((x) => x.textContent.trim().toLowerCase().startsWith(typed)) || (typed.length > 1 && list[i]))?.focus();
          return;
        }
        if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
        else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
        else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
        else if (e.key === "Escape" && !imeBusy(e)) { e.preventDefault(); close(true); }
        else if (e.key === "Tab") close(false);
      };
      const onPick = (e) => {
        const b = e.target.closest("[data-catui-i]");
        if (!b) return;
        const item = c.data[Number(b.dataset.catuiI)];
        const keep = c.click?.call(inst, item, trigger) === false;
        if (keep && b.tagName === "A") e.preventDefault();      // false = 링크 이동도 하지 않음
        inst.emit("click", { data: item, elem: trigger });
        if (!keep) close(b.tagName !== "A");                     // 링크는 이동하므로 포커스를 되돌리지 않음
      };
      const onMove = () => place();
      document.addEventListener("pointerdown", onDoc, true);
      panel.addEventListener("keydown", onKey);
      panel.addEventListener("click", onPick);
      addEventListener("resize", onMove);
      addEventListener("scroll", onMove, true);
      offs = [
        () => document.removeEventListener("pointerdown", onDoc, true),
        () => removeEventListener("resize", onMove),
        () => removeEventListener("scroll", onMove, true),
      ];
    };
    const onTrigger = () => (panel ? close(true) : open());
    const onTriggerKey = (e) => {
      if (ctx) {
        // 키보드 우클릭: Shift+F10 또는 메뉴 키 → 포커스된 요소 위치에 연다
        if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") {
          e.preventDefault();
          const r = (document.activeElement && trigger.contains(document.activeElement) ? document.activeElement : trigger).getBoundingClientRect();
          close(false); open({ x: r.left + 8, y: r.top + Math.min(r.height, 24) });
        }
        return;
      }
      if (e.key === "ArrowDown" && !panel) { e.preventDefault(); open(); }
    };
    const onContext = (e) => {
      if (e.shiftKey && e.button === 2) return;              // Shift+우클릭은 브라우저 기본 메뉴를 남겨 둔다
      e.preventDefault();
      if (e.button === -1 || (e.clientX === 0 && e.clientY === 0)) return;   // 키보드 contextmenu는 keydown에서 이미 열었음
      close(false);
      open({ x: e.clientX, y: e.clientY });
    };
    if (ctx) trigger.addEventListener("contextmenu", onContext); else trigger.addEventListener("click", onTrigger);
    trigger.addEventListener("keydown", onTriggerKey);
    inst.open = (at) => open(at);
    inst.close = () => close(false);
    inst.use(() => {
      close(false);
      trigger.removeEventListener("click", onTrigger);
      trigger.removeEventListener("contextmenu", onContext);
      trigger.removeEventListener("keydown", onTriggerKey);
      ["aria-haspopup", "aria-expanded", "aria-controls"].forEach((a) => trigger.removeAttribute(a));
    });
  },
  close(id) { dropdown.getThis(id)?.close(); },

  // <details class="Catui_dd|Catui_mega"> 향상: 하나만 열기, 바깥 클릭·Esc 닫기, 항목 선택 시 닫기
  bindDetails() {
    const menus = () => document.querySelectorAll("details.Catui_dd[open], details.Catui_mega[open]");
    const onToggle = (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.open || !d.matches(".Catui_dd, .Catui_mega")) return;
      menus().forEach((m) => { if (m !== d && !m.contains(d)) m.open = false; });
    };
    const onClick = (e) => {
      menus().forEach((m) => { if (!m.contains(e.target)) m.open = false; });
      const item = e.target.closest?.(".Catui_dd-item, .Catui_mega-item");
      const m = item?.closest("details.Catui_dd, details.Catui_mega");
      if (m && !item.disabled) m.open = false;
    };
    const onKey = (e) => {
      if (e.key !== "Escape" || imeBusy(e)) return;
      const m = e.target.closest?.("details.Catui_dd[open], details.Catui_mega[open]");
      if (!m) return;
      e.preventDefault();          // 모달 안 메뉴: Esc는 메뉴만 닫는다(바깥 패널은 defaultPrevented로 건너뜀)
      m.open = false;
      m.querySelector("summary")?.focus();
    };
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  },
});

// 메뉴 링크는 같은 사이트 상대 경로·http·https·mailto·tel만 (javascript: 차단)
function catuiSafeHref(u) {
  try { const url = new URL(String(u), location.href); return /^(https?|mailto|tel):$/.test(url.protocol) ? String(u) : null; } catch { return null; }
}

// ── modules/util.js ──

// util — 자주 쓰는 도구.
const util = (() => {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const toDate = (t) => (t instanceof Date ? t : new Date(typeof t === "string" && /^\d+$/.test(t) ? Number(t) : t));
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  // util.toDateString(Date.now(), 'yyyy-MM-dd HH:mm:ss')
  // 토큰: yyyy yy · MM M · dd d · HH H · hh h(12시간) · mm m · ss s · a(오전/오후) · E(요일 한 글자). 따옴표 안 글자는 그대로: "yyyy'년'"
  function toDateString(time = Date.now(), format = "yyyy-MM-dd HH:mm:ss") {
    const d = toDate(time);
    if (Number.isNaN(d.getTime())) return "";
    const h = d.getHours(), h12 = h % 12 || 12;
    const map = {
      yyyy: d.getFullYear(), yy: pad(d.getFullYear() % 100), MM: pad(d.getMonth() + 1), M: d.getMonth() + 1, dd: pad(d.getDate()), d: d.getDate(),
      HH: pad(h), H: h, hh: pad(h12), h: h12, mm: pad(d.getMinutes()), m: d.getMinutes(), ss: pad(d.getSeconds()), s: d.getSeconds(),
      a: h < 12 ? "오전" : "오후", E: DOW[d.getDay()],
    };
    return format.replace(/'([^']*)'|yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|a|E/g, (k, lit) => (lit != null ? lit : map[k]));
  }

  // util.timeAgo(시각) → '방금' · '5분 전' · '3시간 전' · '2일 전' · 30일 넘으면 날짜
  function timeAgo(time, onlyDate = false) {
    const d = toDate(time), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 0) return toDateString(d, onlyDate ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm");
    if (diff < 60) return "방금";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
    return toDateString(d, onlyDate ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm");
  }

  // util.countdown({ date: 목표시각, ready(t){ t.d, t.h, t.m, t.s }, clear(){} }) → { clear() }
  function countdown({ date, now = Date.now(), ready, clear } = {}) {
    const end = toDate(date).getTime(), offset = Date.now() - toDate(now).getTime();
    // 잘못된 날짜면 남은 시간이 NaN이라 끝나지 않는 타이머가 된다 → 시작하지 않음
    if (!Number.isFinite(end) || !Number.isFinite(offset)) { hint.error(`util.countdown: 날짜를 해석할 수 없습니다 (${date})`); return { clear() {} }; }
    let timer = 0;
    const tick = () => {
      const left = Math.max(0, end - (Date.now() - offset));
      const t = { d: Math.floor(left / 86400000), h: Math.floor(left / 3600000) % 24, m: Math.floor(left / 60000) % 60, s: Math.floor(left / 1000) % 60, left };
      ready?.(t);
      if (left <= 0) { clearInterval(timer); timer = 0; clear?.(); }
    };
    timer = setInterval(tick, 1000);
    tick();
    return { clear() { clearInterval(timer); timer = 0; } };
  }

  function debounce(fn, wait = 200) {
    let t = 0;
    const d = function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  function throttle(fn, wait = 200) {
    let last = 0, t = 0;
    const th = function (...args) {
      const now = Date.now(), rest = wait - (now - last);
      if (rest <= 0) { last = now; fn.apply(this, args); }
      else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, rest); }
    };
    th.cancel = () => clearTimeout(t);
    return th;
  }

  // 클립보드 복사. http 같은 비보안 환경에서는 Clipboard API가 없으므로 숨긴 textarea로 대신한다
  async function copy(text) {
    const s = String(text ?? "");
    try { await navigator.clipboard.writeText(s); return true; } catch { /* 대체 경로 */ }
    const ta = Object.assign(document.createElement("textarea"), { value: s, readOnly: true });
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    const back = document.activeElement;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    back?.focus?.({ preventScroll: true });
    return ok;
  }

  // util.number(1234567.8, 1) → '1,234,567.8' (한국어 천 단위 구분)
  function number(n, decimals) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v.toLocaleString("ko-KR", decimals == null ? undefined : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  // util.fileSize(1536) → '1.5KB' · 'B·KB·MB·GB·TB'
  function fileSize(bytes, decimals = 1) {
    const v = Number(bytes);
    if (!Number.isFinite(v) || v < 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = v === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(v) / Math.log(1024)));
    return `${Number((v / 1024 ** i).toFixed(i ? decimals : 0))}${units[i]}`;
  }

  return { toDateString, timeAgo, countdown, debounce, throttle, copy, number, fileSize, escape, html, raw };
})();

// ── modules/datePicker.js ──

// datePicker — 날짜·기간 선택 (layui laydate에 해당).
//   datePicker.render({ elem: '#d', min: '2026-01-01', max: '2026-12-31', done(value, date) {} })
//   datePicker.render({ elem: '#r', range: true })        // 값: 'YYYY-MM-DD ~ YYYY-MM-DD'
//   마크업: <input class="Catui_input" data-catui-date> / data-catui-date="range" data-catui-min data-catui-max
// 키보드: ↑↓←→ 하루·한 주, PageUp/PageDown 한 달, Home/End 주의 처음·끝, Enter 선택, Esc 닫기.
const datePicker = component({
  name: "datePicker",
  ownDone: true,   // done(value, date)은 날짜 선택 콜백 — 렌더 완료로 부르지 않음
  // shortcuts: true(기간이면 최근 7일·30일·이번 달·지난 달) | [{ text, value: () => Date | [Date, Date] }]
  config: { range: false, min: "", max: "", value: "", separator: " ~ ", disabled: null, weekStart: 1, shortcuts: false, done: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!input) return;
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parse = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
      if (!m) return null;
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return d.getMonth() === Number(m[2]) - 1 ? d : null;   // 2월 30일 같은 값 거부
    };
    const same = (a, b) => !!a && !!b && fmt(a) === fmt(b);
    const asDate = (v) => (v instanceof Date ? (Number.isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate())) : parse(v));
    const minD = asDate(c.min), maxD = asDate(c.max);
    // 달 이동: 3월 31일 → 2월이면 2월 말일로 (setMonth는 3월 3일로 넘어간다)
    const addMonths = (d, n) => { const y = d.getFullYear(), m = d.getMonth() + n; return new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate())); };
    const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
    const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const shortcutList = () => {
      if (Array.isArray(c.shortcuts)) return c.shortcuts;
      if (!c.shortcuts || !c.range) return [];
      const t = today0();
      return [
        { text: "최근 7일", value: () => [addDays(t, -6), t] },
        { text: "최근 30일", value: () => [addDays(t, -29), t] },
        { text: "이번 달", value: () => [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)] },
        { text: "지난 달", value: () => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
      ];
    };
    const blocked = (d) => (minD && d < minD) || (maxD && d > maxD) || !!c.disabled?.(d);

    const panelId = uid("catui-dp");
    let panel = null, offs = [], view = null, focusD = null, from = null, to = null;
    if (c.value) input.value = c.value;
    const readValue = () => {
      const [a, b] = c.range ? input.value.split(c.separator) : [input.value];
      from = parse(a); to = c.range ? parse(b) : null;
    };
    input.setAttribute("aria-haspopup", "dialog");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", panelId);
    if (!input.placeholder) input.placeholder = c.range ? `YYYY-MM-DD${c.separator}YYYY-MM-DD` : "YYYY-MM-DD";
    input.autocomplete = "off";

    const draw = () => {
      const y = view.getFullYear(), m = view.getMonth();
      const lead = (new Date(y, m, 1).getDay() - c.weekStart + 7) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      const today = new Date();
      const dows = ["일", "월", "화", "수", "목", "금", "토"];
      const order = [...dows.slice(c.weekStart), ...dows.slice(0, c.weekStart)];
      const status = c.range ? (from && !to ? "끝 날짜를 고르세요" : from && to ? `${fmt(from)}${c.separator}${fmt(to)}` : "시작 날짜를 고르세요") : (from ? fmt(from) : "날짜를 고르세요");
      mount(panel, html`
<div class="Catui_dp">
  <div class="Catui_dp-head">
    <span style="display:flex;gap:2px"><button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-nav="-12" aria-label="이전 해">${icon("chevrons-left", 16)}</button><button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-nav="-1" aria-label="이전 달">${icon("chevron-right", 16, "Catui_pg-prev")}</button></span>
    <span aria-live="polite">${y}년 ${m + 1}월</span>
    <span style="display:flex;gap:2px"><button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-nav="1" aria-label="다음 달">${icon("chevron-right", 16)}</button><button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-nav="12" aria-label="다음 해">${icon("chevrons-right", 16)}</button></span>
  </div>
  <div class="Catui_dp-dows" aria-hidden="true">${order.map((d) => html`<span class="Catui_dp-dow">${d}</span>`)}</div>
  <div class="Catui_dp-grid">${Array.from({ length: lead }, () => html`<span class="Catui_dp-cell Catui_dp-out" aria-hidden="true"></span>`)}${Array.from({ length: days }, (_, i) => {
    const d = new Date(y, m, i + 1);
    const sel = same(d, from) || same(d, to);
    const inRange = c.range && from && to && d > from && d < to;
    const dis = blocked(d);
    const cls = dis ? " Catui_dp-dis" : sel ? " Catui_dp-sel" : inRange ? " Catui_dp-range" : same(d, today) ? " Catui_dp-today" : "";
    return html`<button type="button" class="Catui_dp-cell${cls}" data-catui-date="${fmt(d)}" tabindex="${same(d, focusD) ? 0 : -1}" aria-pressed="${sel || !!inRange}" ${dis ? html`aria-disabled="true"` : ""} aria-label="${y}년 ${m + 1}월 ${i + 1}일 ${dows[d.getDay()]}요일${same(d, today) ? ", 오늘" : ""}${dis ? ", 선택 불가" : ""}">${i + 1}</button>`;
  })}</div>
  <p class="Catui_help" aria-live="polite">${status}</p>
  ${shortcutList().length ? html`<div class="Catui_actions" role="group" aria-label="빠른 선택">${shortcutList().map((sc, i) => html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-catui-short="${i}">${sc.text}</button>`)}</div>` : ""}
  <div class="Catui_actions"><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-act="today">오늘</button><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-act="clear">지우기</button></div>
</div>`);
    };
    const focusDay = () => panel?.querySelector(`[data-catui-date="${fmt(focusD)}"]`)?.focus();
    const moveTo = (d) => {
      focusD = d;
      if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) view = new Date(d.getFullYear(), d.getMonth(), 1);
      draw(); focusDay();
    };
    const place = () => {
      const r = input.getBoundingClientRect(), p = panel.getBoundingClientRect();
      const up = innerHeight - r.bottom < p.height + 8 && r.top > p.height + 8;
      panel.style.top = `${Math.round(up ? r.top - p.height - 4 : r.bottom + 4)}px`;
      panel.style.left = `${Math.round(Math.min(Math.max(8, r.left), innerWidth - p.width - 8))}px`;
    };
    const close = (focusInput) => {
      if (!panel) return;
      offs.forEach((f) => f()); offs = [];
      panel.remove(); panel = null;
      input.setAttribute("aria-expanded", "false");
      if (focusInput) input.focus();
    };
    const commit = () => {
      const value = c.range ? (from && to ? `${fmt(from)}${c.separator}${fmt(to)}` : "") : (from ? fmt(from) : "");
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const date = c.range ? [from, to] : from;
      c.done?.call(inst, value, date);
      inst.emit("done", { value, date, elem: input });
    };
    const pick = (d) => {
      if (blocked(d)) return;
      if (!c.range) { from = d; commit(); close(true); return; }
      if (!from || to || d < from) { from = d; to = null; focusD = d; draw(); focusDay(); return; }
      to = d; commit(); close(true);
    };
    const open = () => {
      if (panel) return;
      readValue();
      focusD = from || (minD && minD > new Date() ? minD : new Date());
      view = new Date(focusD.getFullYear(), focusD.getMonth(), 1);
      panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "Catui_dd-menu Catui_dd-float";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", c.range ? "기간 선택" : "날짜 선택");
      layerRoot().appendChild(panel);
      input.setAttribute("aria-expanded", "true");
      draw(); place();
      const onDoc = (e) => { if (!panel.contains(e.target) && e.target !== input) close(false); };
      const onKey = (e) => {
        const t = e.target.closest?.("[data-catui-date]");
        if (e.key === "Escape") { if (!imeBusy(e)) { e.preventDefault(); close(true); } return; }
        if (!t) return;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (step) { e.preventDefault(); const d = new Date(focusD); d.setDate(d.getDate() + step); moveTo(d); return; }
        // PageUp/Down 한 달, Shift와 함께면 한 해
        if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); moveTo(addMonths(focusD, (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1))); return; }
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); const d = new Date(focusD); const dow = (d.getDay() - c.weekStart + 7) % 7; d.setDate(d.getDate() + (e.key === "Home" ? -dow : 6 - dow)); moveTo(d); }
      };
      const onClick = (e) => {
        const nav = e.target.closest("[data-catui-nav]");
        if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.catuiNav), 1); focusD = new Date(view); draw(); return; }
        const sc = e.target.closest("[data-catui-short]");
        if (sc) {
          const v = shortcutList()[Number(sc.dataset.catuiShort)]?.value?.();
          const [a, b] = [].concat(v).map(asDate);
          if (!a || blocked(a) || (c.range && (!b || blocked(b) || b < a))) return;   // 허용 범위를 벗어나면 고르지 않음
          from = a; to = c.range ? b : null; commit(); close(true);
          return;
        }
        const act = e.target.closest("[data-catui-act]");
        if (act?.dataset.catuiAct === "today") { const t = today0(); moveTo(t); if (!blocked(t)) pick(t); return; }
        if (act?.dataset.catuiAct === "clear") { from = to = null; commit(); close(true); return; }
        const day = e.target.closest("[data-catui-date]");
        if (day) { focusD = parse(day.dataset.catuiDate); pick(focusD); }
      };
      const onMove = () => place();
      // Tab 등으로 포커스가 입력칸·패널 밖으로 나가면 닫는다 (마우스 바깥 클릭만 처리하면 키보드 사용자는 패널이 남음)
      const onFocusOut = (e) => { const to2 = e.relatedTarget; if (to2 && to2 !== input && !panel?.contains(to2)) close(false); };
      document.addEventListener("pointerdown", onDoc, true);
      panel.addEventListener("keydown", onKey);
      panel.addEventListener("click", onClick);
      panel.addEventListener("focusout", onFocusOut);
      input.addEventListener("focusout", onFocusOut);
      addEventListener("resize", onMove);
      addEventListener("scroll", onMove, true);
      offs = [() => document.removeEventListener("pointerdown", onDoc, true), () => input.removeEventListener("focusout", onFocusOut), () => removeEventListener("resize", onMove), () => removeEventListener("scroll", onMove, true)];
    };
    // 입력 칸: 클릭·↓키로 열고, 직접 친 값은 형식·범위를 확인
    const onInputClick = () => (panel ? close(false) : open());
    const onInputKey = (e) => {
      if (e.key === "ArrowDown" || (e.key === "Enter" && !panel)) { e.preventDefault(); open(); focusDay(); }
      else if (e.key === "Escape" && panel && !imeBusy(e)) { e.preventDefault(); close(true); }
    };
    const onInputChange = (e) => {
      if (!e.isTrusted) return;               // commit()이 보낸 이벤트는 건너뜀
      readValue();
      const ok = !input.value || (from && !blocked(from) && (!c.range || (to && !blocked(to) && to >= from)));
      input.setAttribute("aria-invalid", String(!ok));
    };
    input.addEventListener("click", onInputClick);
    input.addEventListener("keydown", onInputKey);
    input.addEventListener("change", onInputChange);
    inst.open = open;
    inst.close = () => close(false);
    inst.use(() => {
      close(false);
      input.removeEventListener("click", onInputClick);
      input.removeEventListener("keydown", onInputKey);
      input.removeEventListener("change", onInputChange);
    });
  },
  // 선언형: <input data-catui-date> 자동 렌더
  enhance(scope = document) {
    scope.querySelectorAll("input[data-catui-date]:not([data-catui-ready])").forEach((el) => {
      el.setAttribute("data-catui-ready", "");
      datePicker.render({ elem: el, auto: true, range: el.getAttribute("data-catui-date") === "range", min: el.getAttribute("data-catui-min") || "", max: el.getAttribute("data-catui-max") || "" });
    });
  },
  // 자동 렌더한 칸을 destroy하면 표식을 지워 다음 catui.init에서 다시 붙게 한다 (reload에서는 호출되지 않음)
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── modules/upload.js ──

// upload — 파일 올리기. 끌어 놓기·선택, 형식·용량·개수 검사(오류는 문장으로), 진행률, 목록, 취소.
//   upload.render({ elem: '#zone', url: '/api/upload', accept: '.pdf,image/*', size: 10240, number: 5,
//                   list: '#files', done(res, file) {}, error(msg, file) {} })
//   url을 빼면 서버로 보내지 않고 고른 파일만 관리한다(choose 이벤트로 받아 직접 처리).
//   이벤트: upload.on('choose(f)'), 'progress(f)', 'done(f)', 'error(f)', 'remove(f)'
const upload = component({
  name: "upload",
  ownDone: true,   // done(res, file)은 업로드 완료 콜백 — 렌더 완료로 부르지 않음
  config: {
    url: "", method: "POST", field: "file", data: {}, headers: {}, accept: "", size: 0, number: 0,
    multiple: true, auto: true, list: null, withCredentials: false, disabled: false,
    guard: true,   // 영역 밖에 파일을 잘못 놓았을 때 브라우저가 그 파일을 열며 페이지를 떠나는 것을 막음
  },
  render(inst) {
    const c = inst.config;
    const zone = inst.elem;
    if (!zone) return;
    // 입력 찾기 또는 만들기 (zone이 label.Catui_upz면 안의 input 사용)
    let input = zone.querySelector('input[type="file"]');
    if (!input) {
      input = Object.assign(document.createElement("input"), { type: "file", className: "Catui_clip" });
      zone.appendChild(input);
    }
    if (c.accept) input.accept = c.accept;
    input.multiple = !!c.multiple;
    if (!input.id) input.id = uid("catui-up");
    const listEl = el(c.list);
    const errId = `${input.id}-err`;
    let err = document.getElementById(errId);
    if (!err) {
      err = Object.assign(document.createElement("p"), { className: "Catui_error", id: errId, hidden: true });
      err.setAttribute("role", "alert");
      zone.insertAdjacentElement("afterend", err);
      inst.use(() => err.remove());
    }
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), errId].filter(Boolean).join(" "));

    const items = (inst.files = []);          // { id, file, status: 'ready'|'uploading'|'done'|'error', percent, xhr, res }
    const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(/\.0$/, "")}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);
    const acceptOk = (f) => {
      if (!c.accept) return true;
      return c.accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((a) => (a.startsWith(".")
        ? f.name.toLowerCase().endsWith(a)
        : a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a));
    };
    const statusText = (it) => ({ ready: "대기", uploading: `올리는 중 ${it.percent}%`, done: "완료", error: it.msg || "실패" }[it.status]);
    const drawList = () => {
      if (!listEl) return;
      // 다시 그려도 목록 안 포커스(빼기·다시 버튼)를 같은 파일의 같은 버튼으로 되돌린다
      const act = listEl.contains(document.activeElement) ? document.activeElement : null;
      const keep = act && (act.hasAttribute("data-catui-remove") ? `[data-catui-remove="${act.getAttribute("data-catui-remove")}"]` : act.hasAttribute("data-catui-retry") ? `[data-catui-remove="${act.getAttribute("data-catui-retry")}"]` : null);
      listEl.classList.add("Catui_files");
      mount(listEl, html`${items.map((it) => html`
<div class="Catui_file" data-catui-file="${it.id}">
  <span class="Catui_file-ico${it.status === "error" ? " Catui_file-ico-5" : ""}">${icon(it.status === "error" ? "alert-circle" : "file-text", 16)}</span>
  <span class="Catui_file-main"><span class="Catui_file-name">${it.file.name}</span>
    <span class="Catui_file-meta">${size(it.file.size)} · <span data-catui-st>${statusText(it)}</span>
    ${it.status === "uploading" ? html`<span class="Catui_prog Catui_prog-sm" role="progressbar" aria-label="${it.file.name} 올리는 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${it.percent}"><i class="Catui_pc2" style="width:${it.percent}%"></i></span>` : ""}</span></span>
  <span class="Catui_file-acts">
    ${it.status === "error" && c.url ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-retry="${it.id}">다시</button>` : ""}
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-remove="${it.id}" aria-label="${it.file.name} ${it.status === "uploading" ? "올리기 취소" : "빼기"}">${icon("x", 16)}</button>
  </span>
</div>`)}`);
      if (act) (keep && listEl.querySelector(keep) || zone).focus?.({ preventScroll: true });
    };
    // 진행률은 그 줄만 고친다(전체를 다시 그리면 스크린리더·포커스가 매번 흔들림)
    const drawProgress = (it) => {
      const row = listEl?.querySelector(`[data-catui-file="${it.id}"]`);
      const bar = row?.querySelector('[role="progressbar"]');
      if (!bar) { drawList(); return; }
      bar.setAttribute("aria-valuenow", String(it.percent));
      bar.firstElementChild.style.width = `${it.percent}%`;
      row.querySelector("[data-catui-st]").textContent = statusText(it);
    };
    const showErr = (msgs) => { err.textContent = msgs.join(" / "); err.hidden = !msgs.length; };

    const send = (it) => {
      if (!c.url) return;
      const fd = new FormData();
      for (const [k, v] of Object.entries(c.data || {})) fd.append(k, typeof v === "function" ? v() : v);
      fd.append(c.field, it.file);
      const xhr = (it.xhr = new XMLHttpRequest());
      xhr.open(c.method, c.url);
      xhr.withCredentials = !!c.withCredentials;
      for (const [k, v] of Object.entries({ ...csrfHeaders(c.url, c.method), ...(c.headers || {}) })) xhr.setRequestHeader(k, v);
      it.status = "uploading"; it.percent = 0; drawList();
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        it.percent = Math.round((e.loaded / e.total) * 100);
        drawProgress(it);
        c.progress?.call(inst, it.percent, it.file);
        inst.emit("progress", { percent: it.percent, file: it.file });
      };
      const fail = (msg) => {
        it.status = "error"; it.msg = msg; it.xhr = null; drawList();
        c.error?.call(inst, msg, it.file);
        inst.emit("error", { msg, file: it.file });
      };
      xhr.onload = () => {
        it.xhr = null;
        if (xhr.status < 200 || xhr.status >= 300) { fail(`HTTP ${xhr.status}`); return; }
        let res = xhr.responseText;
        try { res = JSON.parse(res); } catch { /* 텍스트 응답 */ }
        it.status = "done"; it.res = res; it.percent = 100; drawList();
        c.done?.call(inst, res, it.file);
        inst.emit("done", { res, file: it.file });
      };
      xhr.onerror = () => fail("네트워크 오류");
      xhr.onabort = () => { it.xhr = null; };
      xhr.send(fd);
    };

    const add = (fileList) => {
      if (c.disabled) return;
      const bad = [], ok = [];
      // 한 파일만 받는 영역에 여러 개를 끌어 놓으면 첫 파일만
      const list = c.multiple ? [...fileList] : [...fileList].slice(0, 1);
      for (const f of list) {
        if (!acceptOk(f)) bad.push(`${f.name}: 허용하지 않는 형식입니다`);
        else if (c.size && f.size > c.size * 1024) bad.push(`${f.name}: ${size(f.size)} — ${size(c.size * 1024)}를 넘습니다`);
        else if (c.number && items.length + ok.length >= c.number) bad.push(`${f.name}: 최대 ${c.number}개까지 올릴 수 있습니다`);
        else if (c.before?.call(inst, f) === false) continue;
        else ok.push(f);
      }
      showErr(bad);
      if (bad.length) bad.forEach((m) => inst.emit("error", { msg: m }));
      if (!ok.length) return;
      if (!c.multiple) items.splice(0).forEach((it) => it.xhr?.abort());
      const added = ok.map((file) => ({ id: uid("f"), file, status: "ready", percent: 0, xhr: null }));
      items.push(...added);
      drawList();
      c.choose?.call(inst, ok);
      inst.emit("choose", { files: ok });
      if (c.auto) added.forEach(send);
    };

    const hi = (on) => { zone.style.borderColor = on ? "var(--Catui_upload-border-active)" : ""; zone.style.background = on ? "var(--Catui_upload-bg-hover)" : ""; };
    const onChange = () => { add(input.files); input.value = ""; };
    // 자식 요소를 지날 때마다 dragleave가 와서 깜빡이므로, 들어온 횟수를 세어 완전히 나갔을 때만 해제
    let depth = 0;
    const onEnter = (e) => { e.preventDefault(); if (!c.disabled) { depth += 1; hi(true); } };
    const onOver = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = c.disabled ? "none" : "copy"; };
    const onLeave = () => { depth = Math.max(0, depth - 1); if (!depth) hi(false); };
    const onDrop = (e) => { e.preventDefault(); depth = 0; hi(false); add(e.dataTransfer.files); };
    const onKey = (e) => { if (!c.disabled && zone.tagName !== "LABEL" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.click(); } };
    const onZoneClick = (e) => { if (!c.disabled && zone.tagName !== "LABEL" && e.target !== input) input.click(); };
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    const onWinDrag = (e) => { if (hasFiles(e) && !zone.contains(e.target) && !e.target.closest?.('input[type="file"]')) e.preventDefault(); };
    const setDisabled = (on) => {
      c.disabled = !!on;
      input.disabled = c.disabled;
      zone.setAttribute("aria-disabled", String(c.disabled));
      zone.style.background = c.disabled ? "var(--Catui_input-disabled-bg)" : "";
      zone.style.color = c.disabled ? "var(--Catui_color-text-secondary)" : "";
      zone.style.cursor = c.disabled ? "not-allowed" : "";
    };
    setDisabled(c.disabled);
    const onList = (e) => {
      const rm = e.target.closest("[data-catui-remove]");
      const rt = e.target.closest("[data-catui-retry]");
      const it = items.find((x) => x.id === (rm || rt)?.getAttribute(rm ? "data-catui-remove" : "data-catui-retry"));
      if (!it) return;
      if (rt) { send(it); return; }
      it.xhr?.abort();
      items.splice(items.indexOf(it), 1);
      drawList();
      inst.emit("remove", { file: it.file });
      zone.focus?.();
    };
    if (zone.tagName !== "LABEL" && !zone.hasAttribute("tabindex")) { zone.tabIndex = 0; zone.setAttribute("role", "button"); }
    input.addEventListener("change", onChange);
    zone.addEventListener("dragenter", onEnter);
    zone.addEventListener("dragover", onOver);
    zone.addEventListener("dragleave", onLeave);
    zone.addEventListener("drop", onDrop);
    zone.addEventListener("keydown", onKey);
    zone.addEventListener("click", onZoneClick);
    listEl?.addEventListener("click", onList);
    if (c.guard) { addEventListener("dragover", onWinDrag); addEventListener("drop", onWinDrag); }
    inst.upload = () => items.filter((it) => it.status === "ready" || it.status === "error").forEach(send);
    inst.clear = () => { items.splice(0).forEach((it) => it.xhr?.abort()); drawList(); showErr([]); };
    inst.setDisabled = setDisabled;
    inst.use(() => {
      items.forEach((it) => it.xhr?.abort());
      input.removeEventListener("change", onChange);
      zone.removeEventListener("dragenter", onEnter);
      zone.removeEventListener("dragover", onOver);
      zone.removeEventListener("dragleave", onLeave);
      zone.removeEventListener("drop", onDrop);
      zone.removeEventListener("keydown", onKey);
      zone.removeEventListener("click", onZoneClick);
      listEl?.removeEventListener("click", onList);
      removeEventListener("dragover", onWinDrag);
      removeEventListener("drop", onWinDrag);
      hi(false);
      ["aria-disabled"].forEach((a) => zone.removeAttribute(a));
      zone.style.color = zone.style.cursor = "";
    });
  },
});

// ── modules/slider.js ──

// slider — 슬라이더. 네이티브 <input type=range class=Catui_range>를 만들어 키보드·스크린리더 지원을 그대로 쓴다.
//   slider.render({ elem: '#vol', label: '음량', min: 0, max: 100, step: 10, value: 50, ticks: true,
//                   setTips: (v) => `${v}%`, change(v) {} })
//   마크업의 <input class="Catui_range" data-catui-filter="x">도 slider.on('change(x)')·'input(x)'를 낸다.
const slider = component({
  name: "slider",
  config: { label: "", min: 0, max: 100, step: 1, value: 0, ticks: false, scale: true, tips: true, disabled: false, setTips: null, change: null, input: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    const id = uid("catui-slider");
    const tip = (v) => (c.setTips ? c.setTips(Number(v)) : String(v));
    // step 0·음수·min>max면 눈금 계산이 Infinity·NaN이 되므로 바로잡는다
    const step = Number(c.step) > 0 ? Number(c.step) : 1;
    if (Number(c.max) < Number(c.min)) [c.min, c.max] = [c.max, c.min];
    const clamp = (v) => Math.min(Number(c.max), Math.max(Number(c.min), Number(v) || 0));
    c.value = clamp(c.value);
    const count = Math.min(21, Math.floor((c.max - c.min) / step) + 1);
    mount(inst.elem, html`
<div class="Catui_field">
  <label class="Catui_label" for="${id}">${c.label}${c.tips ? html` <output for="${id}" class="Catui_num" data-catui-tip>${tip(c.value)}</output>` : ""}</label>
  <input class="Catui_range" id="${id}" type="range" min="${c.min}" max="${c.max}" step="${step}" value="${c.value}" aria-valuetext="${tip(c.value)}" ${c.disabled ? "disabled" : ""}>
  ${c.ticks && count > 1 ? html`<div class="Catui_range-ticks" aria-hidden="true">${Array.from({ length: count }, () => html`<i></i>`)}</div>` : ""}
  ${c.scale ? html`<div class="Catui_range-scale" aria-hidden="true"><span>${tip(c.min)}</span><span>${tip(c.max)}</span></div>` : ""}
</div>`);
    const input = inst.elem.querySelector("input");
    const out = inst.elem.querySelector("[data-catui-tip]");
    const sync = () => { const t = tip(input.value); if (out) out.textContent = t; input.setAttribute("aria-valuetext", t); };
    const onInput = () => { sync(); c.input?.call(inst, Number(input.value)); inst.emit("input", { value: Number(input.value) }); };
    const onChange = () => { c.change?.call(inst, Number(input.value)); inst.emit("change", { value: Number(input.value) }); };
    input.addEventListener("input", onInput);
    input.addEventListener("change", onChange);
    inst.input = input;
    inst.setValue = (v) => { input.value = String(clamp(v)); sync(); onChange(); };
    inst.getValue = () => Number(input.value);
    inst.setDisabled = (on) => { c.disabled = !!on; input.disabled = c.disabled; };
    inst.use(() => { input.removeEventListener("input", onInput); input.removeEventListener("change", onChange); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  setValue(id, v) { slider.getThis(id)?.setValue(v); },
  getValue(id) { return slider.getThis(id)?.getValue() ?? null; },
  // 마크업의 range에도 이벤트를 낸다
  bind() {
    const handler = (type) => (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.type !== "range" || !t.matches(".Catui_range[data-catui-filter]")) return;
      emit("slider", type, t.getAttribute("data-catui-filter"), { value: Number(t.value), elem: t });
    };
    const onInput = handler("input"), onChange = handler("change");
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    return () => { document.removeEventListener("input", onInput); document.removeEventListener("change", onChange); };
  },
});

// ── modules/rate.js ──

// rate — 별점. radio 그룹(화살표 키로 선택)을 만들고, 읽기 전용이면 role=img로 점수만 읽힌다.
//   rate.render({ elem: '#score', label: '만족도', length: 5, value: 4, text: true, choose(v) {} })
//   마크업의 <div class="Catui_rating" data-catui-filter="x">도 rate.on('choose(x)')를 낸다.
const rate = component({
  name: "rate",
  config: { label: "", length: 5, value: 0, readonly: false, text: false, texts: ["별로예요", "아쉬워요", "보통이에요", "좋아요", "최고예요"], clearable: false, choose: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    const name = uid("catui-rate");
    const word = (v) => (v ? `${v}점${c.texts[v - 1] ? ` · ${c.texts[v - 1]}` : ""}` : "선택 안 함");
    if (c.readonly) {
      // 3.6점처럼 소수면 별은 반올림(4개), 읽기 값은 소수 첫째 자리까지 그대로
      const v = Math.max(0, Math.min(c.length, Number(c.value) || 0)), shown = Math.round(v);
      inst.value = v;
      inst.getValue = () => v;
      mount(inst.elem, html`<span class="Catui_rating" role="img" aria-label="${c.label ? `${c.label} ` : ""}${c.length}점 중 ${Math.round(v * 10) / 10}점">${Array.from({ length: c.length }, (_, i) => html`<span style="color:var(${i < shown ? "--Catui_rating-on" : "--Catui_rating-off"})">${icon("star", 16)}</span>`)}</span>`);
      return;
    }
    mount(inst.elem, html`
<fieldset style="border:0;padding:0;margin:0">${c.label ? html`<legend class="Catui_label">${c.label}</legend>` : ""}
<div class="Catui_rating">${Array.from({ length: c.length }, (_, i) => html`<input class="Catui_clip" type="radio" name="${name}" id="${name}-${i + 1}" value="${i + 1}" ${i + 1 === c.value ? "checked" : ""}><label for="${name}-${i + 1}" aria-label="${word(i + 1)}">${icon("star", 16)}</label>`)}</div>
${c.text ? html`<p class="Catui_help" aria-live="polite" data-catui-word>${word(c.value)}</p>` : ""}
${c.clearable ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-clear>지우기</button>` : ""}
</fieldset>`);
    const out = inst.elem.querySelector("[data-catui-word]");
    const set = (v, fire) => {
      inst.value = v;
      inst.elem.querySelectorAll("input").forEach((r) => { r.checked = Number(r.value) === v; });
      if (out) out.textContent = word(v);
      if (fire) { c.choose?.call(inst, v); inst.emit("choose", { value: v }); }
    };
    inst.value = c.value;
    const onChange = (e) => { if (e.target.name === name) set(Number(e.target.value), true); };
    const onClick = (e) => { if (e.target.closest("[data-catui-clear]")) set(0, true); };
    inst.elem.addEventListener("change", onChange);
    inst.elem.addEventListener("click", onClick);
    inst.setValue = (v) => set(Math.max(0, Math.min(c.length, Math.round(Number(v) || 0))), false);
    inst.getValue = () => inst.value;
    inst.use(() => { inst.elem.removeEventListener("change", onChange); inst.elem.removeEventListener("click", onClick); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  setValue(id, v) { rate.getThis(id)?.setValue?.(v); },
  getValue(id) { return rate.getThis(id)?.getValue?.() ?? 0; },
  bind() {
    const onChange = (e) => {
      const r = e.target;
      const box = r.closest?.(".Catui_rating[data-catui-filter]");
      if (!box || r.type !== "radio") return;
      emit("rate", "choose", box.getAttribute("data-catui-filter"), { value: Number(r.value), elem: box });
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  },
});

// ── modules/tree.js ──

// tree — 트리. 접힘은 네이티브 <details>, 선택 행은 brand-soft, 체크박스는 부모·자식 상태가 전파된다(일부 선택 = indeterminate).
//   tree.render({ elem: '#tree', id: 'docs', data: [{ id, title, children: [...], spread: true, disabled }],
//                 showCheckbox: true, accordion: false, click(obj) {}, oncheck(obj) {} })
//   tree.getChecked('docs') → 체크된 잎 노드 배열 / tree.setChecked('docs', [id...]) / tree.getSelected('docs')
// 키보드: ↑↓ 보이는 항목 이동, → 펼치기, ← 접기·부모로, Home/End.
const tree = component({
  name: "tree",
  config: { data: [], showCheckbox: false, accordion: false, label: "트리", selected: null, click: null, oncheck: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    // 부모 관계는 내부 Map에만 둔다. 사용자 데이터에 부모 참조를 넣으면 JSON.stringify(data)가 순환 오류를 낸다
    const byId = new Map(), parentOf = new Map();
    const index = (nodes, parent) => nodes.forEach((n) => { parentOf.set(n, parent); byId.set(String(n.id), n); if (n.children) index(n.children, n); });
    index(c.data, null);
    const kw = () => String(s.keyword || "").trim().toLowerCase();
    // 검색어가 있으면 제목이 맞는 노드와 그 조상만 보인다
    const matches = (n) => !kw() || String(n.title ?? "").toLowerCase().includes(kw()) || (n.children || []).some(matches);
    inst.state ||= { checked: new Set(), open: new Set(c.data.flatMap(function walk(n) { return [...(n.spread ? [String(n.id)] : []), ...(n.children || []).flatMap(walk)]; })), selected: c.selected != null ? String(c.selected) : null };
    const s = inst.state;
    const leaves = (n) => (n.children?.length ? n.children.flatMap(leaves) : [n]);
    const stateOf = (n) => {
      const ls = leaves(n).filter((l) => !l.disabled);
      const on = ls.filter((l) => s.checked.has(String(l.id))).length;
      return on === 0 ? "off" : on === ls.length ? "on" : "mixed";
    };
    const cbx = (n) => {
      const st = stateOf(n);
      return html`<label class="Catui_choice" style="gap:6px"><input class="Catui_clip" type="checkbox" data-catui-tcheck="${n.id}" ${st === "on" ? "checked" : ""} ${st === "mixed" ? html`data-catui-mixed` : ""} ${n.disabled ? "disabled" : ""} aria-label="${n.title} 선택"><span class="Catui_cbx">${icon("check", 12)}</span></label>`;
    };
    const node = (n) => {
      if (!matches(n)) return "";
      const id = String(n.id), on = s.selected === id;
      if (n.children?.length) {
        const open = s.open.has(id) || (!!kw() && n.children.some(matches));   // 검색 중에는 맞는 자식이 있는 폴더를 펼침
        return html`<details data-catui-tid="${id}" ${open ? "open" : ""}><summary data-catui-titem="${id}" class="${on ? "Catui_tree-on" : ""}" ${on ? html`aria-current="true"` : ""}>${icon("chevron-right", 16, "Catui_tree-toggle")}${c.showCheckbox ? cbx(n) : ""}${icon("folder", 16)}<span>${n.title}</span></summary><div class="Catui_tree-kids">${n.children.map(node)}</div></details>`;
      }
      return html`<div class="Catui_tree-row${on ? " Catui_tree-on" : ""}">${c.showCheckbox ? cbx(n) : ""}<button type="button" data-catui-titem="${id}" ${n.disabled ? "disabled" : ""} ${on ? html`aria-current="true"` : ""} style="flex:1;text-align:left;display:flex;align-items:center;gap:inherit">${icon(n.icon || "file-text", 16)}<span>${n.title}</span></button></div>`;
    };
    const draw = () => {
      inst.elem.classList.add("Catui_tree");
      inst.elem.setAttribute("aria-label", c.label);
      const list = c.data.map(node);
      mount(inst.elem, list.some(Boolean) ? html`${list}` : html`<p class="Catui_help">${kw() ? "맞는 항목이 없습니다." : "항목이 없습니다."}</p>`);
      inst.elem.querySelectorAll("[data-catui-mixed]").forEach((x) => { x.indeterminate = true; });
    };
    draw();

    // 실제로 보이는 항목만. 최신 브라우저는 접힌 details 내용을 content-visibility로 숨기므로 checkVisibility()로 판정
    const shown = (x) => (x.checkVisibility ? x.checkVisibility() : x.getClientRects().length > 0);
    const visible = () => [...inst.elem.querySelectorAll("[data-catui-titem]")].filter(shown);
    const focusItem = (id) => inst.elem.querySelector(`[data-catui-titem="${CSS.escape(id)}"]`)?.focus();
    const onToggle = (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.dataset.catuiTid) return;
      if (kw()) return;   // 검색 결과로 자동 펼친 폴더는 펼침 상태·아코디언에 반영하지 않는다
      const id = d.dataset.catuiTid;
      if (d.open) {
        s.open.add(id);
        if (c.accordion) [...d.parentElement.children].forEach((sib) => { if (sib !== d && sib.tagName === "DETAILS" && sib.open) sib.open = false; });
      } else s.open.delete(id);
      inst.emit("spread", { data: byId.get(id), open: d.open });
    };
    const onClick = (e) => {
      if (e.target.closest("label.Catui_choice")) return;      // 체크박스 클릭은 change에서
      const item = e.target.closest("[data-catui-titem]");
      if (!item || item.disabled) return;
      const id = item.dataset.catuiTitem, n = byId.get(id);
      s.selected = id;
      inst.elem.querySelectorAll(".Catui_tree-on").forEach((x) => { x.classList.remove("Catui_tree-on"); x.removeAttribute("aria-current"); });
      (item.tagName === "SUMMARY" ? item : item.parentElement).classList.add("Catui_tree-on");
      item.setAttribute("aria-current", "true");
      c.click?.call(inst, { data: n, elem: item });
      inst.emit("click", { data: n, elem: item });
    };
    const onChange = (e) => {
      const cb = e.target.closest("[data-catui-tcheck]");
      if (!cb) return;
      const n = byId.get(cb.dataset.catuiTcheck);
      leaves(n).filter((l) => !l.disabled).forEach((l) => (cb.checked ? s.checked.add(String(l.id)) : s.checked.delete(String(l.id))));
      draw();
      inst.elem.querySelector(`[data-catui-tcheck="${CSS.escape(String(n.id))}"]`)?.focus();
      c.oncheck?.call(inst, { data: n, checked: cb.checked });
      inst.emit("check", { data: n, checked: cb.checked });
    };
    const onKey = (e) => {
      const item = e.target.closest?.("[data-catui-titem]");
      if (!item) return;
      const list = visible(), i = list.indexOf(item), id = item.dataset.catuiTitem, n = byId.get(id);
      const det = item.tagName === "SUMMARY" ? item.parentElement : null;
      if (e.key === "ArrowDown") { e.preventDefault(); list[i + 1]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); list[i - 1]?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
      else if (e.key === "ArrowRight" && det) { e.preventDefault(); if (!det.open) det.open = true; else det.querySelector(".Catui_tree-kids [data-catui-titem]")?.focus(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); const p = parentOf.get(n); if (det?.open) det.open = false; else if (p) focusItem(String(p.id)); }
    };
    inst.elem.addEventListener("toggle", onToggle, true);
    inst.elem.addEventListener("click", onClick);
    inst.elem.addEventListener("change", onChange);
    inst.elem.addEventListener("keydown", onKey);
    inst.getChecked = () => [...s.checked].map((id) => byId.get(id)).filter(Boolean);
    inst.setChecked = (ids) => { [].concat(ids).forEach((id) => { const n = byId.get(String(id)); if (n) leaves(n).forEach((l) => s.checked.add(String(l.id))); }); draw(); };
    inst.getSelected = () => (s.selected ? byId.get(s.selected) : null);
    inst.clearChecked = () => { s.checked.clear(); draw(); };
    // 모두 펼치기·접기 (open=false면 접기)
    inst.expandAll = (open = true) => { s.open = new Set(open ? [...byId.values()].filter((n) => n.children?.length).map((n) => String(n.id)) : []); draw(); };
    // 제목 검색: 맞는 노드와 조상만 보이고 펼친다. 빈 문자열이면 전체
    inst.search = (keyword) => { s.keyword = keyword; draw(); };
    inst.use(() => {
      inst.elem.removeEventListener("toggle", onToggle, true);
      inst.elem.removeEventListener("click", onClick);
      inst.elem.removeEventListener("change", onChange);
      inst.elem.removeEventListener("keydown", onKey);
    });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  getChecked(id) { return tree.getThis(id)?.getChecked() || []; },
  setChecked(id, ids) { tree.getThis(id)?.setChecked(ids); },
  getSelected(id) { return tree.getThis(id)?.getSelected() || null; },
  clearChecked(id) { tree.getThis(id)?.clearChecked(); },
  expandAll(id, open = true) { tree.getThis(id)?.expandAll(open); },
  search(id, keyword) { tree.getThis(id)?.search(keyword); },
});

// ── modules/collapse.js ──

// collapse — 접기 패널(질문·아코디언). 네이티브 <details class="Catui_faq"> 묶음.
//   마크업: <div data-catui-collapse="accordion" data-catui-filter="faq"> <details class="Catui_faq">…</details> …</div>
//   collapse.render({ elem: '#faq', accordion: true, data: [{ title, content, open }] })
//   collapse.on('collapse(faq)', ({ index, title, open }) => {}) / collapse.open('faq', 1) / collapse.close('faq')
const collapse = component({
  name: "collapse",
  config: { data: [], accordion: false },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    inst.elem.setAttribute("data-catui-collapse", c.accordion ? "accordion" : "");
    if (!inst.elem.hasAttribute("data-catui-filter")) inst.elem.setAttribute("data-catui-filter", inst.filter);
    mount(inst.elem, html`${c.data.map((d) => html`<details class="Catui_faq" ${d.open ? "open" : ""}><summary>${d.title} ${icon("chevron-down", 16)}</summary><div data-catui-body></div></details>`)}`);
    inst.elem.querySelectorAll("[data-catui-body]").forEach((body, i) => {
      const content = c.data[i].content;
      if (content instanceof Element) body.appendChild(content);
      else if (isRaw(content)) mount(body, content);
      else body.appendChild(Object.assign(document.createElement("p"), { textContent: String(content ?? "") }));
    });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  // index를 빼면 전부 (아코디언은 하나만 열리므로 open(filter)는 첫 패널만)
  open(filter, index) {
    const items = collapseItems(filter);
    if (index != null) { if (items[index]) items[index].open = true; return; }
    const box = items[0]?.parentElement;
    (box?.getAttribute("data-catui-collapse") === "accordion" ? items.slice(0, 1) : items).forEach((d) => { d.open = true; });
  },
  close(filter, index) { collapseItems(filter).forEach((d, i) => { if (index == null || i === index) d.open = false; }); },
  toggle(filter, index) { const d = collapseItems(filter)[index]; if (d) d.open = !d.open; },
  // 전역 위임: 아코디언(하나만 열기) + collapse(filter) 이벤트
  bind() {
    const onToggle = (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement)) return;
      const box = d.parentElement?.closest("[data-catui-collapse]");
      if (!box || d.parentElement !== box) return;
      // 아코디언이 자동으로 닫은 패널의 toggle은 알리지 않는다(방금 연 패널 이벤트를 덮어쓰지 않게)
      if (d.dataset.catuiAuto) { delete d.dataset.catuiAuto; return; }
      if (d.open && box.getAttribute("data-catui-collapse") === "accordion") {
        [...box.children].forEach((x) => { if (x !== d && x.tagName === "DETAILS" && x.open) { x.dataset.catuiAuto = "1"; x.open = false; } });
      }
      const items = [...box.children].filter((x) => x.tagName === "DETAILS");
      emit("collapse", "collapse", box.getAttribute("data-catui-filter"), { index: items.indexOf(d), title: d.querySelector("summary")?.textContent.trim() ?? "", open: d.open, elem: d });
    };
    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  },
});

function collapseItems(filter) {
  const box = document.querySelector(`[data-catui-collapse][data-catui-filter="${CSS.escape(filter)}"]`);
  return box ? [...box.children].filter((x) => x.tagName === "DETAILS") : [];
}

// ── modules/canvas.js ──

// canvas — 반응형·고해상도(DPR) 캔버스.
//   canvas.render({ elem: '#c', ratio: '16/9', label: '매출 추이', draw(ctx, s) { … }, animate: false })
//   draw(ctx, { width, height, dpr, time, token, font, reduced }) — 좌표는 CSS 픽셀, token('--Catui_color-brand')로 토큰 색.
// 크기 변화(ResizeObserver)·테마 전환(data-catui-theme) 때 다시 그리고, animate면 rAF로 그리되
// 모션 줄이기·백그라운드 탭에서는 멈춘다. destroy 시 관찰자·rAF를 모두 정리한다.
const canvas = component({
  name: "canvas",
  config: { ratio: "16/9", label: "", draw: null, animate: false, maxDpr: 2 },
  render(inst) {
    const c = inst.config;
    const host = inst.elem;
    if (!host) return;
    host.classList.add("Catui_canvas");
    if (c.ratio) host.style.aspectRatio = String(c.ratio);
    let cv = host.querySelector("canvas");
    if (!cv) { cv = document.createElement("canvas"); host.prepend(cv); inst.use(() => cv.remove()); }
    cv.setAttribute("role", "img");
    if (c.label) cv.setAttribute("aria-label", c.label);
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const token = (name) => getComputedStyle(host).getPropertyValue(name).trim();
    // 페이지와 같은 글꼴로 캔버스 글자를 그리기 위한 font 문자열 (예: s.font(11), s.font(13, 600))
    const font = (size = 12, weight = 400) => `${weight} ${size}px ${getComputedStyle(host).fontFamily}`;
    const start = performance.now();
    let w = 1, h = 1, dpr = 1, raf = 0;

    const paint = (t = performance.now()) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      c.draw?.call(inst, ctx, { width: w, height: h, dpr, time: (t - start) / 1000, token, font, reduced: reduce.matches });
    };
    const resize = () => {
      // 테두리를 뺀 안쪽 크기 = canvas가 채우는 영역
      dpr = Math.min(window.devicePixelRatio || 1, c.maxDpr);
      w = Math.max(1, host.clientWidth);
      h = Math.max(1, host.clientHeight);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      paint();
    };
    const loop = (t) => { paint(t); raf = requestAnimationFrame(loop); };
    const startLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (c.animate && !reduce.matches && !document.hidden) raf = requestAnimationFrame(loop);
      else paint();
    };
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : startLoop());

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const mo = new MutationObserver(() => paint());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-catui-theme"] });
    document.addEventListener("visibilitychange", onVis);
    reduce.addEventListener?.("change", startLoop);
    resize();
    startLoop();

    inst.canvas = cv;
    inst.ctx = ctx;
    inst.redraw = () => paint();
    inst.toBlob = (cb, type = "image/png") => cv.toBlob(cb, type);
    inst.use(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduce.removeEventListener?.("change", startLoop);
      host.style.aspectRatio = "";
    });
  },
  redraw(id) { canvas.getThis(id)?.redraw(); },
});

// ── modules/fx.js ──

// fx — 텍스트·스크롤·커서·배경 효과. 각 함수는 { destroy() }를 돌려주고, 모션 줄이기에서는 최종 상태를 바로 보인다.
//   fx.reveal(el, { y, delay, once }) · fx.split(el, { by:'char'|'word', stagger }) · fx.count(el, { to, from, duration, decimals })
//   fx.type(el, { words, speed, pause, loop }) · fx.scramble(el, { duration, chars })
//   fx.tilt(el, { max }) · fx.spotlight(el) · fx.magnet(el, { strength }) · fx.spark(el, { count })
//   fx.particles(el, { count, link }) · fx.waves(el, { lines, amplitude }) · fx.aurora(el)
//   fx.shiny · fx.gradient · fx.rotate(el, { words, interval }) · fx.glitch · fx.border · fx.glare · fx.ripple · fx.marquee(el, { speed }) · fx.dock(el, { scale, radius })
//   fx.hold(el, { duration, onHold }) · fx.swipe(row) · fx.list(ul) · fx.indicator(nav) · fx.flip(card) · fx.check(svg) · fx.pulse(btn) · fx.press(영역)
//   fx.circle(el, { radius }) · fx.velocity(el) · fx.focus(el) · fx.stroke · fx.edge · fx.noise · fx.dotgrid(el) · fx.ripplegrid(el) · fx.cursor(el, { type })
//   fx.bind(scope) — data-catui-fx="이름 이름…" (위 38종)
const fx = (() => {
  const list = (target) => (typeof target === "string" ? [...document.querySelectorAll(target)] : target instanceof Element ? [target] : [...(target || [])]);
  const many = (target, one) => {
    const hs = list(target).map(one).filter(Boolean);
    return hs.length === 1 ? hs[0] : { destroy() { hs.forEach((h) => h.destroy()); } };
  };
  // 화면에 들어올 때 한 번(또는 매번) fn 실행
  const onView = (el, fn, once = true) => {
    if (typeof IntersectionObserver !== "function") { fn(true); return () => {}; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { fn(true); if (once) io.disconnect(); } else if (!once) fn(false);
    }), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  };
  const pointer = (el, move, leave) => {
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  };
  const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

  function reveal(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-reveal");
      if (o.y != null) el.style.setProperty("--Catui_fx-y", `${o.y}px`);
      if (o.delay) el.style.setProperty("--Catui_fx-delay", `${o.delay}ms`);
      if (reducedMotion()) { el.classList.add("Catui_fx-in"); return { destroy() { el.classList.remove("Catui_fx-reveal", "Catui_fx-in"); } }; }
      const off = onView(el, (v) => el.classList.toggle("Catui_fx-in", v), o.once !== false);
      return { destroy() { off(); el.classList.remove("Catui_fx-reveal", "Catui_fx-in"); el.style.removeProperty("--Catui_fx-y"); el.style.removeProperty("--Catui_fx-delay"); } };
    });
  }

  // 글자(또는 단어)를 span으로 나누되, 스크린리더는 원문 한 덩어리로 읽게 한다
  function split(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent, label = el.getAttribute("aria-label");
      const parts = o.by === "word" ? text.split(/(\s+)/) : [...text];
      el.setAttribute("aria-label", label || text.trim());
      el.textContent = "";
      let i = 0;
      parts.forEach((p) => {
        if (!p) return;
        const s = document.createElement("span");
        s.className = "Catui_fx-char";
        s.setAttribute("aria-hidden", "true");
        s.textContent = p;
        if (!/^\s+$/.test(p)) s.style.setProperty("--i", String(i++));
        el.appendChild(s);
      });
      if (o.stagger) el.style.setProperty("--Catui_fx-stagger", `${o.stagger}ms`);
      const off = reducedMotion() ? (el.classList.add("Catui_fx-in"), () => {}) : onView(el, () => el.classList.add("Catui_fx-in"));
      return { destroy() { off(); el.textContent = text; el.classList.remove("Catui_fx-in"); el.style.removeProperty("--Catui_fx-stagger"); if (label == null) el.removeAttribute("aria-label"); else el.setAttribute("aria-label", label); } };
    });
  }

  // 숫자 올라가기 (천 단위 구분 ko-KR). 화면 리더는 최종 값을 aria-label로 읽는다
  function count(target, o = {}) {
    return many(target, (el) => {
      const orig = el.textContent;
      const to = Number(o.to ?? el.dataset.catuiTo ?? (orig.replace(/[^\d.-]/g, "") || 0));
      const from = Number(o.from ?? 0), dur = o.duration ?? 1200, dec = o.decimals ?? (String(to).split(".")[1]?.length || 0);
      const fmt = (v) => v.toLocaleString("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      el.style.fontVariantNumeric = "tabular-nums";
      el.setAttribute("aria-label", (o.prefix || "") + fmt(to) + (o.suffix || ""));
      const show = (v) => { el.textContent = (o.prefix || "") + fmt(v) + (o.suffix || ""); };
      let raf = 0, done = 0;
      const run = () => {
        if (reducedMotion()) return show(to);
        const t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; show(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
        raf = requestAnimationFrame(step);
        // 프레임이 멈춘 환경(백그라운드 탭 등)에서도 최종 값은 반드시 보이게
        done = setTimeout(() => { cancelAnimationFrame(raf); show(to); }, dur + 200);
      };
      show(from);
      const off = onView(el, run);
      return { destroy() { off(); cancelAnimationFrame(raf); clearTimeout(done); el.textContent = orig; el.style.fontVariantNumeric = ""; el.removeAttribute("aria-label"); } };
    });
  }

  // 타자기: words를 차례로 쓰고 지움. 바뀌는 글자는 aria-hidden, 전체 목록은 화면 리더용 글자로
  function type(target, o = {}) {
    return many(target, (el) => {
      const orig = el.innerHTML;
      const words = o.words || (el.dataset.catuiWords || el.textContent).split("|").map((s) => s.trim()).filter(Boolean);
      const speed = o.speed ?? 70, pause = o.pause ?? 1400, loop = o.loop !== false;
      el.textContent = "";
      const sr = document.createElement("span"); sr.className = "Catui_clip"; sr.textContent = words.join(", ");
      const out = document.createElement("span"); out.setAttribute("aria-hidden", "true");
      const caret = document.createElement("span"); caret.className = "Catui_fx-caret"; caret.setAttribute("aria-hidden", "true");
      el.append(sr, out, caret);
      if (reducedMotion()) { out.textContent = words[0] || ""; return { destroy() { el.innerHTML = orig; } }; }
      let w = 0, n = 0, del = false, timer = 0;
      const tick = () => {
        const word = words[w] || "";
        n += del ? -1 : 1;
        out.textContent = word.slice(0, n);
        let wait = del ? speed / 2 : speed;
        if (!del && n >= word.length) { if (!loop && w === words.length - 1) return; del = true; wait = pause; }
        else if (del && n <= 0) { del = false; w = (w + 1) % words.length; wait = speed * 4; }
        timer = setTimeout(tick, wait);
      };
      timer = setTimeout(tick, speed);
      return { destroy() { clearTimeout(timer); el.innerHTML = orig; } };
    });
  }

  // 글자 해독: 무작위 글자에서 원문으로 왼쪽부터 확정
  function scramble(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent, chars = o.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*", dur = o.duration ?? 900;
      el.setAttribute("aria-label", text);
      let raf = 0, done = 0;
      const run = () => {
        if (reducedMotion()) { el.textContent = text; return; }
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur), done = Math.floor(text.length * k);
          el.textContent = [...text].map((c, i) => (i < done || /\s/.test(c) ? c : chars[(Math.random() * chars.length) | 0])).join("");
          if (k < 1) raf = requestAnimationFrame(step); else el.textContent = text;
        };
        raf = requestAnimationFrame(step);
        clearTimeout(done);
        done = setTimeout(() => { cancelAnimationFrame(raf); el.textContent = text; }, dur + 200);
      };
      const off = onView(el, run);
      const enter = () => run();
      if (o.hover) el.addEventListener("pointerenter", enter);
      return { destroy() { off(); cancelAnimationFrame(raf); clearTimeout(done); el.removeEventListener("pointerenter", enter); el.textContent = text; el.removeAttribute("aria-label"); } };
    });
  }

  function tilt(target, o = {}) {
    return many(target, (el) => {
      if (!finePointer()) return null;
      const max = o.max ?? 8;
      el.classList.add("Catui_fx-tilt");
      const move = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--Catui_fx-rx", `${(-y * max).toFixed(2)}deg`);
        el.style.setProperty("--Catui_fx-ry", `${(x * max).toFixed(2)}deg`);
      };
      const leave = () => { el.style.setProperty("--Catui_fx-rx", "0deg"); el.style.setProperty("--Catui_fx-ry", "0deg"); };
      const off = pointer(el, move, leave);
      return { destroy() { off(); el.classList.remove("Catui_fx-tilt"); el.style.removeProperty("--Catui_fx-rx"); el.style.removeProperty("--Catui_fx-ry"); } };
    });
  }

  function spotlight(target) {
    return many(target, (el) => {
      const offLayer = addLayer(el, "Catui_fx-spot", true);
      const move = (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--Catui_fx-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--Catui_fx-y", `${e.clientY - r.top}px`);
        el.style.setProperty("--Catui_fx-o", "1");
      };
      const leave = () => el.style.setProperty("--Catui_fx-o", "0");
      const off = pointer(el, move, leave);
      const focusIn = () => { el.style.setProperty("--Catui_fx-x", "50%"); el.style.setProperty("--Catui_fx-y", "50%"); el.style.setProperty("--Catui_fx-o", "1"); };
      el.addEventListener("focusin", focusIn); el.addEventListener("focusout", leave);
      return { destroy() { off(); el.removeEventListener("focusin", focusIn); el.removeEventListener("focusout", leave); offLayer(); ["x", "y", "o"].forEach((k) => el.style.removeProperty(`--Catui_fx-${k}`)); } };
    });
  }

  function magnet(target, o = {}) {
    return many(target, (el) => {
      if (!finePointer()) return null;
      const k = o.strength ?? 0.3;
      el.classList.add("Catui_fx-magnet");
      const move = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--Catui_fx-mx", `${((e.clientX - r.left - r.width / 2) * k).toFixed(1)}px`);
        el.style.setProperty("--Catui_fx-my", `${((e.clientY - r.top - r.height / 2) * k).toFixed(1)}px`);
      };
      const leave = () => { el.style.setProperty("--Catui_fx-mx", "0px"); el.style.setProperty("--Catui_fx-my", "0px"); };
      const off = pointer(el, move, leave);
      return { destroy() { off(); el.classList.remove("Catui_fx-magnet"); el.style.removeProperty("--Catui_fx-mx"); el.style.removeProperty("--Catui_fx-my"); } };
    });
  }

  // 클릭 불꽃: 클릭 위치에 선 조각을 퍼뜨리고 애니메이션이 끝나면 제거 (장식, aria-hidden)
  function spark(target, o = {}) {
    return many(target, (el) => {
      const n = o.count ?? 8;
      const click = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect();
        const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
        const box = document.createElement("span");
        box.className = "Catui_fx-spark"; box.setAttribute("aria-hidden", "true");
        box.style.left = `${x}px`; box.style.top = `${y}px`;
        for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.style.setProperty("--a", `${(360 / n) * i}deg`); box.appendChild(s); }
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 600);
      };
      el.addEventListener("click", click);
      return { destroy() { el.removeEventListener("click", click); } };
    });
  }

  // 점과 선 배경 (canvas 모듈). 색은 토큰, 다크 모드·크기 변화·모션 줄이기 자동 대응
  function particles(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-bg");
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      el.prepend(host);
      const N = o.count ?? 40, link = o.link ?? 90;
      let pts = null;
      const inst = canvas.render({
        elem: host, ratio: "", label: "", animate: true,
        draw(ctx, s) {
          if (!pts) pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006 }));
          const dot = s.token("--Catui_color-brand"), line = s.token("--Catui_color-neutral-300");
          if (!s.reduced) pts.forEach((p) => { p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1; });
          ctx.lineWidth = 1;
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
            const a = pts[i], b = pts[j], dx = (a.x - b.x) * s.width, dy = (a.y - b.y) * s.height, d = Math.hypot(dx, dy);
            if (d < link) { ctx.globalAlpha = 1 - d / link; ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(a.x * s.width, a.y * s.height); ctx.lineTo(b.x * s.width, b.y * s.height); ctx.stroke(); }
          }
          ctx.globalAlpha = 0.9; ctx.fillStyle = dot;
          pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x * s.width, p.y * s.height, 2, 0, Math.PI * 2); ctx.fill(); });
          ctx.globalAlpha = 1;
        },
      });
      host.removeAttribute("role");
      host.querySelector("canvas")?.removeAttribute("role");
      return { destroy() { inst.destroy(); host.remove(); el.classList.remove("Catui_fx-bg"); } };
    });
  }

  // 클래스만 붙이는 CSS 효과 (빛 글자·그라디언트 글자·테두리 빛·광택·오로라)
  const cls = (name) => (target) => many(target, (el) => { el.classList.add(name); return { destroy() { el.classList.remove(name); } }; });
  // 덧칠 효과(::before/::after 사용)는 요소 안 전용 레이어에 그려 서로·컴포넌트 가상 요소와 겹치지 않게
  const addLayer = (el, name, back) => {
    const ly = document.createElement("span");
    ly.className = "Catui_fx-layer " + (back ? "Catui_fx-layer-back " : "Catui_fx-layer-front ") + name;
    ly.setAttribute("aria-hidden", "true");
    el.classList.add("Catui_fx-host");
    if (getComputedStyle(el).position === "static") el.classList.add("Catui_fx-host-rel");
    back ? el.prepend(ly) : el.appendChild(ly);
    return () => { ly.remove(); if (!el.querySelector(":scope > .Catui_fx-layer")) el.classList.remove("Catui_fx-host", "Catui_fx-host-rel"); };
  };
  const layered = (name, back) => (target) => many(target, (el) => { const off = addLayer(el, name, back); return { destroy: off }; });
  const shiny = cls("Catui_fx-shiny"), gradient = cls("Catui_fx-gradient"), border = layered("Catui_fx-border"), glare = layered("Catui_fx-glare"), aurora = layered("Catui_fx-aurora", true);

  // 위아래로 바뀌는 단어. 화면 리더는 전체 목록을 한 번 읽는다
  function rotate(target, o = {}) {
    return many(target, (el) => {
      const orig = el.innerHTML;
      const words = o.words || (el.dataset.catuiWords || el.textContent).split("|").map((s) => s.trim()).filter(Boolean);
      el.textContent = "";
      el.setAttribute("aria-label", words.join(", "));
      el.classList.add("Catui_fx-rotate");
      words.forEach((w) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = w; el.appendChild(s); });
      let k = 0;
      const timer = reducedMotion() ? 0 : setInterval(() => { k = (k + 1) % words.length; el.style.setProperty("--Catui_fx-k", String(k)); }, o.interval ?? 2200);
      return { destroy() { clearInterval(timer); el.innerHTML = orig; el.classList.remove("Catui_fx-rotate"); el.removeAttribute("aria-label"); el.style.removeProperty("--Catui_fx-k"); } };
    });
  }

  function glitch(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-glitch");
      el.dataset.text = el.textContent;
      return { destroy() { el.classList.remove("Catui_fx-glitch"); delete el.dataset.text; } };
    });
  }

  // 클릭 물결: 누른 지점에서 원이 퍼짐 (키보드 실행은 가운데)
  function ripple(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-ripple");
      const down = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect(), size = Math.hypot(r.width, r.height) * 2;
        const x = (e.clientX || r.left + r.width / 2) - r.left, y = (e.clientY || r.top + r.height / 2) - r.top;
        const w = document.createElement("span");
        w.className = "Catui_fx-wave"; w.setAttribute("aria-hidden", "true");
        Object.assign(w.style, { width: `${size}px`, height: `${size}px`, left: `${x - size / 2}px`, top: `${y - size / 2}px` });
        el.appendChild(w);
        setTimeout(() => w.remove(), 700);
      };
      el.addEventListener("click", down);
      return { destroy() { el.removeEventListener("click", down); el.classList.remove("Catui_fx-ripple"); } };
    });
  }

  // 끝없는 띠: 자식들을 트랙으로 감싸고 한 벌 더 복제(복제본은 aria-hidden·포커스 제외)
  function marquee(target, o = {}) {
    return many(target, (el) => {
      const orig = [...el.childNodes];
      const track = document.createElement("div");
      track.className = "Catui_fx-track";
      orig.forEach((n) => track.appendChild(n));
      const copy = document.createElement("div");
      copy.style.display = "contents";
      copy.setAttribute("aria-hidden", "true");
      [...track.children].forEach((c) => { const k = c.cloneNode(true); k.querySelectorAll("a,button,input,[tabindex]").forEach((f) => f.setAttribute("tabindex", "-1")); if (k.matches("a,button")) k.setAttribute("tabindex", "-1"); copy.appendChild(k); });
      track.appendChild(copy);
      el.classList.add("Catui_fx-marquee");
      el.appendChild(track);
      if (o.speed) el.style.setProperty("--Catui_fx-speed", `${o.speed}s`);
      return { destroy() { el.classList.remove("Catui_fx-marquee"); el.style.removeProperty("--Catui_fx-speed"); orig.forEach((n) => el.appendChild(n)); track.remove(); } };
    });
  }

  // 독: 커서와 가까운 항목일수록 커짐 (최대 scale, 반경 px)
  function dock(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-dock");
      const max = o.scale ?? 1.5, radius = o.radius ?? 120;
      const items = () => [...el.children];
      const move = (e) => {
        if (reducedMotion() || !finePointer()) return;
        items().forEach((it) => {
          const r = it.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
          it.style.setProperty("--Catui_fx-s", (1 + (max - 1) * Math.max(0, 1 - d / radius)).toFixed(3));
        });
      };
      const leave = () => items().forEach((it) => it.style.setProperty("--Catui_fx-s", "1"));
      const off = pointer(el, move, leave);
      return { destroy() { off(); el.classList.remove("Catui_fx-dock"); items().forEach((it) => it.style.removeProperty("--Catui_fx-s")); } };
    });
  }

  // 물결 선 배경 (canvas)
  function waves(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-bg");
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      el.prepend(host);
      const lines = o.lines ?? 3, amp = o.amplitude ?? 14;
      const inst = canvas.render({
        elem: host, ratio: "", label: "", animate: true,
        draw(ctx, s) {
          const tk = ["--Catui_chart-series-1", "--Catui_chart-series-2", "--Catui_chart-series-3"];
          const t = s.reduced ? 0 : s.time;
          for (let k = 0; k < lines; k++) {
            ctx.beginPath();
            for (let x = 0; x <= s.width; x += 6) {
              const y = s.height * (0.35 + k * 0.15) + Math.sin(x / (70 + k * 20) + t * (0.8 + k * 0.25) + k) * (amp + k * 4);
              x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = s.token(tk[k % tk.length]); ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.globalAlpha = 1;
        },
      });
      host.querySelector("canvas")?.removeAttribute("role");
      return { destroy() { inst.destroy(); host.remove(); el.classList.remove("Catui_fx-bg"); } };
    });
  }

  // ---- 3차: 화면 기능 · 마이크로 · 꾸밈 ----
  const stroke = cls("Catui_fx-stroke"), edge = layered("Catui_fx-edge"), noise = layered("Catui_fx-noise"), press = cls("Catui_fx-press");
  const emitFx = (el, name, detail) => el.dispatchEvent(new CustomEvent(`catui:${name}`, { bubbles: true, detail }));

  // 누르고 있기: duration 동안 누르면 실행(catui:hold 이벤트 + onHold). Space·Enter로도 동작, 떼면 취소
  function hold(target, o = {}) {
    return many(target, (el) => {
      const dur = (o.duration ?? Number(el.dataset.catuiDuration)) || 1200;
      el.classList.add("Catui_fx-hold");
      const hint = document.createElement("span"); hint.className = "Catui_clip"; hint.textContent = " (길게 눌러 실행)";
      el.appendChild(hint);
      let t0 = 0, timer = 0, fired = false;
      const set = (p) => el.style.setProperty("--Catui_fx-p", p.toFixed(3));
      const stop = () => { clearTimeout(timer); timer = 0; if (!fired) set(0); };
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / dur);
        set(p);
        if (p >= 1) { fired = true; timer = 0; emitFx(el, "hold", {}); o.onHold?.call(el); setTimeout(() => { fired = false; set(0); }, 400); }
        else timer = setTimeout(tick, 16);
      };
      const start = (e) => { if (timer || el.disabled || (e.type === "keydown" && e.key !== " " && e.key !== "Enter") || e.repeat) return; if (e.type === "keydown") e.preventDefault(); t0 = performance.now(); fired = false; tick(); };
      const keyup = (e) => { if (e.key === " " || e.key === "Enter") stop(); };
      const block = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
      el.addEventListener("pointerdown", start); el.addEventListener("keydown", start);
      ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((n) => el.addEventListener(n, stop));
      el.addEventListener("keyup", keyup); el.addEventListener("click", block, true);
      return { destroy() { stop(); hint.remove(); el.classList.remove("Catui_fx-hold"); el.style.removeProperty("--Catui_fx-p"); el.removeEventListener("pointerdown", start); el.removeEventListener("keydown", start); ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((n) => el.removeEventListener(n, stop)); el.removeEventListener("keyup", keyup); el.removeEventListener("click", block, true); } };
    });
  }

  // 밀어서 동작: .Catui_fx-swipe-front를 왼쪽으로 밀면 .Catui_fx-swipe-actions가 드러남. 키보드는 포커스로 열림
  function swipe(target) {
    return many(target, (el) => {
      const front = el.querySelector(".Catui_fx-swipe-front"), acts = el.querySelector(".Catui_fx-swipe-actions");
      if (!front || !acts) return null;
      el.classList.add("Catui_fx-swipe");
      const aw = () => acts.getBoundingClientRect().width;
      el.style.setProperty("--Catui_fx-aw", `${aw()}px`);
      let x0 = null, dx = 0, open = false;
      const down = (e) => { if (e.button) return; x0 = e.clientX; dx = 0; front.style.transition = "none"; front.setPointerCapture?.(e.pointerId); };
      const move = (e) => { if (x0 == null) return; dx = e.clientX - x0; const base = open ? -aw() : 0; front.style.setProperty("--Catui_fx-sx", `${Math.max(-aw(), Math.min(0, base + dx))}px`); };
      const up = () => {
        if (x0 == null) return;
        front.style.transition = ""; front.style.removeProperty("--Catui_fx-sx");
        if (Math.abs(dx) > 8) { open = open ? dx < aw() / 2 : dx < -aw() / 2; el.classList.toggle("Catui_fx-on", open); }
        x0 = null;
      };
      const key = (e) => { if (e.key === "Escape" && !imeBusy(e)) { open = false; el.classList.remove("Catui_fx-on"); front.focus(); } };
      front.addEventListener("pointerdown", down); front.addEventListener("pointermove", move);
      front.addEventListener("pointerup", up); front.addEventListener("pointercancel", up); el.addEventListener("keydown", key);
      return { close() { open = false; el.classList.remove("Catui_fx-on"); }, destroy() { front.removeEventListener("pointerdown", down); front.removeEventListener("pointermove", move); front.removeEventListener("pointerup", up); front.removeEventListener("pointercancel", up); el.removeEventListener("keydown", key); el.classList.remove("Catui_fx-swipe", "Catui_fx-on"); el.style.removeProperty("--Catui_fx-aw"); } };
    });
  }

  // 목록: 항목 차례 등장 + 위·아래·Home·End로 이동, Enter·Space로 선택(catui:select)
  function listFx(target) {
    return many(target, (el) => {
      const items = () => [...el.children];
      el.classList.add("Catui_fx-list");
      if (!el.getAttribute("role")) el.setAttribute("role", "listbox");
      items().forEach((it, i) => { it.style.setProperty("--i", String(i)); it.setAttribute("role", "option"); it.tabIndex = i ? -1 : 0; it.setAttribute("aria-selected", it.getAttribute("aria-selected") || "false"); });
      const pick = (it) => { items().forEach((x) => x.setAttribute("aria-selected", String(x === it))); emitFx(el, "select", { index: items().indexOf(it), item: it }); };
      const go = (it) => { items().forEach((x) => (x.tabIndex = x === it ? 0 : -1)); it.focus(); };
      const key = (e) => {
        const all = items(), i = all.indexOf(document.activeElement);
        if (i < 0) return;
        const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
        if (to != null) { e.preventDefault(); go(all[Math.max(0, Math.min(all.length - 1, to))]); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(all[i]); }
      };
      const click = (e) => { const it = items().find((x) => x.contains(e.target)); if (it) { go(it); pick(it); } };
      el.addEventListener("keydown", key); el.addEventListener("click", click);
      return { destroy() { el.removeEventListener("keydown", key); el.removeEventListener("click", click); el.classList.remove("Catui_fx-list"); items().forEach((it) => it.style.removeProperty("--i")); } };
    });
  }

  // 움직이는 현재 표시: 현재 항목(aria-current·aria-pressed·aria-selected·checked 라벨) 아래로 표시가 미끄러짐.
  // aria-pressed 버튼 묶음은 하나만 눌리도록 바꿔 줌
  function indicator(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-ind");
      const cur = () => el.querySelector('[aria-current="page"],[aria-pressed="true"],[aria-selected="true"],input:checked + label');
      const place = () => {
        const c = cur(); if (!c) return el.style.setProperty("--Catui_fx-iw", "0px");
        const r = el.getBoundingClientRect(), b = c.getBoundingClientRect();
        el.style.setProperty("--Catui_fx-ix", `${b.left - r.left + el.scrollLeft}px`); el.style.setProperty("--Catui_fx-iy", `${b.top - r.top}px`);
        el.style.setProperty("--Catui_fx-iw", `${b.width}px`); el.style.setProperty("--Catui_fx-ih", `${b.height}px`);
      };
      const click = (e) => {
        const b = e.target.closest("[aria-pressed]");
        if (b && el.contains(b)) el.querySelectorAll("[aria-pressed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        const a = e.target.closest("a");
        if (a && el.contains(a) && a.getAttribute("href") === "#") { e.preventDefault(); el.querySelectorAll("a").forEach((x) => (x === a ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current"))); }
        requestAnimationFrame(place); setTimeout(place, 30);
      };
      el.addEventListener("click", click); el.addEventListener("change", place);
      window.addEventListener("resize", place);
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null; ro?.observe(el);
      place();
      return { update: place, destroy() { el.removeEventListener("click", click); el.removeEventListener("change", place); window.removeEventListener("resize", place); ro?.disconnect(); el.classList.remove("Catui_fx-ind"); ["ix", "iy", "iw", "ih"].forEach((k) => el.style.removeProperty(`--Catui_fx-${k}`)); } };
    });
  }

  // 뒤집기: [data-catui-flip] 버튼으로 앞뒤 전환. 보이지 않는 면은 inert
  function flip(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-flip");
      const front = el.querySelector(".Catui_fx-flip-front"), back = el.querySelector(".Catui_fx-flip-back");
      const sync = () => { const on = el.classList.contains("Catui_fx-flipped"); front.inert = on; back.inert = !on; el.querySelectorAll("[data-catui-flip]").forEach((b) => b.setAttribute("aria-pressed", String(on))); };
      const click = (e) => { const b = e.target.closest("[data-catui-flip]"); if (!b || !el.contains(b)) return; el.classList.toggle("Catui_fx-flipped"); sync(); (el.classList.contains("Catui_fx-flipped") ? back : front).querySelector("[data-catui-flip],button,a")?.focus(); emitFx(el, "flip", { flipped: el.classList.contains("Catui_fx-flipped") }); };
      el.addEventListener("click", click); sync();
      return { toggle() { el.classList.toggle("Catui_fx-flipped"); sync(); }, destroy() { el.removeEventListener("click", click); el.classList.remove("Catui_fx-flip", "Catui_fx-flipped"); front.inert = back.inert = false; } };
    });
  }

  // 완료 체크 다시 그리기
  function check(target) {
    return many(target, (el) => {
      el.classList.remove("Catui_fx-on"); void el.getBoundingClientRect(); el.classList.add("Catui_fx-on");
      return { replay() { el.classList.remove("Catui_fx-on"); void el.getBoundingClientRect(); el.classList.add("Catui_fx-on"); }, destroy() { el.classList.remove("Catui_fx-on"); } };
    });
  }

  // 좋아요: aria-pressed 토글 + 톡 튀기
  function pulse(target) {
    return many(target, (el) => {
      if (!el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", "false");
      const click = () => {
        el.setAttribute("aria-pressed", String(el.getAttribute("aria-pressed") !== "true"));
        if (!reducedMotion()) { el.classList.remove("Catui_fx-pop"); void el.offsetWidth; el.classList.add("Catui_fx-pop"); }
        emitFx(el, "toggle", { pressed: el.getAttribute("aria-pressed") === "true" });
      };
      const end = () => el.classList.remove("Catui_fx-pop");
      el.addEventListener("click", click); el.addEventListener("animationend", end);
      return { destroy() { el.removeEventListener("click", click); el.removeEventListener("animationend", end); el.classList.remove("Catui_fx-pop"); } };
    });
  }

  // 원형 글자
  function circle(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent.trim(), chars = [...text], r = o.radius ?? (Number(el.dataset.catuiRadius) || 60);
      el.setAttribute("aria-label", text); el.textContent = "";
      el.classList.add("Catui_fx-circle"); el.style.setProperty("--Catui_fx-r", `${r}px`);
      chars.forEach((c, i) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = c; s.style.setProperty("--a", `${(360 / chars.length) * i}deg`); el.appendChild(s); });
      return { destroy() { el.textContent = text; el.removeAttribute("aria-label"); el.classList.remove("Catui_fx-circle"); el.style.removeProperty("--Catui_fx-r"); } };
    });
  }

  // 스크롤 속도 띠: marquee 위에서 스크롤 속도만큼 빨라졌다 서서히 돌아옴
  function velocity(target, o = {}) {
    return many(target, (el) => {
      const m = marquee(el, o);
      const anim = () => el.querySelector(".Catui_fx-track")?.getAnimations?.()[0];
      let last = scrollY, boost = 0, timer = 0;
      const onScroll = () => { boost = Math.min(6, boost + Math.abs(scrollY - last) / 40); last = scrollY; };
      const tick = () => { boost *= 0.9; const a = anim(); if (a && !reducedMotion()) a.playbackRate = 1 + boost; timer = setTimeout(tick, 50); };
      addEventListener("scroll", onScroll, { passive: true }); tick();
      return { destroy() { clearTimeout(timer); removeEventListener("scroll", onScroll); m.destroy(); } };
    });
  }

  // 초점 글자: 단어를 차례로 또렷하게
  function focus(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent.trim(), words = text.split(/\s+/);
      el.setAttribute("aria-label", text); el.textContent = "";
      el.classList.add("Catui_fx-focus");
      const spans = words.map((w, i) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(" ")); return s; });
      let k = 0; spans[0]?.classList.add("Catui_fx-on");
      const timer = reducedMotion() ? 0 : setInterval(() => { spans[k].classList.remove("Catui_fx-on"); k = (k + 1) % spans.length; spans[k].classList.add("Catui_fx-on"); }, o.interval ?? 1100);
      if (reducedMotion()) spans.forEach((s) => s.classList.add("Catui_fx-on"));
      return { destroy() { clearInterval(timer); el.textContent = text; el.removeAttribute("aria-label"); el.classList.remove("Catui_fx-focus"); } };
    });
  }

  // 배경 캔버스 공통 (점 격자·물결 격자)
  const bgCanvas = (el, draw, extra = () => () => {}) => {
    el.classList.add("Catui_fx-bg");
    const host = document.createElement("div"); host.setAttribute("aria-hidden", "true"); el.prepend(host);
    const inst = canvas.render({ elem: host, ratio: "", label: "", animate: true, draw });
    host.querySelector("canvas")?.removeAttribute("role");
    const off = extra(inst);
    return { destroy() { off(); inst.destroy(); host.remove(); el.classList.remove("Catui_fx-bg"); } };
  };
  // 점 격자: 커서 근처 점이 커지고 브랜드 색으로
  function dotgrid(target, o = {}) {
    return many(target, (el) => {
      const gap = o.gap ?? 22, reach = o.reach ?? 110;
      let mx = -999, my = -999;
      return bgCanvas(el, (ctx, s) => {
        const base = s.token("--Catui_color-neutral-300"), hot = s.token("--Catui_color-brand");
        for (let y = gap / 2; y < s.height; y += gap) for (let x = gap / 2; x < s.width; x += gap) {
          const k = Math.max(0, 1 - Math.hypot(x - mx, y - my) / reach);
          ctx.globalAlpha = 0.6 + k * 0.4; ctx.fillStyle = k > 0.05 ? hot : base;
          ctx.beginPath(); ctx.arc(x, y, 1.4 + k * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }, () => {
        const move = (e) => { const r = el.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
        const leave = () => { mx = my = -999; };
        el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
        return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
      });
    });
  }
  // 물결 격자: 가운데에서 퍼지는 파동이 격자 선을 휘게
  function ripplegrid(target, o = {}) {
    return many(target, (el) => {
      const gap = o.gap ?? 28;
      return bgCanvas(el, (ctx, s) => {
        const t = s.reduced ? 0 : s.time, cx = s.width / 2, cy = s.height / 2;
        const off = (x, y) => Math.sin(Math.hypot(x - cx, y - cy) / 18 - t * 2.4) * 4;
        ctx.strokeStyle = s.token("--Catui_color-brand"); ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
        for (let y = 0; y <= s.height; y += gap) { ctx.beginPath(); for (let x = 0; x <= s.width; x += 8) { const yy = y + off(x, y); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
        for (let x = 0; x <= s.width; x += gap) { ctx.beginPath(); for (let y = 0; y <= s.height; y += 8) { const xx = x + off(x, y); y ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); } ctx.stroke(); }
        ctx.globalAlpha = 1;
      });
    });
  }

  // 커스텀 커서: 요소 위에서만 빛(glow)·고리(ring)가 따라옴. 마우스 환경·모션 허용일 때만
  function cursor(target, o = {}) {
    return many(target, (el) => {
      if (!finePointer()) return null;
      const c = document.createElement("span");
      c.className = "Catui_fx-cursor"; c.setAttribute("aria-hidden", "true");
      if ((o.type || el.dataset.catuiCursor) === "ring") c.dataset.type = "ring";
      document.body.appendChild(c);
      const move = (e) => { if (reducedMotion()) return; c.style.setProperty("--Catui_fx-cx", `${e.clientX}px`); c.style.setProperty("--Catui_fx-cy", `${e.clientY}px`); c.classList.add("Catui_fx-on"); };
      const leave = () => c.classList.remove("Catui_fx-on");
      const off = pointer(el, move, leave);
      return { destroy() { off(); c.remove(); } };
    });
  }

  const effects = { reveal, split, count, type, scramble, tilt, spotlight, magnet, spark, particles, shiny, gradient, rotate, glitch, border, glare, ripple, marquee, dock, aurora, waves,
    hold, swipe, list: listFx, indicator, flip, check, pulse, press, circle, velocity, focus, stroke, edge, noise, dotgrid, ripplegrid, cursor };
  // data-catui-fx="이름[ 이름…]" 선언형 연결. 돌려준 함수로 모두 해제
  function bind(scope = document) {
    const hs = [];
    scope.querySelectorAll?.("[data-catui-fx]").forEach((el) => {
      if (el.catuiFx) return;
      el.catuiFx = el.dataset.catuiFx.split(/\s+/).filter((n) => effects[n]).map((n) => api[n](el, {
        by: el.dataset.catuiBy, to: el.dataset.catuiTo, delay: Number(el.dataset.catuiDelay) || 0,
      }));
      hs.push(...el.catuiFx);
    });
    return () => hs.forEach((h) => h.destroy());
  }
  const SLOTS = {
    split: ["text"], count: ["text"], type: ["text"], scramble: ["text"], rotate: ["text"], focus: ["text"],
    circle: ["text", "anim"], glitch: ["text", "after"], shiny: ["fill", "anim"], gradient: ["fill", "anim"], stroke: ["fill"],
    pulse: ["anim"], hold: ["after", "click"], indicator: ["after"], marquee: ["children"], velocity: ["children"],
    particles: ["bg"], waves: ["bg"], dotgrid: ["bg"], ripplegrid: ["bg"], ripple: ["click"], spark: ["click"],
  };
  const reg = new WeakMap();
  const guard = (name, fn) => (target, o) => {
    const hs = list(target).map((el) => {
      const m = reg.get(el) || new Map(), mine = SLOTS[name] || [];
      if (m.has(name)) return m.get(name).h;
      const clash = [...m].find(([, v]) => v.slots.some((x) => mine.includes(x)));
      if (clash) { hint.error(`fx: ${name}과 ${clash[0]}는 같은 요소에서 함께 쓸 수 없어 ${name}을 건너뜁니다 (겹치는 자리: ${mine.filter((x) => clash[1].slots.includes(x)).join(", ")})`, "warn", el); return null; }
      const raw = fn(el, o);
      const h = { ...raw, destroy() { raw.destroy(); m.delete(name); } };
      m.set(name, { slots: mine, h }); reg.set(el, m);
      return h;
    }).filter(Boolean);
    return hs.length === 1 ? hs[0] : { destroy() { hs.forEach((h) => h.destroy()); } };
  };
  const api = Object.fromEntries(Object.entries(effects).map(([k, f]) => [k, guard(k, f)]));
  return { ...api, bind };
})();

// ── modules/carousel.js ──

// carousel — CSS 스크롤 스냅 캐러셀(.Catui_carousel)에 이동·순환·자동 넘김·여러 장·가로/세로·끌기·페이드·미리보기를 붙인다.
//   carousel.render({ elem: '#hero', direction: 'horizontal' | 'vertical', autoplay: 5000, loop: true,
//                     perView: { 0: 1, 768: 2, 1200: 3 }, step: 1, align: 'start' | 'center', thumbs: true, change(index) {} })
//   마크업: <div class="Catui_carousel" data-catui-carousel data-catui-direction="vertical" data-catui-autoplay="5000" …>
//   이벤트: carousel.on('change(f)', ({ index, total, atStart, atEnd }) => {})
// 끊김 없는 순환: 양 끝에 복제 슬라이드를 두고, 복제 위치에 닿으면 스크롤이 멈춘 뒤 같은 그림인 진짜 위치로 순간 이동한다(되감기 없음).
// 자동 넘김은 정지 버튼을 함께 그리고, 포커스가 들어오면 멈추며, 모션 줄이기·숨은 탭에서는 넘기지 않는다.

// "1,768:2,1200:3" 또는 { 0: 1, 768: 2 } 또는 숫자 → 지금 폭의 장 수
const catuiPerView = (v, width) => {
  if (v == null || v === "") return 1;
  if (typeof v === "number") return Math.max(1, Math.floor(v));
  const map = typeof v === "string"
    ? Object.fromEntries(String(v).split(",").map((p) => { const [a, b] = p.split(":"); return b == null ? [0, Number(a)] : [Number(a), Number(b)]; }))
    : v;
  let n = 1;
  Object.keys(map).map(Number).sort((a, b) => a - b).forEach((bp) => { if (width >= bp) n = Number(map[bp]) || 1; });
  return Math.max(1, Math.floor(n));
};
const catuiLen = (v) => (v == null || v === "" ? "" : typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v));

const carousel = component({
  name: "carousel",
  config: {
    direction: "horizontal", effect: "slide", loop: true, rewind: false, index: 0,
    perView: null, step: 1, gap: null, align: "start", height: null, autoHeight: false,
    autoplay: 0, pauseOnHover: true, reverse: false, stopOnInteraction: false,
    arrows: true, dots: true, thumbs: false, counter: false, progress: false, drag: true, wheel: false, keyboard: true,
    label: "", slideLabel: "{n} / {total}", before: null, change: null,
  },
  render(inst) {
    const c = inst.config;
    const root = inst.elem;
    if (!root) return;
    const track = root.querySelector(".Catui_carousel-track");
    if (!track) { hint.error("carousel: .Catui_carousel-track이 없습니다"); return; }
    const fade = c.effect === "fade";
    const V = c.direction === "vertical" && !fade;
    const center = c.align === "center" && !fade;
    const step = Math.max(1, Math.floor(Number(c.step)) || 1);
    const real = [...track.children].filter((s) => s.classList.contains("Catui_carousel-slide") && !s.hasAttribute("data-catui-clone"));
    const N = real.length;
    if (!N) return;

    root.setAttribute("role", root.getAttribute("role") || "region");
    root.setAttribute("aria-roledescription", "캐러셀");
    if (c.label) root.setAttribute("aria-label", c.label);
    if (fade) root.classList.add("Catui_carousel-fade");
    if (V) { root.classList.add("Catui_carousel-vertical"); track.setAttribute("aria-orientation", "vertical"); }
    if (c.height) track.style.height = catuiLen(c.height);
    const gapCss = c.gap != null ? catuiLen(c.gap) : "var(--Catui_space-3)";
    if (c.gap != null) track.style.gap = gapCss;
    real.forEach((s, i) => {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "슬라이드");
      s.setAttribute("aria-label", String(c.slideLabel).replace("{n}", i + 1).replace("{total}", N));
      s.style.scrollSnapAlign = center ? "center" : "";
    });

    const auto = Number(c.autoplay) > 0 && !reducedMotion();
    let P = 1, K = 0, index = 0;               // P 한 화면 장 수 · K 앞뒤 복제 수 · index 진짜 슬라이드 번호
    const loopOn = () => !fade && c.loop && N > (center ? 1 : P);
    const maxIndex = () => (loopOn() || center || fade ? N - 1 : Math.max(0, N - P));
    index = Math.min(Math.max(0, Number(c.index) || 0), N - 1);

    // ── 축(가로/세로) ──
    const startOf = (s) => (V ? s.offsetTop - track.offsetTop : s.offsetLeft - track.offsetLeft);
    const sizeOf = (s) => (V ? s.offsetHeight : s.offsetWidth);
    const trackSize = () => (V ? track.clientHeight : track.clientWidth);
    const snapOf = (s) => (center ? startOf(s) - (trackSize() - sizeOf(s)) / 2 : startOf(s));
    const curPos = () => (V ? track.scrollTop : track.scrollLeft);
    const scrollToPos = (p, behavior) => track.scrollTo(V ? { top: p, behavior } : { left: p, behavior });
    const all = () => [...track.children].filter((s) => s.classList.contains("Catui_carousel-slide"));
    const physical = (i) => all()[i + K];
    const nearest = () => { const p = curPos(); let best = 0, dist = Infinity; all().forEach((s, k) => { const d = Math.abs(snapOf(s) - p); if (d < dist) { dist = d; best = k; } }); return best; };
    const jump = (i) => { const s = physical(i); if (s) scrollToPos(snapOf(s), "instant"); };

    // ── 탐색 줄: 기존 <nav class="Catui_carousel-nav">(점 링크)가 있으면 점은 그대로 쓰고 버튼만 더한다 ──
    let nav = root.querySelector(":scope > .Catui_carousel-nav");
    const madeNav = !nav;
    if (madeNav) {
      nav = document.createElement("div");
      nav.className = "Catui_carousel-nav";
      nav.setAttribute("role", "group");
      nav.setAttribute("aria-label", "슬라이드 이동");
      root.appendChild(nav);
    }
    const added = [];
    const addNav = (where, markup, parent = nav) => { const t = document.createElement("template"); t.innerHTML = markup.__raw; const n = t.content.firstElementChild; parent.insertAdjacentElement(where, n); added.push(n); return n; };
    const prevIcon = V ? "chevron-up" : "chevron-left", nextIcon = V ? "chevron-down" : "chevron-right";
    const prevBtn = c.arrows ? addNav("afterbegin", html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-car="prev" aria-label="이전 슬라이드">${icon(prevIcon, 16)}</button>`) : null;
    const dotBox = madeNav && c.dots ? addNav("beforeend", html`<span style="display:inline-flex;align-items:center;gap:var(--Catui_space-2)"></span>`) : null;
    const nextBtn = c.arrows ? addNav("beforeend", html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-car="next" aria-label="다음 슬라이드">${icon(nextIcon, 16)}</button>`) : null;
    const countEl = c.counter ? addNav("beforeend", html`<span class="Catui_help Catui_num" aria-hidden="true"></span>`) : null;
    const playBtn = auto ? addNav("beforeend", html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-car="play" aria-label="자동 넘김 정지">${icon("pause", 16)}</button>`) : null;
    const bar = auto && c.progress ? (() => { const b = document.createElement("span"); b.className = "Catui_prog Catui_prog-sm"; b.setAttribute("aria-hidden", "true"); b.innerHTML = '<i class="Catui_pc1" style="width:0%"></i>'; root.insertBefore(b, nav); added.push(b); return b.firstElementChild; })() : null;
    // 미리보기 줄: 슬라이드의 data-catui-thumb 또는 첫 이미지
    const thumbs = c.thumbs ? (() => {
      const box = document.createElement("div");
      box.className = "Catui_carousel-thumbs";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", "슬라이드 미리보기");
      mount(box, html`${real.map((s, i) => { const img = s.querySelector("img"); const src = s.getAttribute("data-catui-thumb") || img?.getAttribute("src") || img?.getAttribute("data-catui-src") || ""; return html`<button class="Catui_carousel-thumb" type="button" data-catui-car-thumb="${i}" aria-label="${i + 1}번 슬라이드${img?.alt ? `: ${img.alt}` : ""}">${src ? html`<img src="${src}" alt="">` : i + 1}</button>`; })}`);
      root.insertBefore(box, nav);
      added.push(box);
      return box;
    })() : null;
    track.setAttribute("aria-live", auto ? "off" : "polite");

    // ── 배치: 장 수·복제 만들기 (폭이 바뀌어 장 수가 달라지면 다시) ──
    const clone = (s) => {
      const n = s.cloneNode(true);
      n.setAttribute("data-catui-clone", "");
      n.setAttribute("aria-hidden", "true");
      n.inert = true;                                   // 복제는 키보드·화면 낭독기에서 빠진다
      n.removeAttribute("id"); n.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
      return n;
    };
    const drawDots = () => {
      if (!dotBox) { nav.querySelectorAll(".Catui_carousel-dot").forEach((d, i) => d.setAttribute("data-catui-car-dot", String(i))); return; }
      mount(dotBox, html`${Array.from({ length: maxIndex() + 1 }, (_, i) => html`<button class="Catui_carousel-dot" type="button" data-catui-car-dot="${i}" aria-label="${i + 1}번 슬라이드${P > 1 && !center ? "부터 보기" : ""}"></button>`)}`);
    };
    const layout = () => {
      track.querySelectorAll(":scope > [data-catui-clone]").forEach((n) => n.remove());
      P = fade ? 1 : catuiPerView(c.perView, root.clientWidth || innerWidth);
      const basis = c.perView != null && !fade ? `calc((100% - ${P - 1} * ${gapCss}) / ${P})` : "";
      real.forEach((s) => { s.style.flexBasis = basis; });
      K = loopOn() ? Math.min(N, Math.max(P, step) + (center ? 1 : 0)) : 0;
      if (K) {
        real.slice(-K).map(clone).forEach((n) => track.insertBefore(n, real[0]));
        real.slice(0, K).map(clone).forEach((n) => track.appendChild(n));
      }
      index = Math.min(index, maxIndex());
      drawDots();
      if (!fade) jump(index);
      mark();
    };

    const mark = () => {
      nav.querySelectorAll("[data-catui-car-dot]").forEach((d) => { if (Number(d.dataset.catuiCarDot) === index) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      const bounded = !(fade ? c.loop : loopOn()) && !c.rewind;
      if (prevBtn) prevBtn.disabled = bounded && index === 0;
      if (nextBtn) nextBtn.disabled = bounded && index >= maxIndex();
      if (countEl) countEl.textContent = `${index + 1} / ${N}`;
      real.forEach((s, i) => { const on = center ? i === index : i >= index && i < index + P; if (on) s.setAttribute("data-catui-active", ""); else s.removeAttribute("data-catui-active"); });
      if (thumbs) {
        thumbs.querySelectorAll("[data-catui-car-thumb]").forEach((b) => { const on = Number(b.dataset.catuiCarThumb) === index; if (on) { b.setAttribute("aria-current", "true"); thumbs.scrollTo({ left: b.offsetLeft - thumbs.offsetLeft - (thumbs.clientWidth - b.offsetWidth) / 2, behavior: reducedMotion() ? "instant" : "smooth" }); } else b.removeAttribute("aria-current"); });
      }
      // 내용 높이 맞추기 (가로 · 슬라이드마다 높이가 다를 때)
      if (c.autoHeight && !V && !fade) {
        track.style.alignItems = "flex-start";
        track.style.transition = reducedMotion() ? "" : "height calc(var(--Catui_dur-fast) * 2) var(--Catui_ease)";
        const vis = real.filter((s) => s.hasAttribute("data-catui-active"));
        const h = Math.max(...vis.map((s) => s.scrollHeight), 0);
        if (h) track.style.height = `${h}px`;
      }
    };
    const changed = (prev) => {
      if (prev === index) return;
      mark(); restartBar();
      c.change?.call(inst, index);
      inst.emit("change", { index, total: N, atStart: index === 0, atEnd: index >= maxIndex() });
    };

    // user: 사용자가 직접 넘겼는지 (stopOnInteraction·before 검사용)
    const go = (i, smooth = true, user = false) => {
      if (!fade && !loopOn() && c.rewind) { if (i > maxIndex()) i = 0; else if (i < 0) i = maxIndex(); }   // 끝에서 처음으로 되감기
      const wrap = (x) => ((x % N) + N) % N;
      const to = fade ? (c.loop || c.rewind ? wrap(i) : Math.min(Math.max(0, i), N - 1)) : loopOn() ? wrap(i) : Math.min(Math.max(0, i), maxIndex());
      if (to !== index && c.before && c.before.call(inst, index, to) === false) return;   // before가 false면 이동 취소
      if (user && auto && c.stopOnInteraction && !paused) setPaused(true);
      const prev = index;
      if (fade) { index = to; changed(prev); return; }
      // 아직 복제 위치에 있으면(순환 직후 연달아 누름) 같은 그림인 진짜 위치로 먼저 옮겨 되감기를 막는다
      if (loopOn()) {
        const b = nearest(), lg = b - K;
        if (lg < 0 || lg >= N) { const delta = curPos() - snapOf(all()[b]); scrollToPos(snapOf(physical(wrap(lg))) + delta, "instant"); }
      }
      const target = loopOn() ? i : to;   // 순환이면 -1·N 같은 복제 위치로 먼저 간다
      const s = physical(target);
      if (!s) return;
      const instant = !smooth || reducedMotion();
      scrollToPos(snapOf(s), instant ? "instant" : "smooth");
      index = to;
      changed(prev);
      if (instant) settle();
    };
    // 스크롤이 멈추면: 가장 가까운 슬라이드를 현재로, 복제 위치면 진짜 위치로 순간 이동
    const settle = () => {
      if (fade || dragging) return;
      let logical = nearest() - K;
      if (loopOn() && (logical < 0 || logical >= N)) { logical = ((logical % N) + N) % N; jump(logical); }
      const prev = index;
      index = Math.min(Math.max(0, logical), maxIndex());
      changed(prev);
    };
    let st = 0;
    const onScroll = () => { clearTimeout(st); st = setTimeout(settle, 110); };
    const onScrollEnd = () => { clearTimeout(st); settle(); };

    // ── 마우스 끌기 (터치·트랙패드는 브라우저 스크롤이 처리) / 페이드는 손가락 밀기 ──
    let dragging = false, s0 = 0, p0 = 0, moved = 0;
    const axis = (e) => (V ? e.clientY : e.clientX);
    const onDown = (e) => {
      if (!c.drag || e.button !== 0 || e.target.closest("button, a[href], input, select, textarea")) return;
      if (!fade && e.pointerType !== "mouse") return;
      dragging = true; s0 = axis(e); p0 = curPos(); moved = 0;
      if (!fade) { track.style.scrollSnapType = "none"; track.style.scrollBehavior = "auto"; }
      track.setPointerCapture?.(e.pointerId);
    };
    const onMovePtr = (e) => { if (!dragging) return; moved = axis(e) - s0; if (!fade) { if (V) track.scrollTop = p0 - moved; else track.scrollLeft = p0 - moved; } };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (!fade) { track.style.scrollSnapType = ""; track.style.scrollBehavior = ""; }
      if (Math.abs(moved) > 40) go(index + (moved < 0 ? step : -step), true, true); else if (!fade) go(index);
    };
    const onClickCapture = (e) => { if (Math.abs(moved) > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } };   // 끌고 놓을 때 링크가 눌리지 않게

    // ── 휠: wheel 옵션이면 한 번에 한 장씩 (끝에서는 페이지 스크롤로 넘김) ──
    let wheelAt = 0;
    const onWheel = (e) => {
      if (!c.wheel) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 8) return;
      const dir = d > 0 ? 1 : -1;
      const bounded = !(fade ? c.loop : loopOn()) && !c.rewind;
      if (bounded && ((dir < 0 && index === 0) || (dir > 0 && index >= maxIndex()))) return;
      e.preventDefault();
      const now = Date.now();
      if (now - wheelAt < 450) return;   // 트랙패드 관성으로 여러 장 넘어가지 않게
      wheelAt = now;
      go(index + dir * step, true, true);
    };

    // ── 자동 넘김 ──
    let timer = 0, paused = !auto, hold = false, focusHold = false;
    const running = () => !paused && !hold && !focusHold && !document.hidden;
    function restartBar() {
      if (!bar) return;
      bar.style.transition = "none"; bar.style.width = "0%";
      if (!running()) return;
      void bar.offsetWidth;   // 다시 0에서 시작하도록 강제 배치
      bar.style.transition = `width ${Number(c.autoplay)}ms linear`; bar.style.width = "100%";
    }
    const tick = () => { clearInterval(timer); timer = 0; if (running()) timer = setInterval(() => go(index + (c.reverse ? -step : step)), Number(c.autoplay)); restartBar(); };
    function setPaused(on) {
      paused = on;
      if (playBtn) { mount(playBtn, icon(on ? "play" : "pause", 16)); playBtn.setAttribute("aria-label", on ? "자동 넘김 시작" : "자동 넘김 정지"); }
      track.setAttribute("aria-live", on ? "polite" : "off");
      tick();
    }
    const onEnter = () => { if (c.pauseOnHover) { hold = true; tick(); } };
    const onLeave = () => { hold = false; tick(); };
    // 키보드 포커스가 안에 있으면 항상 멈춤 (읽는 중에 바뀌지 않게)
    const onFocusIn = () => { focusHold = true; tick(); };
    const onFocusOut = (e) => { if (root.contains(e.relatedTarget)) return; focusHold = false; tick(); };
    const onVis = () => tick();

    const onClick = (e) => {
      const dot = e.target.closest("[data-catui-car-dot], [data-catui-car-thumb]");
      if (dot) { e.preventDefault(); go(Number(dot.dataset.catuiCarDot ?? dot.dataset.catuiCarThumb), true, true); return; }   // 점 링크(#id)는 페이지 점프 대신 트랙만 이동
      const b = e.target.closest("[data-catui-car]");
      if (!b) return;
      if (b.dataset.catuiCar === "play") { setPaused(!paused); return; }
      go(index + (b.dataset.catuiCar === "next" ? step : -step), true, true);
    };
    const onKey = (e) => {
      if (!c.keyboard || e.target.closest("input, textarea, select, [contenteditable=true]")) return;
      const prevKey = V ? "ArrowUp" : "ArrowLeft", nextKey = V ? "ArrowDown" : "ArrowRight";
      if (e.key === nextKey) { e.preventDefault(); go(index + step, true, true); }
      else if (e.key === prevKey) { e.preventDefault(); go(index - step, true, true); }
      else if (e.key === "Home") { e.preventDefault(); go(0, true, true); }
      else if (e.key === "End") { e.preventDefault(); go(maxIndex(), true, true); }
    };
    let lastW = 0, lastH = 0;
    const ro = new ResizeObserver(() => { const w = root.clientWidth, h = track.clientHeight; if (Math.abs(w - lastW) < 1 && Math.abs(h - lastH) < 1) return; lastW = w; lastH = h; layout(); });

    root.addEventListener("click", onClick);
    track.addEventListener("click", onClickCapture, true);
    root.addEventListener("keydown", onKey);
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("scrollend", onScrollEnd);
    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMovePtr);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    track.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVis);
    if (!track.hasAttribute("tabindex")) track.tabIndex = 0;   // 키보드로 트랙에 들어와 방향키로 넘길 수 있게
    layout();
    lastW = root.clientWidth; lastH = track.clientHeight;
    ro.observe(root);
    // 이미지가 늦게 로드돼 높이가 바뀌면 autoHeight 다시 맞춤
    const onImg = () => { if (c.autoHeight) mark(); };
    track.addEventListener("load", onImg, true);
    tick();

    inst.go = (i, smooth = true) => go(Number(i), smooth);
    inst.next = () => go(index + step);
    inst.prev = () => go(index - step);
    inst.pause = () => setPaused(true);
    inst.play = () => setPaused(false);
    inst.isPaused = () => paused;
    inst.getIndex = () => index;
    inst.getTotal = () => N;
    inst.update = () => inst.reload();          // 슬라이드를 넣거나 뺀 뒤 다시 배치
    inst.use(() => {
      clearInterval(timer); clearTimeout(st); ro.disconnect();
      root.removeEventListener("click", onClick);
      track.removeEventListener("click", onClickCapture, true);
      root.removeEventListener("keydown", onKey);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("scrollend", onScrollEnd);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMovePtr);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("load", onImg, true);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVis);
      track.querySelectorAll(":scope > [data-catui-clone]").forEach((n) => n.remove());
      real.forEach((s) => { s.style.flexBasis = ""; s.style.scrollSnapAlign = ""; s.removeAttribute("data-catui-active"); });
      ["height", "gap", "alignItems", "transition"].forEach((k) => { track.style[k] = ""; });
      track.removeAttribute("aria-orientation");
      if (madeNav) nav.remove(); else added.forEach((n) => n.remove());
      if (madeNav) added.filter((n) => !nav.contains(n)).forEach((n) => n.remove());
      root.classList.remove("Catui_carousel-fade", "Catui_carousel-vertical");
    });
  },
  go(id, i) { carousel.getThis(id)?.go(i); },
  // 선언형: [data-catui-carousel] + data-catui-direction · autoplay · loop · rewind · per-view · step · gap · align · height
  //         · effect · thumbs · counter · progress · auto-height · wheel · reverse · stop-on-interaction · pause-on-hover="false"
  enhance(scope = document) {
    scope.querySelectorAll(".Catui_carousel[data-catui-carousel]:not([data-catui-ready])").forEach((el) => {
      el.setAttribute("data-catui-ready", "");
      const a = (k) => el.getAttribute(`data-catui-${k}`);
      const has = (k) => el.hasAttribute(`data-catui-${k}`) && a(k) !== "false";
      try {
        carousel.render({
          elem: el, auto: true,
          direction: a("direction") || "horizontal", effect: a("effect") || "slide",
          autoplay: Number(a("autoplay")) || 0, loop: a("loop") !== "false", rewind: has("rewind"),
          perView: a("per-view") || null, step: Number(a("step")) || 1, gap: a("gap"), align: a("align") || "start", height: a("height"),
          thumbs: has("thumbs"), counter: has("counter"), progress: has("progress"), autoHeight: has("auto-height"), wheel: has("wheel"),
          reverse: has("reverse"), stopOnInteraction: has("stop-on-interaction"), pauseOnHover: a("pause-on-hover") !== "false",
          dots: a("dots") !== "false", arrows: a("arrows") !== "false",
        });
      } catch (err) { el.removeAttribute("data-catui-ready"); hint.error("carousel 연결 실패", "error", err, el); }
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── modules/field.js ──

// field — 입력 보강 묶음. 각각 render/reload/destroy/on을 갖는 컴포넌트다.
//   field.tags.render({ elem: 'input', max: 5, value: ['디자인'], change(list) {} })      · 마크업 <input data-catui-tags data-catui-max="5">
//   field.stepper.render({ elem, min: 1, max: 9, step: 1, value: 1, name: 'qty' })     · 마크업 <div class="Catui_stepper" data-catui-stepper data-catui-min="1">
//   field.counter.render({ elem: 'textarea', max: 240 })                               · 마크업 <textarea maxlength="240" data-catui-counter>
//   field.otp.render({ elem: 'fieldset.Catui_otp', complete(code) {} })                · 마크업 <fieldset class="Catui_otp" data-catui-otp>
// 폼으로 보낼 값은 숨은 input(name)에 담아 form.val·FormData로 그대로 읽힌다.

const catuiNum = (v, d) => (v === "" || v == null || Number.isNaN(Number(v)) ? d : Number(v));
// 스크린리더에 짧게 알리는 숨은 영역 (컴포넌트 옆에 하나)
const catuiLive = (host) => {
  const p = document.createElement("p");
  p.className = "Catui_clip";
  p.setAttribute("aria-live", "polite");
  host.insertAdjacentElement("afterend", p);
  return p;
};

// ── 태그 입력 ──
const catuiFieldTags = component({
  name: "tags",
  config: { max: 0, value: [], duplicate: false, maxLength: 30, separator: ",", name: "", label: "", change: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!(input instanceof HTMLInputElement)) return;
    const list = (inst.list = [...new Set([].concat(c.value || []).map((t) => String(t).trim()).filter(Boolean))]);
    // 폼 값: 원래 name은 숨은 input으로 옮기고(쉼표로 이은 값) 입력 칸은 이름 없이 둔다
    const name = c.name || input.name;
    const hidden = name ? Object.assign(document.createElement("input"), { type: "hidden", name }) : null;
    if (name) input.removeAttribute("name");
    const box = document.createElement("div");
    box.className = "Catui_tags";
    box.setAttribute("role", "list");
    box.setAttribute("aria-label", c.label || `${input.labels?.[0]?.textContent.trim() || "태그"} 목록`);
    input.insertAdjacentElement("beforebegin", box);
    if (hidden) box.insertAdjacentElement("afterend", hidden);
    const live = catuiLive(input);
    const limitText = () => (c.max ? `${list.length}/${c.max}개` : "");
    const draw = () => {
      mount(box, html`${list.map((t, i) => html`<span class="Catui_tag" role="listitem">${t} <button type="button" data-catui-tag-del="${i}" aria-label="${t} 태그 제거">${icon("x", 12)}</button></span>`)}${c.max ? html`<span class="Catui_tag Catui_tag-limit" role="listitem">${limitText()}</span>` : ""}`);
      if (hidden) hidden.value = list.join(c.separator);
      input.placeholder = c.max && list.length >= c.max ? `최대 ${c.max}개` : (inst.placeholder ?? (inst.placeholder = input.placeholder));
    };
    const changed = (msg) => { draw(); live.textContent = msg; c.change?.call(inst, [...list]); inst.emit("change", { value: [...list], elem: input }); };
    const add = (raw) => {
      const words = String(raw).split(c.separator).map((t) => t.trim().slice(0, c.maxLength)).filter(Boolean);
      const added = [], refused = [];
      for (const w of words) {
        if (c.max && list.length >= c.max) { refused.push(`최대 ${c.max}개까지 넣을 수 있습니다`); break; }
        if (!c.duplicate && list.some((t) => t.toLowerCase() === w.toLowerCase())) { refused.push(`'${w}'은(는) 이미 있습니다`); continue; }
        list.push(w); added.push(w);
      }
      if (added.length) changed(`${added.join(", ")} 추가됨. ${limitText()}`);
      else if (refused.length) live.textContent = refused[0];
      return added.length > 0;
    };
    const remove = (i, focusNext) => {
      const [t] = list.splice(i, 1);
      if (t == null) return;
      changed(`${t} 제거됨. ${limitText()}`);
      // 지운 자리 다음 태그의 제거 버튼(없으면 입력 칸)으로 포커스
      (focusNext && box.querySelector(`[data-catui-tag-del="${Math.min(i, list.length - 1)}"]`) || input).focus();
    };
    const onKey = (e) => {
      if (imeBusy(e)) return;   // 한글 조합 중 Enter는 글자 확정
      if (e.key === "Enter" || (e.key === c.separator && c.separator.length === 1)) {
        if (!input.value.trim()) { if (e.key === "Enter" && input.form) return; e.preventDefault(); return; }   // 빈 칸 Enter는 폼 제출 허용
        e.preventDefault();
        if (add(input.value)) input.value = "";
      } else if (e.key === "Backspace" && !input.value && list.length) {
        e.preventDefault();
        remove(list.length - 1, false);
      }
    };
    const onPaste = (e) => {
      const text = e.clipboardData?.getData("text") || "";
      if (!text.includes(c.separator) && !text.includes("\n")) return;
      e.preventDefault();
      add(text.replace(/\r?\n/g, c.separator));
    };
    const onBlur = () => { if (input.value.trim() && add(input.value)) input.value = ""; };   // 칸을 벗어나면 남은 글자도 태그로
    const onBox = (e) => { const b = e.target.closest("[data-catui-tag-del]"); if (b) remove(Number(b.dataset.catuiTagDel), true); };
    input.addEventListener("keydown", onKey);
    input.addEventListener("paste", onPaste);
    input.addEventListener("blur", onBlur);
    box.addEventListener("click", onBox);
    draw();
    inst.add = (t) => add(t);
    inst.remove = (t) => { const i = typeof t === "number" ? t : list.indexOf(String(t)); if (i >= 0) remove(i, false); };
    inst.getValue = () => [...list];
    inst.setValue = (v) => { list.splice(0, list.length, ...new Set([].concat(v || []).map(String).filter(Boolean))); draw(); };
    inst.use(() => {
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("paste", onPaste);
      input.removeEventListener("blur", onBlur);
      box.remove(); live.remove(); hidden?.remove();
      if (name) input.name = name;
      if (inst.placeholder != null) input.placeholder = inst.placeholder;
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 수량 증감 ──
const catuiFieldStepper = component({
  name: "stepper",
  config: { min: 0, max: Infinity, step: 1, value: null, name: "", label: "", unit: "", change: null },
  render(inst) {
    const c = inst.config;
    const host = inst.elem;
    if (!host) return;
    host.classList.add("Catui_stepper");
    host.setAttribute("role", "group");
    if (c.label && !host.hasAttribute("aria-labelledby")) host.setAttribute("aria-label", c.label);
    let dec = host.querySelector("button:first-child"), out = host.querySelector("output"), inc = host.querySelector("button:last-child");
    const made = !(dec && out && inc && dec !== inc);
    if (made) {
      mount(host, html`<button type="button" aria-label="감소">${icon("minus", 16)}</button><output aria-live="polite"></output><button type="button" aria-label="증가">${icon("plus", 16)}</button>`);
      [dec, out, inc] = [host.firstElementChild, host.querySelector("output"), host.lastElementChild];
    }
    out.setAttribute("aria-live", "polite");
    const min = catuiNum(c.min, 0), max = catuiNum(c.max, Infinity), step = catuiNum(c.step, 1) > 0 ? catuiNum(c.step, 1) : 1;
    // 소수 단계(0.1)에서 0.30000000000000004 같은 값이 나오지 않게 단계의 소수 자릿수로 반올림
    const digits = (String(step).split(".")[1] || "").length;
    const fix = (v) => Number(Math.min(max, Math.max(min, v)).toFixed(digits));
    let value = fix(catuiNum(c.value, catuiNum(out.textContent.trim(), min)));
    const hidden = c.name ? Object.assign(document.createElement("input"), { type: "hidden", name: c.name }) : null;
    if (hidden) host.appendChild(hidden);
    const draw = () => {
      out.textContent = `${value}${c.unit}`;
      dec.disabled = value <= min;
      inc.disabled = value >= max;
      if (hidden) hidden.value = String(value);
    };
    const set = (v, fire = true) => {
      const next = fix(v);
      if (next === value) { draw(); return; }
      value = next; draw();
      if (fire) { c.change?.call(inst, value); inst.emit("change", { value, elem: host }); }
    };
    // 길게 누르면 반복 (0.4초 뒤부터 0.08초 간격)
    let hold = 0, rep = 0;
    const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = 0; };
    const onDown = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled || e.button) return;
      const d = b === inc ? step : -step;
      hold = setTimeout(() => { rep = setInterval(() => { set(value + d); if ((d > 0 && value >= max) || (d < 0 && value <= min)) stop(); }, 80); }, 400);
    };
    const onClick = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (rep) { stop(); return; }   // 길게 눌러 반복했으면 마지막 click은 무시
      stop();
      set(value + (b === inc ? step : -step));
      if (b.disabled) (b === inc ? dec : inc).focus();   // 경계에 닿아 버튼이 잠기면 반대 버튼으로 포커스
    };
    const onKey = (e) => {
      const d = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key];
      if (d != null) { e.preventDefault(); set(value + d); }
      else if (e.key === "Home" && Number.isFinite(min)) { e.preventDefault(); set(min); }
      else if (e.key === "End" && Number.isFinite(max)) { e.preventDefault(); set(max); }
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerup", stop);
    host.addEventListener("pointerleave", stop);
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);
    draw();
    inst.getValue = () => value;
    inst.setValue = (v) => set(Number(v), false);
    inst.use(() => {
      stop();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", stop);
      host.removeEventListener("pointerleave", stop);
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
      hidden?.remove();
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 글자 수 ──
const catuiFieldCounter = component({
  name: "counter",
  config: { max: 0, warn: 0.85, target: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!input || !("value" in input)) return;
    const max = catuiNum(c.max, 0) || catuiNum(input.getAttribute("maxlength"), 0);
    if (!max) return;
    // 표시 요소: 지정 → aria-describedby 안의 .Catui_counter → 새로 만들기
    // 빈 id("")는 거른다 — "".classList가 undefined라 contains에서 오류가 났었다
    let out = el(c.target) || (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).find((n) => n?.classList.contains("Catui_counter"));
    const made = !out;
    if (made) {
      out = Object.assign(document.createElement("p"), { className: "Catui_counter", id: uid("catui-cnt") });
      input.insertAdjacentElement("afterend", out);
      input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), out.id].filter(Boolean).join(" "));
    }
    out.setAttribute("aria-live", "polite");
    let lastBand = "";
    const draw = () => {
      const n = input.value.length, over = n - max;
      out.classList.toggle("Catui_counter-warn", over <= 0 && n >= max * c.warn);
      out.classList.toggle("Catui_counter-over", over > 0);
      out.textContent = over > 0 ? `${n}/${max} — ${over}자 초과` : `${n}/${max}`;
      if (over > 0) input.setAttribute("aria-invalid", "true"); else if (input.getAttribute("aria-invalid") === "true" && lastBand === "over") input.removeAttribute("aria-invalid");
      // 매 글자마다 읽지 않도록, 경고·초과 구간에 들어설 때만 읽힌다
      const band = over > 0 ? "over" : n >= max * c.warn ? "warn" : "ok";
      out.setAttribute("aria-live", band !== lastBand && band !== "ok" ? "polite" : "off");
      lastBand = band;
    };
    input.addEventListener("input", draw);
    draw();
    inst.refresh = draw;
    inst.use(() => { input.removeEventListener("input", draw); if (made) { out.remove(); input.setAttribute("aria-describedby", (input.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== out.id).join(" ")); } });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 인증 코드 칸 ──
const catuiFieldOtp = component({
  name: "otp",
  config: { pattern: "\\d", name: "", complete: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box) return;
    const cells = [...box.querySelectorAll("input")];
    if (!cells.length) return;
    const ok = new RegExp(`^${c.pattern}$`);
    cells.forEach((x, i) => {
      x.maxLength = 1;
      x.autocomplete = i === 0 ? "one-time-code" : "off";
      if (!x.getAttribute("aria-label")) x.setAttribute("aria-label", `${i + 1}번째 글자`);
    });
    const hidden = c.name ? Object.assign(document.createElement("input"), { type: "hidden", name: c.name }) : null;
    if (hidden) box.appendChild(hidden);
    const code = () => cells.map((x) => x.value).join("");
    const sync = () => {
      if (hidden) hidden.value = code();
      if (code().length === cells.length) { c.complete?.call(inst, code()); inst.emit("complete", { value: code(), elem: box }); }
    };
    // 여러 글자(붙여넣기·휴대폰 코드 자동 채움)를 지금 칸부터 나눠 담는다
    const spread = (from, text) => {
      const chars = [...text].filter((ch) => ok.test(ch));
      if (!chars.length) return false;
      chars.slice(0, cells.length - from).forEach((ch, k) => { cells[from + k].value = ch; });
      cells[Math.min(cells.length - 1, from + chars.length)]?.focus();
      sync();
      return true;
    };
    const onInput = (e) => {
      const x = e.target, i = cells.indexOf(x);
      if (i < 0) return;
      if (x.value.length > 1) { const v = x.value; x.value = ""; spread(i, v); return; }
      if (x.value && !ok.test(x.value)) { x.value = ""; return; }
      if (x.value) { cells[i + 1]?.focus(); cells[i + 1]?.select?.(); sync(); }
      else if (hidden) hidden.value = code();
    };
    const onKey = (e) => {
      const i = cells.indexOf(e.target);
      if (i < 0) return;
      if (e.key === "Backspace" && !e.target.value && i > 0) { e.preventDefault(); cells[i - 1].value = ""; cells[i - 1].focus(); if (hidden) hidden.value = code(); }
      else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); cells[i - 1].focus(); }
      else if (e.key === "ArrowRight" && i < cells.length - 1) { e.preventDefault(); cells[i + 1].focus(); }
    };
    const onPaste = (e) => { const i = cells.indexOf(e.target); if (i >= 0 && spread(i, e.clipboardData?.getData("text") || "")) e.preventDefault(); };
    const onFocus = (e) => { if (cells.includes(e.target)) e.target.select?.(); };
    box.addEventListener("input", onInput);
    box.addEventListener("keydown", onKey);
    box.addEventListener("paste", onPaste);
    box.addEventListener("focusin", onFocus);
    inst.getValue = code;
    inst.clear = () => { cells.forEach((x) => { x.value = ""; x.removeAttribute("aria-invalid"); }); cells[0].focus(); if (hidden) hidden.value = ""; };
    // 서버에서 틀렸다고 하면: 칸을 오류로 표시하고 첫 칸부터 다시
    inst.setError = (on = true) => { cells.forEach((x) => (on ? x.setAttribute("aria-invalid", "true") : x.removeAttribute("aria-invalid"))); if (on) cells[0].focus(); };
    inst.use(() => {
      box.removeEventListener("input", onInput);
      box.removeEventListener("keydown", onKey);
      box.removeEventListener("paste", onPaste);
      box.removeEventListener("focusin", onFocus);
      hidden?.remove();
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

const catuiFieldParts = [catuiFieldTags, catuiFieldStepper, catuiFieldCounter, catuiFieldOtp];
const field = {
  tags: catuiFieldTags,
  stepper: catuiFieldStepper,
  counter: catuiFieldCounter,
  otp: catuiFieldOtp,
  // 선언형 마크업 준비 (catui.init에서 호출)
  enhance(scope = document) {
    // 한 요소가 실패해도 나머지(다른 칸·다른 종류)는 계속 연결한다
    const each = (sel, fn) => scope.querySelectorAll(`${sel}:not([data-catui-ready])`).forEach((n) => {
      n.setAttribute("data-catui-ready", "");
      try { fn(n); } catch (err) { n.removeAttribute("data-catui-ready"); hint.error(`field: ${sel} 연결 실패`, "error", err, n); }
    });
    const a = (n, k) => n.getAttribute(`data-catui-${k}`);
    each("input[data-catui-tags]", (n) => catuiFieldTags.render({ elem: n, auto: true, max: catuiNum(a(n, "max"), 0), value: (a(n, "tags") || n.value || "").split(",").filter(Boolean) }));
    each("[data-catui-stepper]", (n) => catuiFieldStepper.render({ elem: n, auto: true, min: catuiNum(a(n, "min"), 0), max: catuiNum(a(n, "max"), Infinity), step: catuiNum(a(n, "step"), 1), value: a(n, "value"), name: a(n, "name") || "", unit: a(n, "unit") || "" }));
    each("[data-catui-counter]", (n) => catuiFieldCounter.render({ elem: n, auto: true, max: catuiNum(a(n, "counter"), 0) }));
    each("[data-catui-otp]", (n) => catuiFieldOtp.render({ elem: n, auto: true, name: a(n, "name") || "", pattern: a(n, "otp") === "alnum" ? "[A-Za-z0-9]" : "\\d" }));
  },
  destroyAll() { catuiFieldParts.forEach((p) => p.destroyAll()); },
  destroyDetached() { catuiFieldParts.forEach((p) => p.destroyDetached()); },
};

// ── modules/autocomplete.js ──

// autocomplete — 입력 자동완성 (WAI-ARIA combobox + listbox).
//   autocomplete.render({ elem: '#city', data: ['서울', '부산', …] })
//   autocomplete.render({ elem: '#user', data: async (q, signal) => (await fetch(`/api/users?q=${encodeURIComponent(q)}`, { signal })).json(),
//                         minLength: 1, delay: 200, limit: 8, select(item) {} })
//   항목: 문자열 또는 { value, label, desc, disabled } — value가 입력에 들어가고 label을 보여 준다(없으면 value).
//   이벤트: autocomplete.on('select(f)', ({ item, value }) => {})
// 한글은 조합 중에도 후보를 갱신하고, 조합 중 Enter는 선택하지 않는다. 늦게 온 이전 요청 결과는 버린다.
const autocomplete = component({
  name: "autocomplete",
  config: { data: [], minLength: 1, delay: 150, limit: 8, highlight: true, empty: "결과가 없습니다.", loadingText: "찾는 중…", openOnFocus: false, select: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!(input instanceof HTMLInputElement)) return;
    const listId = uid("catui-ac");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.autocomplete = "off";
    let panel = null, items = [], active = -1, timer = 0, ctrl = null, seq = 0;

    const norm = (it) => (typeof it === "object" && it !== null ? { ...it, value: String(it.value ?? it.label ?? ""), label: String(it.label ?? it.value ?? "") } : { value: String(it), label: String(it) });
    // 검색어와 같은 부분을 굵게 (escape는 html``이 처리)
    const mark = (label, q) => {
      const i = c.highlight && q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
      return i < 0 ? label : html`${label.slice(0, i)}<b>${label.slice(i, i + q.length)}</b>${label.slice(i + q.length)}`;
    };
    const place = () => {
      const r = input.getBoundingClientRect();
      panel.style.minWidth = `${Math.round(r.width)}px`;
      const p = panel.getBoundingClientRect();
      const up = innerHeight - r.bottom < p.height + 8 && r.top > p.height + 8;
      panel.style.top = `${Math.round(up ? r.top - p.height - 4 : r.bottom + 4)}px`;
      panel.style.left = `${Math.round(Math.min(Math.max(8, r.left), innerWidth - p.width - 8))}px`;
    };
    const onMove = () => panel && place();
    const ensure = () => {
      if (panel) return;
      panel = document.createElement("div");
      panel.id = listId;
      panel.className = "Catui_dd-menu Catui_dd-float";
      panel.setAttribute("role", "listbox");
      panel.setAttribute("aria-label", `${input.labels?.[0]?.textContent.trim() || "추천"} 목록`);
      panel.style.maxHeight = "min(320px, 50vh)";
      panel.style.overflowY = "auto";
      layerRoot().appendChild(panel);
      // 목록을 누를 때 입력 칸이 포커스를 잃어 목록이 닫히지 않게
      panel.addEventListener("pointerdown", (e) => e.preventDefault());
      panel.addEventListener("click", onPick);
      addEventListener("resize", onMove);
      addEventListener("scroll", onMove, true);
    };
    const close = () => {
      clearTimeout(timer); ctrl?.abort(); ctrl = null;
      if (!panel) return;
      panel.remove(); panel = null; items = []; active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      removeEventListener("resize", onMove);
      removeEventListener("scroll", onMove, true);
    };
    const setActive = (i) => {
      if (!panel) return;
      const opts = [...panel.querySelectorAll('[role="option"]')];
      active = i;
      opts.forEach((o, k) => o.setAttribute("aria-selected", String(k === i)));
      const on = opts[i];
      if (on) { input.setAttribute("aria-activedescendant", on.id); on.scrollIntoView({ block: "nearest" }); } else input.removeAttribute("aria-activedescendant");
    };
    const show = (q, list, status) => {
      ensure();
      items = list.slice(0, c.limit).map(norm);
      mount(panel, status
        ? html`<p class="Catui_dd-group" role="presentation" aria-live="polite">${status}</p>`
        : items.length
          ? html`${items.map((it, i) => html`<div class="Catui_dd-item" role="option" id="${listId}-${i}" data-catui-ac="${i}" aria-selected="false" ${it.disabled ? html`aria-disabled="true"` : ""}><span>${mark(it.label, q)}${it.desc ? html` <span class="Catui_help">${it.desc}</span>` : ""}</span></div>`)}`
          : html`<p class="Catui_dd-group" role="presentation" aria-live="polite">${c.empty}</p>`);
      input.setAttribute("aria-expanded", "true");
      active = -1;
      place();
    };
    const pick = (i) => {
      const it = items[i];
      if (!it || it.disabled) return;
      input.value = it.value;
      close();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      c.select?.call(inst, it);
      inst.emit("select", { item: it, value: it.value, elem: input });
    };
    function onPick(e) { const o = e.target.closest("[data-catui-ac]"); if (o) pick(Number(o.dataset.catuiAc)); }
    const search = (q) => {
      clearTimeout(timer);
      ctrl?.abort();
      if (q.length < c.minLength) { close(); return; }
      const my = ++seq;
      const run = async () => {
        if (typeof c.data !== "function") {
          const ql = q.toLowerCase();
          show(q, (c.data || []).filter((it) => { const n = norm(it); return `${n.label} ${n.value} ${n.desc || ""}`.toLowerCase().includes(ql); }));
          return;
        }
        ctrl = new AbortController();
        show(q, [], c.loadingText);
        try {
          const res = await c.data(q, ctrl.signal);
          if (my !== seq) return;            // 그 사이 새 검색이 시작됐으면 버림
          show(q, Array.isArray(res) ? res : res?.data || []);
        } catch (err) {
          if (err?.name === "AbortError" || my !== seq) return;
          hint.error("autocomplete: 후보를 불러오지 못했습니다", "error", err);
          show(q, [], "후보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      };
      timer = setTimeout(run, typeof c.data === "function" ? c.delay : 0);
    };
    const onInput = (e) => { if (e.isTrusted === false && !panel) return; search(input.value.trim()); };
    const onKey = (e) => {
      const n = items.length;
      if (e.key === "ArrowDown") { e.preventDefault(); if (!panel) { search(input.value.trim()); return; } if (n) setActive((active + 1) % n); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (n) setActive((active - 1 + n) % n); }
      else if (e.key === "Enter" && panel && active >= 0 && !imeBusy(e)) { e.preventDefault(); pick(active); }
      else if (e.key === "Escape" && panel && !imeBusy(e)) { e.preventDefault(); e.stopPropagation(); close(); }   // 모달 안이면 목록만 닫힘
      else if (e.key === "Tab") close();
    };
    const onFocus = () => { if (c.openOnFocus) search(input.value.trim()); };
    const onBlur = () => close();
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKey);
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    inst.close = close;
    inst.search = (q) => search(String(q ?? input.value).trim());
    inst.use(() => {
      close();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      ["role", "aria-autocomplete", "aria-expanded", "aria-controls", "aria-activedescendant"].forEach((a) => input.removeAttribute(a));
    });
  },
});

// ── modules/command.js ──

// command — 명령 팔레트 (Ctrl/⌘+K). .Catui_cmdk를 네이티브 <dialog>에 띄운다.
//   command.render({ id: 'cmd', hotkey: 'mod+k', placeholder: '명령 또는 페이지 검색',
//     data: [{ group: '이동', title: '대시보드', icon: 'layout-dashboard', kbd: 'G D', keywords: 'home', href: '/dash' },
//            { group: '작성', title: '새 주문', icon: 'plus', handler(item) { … } }] })
//   command.open('cmd') / command.close('cmd') · 이벤트 command.on('select(cmd)', ({ item }) => {})
// 검색: 제목·키워드 포함, 띄어쓰기 무시, 한글 초성(ㄷㅅㅂㄷ → 대시보드).
const CATUI_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const catuiChosung = (s) => [...s].map((ch) => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CATUI_CHO[Math.floor(k / 588)] : ch; }).join("");
const catuiSafeLink = (u) => { try { const url = new URL(String(u), location.href); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; } };

const command = component({
  name: "command",
  config: { data: [], hotkey: "mod+k", placeholder: "명령 검색", label: "명령 팔레트", empty: "맞는 명령이 없습니다.", limit: 50 },
  render(inst) {
    const c = inst.config;
    const qid = uid("catui-cmd-q"), lid = uid("catui-cmd-l");
    const dlg = document.createElement("dialog");
    dlg.className = "Catui_cmdk";
    dlg.setAttribute("aria-label", c.label);
    mount(dlg, html`<div class="Catui_cmdk-search">${icon("search", 16)}<label class="Catui_clip" for="${qid}">${c.label} 검색</label><input class="Catui_input" id="${qid}" type="search" placeholder="${c.placeholder}" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="${lid}" aria-autocomplete="list"></div><div id="${lid}" role="listbox" aria-label="${c.label} 결과"></div><div class="Catui_cmdk-hint" aria-hidden="true"><span>↑↓ 이동</span><span>Enter 실행</span><span>Esc 닫기</span></div>`);
    layerRoot().appendChild(dlg);
    const input = dlg.querySelector("input"), list = dlg.querySelector(`#${lid}`);
    let shown = [], active = 0;

    const match = (it, q) => {
      if (!q) return true;
      const hay = `${it.title} ${it.keywords || ""} ${it.group || ""}`.toLowerCase();
      const flat = hay.replace(/\s+/g, ""), qq = q.toLowerCase().replace(/\s+/g, "");
      if (flat.includes(qq)) return true;
      return /^[ㄱ-ㅎ]+$/.test(qq) && catuiChosung(flat).includes(qq);   // 초성만 친 경우
    };
    const draw = () => {
      const q = input.value.trim();
      shown = (c.data || []).filter((it) => !it.hidden && match(it, q)).slice(0, c.limit);
      const groups = [];
      shown.forEach((it, i) => { const g = it.group || "명령"; let grp = groups.find((x) => x.name === g); if (!grp) groups.push((grp = { name: g, rows: [] })); grp.rows.push([it, i]); });
      // 그룹 순서대로 다시 번호를 매겨 ↑↓ 순서와 화면 순서를 맞춘다
      shown = groups.flatMap((g) => g.rows.map(([it]) => it));
      let k = -1;
      mount(list, shown.length
        ? html`${groups.map((g, gi) => html`<details class="Catui_cmdk-grp" open role="group" aria-labelledby="${lid}-g${gi}"><summary id="${lid}-g${gi}" tabindex="-1">${g.name}</summary>${g.rows.map(([it]) => { k += 1; return html`<div class="Catui_cmdk-row" role="option" id="${lid}-${k}" data-catui-cmd="${k}" aria-selected="false" ${it.disabled ? html`aria-disabled="true"` : ""}>${it.icon ? icon(it.icon, 16) : ""}<span>${it.title}</span>${it.kbd ? html`<span class="Catui_kbd">${it.kbd}</span>` : ""}</div>`; })}</details>`)}`
        : html`<p class="Catui_cmdk-row" role="presentation" aria-live="polite">${c.empty}</p>`);
      setActive(shown.findIndex((it) => !it.disabled));
    };
    const setActive = (i) => {
      active = i;
      list.querySelectorAll("[data-catui-cmd]").forEach((r) => { const on = Number(r.dataset.catuiCmd) === i; r.classList.toggle("Catui_cmdk-row-on", on); r.setAttribute("aria-selected", String(on)); if (on) r.scrollIntoView({ block: "nearest" }); });
      if (i >= 0) input.setAttribute("aria-activedescendant", `${lid}-${i}`); else input.removeAttribute("aria-activedescendant");
    };
    const step = (d) => {
      const n = shown.length;
      if (!n) return;
      let i = active;
      for (let t = 0; t < n; t++) { i = (i + d + n) % n; if (!shown[i].disabled) break; }   // 비활성은 건너뜀
      setActive(i);
    };
    const run = (i) => {
      const it = shown[i];
      if (!it || it.disabled) return;
      const keep = it.handler?.call(inst, it) === false;
      inst.emit("select", { item: it });
      if (keep) return;
      close();
      const href = it.href && catuiSafeLink(it.href);
      if (href) location.assign(href);
    };
    const open = () => {
      if (dlg.open) return;
      input.value = "";
      draw();
      dlg.showModal();
      input.focus();
      inst.emit("open", {});
    };
    const close = () => { if (dlg.open) dlg.close(); };

    const onKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
      else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setActive(0); }
      else if (e.key === "Enter" && !imeBusy(e)) { e.preventDefault(); run(active); }
      else if (e.key === "Escape" && imeBusy(e)) e.preventDefault();   // 한글 조합 중 Esc는 팔레트를 닫지 않음
    };
    const onClick = (e) => {
      if (e.target === dlg) { close(); return; }   // 바깥(배경) 클릭
      const r = e.target.closest("[data-catui-cmd]");
      if (r) run(Number(r.dataset.catuiCmd));
      if (e.target.closest("summary")) e.preventDefault();   // 그룹 제목은 접히지 않음
    };
    const onHover = (e) => { const r = e.target.closest("[data-catui-cmd]"); if (r && Number(r.dataset.catuiCmd) !== active && r.getAttribute("aria-disabled") !== "true") setActive(Number(r.dataset.catuiCmd)); };
    // 단축키: 'mod+k'(Windows Ctrl, Mac ⌘) · '/' 같은 한 글자는 입력 중이 아닐 때만
    const keys = [].concat(c.hotkey || []).map((h) => String(h).toLowerCase().split("+"));
    const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
    const onHot = (e) => {
      if (dlg.open || e.defaultPrevented || imeBusy(e)) return;
      const typing = e.target.closest?.("input, textarea, select, [contenteditable=true]");
      for (const parts of keys) {
        const key = parts[parts.length - 1], mods = parts.slice(0, -1);
        const want = { ctrl: mods.includes("ctrl") || (mods.includes("mod") && !isMac), meta: mods.includes("meta") || (mods.includes("mod") && isMac), shift: mods.includes("shift"), alt: mods.includes("alt") };
        if (e.key.toLowerCase() !== key || e.ctrlKey !== want.ctrl || e.metaKey !== want.meta || e.altKey !== want.alt || (want.shift && !e.shiftKey)) continue;
        if (!mods.length && typing) continue;
        e.preventDefault();
        open();
        return;
      }
    };
    input.addEventListener("input", draw);
    input.addEventListener("keydown", onKey);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("mousemove", onHover);
    dlg.addEventListener("close", () => inst.emit("close", {}));
    if (keys.length) document.addEventListener("keydown", onHot);
    inst.open = open;
    inst.close = close;
    inst.dialog = dlg;
    inst.use(() => { document.removeEventListener("keydown", onHot); close(); dlg.remove(); });
  },
  open(id) { command.getThis(id)?.open(); },
  close(id) { command.getThis(id)?.close(); },
});

// ── modules/page.js ──

// page — 웹 페이지 도구 묶음. 대부분 선언형 속성만으로 동작한다(catui.init이 연결).
//   맨 위로:  <a class="Catui_totop" href="#main" data-catui-totop="400" aria-label="맨 위로">…</a>  · page.totop({ offset })
//   복사:     <button data-catui-copy>복사</button>(가까운 코드 블록) · data-catui-copy="#id" · data-catui-copy="글자"
//   지연 로딩: <img data-catui-src="a.jpg" alt="…">(·data-catui-srcset) · <iframe data-catui-src>
//   툴팁:     <button data-catui-tip="설명" data-catui-tip-side="bottom">
//   무한 스크롤: page.flow.render({ elem: '#list', done(page, next) { next(html`…`, hasMore) } })
//   단계:     page.steps.render({ elem: '#wiz', data: ['정보', '결제', '완료'], panels: '#wiz-panels', before(from, to) {} })

// ── 단계(wizard) ──
const catuiPageSteps = component({
  name: "steps",
  config: { data: [], current: 0, panels: null, label: "진행 단계", before: null, change: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    const panelBox = el(c.panels);
    const panels = () => (panelBox ? [...panelBox.children].filter((p) => p.classList.contains("Catui_step-panel")) : []);
    let cur = Math.min(Math.max(0, Number(c.current) || 0), Math.max(0, c.data.length - 1));
    const draw = () => {
      mount(inst.elem, html`<ol class="Catui_steps" aria-label="${c.label}">${c.data.map((d, i) => {
        const label = typeof d === "object" ? d.title : d;
        const st = i < cur ? "done" : i === cur ? "current" : "";
        return html`${i ? html`<li class="Catui_step-line${i <= cur ? " Catui_step-line-done" : ""}" aria-hidden="true"></li>` : ""}<li class="Catui_step${st ? ` Catui_step-${st}` : ""}" ${st === "current" ? html`aria-current="step"` : ""}><span class="Catui_step-dot">${st === "done" ? icon("check", 16) : i + 1}</span><span class="Catui_step-label">${label}${st === "done" ? html`<span class="Catui_clip"> 완료</span>` : ""}</span></li>`;
      })}</ol>`);
      panels().forEach((p, i) => { p.hidden = i !== cur; if (!p.hasAttribute("tabindex")) p.tabIndex = -1; });
    };
    const go = async (to) => {
      to = Math.min(Math.max(0, Number(to)), c.data.length - 1);
      if (to === cur) return false;
      // before(from, to)가 false(또는 false로 끝나는 Promise)면 이동하지 않는다 — 입력 검사에 사용
      if (c.before && (await c.before.call(inst, cur, to)) === false) return false;
      const from = cur;
      cur = to;
      draw();
      panels()[cur]?.focus({ preventScroll: false });   // 새 단계 내용으로 포커스 → 스크린리더가 읽음
      c.change?.call(inst, cur, from);
      inst.emit("change", { index: cur, from, total: c.data.length });
      return true;
    };
    draw();
    inst.go = go;
    inst.next = () => go(cur + 1);
    inst.prev = () => go(cur - 1);
    inst.getIndex = () => cur;
    inst.use(() => panels().forEach((p) => { p.hidden = false; }));
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
});

// ── 무한 스크롤 / 더 보기 ──
const catuiPageFlow = component({
  name: "flow",
  ownDone: true,   // done(page, next)은 불러오기 콜백 — 렌더 완료로 부르지 않음
  config: { auto: true, margin: "200px", more: "더 보기", end: "마지막 항목입니다.", loadingText: "불러오는 중…", done: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box || typeof c.done !== "function") { if (box) hint.error("flow: done(page, next)가 필요합니다"); return; }
    const bar = document.createElement("div");
    bar.className = "Catui_actions";
    bar.style.justifyContent = "center";
    bar.setAttribute("aria-live", "polite");
    box.insertAdjacentElement("afterend", bar);
    box.setAttribute("aria-busy", "false");
    let page = 0, busy = false, ended = false, io = null;
    const status = (state) => {
      mount(bar, state === "loading"
        ? html`<span class="Catui_spin" aria-hidden="true"></span><span class="Catui_help">${c.loadingText}</span>`
        : state === "end"
          ? html`<span class="Catui_help">${c.end}</span>`
          : state === "error"
            ? html`<span class="Catui_help">불러오지 못했습니다.</span><button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-catui-flow>다시 시도</button>`
            : html`<button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-catui-flow>${c.more}</button>`);
    };
    const append = (items) => {
      for (const it of [].concat(items ?? [])) {
        if (it instanceof Node) box.appendChild(it);
        else if (isRaw(it)) box.insertAdjacentHTML("beforeend", it.__raw);
        else if (it != null && it !== "") box.appendChild(Object.assign(document.createElement("p"), { textContent: String(it) }));
      }
    };
    const load = () => {
      if (busy || ended) return;
      busy = true;
      page += 1;
      box.setAttribute("aria-busy", "true");
      status("loading");
      const my = page;
      let answered = false;
      // next(항목들, 더 있음?) — 항목은 html``·Element·배열
      const next = (items, more = true) => {
        if (answered || my !== page) return;
        answered = true;
        append(items);
        busy = false;
        box.setAttribute("aria-busy", "false");
        ended = !more;
        status(ended ? "end" : "more");
        if (ended) io?.disconnect();
        inst.emit("load", { page: my, more: !ended });
      };
      try {
        const r = c.done.call(inst, my, next);
        // done이 Promise를 돌려주다 실패하면 다시 시도할 수 있게
        r?.catch?.((err) => { if (answered) return; answered = true; busy = false; page -= 1; box.setAttribute("aria-busy", "false"); status("error"); hint.error("flow: 불러오기 실패", "error", err); });
      } catch (err) { answered = true; busy = false; page -= 1; box.setAttribute("aria-busy", "false"); status("error"); hint.error("flow: 불러오기 실패", "error", err); }
    };
    const onClick = (e) => { if (e.target.closest("[data-catui-flow]")) load(); };
    bar.addEventListener("click", onClick);
    // 자동이면 아래쪽 막대가 보일 때 불러온다. 키보드·스크린리더 사용자를 위해 "더 보기" 버튼도 항상 둔다
    if (c.auto && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) load(); }, { rootMargin: c.margin });
      io.observe(bar);
    }
    status("more");
    if (!io) load();
    inst.load = load;
    inst.reset = () => { page = 0; ended = false; busy = false; box.textContent = ""; status("more"); if (c.auto && io) { io.disconnect(); io.observe(bar); } else load(); };
    inst.use(() => { io?.disconnect(); bar.removeEventListener("click", onClick); bar.remove(); box.removeAttribute("aria-busy"); });
  },
});

// ── 지연 로딩 (화면에 가까워지면 data-catui-src → src) ──
let catuiLazyIO = null;
const catuiLoadNow = (n) => {
  const src = n.getAttribute("data-catui-src"), set = n.getAttribute("data-catui-srcset");
  if (set) n.setAttribute("srcset", set);
  if (src) n.setAttribute("src", src);
  n.removeAttribute("data-catui-src"); n.removeAttribute("data-catui-srcset");
};
function catuiLazy(scope = document) {
  const nodes = scope.querySelectorAll("img[data-catui-src], img[data-catui-srcset], iframe[data-catui-src], source[data-catui-srcset]");
  if (!nodes.length) return;
  if (typeof IntersectionObserver === "undefined") { nodes.forEach(catuiLoadNow); return; }
  catuiLazyIO ||= new IntersectionObserver((ents) => ents.forEach((x) => {
    if (!x.isIntersecting) return;
    catuiLazyIO.unobserve(x.target);
    // <picture>는 안의 source까지 함께
    x.target.closest("picture")?.querySelectorAll("source[data-catui-srcset]").forEach(catuiLoadNow);
    catuiLoadNow(x.target);
  }), { rootMargin: "300px 0px" });
  nodes.forEach((n) => { if (n.tagName !== "SOURCE") catuiLazyIO.observe(n); });
}

// ── 맨 위로 ──
const catuiTotopSync = () => document.querySelectorAll("[data-catui-totop]").forEach((b) => {
  const show = scrollY > (Number(b.getAttribute("data-catui-totop")) || 400);
  b.style.display = show ? "" : "none";   // .Catui_totop은 display:grid라 hidden 속성이 이기지 못한다
});
function catuiTotop(options = {}) {
  let b = document.querySelector("[data-catui-totop]");
  if (!b) {
    b = document.createElement("button");
    b.type = "button";
    b.className = "Catui_totop";
    b.setAttribute("aria-label", options.label || "맨 위로");
    mount(b, icon("arrow-right", 18));
    layerRoot().appendChild(b);
  }
  b.setAttribute("data-catui-totop", String(options.offset ?? b.getAttribute("data-catui-totop") ?? 400));
  if (options.target) b.setAttribute("data-catui-totop-target", options.target);
  catuiTotopSync();
  return b;
}
function catuiGoTop(b) {
  scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  // 포커스도 위로: href의 #대상 → data-catui-totop-target → 본문 첫 제목
  const sel = b.getAttribute("data-catui-totop-target") || (b.getAttribute("href")?.startsWith("#") ? b.getAttribute("href") : "");
  let t = null;
  try { t = sel ? document.querySelector(sel) : null; } catch { t = null; }
  t ||= document.querySelector("main, h1");
  if (t) { if (!t.hasAttribute("tabindex") && !t.matches("a[href], button, input, select, textarea")) t.tabIndex = -1; t.focus({ preventScroll: true }); }
}

// ── 복사 ──
// 화면에 보이지 않는 공용 알림 영역 (오버레이 루트 안 하나)
function catuiAnnounce(msg) {
  const root = layerRoot();
  let live = root.querySelector(":scope > [data-catui-announce]");
  if (!live) { live = Object.assign(document.createElement("p"), { className: "Catui_clip" }); live.setAttribute("aria-live", "polite"); live.setAttribute("data-catui-announce", ""); root.appendChild(live); }
  live.textContent = "";
  setTimeout(() => { live.textContent = msg; }, 30);   // 같은 문장도 다시 읽히게 비웠다가 넣음
}
async function catuiCopyFrom(btn) {
  const v = btn.getAttribute("data-catui-copy") || "";
  let text = v;
  if (!v) text = btn.closest(".Catui_codeblock")?.querySelector("pre code, pre")?.textContent ?? "";
  else if (v.startsWith("#")) { let t = null; try { t = document.querySelector(v); } catch { t = null; } text = t ? ("value" in t && t.tagName !== "BUTTON" ? t.value : t.textContent) : ""; }
  const ok = text ? await util.copy(text) : false;
  const msg = ok ? "복사됨" : "복사하지 못했습니다";
  catuiAnnounce(msg);   // 스크린리더 알림은 공용 영역으로
  // 글자만 있는 버튼은 잠시 글자를 바꿨다 되돌린다 (아이콘이 든 버튼은 건드리지 않음)
  if (!btn.firstElementChild && btn.textContent.trim()) {
    if (btn.dataset.catuiCopyLabel == null) btn.dataset.catuiCopyLabel = btn.textContent;
    clearTimeout(Number(btn.dataset.catuiCopyTimer));
    btn.textContent = msg;
    btn.dataset.catuiCopyTimer = String(setTimeout(() => { btn.textContent = btn.dataset.catuiCopyLabel; delete btn.dataset.catuiCopyLabel; }, 1500));
  }
  btn.dispatchEvent(new CustomEvent("catui:copy", { bubbles: true, detail: { ok, text } }));
  return ok;
}

// ── 툴팁 ──
let catuiTip = null, catuiTipFor = null, catuiTipTimer = 0;
function catuiTipHide() {
  clearTimeout(catuiTipTimer);
  if (catuiTipFor) {
    const d = (catuiTipFor.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== catuiTip?.id);
    if (d.length) catuiTipFor.setAttribute("aria-describedby", d.join(" ")); else catuiTipFor.removeAttribute("aria-describedby");
  }
  catuiTip?.remove();
  catuiTip = catuiTipFor = null;
}
function catuiTipShow(target) {
  if (catuiTipFor === target) return;
  catuiTipHide();
  const text = target.getAttribute("data-catui-tip");
  if (!text) return;
  catuiTip = document.createElement("div");
  catuiTip.className = "Catui_tooltip";
  catuiTip.id = uid("catui-tip");
  catuiTip.setAttribute("role", "tooltip");
  catuiTip.textContent = text;
  layerRoot().appendChild(catuiTip);
  catuiTipFor = target;
  target.setAttribute("aria-describedby", [target.getAttribute("aria-describedby"), catuiTip.id].filter(Boolean).join(" "));
  const r = target.getBoundingClientRect(), t = catuiTip.getBoundingClientRect(), g = 6;
  let side = target.getAttribute("data-catui-tip-side") || "top";
  if (side === "top" && r.top - t.height - g < 0) side = "bottom";
  else if (side === "bottom" && r.bottom + t.height + g > innerHeight) side = "top";
  const top = side === "top" ? r.top - t.height - g : r.bottom + g;
  catuiTip.style.left = `${Math.round(Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2)))}px`;
  catuiTip.style.top = `${Math.round(Math.max(8, top))}px`;
}

const catuiPageParts = [catuiPageSteps, catuiPageFlow];
const page = {
  steps: catuiPageSteps,
  flow: catuiPageFlow,
  lazy: catuiLazy,
  totop: catuiTotop,
  copy: (text) => util.copy(text),
  tip: { show: (t) => { const n = el(t); if (n) catuiTipShow(n); }, hide: catuiTipHide },
  enhance(scope = document) { catuiLazy(scope); catuiTotopSync(); },
  // 전역 위임 (catui.init에서 1회): 복사·툴팁·맨 위로
  bind() {
    const onClick = (e) => {
      const cp = e.target.closest?.("[data-catui-copy]");
      if (cp) { e.preventDefault(); catuiCopyFrom(cp); return; }
      const top = e.target.closest?.("[data-catui-totop]");
      if (top) { e.preventDefault(); catuiGoTop(top); }
    };
    const tipOf = (n) => n?.closest?.("[data-catui-tip]");
    const onOver = (e) => { const t = tipOf(e.target); if (!t || t === catuiTipFor) return; clearTimeout(catuiTipTimer); catuiTipTimer = setTimeout(() => catuiTipShow(t), 300); };
    const onOut = (e) => { const t = tipOf(e.target); if (t && !t.contains(e.relatedTarget)) { clearTimeout(catuiTipTimer); if (catuiTipFor === t && document.activeElement !== t) catuiTipHide(); } };
    const onFocusIn = (e) => { const t = tipOf(e.target); if (t) catuiTipShow(t); };
    const onFocusOut = (e) => { if (tipOf(e.target) === catuiTipFor) catuiTipHide(); };
    const onKey = (e) => { if (e.key === "Escape" && catuiTip && !imeBusy(e)) { catuiTipHide(); } };   // 툴팁만 닫고 기본 동작은 막지 않음
    let raf = 0;
    const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; catuiTotopSync(); if (catuiTip) catuiTipHide(); }); };
    document.addEventListener("click", onClick);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKey, true);
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKey, true);
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      catuiTipHide();
      catuiLazyIO?.disconnect(); catuiLazyIO = null;
    };
  },
  destroyAll() { catuiPageParts.forEach((p) => p.destroyAll()); },
  destroyDetached() { catuiPageParts.forEach((p) => p.destroyDetached()); },
};

// ── modules/site.js ──

// site — 공개 홈페이지 도구 묶음. 대부분 선언형 속성만으로 동작한다(catui.init이 연결).
//   헤더:      <header class="Catui_site-header" data-catui-header[="hide"]>  스크롤 그림자 · 내리면 숨기고 올리면 보이기 · 모바일 메뉴 닫기
//   현재 위치:  <nav data-catui-spy> <a href="#features">  보고 있는 섹션 링크에 aria-current="location"
//   공지 띠:    <div class="Catui_announce" data-catui-dismiss="키" data-catui-days="7"> … <button class="Catui_announce-close">
//   쿠키 동의:  <div class="Catui_cookie" data-catui-cookie> <button data-catui-consent="all|necessary">   · site.consent()
//   카운트다운: <p data-catui-countdown="2026-12-31T00:00:00+09:00" data-catui-done="마감"> <b data-catui-unit="d"></b>일 …
//   라이트박스: <div class="Catui_gallery" data-catui-lightbox> <a href="큰.jpg"><img alt></a>
//   요금 전환:  <div data-catui-billing> radio(value="monthly|yearly") … <b data-catui-monthly="9,900" data-catui-yearly="7,900">
//   구독 폼:    <form class="Catui_subscribe" data-catui-form data-catui-ajax="/api/subscribe" data-catui-subscribe="감사 문구">
//   로고 흐름:  <div class="Catui_logos" data-catui-marquee="30">  (초 단위 한 바퀴, 정지 버튼 포함)
//   읽기 막대:  <div class="Catui_readbar" data-catui-readbar="#article" aria-hidden="true"><i></i></div>
//   공유:      <button data-catui-share data-catui-share-title="제목">  Web Share → 안 되면 주소 복사
//   이벤트: site.on('consent', ({ value })) · site.on('dismiss(키)') · site.on('end(필터)')(카운트다운) · site.on('billing', ({ value }))

const MOD = "site";
const STORE = "site";   // catui.data('site') 저장 표 이름
const catuiSiteGet = (k) => data(STORE)[k];
const catuiSiteSet = (k, v) => data(STORE, { key: k, value: v });

// ── 카운트다운 (정리가 필요해 컴포넌트) ──
const catuiSiteCountdown = component({
  name: "countdown",
  config: { date: "", doneText: "", end: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box) return;
    const unit = (u) => box.querySelector(`[data-catui-unit="${u}"]`);
    const hasUnits = !!box.querySelector("[data-catui-unit]");
    const pad = (n) => String(n).padStart(2, "0");
    // 매초 읽지 않도록 숫자는 aria-hidden, 이름(aria-label)은 분 단위로만 바꾼다
    box.setAttribute("role", box.getAttribute("role") || "timer");
    let lastMin = -1;
    const t0 = util.countdown({
      date: c.date,
      ready(t) {
        if (hasUnits) {
          [["d", t.d], ["h", pad(t.h)], ["m", pad(t.m)], ["s", pad(t.s)]].forEach(([u, v]) => { const n = unit(u); if (n) { n.textContent = String(v); n.setAttribute("aria-hidden", "true"); } });
        } else box.textContent = `${t.d ? `${t.d}일 ` : ""}${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
        const mins = Math.floor(t.left / 60000);
        if (mins !== lastMin) { lastMin = mins; box.setAttribute("aria-label", `남은 시간 ${t.d}일 ${t.h}시간 ${t.m}분`); }
      },
      clear() {
        if (c.doneText) { box.textContent = c.doneText; box.removeAttribute("aria-label"); }
        c.end?.call(inst);
        inst.emit("end", { elem: box });
      },
    });
    inst.use(() => t0.clear());
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 로고 흐름 (정지 버튼·모션 줄이기 대응, 정리 필요) ──
const catuiSiteMarquee = component({
  name: "marquee",
  config: { seconds: 30, label: "고객사 로고" },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box || reducedMotion()) return;           // 모션 줄이기: 원래의 줄바꿈 배치 그대로
    const items = [...box.children];
    if (!items.length) return;
    box.classList.add("Catui_logos-marquee");
    const track = document.createElement("div");
    track.className = "Catui_logos-track";
    items.forEach((n) => track.appendChild(n));
    // 끝없이 흐르도록 한 벌을 복제 (복제는 화면 낭독기·키보드에서 제외)
    items.forEach((n) => { const k = n.cloneNode(true); k.setAttribute("aria-hidden", "true"); k.inert = true; k.querySelectorAll?.("[id]").forEach((x) => x.removeAttribute("id")); k.removeAttribute("id"); track.appendChild(k); });
    track.style.animationDuration = `${Math.max(5, Number(c.seconds) || 30)}s`;
    box.appendChild(track);
    // 5초 넘게 움직이는 내용에는 멈춤 수단이 있어야 한다 (WCAG 2.2.2)
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon";
    const setBtn = (paused) => { mount(btn, icon(paused ? "play" : "pause", 16)); btn.setAttribute("aria-label", `${c.label} 흐름 ${paused ? "재생" : "정지"}`); btn.setAttribute("aria-pressed", String(paused)); };
    let paused = false;
    setBtn(false);
    btn.addEventListener("click", () => { paused = !paused; track.style.animationPlayState = paused ? "paused" : ""; setBtn(paused); });
    box.insertAdjacentElement("afterend", btn);
    inst.use(() => {
      btn.remove();
      track.querySelectorAll(":scope > [aria-hidden=true]").forEach((n) => n.remove());
      [...track.children].forEach((n) => box.insertBefore(n, track));
      track.remove();
      box.classList.remove("Catui_logos-marquee");
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 공지 띠 ──
const catuiDismissed = (bar) => {
  const key = bar.getAttribute("data-catui-dismiss");
  const at = key && catuiSiteGet(`dismiss:${key}`);
  if (!at) return false;
  const days = Number(bar.getAttribute("data-catui-days"));
  return !(days > 0 && Date.now() - at > days * 86400000);   // 기간이 지나면 다시 보임
};

// ── 쿠키 동의 ──
const catuiConsent = () => catuiSiteGet("consent") || null;

// ── 요금 월/연 전환 ──
const catuiBilling = (box, value) => {
  box.querySelectorAll("[data-catui-monthly], [data-catui-yearly]").forEach((n) => {
    const v = n.getAttribute(`data-catui-${value}`);
    if (v != null) n.textContent = v;
  });
  box.querySelectorAll("[data-catui-billing-show]").forEach((n) => { n.hidden = n.getAttribute("data-catui-billing-show") !== value; });
};

// ── 읽기 진행 막대 ──
const catuiReadbar = () => document.querySelectorAll("[data-catui-readbar]").forEach((bar) => {
  const sel = bar.getAttribute("data-catui-readbar");
  let t = null;
  try { t = sel ? document.querySelector(sel) : null; } catch { t = null; }
  const top = t ? t.getBoundingClientRect().top + scrollY : 0;
  const height = t ? t.offsetHeight : document.documentElement.scrollHeight;
  const range = Math.max(1, height - innerHeight);
  const p = Math.min(1, Math.max(0, (scrollY - top) / range));
  bar.style.setProperty("--Catui_read", p.toFixed(4));
});

// ── 헤더: 스크롤 상태 ──
let catuiLastY = 0;
const catuiHeaders = () => document.querySelectorAll(".Catui_site-header[data-catui-header]");
const catuiHeaderSync = () => {
  const y = scrollY, down = y > catuiLastY;
  catuiHeaders().forEach((h) => {
    h.toggleAttribute("data-catui-scrolled", y > 4);
    // "hide": 내릴 때 숨기고 올릴 때 보임. 메뉴가 열렸거나 헤더 안에 포커스가 있으면 숨기지 않음
    const keep = h.querySelector(".Catui_site-menu[open]") || h.contains(document.activeElement);
    if (h.getAttribute("data-catui-header") === "hide" && !reducedMotion()) h.toggleAttribute("data-catui-hidden", down && y > h.offsetHeight * 2 && !keep);
  });
  catuiLastY = y;
};

// ── 현재 위치(스크롤 스파이) ──
// 링크 대상이 제목(h2)처럼 얇아도 되도록, 대상이 속한 <section>의 위치로 판단한다.
// 화면 위에서 35% 선을 지난 섹션 중 마지막이 현재. 맨 아래까지 내리면 마지막 섹션.
let catuiSpyMap = null;   // 섹션 → 링크들
function catuiSpy() {
  catuiSpyMap = new Map();
  document.querySelectorAll("[data-catui-spy] a[href^='#']").forEach((a) => {
    let t = null;
    try { t = document.querySelector(a.getAttribute("href")); } catch { t = null; }
    if (!t) return;
    const sec = t.closest("section") || t;
    if (!catuiSpyMap.has(sec)) catuiSpyMap.set(sec, []);
    catuiSpyMap.get(sec).push(a);
  });
  catuiSpySync();
}
function catuiSpySync() {
  if (!catuiSpyMap?.size) return;
  const line = innerHeight * 0.35;
  const secs = [...catuiSpyMap.keys()].filter((s) => s.isConnected).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  let cur = null;
  secs.forEach((s) => { if (s.getBoundingClientRect().top <= line) cur = s; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = secs[secs.length - 1] || cur;
  if (cur && cur.getBoundingClientRect().bottom < 0) cur = null;   // 마지막 섹션도 이미 지나갔으면 없음
  catuiSpyMap.forEach((as, s) => as.forEach((a) => { if (s === cur) a.setAttribute("aria-current", "location"); else if (a.getAttribute("aria-current") === "location") a.removeAttribute("aria-current"); }));
}

// ── 공유 ──
async function catuiShare(btn) {
  const title = btn.getAttribute("data-catui-share-title") || document.title;
  const url = btn.getAttribute("data-catui-share-url") || location.href;
  const text = btn.getAttribute("data-catui-share-text") || "";
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); emit(MOD, "share", null, { method: "native", url }); return; }
    catch (err) { if (err?.name === "AbortError") return; }   // 사용자가 취소
  }
  const ok = await util.copy(url);
  layer.msg(ok ? "주소를 복사했습니다" : "주소를 복사하지 못했습니다", { icon: ok ? "success" : "warn" });
  emit(MOD, "share", null, { method: "copy", url, ok });
}

const catuiSiteParts = [catuiSiteCountdown, catuiSiteMarquee];
const site = {
  countdown: catuiSiteCountdown,
  marquee: catuiSiteMarquee,
  consent: catuiConsent,
  // 저장한 동의를 지워 쿠키 띠를 다시 보이게 (설정 화면의 "쿠키 설정 다시 하기")
  resetConsent() { data(STORE, { key: "consent", remove: true }); document.querySelectorAll(".Catui_cookie[data-catui-cookie]").forEach((n) => { n.hidden = false; }); },
  share: catuiShare,
  billing(box, value) { const b = el(box); if (b) { catuiBilling(b, value); emit(MOD, "billing", b.getAttribute("data-catui-filter"), { value, elem: b }); } },
  on: (evt, fn) => onEvent(MOD, evt, fn),

  enhance(scope = document) {
    const each = (sel, fn) => scope.querySelectorAll(`${sel}:not([data-catui-ready])`).forEach((n) => {
      n.setAttribute("data-catui-ready", "");
      try { fn(n); } catch (err) { n.removeAttribute("data-catui-ready"); hint.error(`site: ${sel} 연결 실패`, "error", err, n); }
    });
    each(".Catui_announce[data-catui-dismiss]", (n) => { if (catuiDismissed(n)) n.hidden = true; });
    each(".Catui_cookie[data-catui-cookie]", (n) => { n.hidden = !!catuiConsent(); if (!n.getAttribute("role")) n.setAttribute("role", "region"); if (!n.getAttribute("aria-label")) n.setAttribute("aria-label", "쿠키 안내"); });
    each("[data-catui-countdown]", (n) => catuiSiteCountdown.render({ elem: n, auto: true, date: n.getAttribute("data-catui-countdown"), doneText: n.getAttribute("data-catui-done") || "" }));
    each("[data-catui-marquee]", (n) => catuiSiteMarquee.render({ elem: n, auto: true, seconds: Number(n.getAttribute("data-catui-marquee")) || 30, label: n.getAttribute("aria-label") || "고객사 로고" }));
    each("[data-catui-billing]", (n) => { const on = n.querySelector("input[type=radio]:checked"); if (on) catuiBilling(n, on.value); });
    each("[data-catui-lightbox]", (n) => { n.querySelectorAll("a[href]").forEach((a) => { if (!a.getAttribute("aria-haspopup")) a.setAttribute("aria-haspopup", "dialog"); }); });
    each(".Catui_site-header[data-catui-header] .Catui_site-menu > summary", (s) => { s.setAttribute("aria-label", s.getAttribute("aria-label") || "메뉴"); });
    catuiSpy();
    catuiHeaderSync();
    catuiReadbar();
  },

  // 전역 위임 (catui.init에서 1회)
  bind() {
    const onClick = (e) => {
      const t = e.target;
      // 공지 띠 닫기 → 기억
      const close = t.closest?.(".Catui_announce-close");
      const bar = close?.closest(".Catui_announce");
      if (bar) {
        bar.hidden = true;
        const key = bar.getAttribute("data-catui-dismiss");
        if (key) { catuiSiteSet(`dismiss:${key}`, Date.now()); emit(MOD, "dismiss", key, { elem: bar }); }
        // 포커스가 사라진 버튼에 남지 않게 다음 요소(본문)로
        (document.querySelector("main, [role=main]") || document.body).focus?.({ preventScroll: true });
        return;
      }
      // 쿠키 동의
      const cons = t.closest?.("[data-catui-consent]");
      if (cons) {
        const value = cons.getAttribute("data-catui-consent") || "all";
        catuiSiteSet("consent", { value, at: Date.now() });
        cons.closest(".Catui_cookie")?.setAttribute("hidden", "");
        emit(MOD, "consent", null, { value });
        dispatchEvent(new CustomEvent("catui:consent", { detail: { value } }));
        return;
      }
      // 라이트박스
      const a = t.closest?.("[data-catui-lightbox] a[href]");
      if (a && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const box = a.closest("[data-catui-lightbox]");
        const links = [...box.querySelectorAll("a[href]")];
        const items = links.map((x) => { const img = x.querySelector("img"); return { src: x.href, alt: img?.alt || "", caption: x.closest("figure")?.querySelector("figcaption")?.textContent.trim() || img?.alt || "" }; });
        e.preventDefault();
        layer.photos({ items, start: links.indexOf(a), title: box.getAttribute("aria-label") || "사진" });
        return;
      }
      // 공유
      const sh = t.closest?.("[data-catui-share]");
      if (sh) { e.preventDefault(); catuiShare(sh); return; }
      // 모바일 메뉴: 링크를 누르면 닫고, 바깥을 누르면 닫음
      document.querySelectorAll(".Catui_site-menu[open]").forEach((m) => { if (!m.contains(t) || t.closest("a[href]")) m.open = false; });
    };
    const onChange = (e) => {
      const r = e.target;
      const box = r.closest?.("[data-catui-billing]");
      if (box && r.type === "radio" && r.checked) { catuiBilling(box, r.value); emit(MOD, "billing", box.getAttribute("data-catui-filter"), { value: r.value, elem: box }); }
    };
    const onKey = (e) => {
      if (e.key !== "Escape" || imeBusy(e)) return;
      const m = document.querySelector(".Catui_site-menu[open]");
      if (m) { m.open = false; m.querySelector("summary")?.focus(); }
    };
    // 구독 폼: form 모듈의 Ajax 결과를 받아 완료 문구로 바꾼다
    const offDone = onEvent("form", "done", (d) => {
      const f = d?.form;
      if (!f?.matches?.("[data-catui-subscribe]")) return;
      const msg = f.getAttribute("data-catui-subscribe") || "구독해 주셔서 감사합니다. 확인 메일을 보냈습니다.";
      const done = Object.assign(document.createElement("p"), { className: "Catui_subscribe-done" });
      done.setAttribute("role", "status");
      done.tabIndex = -1;
      mount(done, html`${icon("check", 16)}<span>${msg}</span>`);
      f.hidden = true;
      f.insertAdjacentElement("afterend", done);
      done.focus({ preventScroll: true });
    });
    const offFail = onEvent("form", "fail", (d) => {
      const f = d?.form;
      if (!f?.matches?.("[data-catui-subscribe]")) return;
      layer.msg("구독하지 못했습니다. 잠시 후 다시 시도해 주세요.", { icon: "danger" });
    });
    let raf = 0;
    const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; catuiHeaderSync(); catuiReadbar(); catuiSpySync(); }); };
    const onResize = () => { catuiReadbar(); catuiSpySync(); };
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      offDone(); offFail();
      catuiSpyMap = null;
    };
  },
  destroyAll() { catuiSiteParts.forEach((p) => p.destroyAll()); },
  destroyDetached() { catuiSiteParts.forEach((p) => p.destroyDetached()); },
};

// ── core/catui.js ──

// 전역 catui 객체 (layui에 해당).
//   <script src="ui/dist/catui.js"></script>
//   catui.use(['layer', 'form'], function (layer, form) { layer.msg('안녕하세요'); });
const catuiModules = { layer, form, laypage, table, tabs, dropdown, util, datePicker, upload, slider, rate, tree, collapse, canvas, fx, carousel, field, autocomplete, command, page, site };
let catuiReady = false;
let catuiOffs = [];
let catuiPrepareOverlays = null;

// 자동 정리: DOM에서 노드가 빠지면 다음 틱에 모든 모듈의 destroyDetached() 실행.
// 다음 틱까지 미루므로 같은 작업 안에서 떼었다 다시 붙인(이동한) 요소는 정리되지 않는다.
function catuiWatchDetached() {
  if (typeof MutationObserver === "undefined" || !document.body) return null;
  let timer = 0;
  const sweep = () => {
    timer = 0;
    Object.values(catuiModules).forEach((m) => { try { m?.destroyDetached?.(); } catch (err) { hint.error("자동 정리 중 오류", "error", err); } });
  };
  const mo = new MutationObserver((records) => {
    if (timer || !records.some((r) => r.removedNodes.length)) return;
    timer = setTimeout(sweep, 0);
  });
  mo.observe(document.body, { childList: true, subtree: true });
  return () => { mo.disconnect(); clearTimeout(timer); };
}

const catui = {
  version: VERSION,
  config,
  get cache() { return { config: getConfig(), modules: Object.keys(catuiModules) }; },
  $, el, html, raw, escape, mount, icon, hint, data, sessionData, url, device, component, csrfHeaders,
  ...catuiModules,

  // 모듈 불러오기. 모두 한 파일에 들어 있으므로 즉시(문서 준비 후) 콜백한다. Promise도 돌려준다.
  use(mods, callback) {
    if (typeof mods === "function") { callback = mods; mods = []; }
    const list = [].concat(mods || []);
    const missing = list.filter((m) => !catuiModules[m]);
    if (missing.length) hint.error(`없는 모듈: ${missing.join(", ")} (catui.extend로 추가할 수 있습니다)`, "error");
    const args = list.map((m) => catuiModules[m]);
    return new Promise((resolve, reject) => {
      // 콜백 오류는 Promise를 거부한다(DOMContentLoaded 뒤 실행돼도 대기 상태로 남지 않게)
      const run = () => { try { callback?.apply(catui, args); resolve(args); } catch (err) { reject(err); } };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
    });
  },

  // 사용자 모듈 추가: catui.extend({ chart: myChart }) → catui.use('chart', fn) / catui.chart
  extend(obj) {
    for (const [name, mod] of Object.entries(obj || {})) {
      if (catuiModules[name]) { hint.error(`이미 있는 모듈 이름입니다: ${name}`); continue; }
      if (name in catui) { hint.error(`catui의 기본 API 이름은 모듈 이름으로 쓸 수 없습니다: ${name}`, "error"); continue; }
      catuiModules[name] = mod;
      catui[name] = mod;
    }
    return catui;
  },
  // 정의형: catui.define('chart', ['layer'], (layer) => ({ ... }))
  define(name, deps, factory) {
    if (typeof deps === "function") { factory = deps; deps = []; }
    const missing = deps.filter((d) => !catuiModules[d]);
    if (missing.length) { hint.error(`define('${name}'): 없는 의존 모듈 ${missing.join(", ")} — 먼저 정의해 주세요`, "error"); return catui; }
    return catui.extend({ [name]: factory(...deps.map((d) => catuiModules[d])) });
  },

  // 어느 모듈이든 이벤트: catui.onevent('form', 'submit(login)', fn) / catui.event('form', 'submit', 'login', data)
  onevent: onEvent,
  offevent: offEvent,
  event: emit,

  // data-catui-* 선언형 마크업 연결. 자동 1회 실행되며, 새로 그린 영역은 catui.init(영역)으로 다시 준비한다.
  init(scope = document) {
    const root = scopeOf(scope);   // 선택자 문자열·요소·document 모두 허용
    if (!root) { hint.error(`catui.init: 영역을 찾을 수 없습니다 (${scope})`); return catui; }
    if (!catuiReady) {
      catuiReady = true;
      catuiOffs = [form.bind(), tabs.bind(), table.bindStatic(), dropdown.bindDetails(), slider.bind(), rate.bind(), collapse.bind(), fx.bind(), page.bind(), site.bind()].filter((f) => typeof f === "function");
      const overlays = bindToggleOverlays();
      catuiOffs.push(overlays.off);
      catuiPrepareOverlays = overlays.prepare;
      if (getConfig().autoDestroy) { const off = catuiWatchDetached(); if (off) catuiOffs.push(off); }
    }
    // 한 모듈의 준비가 실패해도 나머지 모듈은 계속 준비한다 (오류는 콘솔에)
    const steps = [["overlays", () => catuiPrepareOverlays?.(root)], ["form", () => form.render(root)], ["table", () => table.enhance(root)], ["datePicker", () => datePicker.enhance(root)],
      ["carousel", () => carousel.enhance(root)], ["field", () => field.enhance(root)], ["page", () => page.enhance(root)], ["site", () => site.enhance(root)]];
    for (const [name, run] of steps) { try { run(); } catch (err) { hint.error(`catui.init: ${name} 준비 중 오류`, "error", err); } }
    return catui;
  },
  // 전역 연결 해제 + 렌더한 인스턴스·열린 레이어 정리 (테스트·SPA 정리용)
  destroy() {
    catuiOffs.forEach((f) => { try { f(); } catch { /* 해제 실패 무시 */ } });
    catuiOffs = [];
    catuiPrepareOverlays = null;
    catuiReady = false;
    Object.values(catuiModules).forEach((m) => { try { m?.destroyAll?.(); } catch { /* 사용자 모듈 오류 무시 */ } });
    layer.closeAll();
  },
};

// 자동 초기화: catui.config({ autoInit: false })로 끌 수 있다(스크립트 직후 호출)
const catuiAuto = () => { if (getConfig().autoInit && !catuiReady) catui.init(); };
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", catuiAuto, { once: true });
  else queueMicrotask(catuiAuto);
}

global.catui = catui;
})(typeof window !== "undefined" ? window : globalThis);
