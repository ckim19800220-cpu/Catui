/*! Catui UI framework 1.0.0 | 아이콘 Lucide(ISC) */
(function (global) {
"use strict";
if (global.catui) console.warn("[Catui warn]: catui가 이미 있습니다. 덮어씁니다.");
const BASE = (() => { const s = document.currentScript; return s && s.src ? new URL(".", s.src).href : ""; })();

// ── core/html.js ──
// 안전한 마크업 조립. html`...`의 ${값}은 자동 escape되고, raw()로 감싼 신뢰 마크업만 그대로 들어간다.
function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function raw(markup) {
  return { __raw: String(markup ?? "") };
}

function isRaw(value) {
  return !!value && typeof value === "object" && typeof value.__raw === "string";
}

function html(strings, ...values) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i >= values.length) return;
    const v = values[i];
    if (v == null || v === false) return;
    if (Array.isArray(v)) out += v.map((x) => (isRaw(x) ? x.__raw : escape(x))).join("");
    else out += isRaw(v) ? v.__raw : escape(v);
  });
  return raw(out);
}

// ── core/base.js ──

// 전역 설정 + 기본 유틸 (layui의 config / data / url / device / hint에 해당)
const catuiSettings = {
  icons: `${BASE}icons.svg?v=2`, // 아이콘 스프라이트 경로
  autoInit: true,                // DOMContentLoaded에 data-catui-* 자동 초기화
  debug: false,
};

function getConfig() {
  return catuiSettings;
}

function config(options) {
  if (options && typeof options === "object") Object.assign(catuiSettings, options);
  return catuiSettings;
}

const catuiHintSeen = new Set();
const hint = {
  error(msg, type = "warn") {
    (type === "error" ? console.error : console.warn)(`[Catui ${type}]: ${msg}`);
  },
  errorOnce(msg, type = "warn") {
    if (catuiHintSeen.has(msg)) return;
    if (catuiHintSeen.size > 100) catuiHintSeen.clear();
    catuiHintSeen.add(msg);
    hint.error(msg, type);
  },
};

// localStorage / sessionStorage 래퍼. data('표') 읽기, data('표', {key, value}) 쓰기,
// data('표', {key, remove:true}) 삭제, data('표', null) 표 삭제.
function catuiStore(storage, table, settings) {
  if (!table) return {};
  const key = `catui:${table}`;
  let all = {};
  try { all = JSON.parse(storage.getItem(key) || "{}") || {}; } catch { all = {}; }
  if (settings === null) { storage.removeItem(key); return {}; }
  if (settings && typeof settings === "object" && "key" in settings) {
    if (settings.remove) delete all[settings.key];
    else all[settings.key] = settings.value;
    storage.setItem(key, JSON.stringify(all));
  }
  return all;
}
function data(table, settings) {
  return catuiStore(window.localStorage, table, settings);
}
function sessionData(table, settings) {
  return catuiStore(window.sessionStorage, table, settings);
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
  const info = {
    os: /windows/i.test(ua) ? "windows" : /mac/i.test(ua) ? "mac" : /android/i.test(ua) ? "android" : /iphone|ipad|ios/i.test(ua) ? "ios" : /linux/i.test(ua) ? "linux" : "",
    android: /android/i.test(ua),
    ios: /iphone|ipad|ipod/i.test(ua),
    mobile: /mobile|android|iphone|ipad/i.test(ua),
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

function $(target, ctx = document) {
  if (target instanceof CatuiQuery) return target;
  if (!target) return CatuiQuery.from([]);
  if (typeof target === "string") return CatuiQuery.from(ctx.querySelectorAll(target));
  if (target instanceof Element || target === document || target === window) return CatuiQuery.from([target]);
  if (target.length != null) return CatuiQuery.from(target);
  return CatuiQuery.from([]);
}

// 첫 요소 하나 (선택자·요소 모두 허용)
function el(target, ctx = document) {
  if (!target) return null;
  if (typeof target === "string") return ctx.querySelector(target);
  if (target instanceof CatuiQuery) return target[0] || null;
  return target instanceof Element ? target : null;
}

function mount(node, markup) {
  if (isRaw(markup)) node.innerHTML = markup.__raw;
  else node.textContent = String(markup ?? "");
  return node;
}

function delegate(root, type, sel, fn, opts) {
  const handler = sel ? (e) => {
    const t = e.target instanceof Element ? e.target.closest(sel) : null;
    if (t && root.contains(t)) fn.call(t, e, t);
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
  return { __raw: `<svg class="Catui_icon Catui_i${size}${cls ? ` ${escape(cls)}` : ""}" aria-hidden="true"><use href="${escape(getConfig().icons)}#Catui_ic-${escape(name)}"></use></svg>` };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
  const key = `${mod}:${name}`;
  if (!catuiHandlers.has(key)) catuiHandlers.set(key, []);
  const entry = { filter, fn };
  catuiHandlers.get(key).push(entry);
  return () => {
    const list = catuiHandlers.get(key) || [];
    const i = list.indexOf(entry);
    if (i >= 0) list.splice(i, 1);
  };
}

function offEvent(mod, evt) {
  const { name, filter } = catuiParse(evt);
  const key = `${mod}:${name}`;
  if (filter == null) catuiHandlers.delete(key);
  else catuiHandlers.set(key, (catuiHandlers.get(key) || []).filter((h) => h.filter !== filter));
}

// 필터가 같은 핸들러 + 필터 없는 핸들러를 호출. 하나라도 false를 돌려주면 false.
function emit(mod, name, filter, payload, thisArg) {
  let result = true;
  for (const h of [...(catuiHandlers.get(`${mod}:${name}`) || [])]) {
    if (h.filter != null && h.filter !== filter) continue;
    try {
      if (h.fn.call(thisArg ?? payload?.elem ?? null, payload) === false) result = false;
    } catch (err) {
      console.error(`[Catui error]: ${mod}.on('${name}${h.filter ? `(${h.filter})` : ""}') 처리 중 오류`, err);
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
      def.render(this);
      return this;
    }
    teardown() {
      this.cleanups.splice(0).reverse().forEach((f) => { try { f(); } catch { /* 해제 실패 무시 */ } });
    }
    destroy() {
      this.teardown();
      def.destroy?.(this);
      instances.delete(this.id);
    }
  }

  const api = {
    CONST: { MOD_NAME: name, ...(def.CONST || {}) },
    Class: Instance,
    render(options = {}) {
      const prev = instances.get(options.id || el(options.elem)?.id);
      if (prev) prev.destroy();              // 같은 대상에 다시 렌더하면 이전 인스턴스 정리
      const inst = new Instance(options);
      def.beforeRender?.(inst);
      def.render(inst);
      instances.set(inst.id, inst);
      inst.config.done?.call(inst, inst);
      return inst;
    },
    reload(id, options) { const inst = instances.get(id); if (!inst) { hint.error(`${name}: id '${id}' 인스턴스가 없습니다`); return null; } return inst.reload(options); },
    getThis(id) { return instances.get(id) || null; },
    destroy(id) { instances.get(id)?.destroy(); },
    on(evt, fn) { return onEvent(name, evt, fn); },
    off(evt) { offEvent(name, evt); },
    set(options) { Object.assign(defaults, options); return api; },
    get config() { return { ...defaults }; },
  };
  for (const [k, v] of Object.entries(def)) {
    if (!["name", "config", "render", "destroy", "beforeRender", "CONST"].includes(k)) api[k] = v;
  }
  return api;
}

// ── core/init.js ──

// CSS 체크박스 모달·드로어(마크업만으로 동작하는 kit 패턴) 향상 — 견본: "스크림·포커스 트랩은 JS 영역".
// 열리면 패널 첫 요소로 포커스, Tab 가두기, Esc 닫기, 닫히면 토글 체크박스로 포커스 복귀.
function bindToggleOverlays() {
  const panelOf = (t) => t.parentElement?.querySelector(".Catui_modal, .Catui_drawer");
  const onChange = (e) => {
    const t = e.target;
    if (!t.matches?.(".Catui_modal-toggle, .Catui_drawer-toggle")) return;
    if (t.checked) panelOf(t)?.querySelector(FOCUSABLE)?.focus();  // focus()가 스타일을 동기 재계산하므로 바로 호출
    else t.focus();
  };
  const onKey = (e) => {
    const panel = e.target.closest?.(".Catui_modal, .Catui_drawer");
    if (!panel || panel.tagName === "DIALOG") return;   // <dialog>(layer)는 브라우저가 처리
    const toggle = panel.parentElement?.querySelector(".Catui_modal-toggle, .Catui_drawer-toggle");
    if (!toggle) return;
    if (e.key === "Escape") {
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (e.key !== "Tab") return;
    const list = [...panel.querySelectorAll(FOCUSABLE)];
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  // 닫기 라벨(label.Catui_close / 취소 label)도 키보드로: 포커스 가능하게 + Enter/Space
  const onKeyLabel = (e) => {
    const lab = e.target.closest?.(".Catui_modal label[for], .Catui_drawer label[for]");
    if (!lab || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    lab.click();
  };
  const prepare = (scope = document) => scope.querySelectorAll(".Catui_modal label[for]:not([tabindex]), .Catui_drawer label[for]:not([tabindex])").forEach((l) => {
    l.tabIndex = 0;
    if (!l.matches(".Catui_btn")) l.setAttribute("role", "button");
  });
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
    let timer = 0;
    const done = () => { clearTimeout(timer); node.remove(); opened.delete(index); end?.(); };
    opened.set(index, { type: "msg", node, close: done });
    node.querySelector(".Catui_toast-action")?.addEventListener("click", () => { options.action.onClick?.(index); done(); });
    if (time > 0) {
      timer = setTimeout(done, time);
      // 마우스를 올리거나 키보드 포커스가 들어오면 멈춤 (읽을 시간 확보)
      const pause = () => clearTimeout(timer), resume = () => { timer = setTimeout(done, 1500); };
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
      tryCancel();
    });
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
          if (e.key === "Enter" && options.formType !== "textarea") { e.preventDefault(); dlg.querySelector('[data-catui-btn="0"]').click(); }
        });
        options.success?.(dlg, index);
      },
      yes(index, dlg) {
        const input = dlg.querySelector(`#${fid}`), value = input.value;
        const bad = options.required !== false && !value.trim();
        input.setAttribute("aria-invalid", String(bad));
        input.setAttribute("aria-describedby", bad ? `${fid}-err` : "");
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
    const key = (e) => { if (e.key === "Escape") done(); };
    const outside = (e) => { if (!tip.contains(e.target) && !el.contains(e.target)) done(); };
    const done = () => {
      clearTimeout(timer); tip.remove(); opened.delete(index);
      if (prev) el.setAttribute("aria-describedby", prev); else el.removeAttribute("aria-describedby");
      document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside, true);
      removeEventListener("resize", place); removeEventListener("scroll", place, true);
      options.end?.(index);
    };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside, true);
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
          else if (e.key === "Home") { k = 0; show(); } else if (e.key === "End") { k = items.length - 1; show(); }
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
        const t = fl.type || "text", ins = [...el.querySelectorAll(`[name="${fl.name}"]`)];
        if (t === "checkbox" && fl.options) return [fl.name, ins.filter((x) => x.checked).map((x) => x.value)];
        if (t === "checkbox" || t === "switch") return [fl.name, !!ins[0]?.checked];
        if (t === "radio") return [fl.name, ins.find((x) => x.checked)?.value ?? ""];
        if (t === "number") return [fl.name, ins[0].value === "" ? null : Number(ins[0].value)];
        return [fl.name, ins[0]?.value ?? ""];
      }));
      const check = () => {
        const values = read(), bad = [];
        fields.forEach((fl) => {
          const box = el.querySelector(`[data-name="${fl.name}"]`);
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
        const id = `${fid}-${fl.name || i}`, box = el.querySelector(`[data-name="${fl.name}"]`);
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
        if (e.key === "Enter" && !e.isComposing && e.target.matches("input:not([type=checkbox]):not([type=radio])")) { e.preventDefault(); el.requestSubmit(); }
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
    url: [/^https?:\/\/[^\s/$.?#].[^\s]*$/i, "주소 형식이 아닙니다. 예: https://example.com"],
    number: (v) => (v === "" || Number.isFinite(Number(v)) ? "" : "숫자만 입력해 주세요."),
    date: [/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "날짜 형식이 아닙니다. 예: 2026-10-31"],
  };

  // 사용자 규칙 추가: form.verify({ name: [정규식, '메시지'] | (value, elem) => '오류 메시지' | '' })
  function verify(more) { Object.assign(rules, more || {}); return rules; }

  const fieldValue = (f) => (f.type === "checkbox" || f.type === "radio" ? (f.checked ? f.value : "") : f.value);

  function check(field) {
    const spec = field.getAttribute("data-catui-verify");
    if (!spec) return "";
    const value = fieldValue(field);
    for (const name of spec.split("|").map((s) => s.trim()).filter(Boolean)) {
      if (name !== "required" && value === "") continue;       // 빈 값은 required만 검사
      const rule = rules[name];
      if (!rule) { hint.errorOnce(`form: '${name}' 검증 규칙이 없습니다`); continue; }
      let msg = "";
      if (typeof rule === "function") msg = rule(value, field) || "";
      else if (!rule[0].test(value)) msg = rule[1];
      if (msg) {
        if (name === "required" && field.getAttribute("data-catui-reqtext")) return field.getAttribute("data-catui-reqtext");
        return msg;
      }
    }
    return "";
  }

  // 오류 표시: aria-invalid + 에러 문장(.Catui_error, 없으면 생성) + aria-describedby 연결
  function showError(field, msg) {
    if (!field.id) field.id = `catui-f-${Math.random().toString(36).slice(2, 8)}`;
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

  function validate(scope) {
    const root = el(scope);
    if (!root) return true;
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
    const root = document.querySelector(`[data-catui-filter="${CSS.escape(filter)}"]`);
    if (!root) { hint.error(`form.val: data-catui-filter="${filter}" 요소가 없습니다`); return {}; }
    if (values) {
      for (const [name, v] of Object.entries(values)) {
        root.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((f) => {
          if (f.type === "checkbox") f.checked = Array.isArray(v) ? v.includes(f.value) : !!v && (v === true || v === f.value || v === "on");
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
      if (e.submitter && f.querySelector("[data-catui-submit]") && !e.submitter.matches("[data-catui-submit]")) return;
      if (!validate(f)) { e.preventDefault(); return; }
      const filter = e.submitter?.getAttribute("data-catui-filter") || f.getAttribute("data-catui-filter");
      const ok = emit(MOD, "submit", filter, { elem: e.submitter || null, form: f, field: collect(f) }, e.submitter || f);
      if (!ok) e.preventDefault();
    };
    document.addEventListener("submit", onSubmit);
    offs.push(() => document.removeEventListener("submit", onSubmit));

    // 한 번 틀린 칸은 입력할 때마다 다시 검사 (고치면 즉시 오류 해제)
    const onInput = (e) => {
      const t = e.target;
      if (t.matches?.("[data-catui-verify][aria-invalid=true]")) showError(t, check(t));
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
      const filter = t.getAttribute("data-catui-filter") || t.closest("[data-catui-filter]")?.getAttribute("data-catui-filter");
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
    verify, validate, val, render, bind, check,
    on: (evt, fn) => onEvent(MOD, evt, fn),
    off: (evt) => offEvent(MOD, evt),
    // 프로그램 제출: form.submit('login', cb?) → 검증 후 submit 이벤트 발생
    submit(filter, cb) {
      const f = document.querySelector(`[data-catui-filter="${CSS.escape(filter)}"]`);
      if (!f || !validate(f)) return false;
      const data = { elem: null, form: f, field: collect(f) };
      if (cb) cb(data); else emit(MOD, "submit", filter, data);
      return true;
    },
    setError: showError,
  };
})();

// ── modules/laypage.js ──

// laypage — 페이지 이동.
//   laypage.render({ elem: '#pager', count: 120, limit: 10, curr: 1, jump(obj, first) { obj.curr } })
const laypage = component({
  name: "laypage",
  config: { count: 0, limit: 10, curr: 1, groups: 5, label: "페이지", jump: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box) return;
    const pages = () => Math.max(1, Math.ceil(c.count / c.limit));
    const draw = () => {
      const total = pages();
      c.curr = Math.min(Math.max(1, Number(c.curr) || 1), total);
      // 현재 쪽을 가운데 두는 번호 묶음 + 처음/끝, 사이가 비면 …
      const half = Math.floor(c.groups / 2);
      let start = Math.max(1, c.curr - half), end = Math.min(total, start + c.groups - 1);
      start = Math.max(1, end - c.groups + 1);
      const nums = [];
      if (start > 1) nums.push(1, start > 2 ? "…" : null);
      for (let i = start; i <= end; i++) nums.push(i);
      if (end < total) nums.push(end < total - 1 ? "…" : null, total);
      box.classList.add("Catui_pager");
      if (box.tagName !== "NAV") box.setAttribute("role", "navigation");
      box.setAttribute("aria-label", c.label);
      mount(box, total < 2 && !c.alwaysShow ? html`` : html`
<button class="Catui_pg" type="button" data-catui-page="${c.curr - 1}" aria-label="이전 페이지" ${c.curr === 1 ? "disabled" : ""}>${icon("chevron-right", 16, "Catui_pg-prev")}</button>
${nums.filter((n) => n !== null).map((n) => (n === "…"
    ? html`<span class="Catui_help" aria-hidden="true">…</span>`
    : html`<button class="Catui_pg${n === c.curr ? " Catui_pg-active" : ""}" type="button" data-catui-page="${n}" ${n === c.curr ? html`aria-current="page"` : ""} aria-label="${n}쪽">${n}</button>`))}
<button class="Catui_pg" type="button" data-catui-page="${c.curr + 1}" aria-label="다음 페이지" ${c.curr === total ? "disabled" : ""}>${icon("chevron-right", 16)}</button>`);
    };
    const onClick = (e) => {
      const b = e.target.closest("[data-catui-page]");
      if (!b || b.disabled) return;
      c.curr = Number(b.dataset.catuiPage);
      draw();
      box.querySelector(`[data-catui-page="${c.curr}"][aria-current]`)?.focus();
      c.jump?.call(inst, { curr: c.curr, limit: c.limit, count: c.count, pages: pages() }, false);
      inst.emit("jump", { curr: c.curr, limit: c.limit });
    };
    draw();
    box.addEventListener("click", onClick);
    inst.use(() => box.removeEventListener("click", onClick));
    c.jump?.call(inst, { curr: c.curr, limit: c.limit, count: c.count, pages: pages() }, true);
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
    const s = (inst.state ||= { rows: [], count: 0, curr: 1, sort: c.initSort ? { ...c.initSort } : null, checked: new Set(), loading: false, error: "", req: null });
    if (c.page && typeof c.page === "object" && c.page.curr) s.curr = c.page.curr;
    if (c.data) s.checked = new Set([...s.checked].filter((r) => c.data.includes(r)));
    const limit = (typeof c.page === "object" && c.page.limit) || c.limit;
    const capId = uid("catui-tbl-cap");

    mount(host, html`<div class="Catui_table-wrap" data-catui-table-body></div>${c.page ? html`<div data-catui-table-pager></div>` : ""}`);
    const body = host.querySelector("[data-catui-table-body]");
    const pagerEl = host.querySelector("[data-catui-table-pager]");

    const cellValue = (col, row, i) => {
      if (col.type === "numbers") return String((s.curr - 1) * limit + i + 1);
      if (col.templet) { const v = col.templet(row, i); return isRaw(v) ? v : escape(v); }
      if (col.toolbar) return html`<div class="Catui_actions">${col.toolbar.map((b) => html`<button class="Catui_btn Catui_btn-sm ${b.danger ? "Catui_btn-danger" : "Catui_btn-ghost"}" type="button" data-catui-event="${b.event}" aria-label="${b.text}${row[c.labelField || "id"] != null ? ` ${row[c.labelField || "id"]}` : ""}">${b.icon ? icon(b.icon, 16) : ""}${b.icon && !b.showText ? "" : b.text}</button>`)}</div>`;
      return escape(row[col.field]);
    };
    const asCell = (v) => (isRaw(v) ? v : raw(v));

    // 로컬 데이터: 정렬·쪽 나누기를 여기서. 원격: 서버가 처리했다고 보고 그대로.
    const view = () => {
      if (c.url) return s.rows;
      let rows = [...(c.data || [])];
      if (s.sort?.field && s.sort.type) {
        const f = s.sort.field, dir = s.sort.type === "asc" ? 1 : -1;
        rows.sort((a, b) => {
          const x = a[f], y = b[f];
          const nx = Number(x), ny = Number(y);
          const cmp = Number.isFinite(nx) && Number.isFinite(ny) && x !== "" && y !== "" ? nx - ny : String(x ?? "").localeCompare(String(y ?? ""), "ko");
          return cmp * dir;
        });
      }
      s.count = rows.length;
      // 데이터가 줄어 현재 쪽이 범위를 벗어나면 마지막 쪽으로
      s.curr = Math.min(Math.max(1, s.curr), Math.max(1, Math.ceil(s.count / limit)));
      return c.page ? rows.slice((s.curr - 1) * limit, s.curr * limit) : rows;
    };

    const draw = () => {
      const rows = view();
      inst.rows = rows;
      const allOn = rows.length > 0 && rows.every((r) => s.checked.has(r));
      const someOn = rows.some((r) => s.checked.has(r));
      const colspan = c.cols.length;
      mount(body, html`
<table class="Catui_tbl" ${c.caption ? html`aria-labelledby="${capId}"` : ""} aria-busy="${s.loading}">
${c.caption ? html`<caption id="${capId}">${c.caption}</caption>` : ""}
<thead><tr>${c.cols.map((col) => {
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
      ? rows.map((row, i) => html`<tr data-catui-index="${i}">${c.cols.map((col) => (col.type === "checkbox"
          ? html`<td><label class="Catui_choice"><input class="Catui_clip" type="checkbox" data-catui-check="${i}" aria-label="${i + 1}번째 행 선택" ${s.checked.has(row) ? "checked" : ""}><span class="Catui_cbx">${icon("check", 12)}</span></label></td>`
          : html`<td class="${col.align === "right" || col.type === "numbers" ? "Catui_num" : ""}">${asCell(cellValue(col, row, i))}</td>`))}</tr>`)
      : html`<tr><td colspan="${colspan}"><div class="Catui_empty">${icon("inbox", 16)}<p class="Catui_empty-title">${c.text.none}</p></div></td></tr>`}
</tbody></table>`);
      const all = body.querySelector('[data-catui-check="all"]');
      if (all) all.indeterminate = someOn && !allOn;
      if (pagerEl && !s.loading) {
        // 페이지 컴포넌트는 한 번만 만들고 이후엔 reload로 갱신 (정리 함수 누적 방지)
        if (!pager) {
          pager = laypage.render({ elem: pagerEl, id: `${inst.id}-pager`, count: s.count, limit, curr: s.curr,
            jump(obj, first) { if (first) return; s.curr = obj.curr; c.url ? load() : draw(); } });
          inst.use(() => pager.destroy());
        } else pager.reload({ count: s.count, curr: s.curr });
      }
    };
    let pager = null;

    const load = async () => {
      if (!c.url) { draw(); return; }
      s.req?.abort();
      const ac = (s.req = new AbortController());
      s.loading = c.loading; s.error = ""; draw();
      try {
        const q = new URLSearchParams({ ...c.where, ...(c.page ? { page: s.curr, limit } : {}), ...(s.sort?.type ? { field: s.sort.field, order: s.sort.type } : {}) });
        const isGet = c.method.toUpperCase() === "GET";
        const res = await fetch(isGet ? `${c.url}${c.url.includes("?") ? "&" : "?"}${q}` : c.url, {
          method: c.method, signal: ac.signal, headers: { Accept: "application/json", ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }), ...c.headers },
          body: isGet ? undefined : q,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let json = await res.json();
        if (c.parseData) json = c.parseData(json);
        if (json.code != null && Number(json.code) !== 0) throw new Error(json.msg || "데이터를 불러오지 못했습니다.");
        s.rows = json.data || [];
        s.count = Number(json.count ?? s.rows.length);
        s.checked.clear();
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
  config: { data: [], align: "left", width: "md", label: "", click: null },
  render(inst) {
    const c = inst.config;
    const trigger = inst.elem;
    if (!trigger) return;
    const menuId = uid("catui-dd");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);
    let panel = null, offs = [];

    const items = () => [...panel.querySelectorAll("[role=menuitem]:not([disabled])")];
    const place = () => {
      const r = trigger.getBoundingClientRect();
      // 너비 옵션이 없으면 메뉴를 여는 버튼과 같은 너비로 (내용이 더 길면 그만큼 넓어짐)
      if (!c.width) panel.style.minWidth = `${Math.round(r.width)}px`;
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
      trigger.setAttribute("aria-expanded", "false");
      if (focusTrigger) trigger.focus();
    };
    const open = () => {
      if (panel) return;
      panel = document.createElement("div");
      panel.id = menuId;
      panel.className = `Catui_dd-menu Catui_dd-float${c.width === "sm" ? " Catui_dd-sm" : c.width === "lg" ? " Catui_dd-lg" : ""}`;
      panel.setAttribute("role", "menu");
      panel.setAttribute("aria-label", c.label || trigger.getAttribute("aria-label") || trigger.textContent.trim() || "메뉴");
      mount(panel, html`${c.data.map((d, i) => (d.type === "-"
        ? html`<div class="Catui_dd-sep" role="separator"></div>`
        : d.type === "group"
          ? html`<p class="Catui_dd-group" role="presentation">${d.title}</p>`
          : html`<button class="Catui_dd-item${d.danger ? " Catui_dd-danger" : ""}" type="button" role="menuitem" tabindex="-1" data-catui-i="${i}" ${d.disabled ? "disabled" : ""}>${d.icon ? icon(d.icon, 16) : ""}${d.title}</button>`))}`);
      layerRoot().appendChild(panel);
      trigger.setAttribute("aria-expanded", "true");
      place();
      items()[0]?.focus();
      const onDoc = (e) => { if (!panel.contains(e.target) && !trigger.contains(e.target)) close(false); };
      const onKey = (e) => {
        const list = items(), i = list.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
        else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
        else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
        else if (e.key === "Escape") { e.preventDefault(); close(true); }
        else if (e.key === "Tab") close(false);
      };
      const onPick = (e) => {
        const b = e.target.closest("[data-catui-i]");
        if (!b) return;
        const item = c.data[Number(b.dataset.catuiI)];
        const keep = c.click?.call(inst, item, trigger) === false;
        inst.emit("click", { data: item, elem: trigger });
        if (!keep) close(true);
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
    const onTriggerKey = (e) => { if (e.key === "ArrowDown" && !panel) { e.preventDefault(); open(); } };
    trigger.addEventListener("click", onTrigger);
    trigger.addEventListener("keydown", onTriggerKey);
    inst.open = open;
    inst.close = () => close(false);
    inst.use(() => {
      close(false);
      trigger.removeEventListener("click", onTrigger);
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
      if (e.key !== "Escape") return;
      const m = e.target.closest?.("details.Catui_dd[open], details.Catui_mega[open]");
      if (!m) return;
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

// ── modules/util.js ──

// util — 자주 쓰는 도구.
const util = (() => {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const toDate = (t) => (t instanceof Date ? t : new Date(typeof t === "string" && /^\d+$/.test(t) ? Number(t) : t));

  // util.toDateString(Date.now(), 'yyyy-MM-dd HH:mm:ss')
  function toDateString(time = Date.now(), format = "yyyy-MM-dd HH:mm:ss") {
    const d = toDate(time);
    if (Number.isNaN(d.getTime())) return "";
    const map = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) };
    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => map[k]);
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
    let timer = 0;
    const tick = () => {
      const left = Math.max(0, end - (Date.now() - offset));
      const t = { d: Math.floor(left / 86400000), h: Math.floor(left / 3600000) % 24, m: Math.floor(left / 60000) % 60, s: Math.floor(left / 1000) % 60, left };
      ready?.(t);
      if (left <= 0) { clearInterval(timer); clear?.(); }
    };
    tick();
    timer = setInterval(tick, 1000);
    return { clear() { clearInterval(timer); } };
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

  async function copy(text) {
    try { await navigator.clipboard.writeText(String(text)); return true; } catch { return false; }
  }

  return { toDateString, timeAgo, countdown, debounce, throttle, copy, escape, html, raw };
})();

// ── modules/datePicker.js ──

// datePicker — 날짜·기간 선택 (layui laydate에 해당).
//   datePicker.render({ elem: '#d', min: '2026-01-01', max: '2026-12-31', done(value, date) {} })
//   datePicker.render({ elem: '#r', range: true })        // 값: 'YYYY-MM-DD ~ YYYY-MM-DD'
//   마크업: <input class="Catui_input" data-catui-date> / data-catui-date="range" data-catui-min data-catui-max
// 키보드: ↑↓←→ 하루·한 주, PageUp/PageDown 한 달, Home/End 주의 처음·끝, Enter 선택, Esc 닫기.
const datePicker = component({
  name: "datePicker",
  config: { range: false, min: "", max: "", value: "", separator: " ~ ", disabled: null, weekStart: 1, done: null },
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
    const minD = parse(c.min), maxD = parse(c.max);
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
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-nav="-1" aria-label="이전 달">${icon("chevron-right", 16, "Catui_pg-prev")}</button>
    <span aria-live="polite">${y}년 ${m + 1}월</span>
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-nav="1" aria-label="다음 달">${icon("chevron-right", 16)}</button>
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
        if (e.key === "Escape") { e.preventDefault(); close(true); return; }
        if (!t) return;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (step) { e.preventDefault(); const d = new Date(focusD); d.setDate(d.getDate() + step); moveTo(d); return; }
        if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); const d = new Date(focusD); d.setMonth(d.getMonth() + (e.key === "PageUp" ? -1 : 1)); moveTo(d); return; }
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); const d = new Date(focusD); const dow = (d.getDay() - c.weekStart + 7) % 7; d.setDate(d.getDate() + (e.key === "Home" ? -dow : 6 - dow)); moveTo(d); }
      };
      const onClick = (e) => {
        const nav = e.target.closest("[data-catui-nav]");
        if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.catuiNav), 1); focusD = new Date(view); draw(); return; }
        const act = e.target.closest("[data-catui-act]");
        if (act?.dataset.catuiAct === "today") { const t = new Date(); t.setHours(0, 0, 0, 0); moveTo(t); if (!blocked(t)) pick(t); return; }
        if (act?.dataset.catuiAct === "clear") { from = to = null; commit(); close(true); return; }
        const day = e.target.closest("[data-catui-date]");
        if (day) { focusD = parse(day.dataset.catuiDate); pick(focusD); }
      };
      const onMove = () => place();
      document.addEventListener("pointerdown", onDoc, true);
      panel.addEventListener("keydown", onKey);
      panel.addEventListener("click", onClick);
      addEventListener("resize", onMove);
      addEventListener("scroll", onMove, true);
      offs = [() => document.removeEventListener("pointerdown", onDoc, true), () => removeEventListener("resize", onMove), () => removeEventListener("scroll", onMove, true)];
    };
    // 입력 칸: 클릭·↓키로 열고, 직접 친 값은 형식·범위를 확인
    const onInputClick = () => (panel ? close(false) : open());
    const onInputKey = (e) => {
      if (e.key === "ArrowDown" || (e.key === "Enter" && !panel)) { e.preventDefault(); open(); focusDay(); }
      else if (e.key === "Escape" && panel) { e.preventDefault(); close(true); }
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
      datePicker.render({ elem: el, range: el.getAttribute("data-catui-date") === "range", min: el.getAttribute("data-catui-min") || "", max: el.getAttribute("data-catui-max") || "" });
    });
  },
});

// ── modules/upload.js ──

// upload — 파일 올리기. 끌어 놓기·선택, 형식·용량·개수 검사(오류는 문장으로), 진행률, 목록, 취소.
//   upload.render({ elem: '#zone', url: '/api/upload', accept: '.pdf,image/*', size: 10240, number: 5,
//                   list: '#files', done(res, file) {}, error(msg, file) {} })
//   url을 빼면 서버로 보내지 않고 고른 파일만 관리한다(choose 이벤트로 받아 직접 처리).
//   이벤트: upload.on('choose(f)'), 'progress(f)', 'done(f)', 'error(f)', 'remove(f)'
const upload = component({
  name: "upload",
  config: {
    url: "", method: "POST", field: "file", data: {}, headers: {}, accept: "", size: 0, number: 0,
    multiple: true, auto: true, list: null, withCredentials: false,
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
    const drawList = () => {
      if (!listEl) return;
      listEl.classList.add("Catui_files");
      mount(listEl, html`${items.map((it) => html`
<div class="Catui_file" data-catui-file="${it.id}">
  <span class="Catui_file-ico${it.status === "error" ? " Catui_file-ico-5" : ""}">${icon(it.status === "error" ? "alert-circle" : "file-text", 16)}</span>
  <span class="Catui_file-main"><span class="Catui_file-name">${it.file.name}</span>
    <span class="Catui_file-meta">${size(it.file.size)} · ${{ ready: "대기", uploading: `올리는 중 ${it.percent}%`, done: "완료", error: it.msg || "실패" }[it.status]}
    ${it.status === "uploading" ? html`<span class="Catui_prog Catui_prog-sm" role="progressbar" aria-label="${it.file.name} 올리는 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${it.percent}"><i class="Catui_pc2" style="width:${it.percent}%"></i></span>` : ""}</span></span>
  <span class="Catui_file-acts">
    ${it.status === "error" && c.url ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-retry="${it.id}">다시</button>` : ""}
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-remove="${it.id}" aria-label="${it.file.name} ${it.status === "uploading" ? "올리기 취소" : "빼기"}">${icon("x", 16)}</button>
  </span>
</div>`)}`);
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
      for (const [k, v] of Object.entries(c.headers || {})) xhr.setRequestHeader(k, v);
      it.status = "uploading"; it.percent = 0; drawList();
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        it.percent = Math.round((e.loaded / e.total) * 100);
        drawList();
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
      const bad = [], ok = [];
      for (const f of fileList) {
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
    const onOver = (e) => { e.preventDefault(); hi(true); };
    const onLeave = () => hi(false);
    const onDrop = (e) => { e.preventDefault(); hi(false); add(e.dataTransfer.files); };
    const onKey = (e) => { if (zone.tagName !== "LABEL" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.click(); } };
    const onZoneClick = (e) => { if (zone.tagName !== "LABEL" && e.target !== input) input.click(); };
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
    zone.addEventListener("dragover", onOver);
    zone.addEventListener("dragleave", onLeave);
    zone.addEventListener("drop", onDrop);
    zone.addEventListener("keydown", onKey);
    zone.addEventListener("click", onZoneClick);
    listEl?.addEventListener("click", onList);
    inst.upload = () => items.filter((it) => it.status === "ready" || it.status === "error").forEach(send);
    inst.clear = () => { items.splice(0).forEach((it) => it.xhr?.abort()); drawList(); showErr([]); };
    inst.use(() => {
      items.forEach((it) => it.xhr?.abort());
      input.removeEventListener("change", onChange);
      zone.removeEventListener("dragover", onOver);
      zone.removeEventListener("dragleave", onLeave);
      zone.removeEventListener("drop", onDrop);
      zone.removeEventListener("keydown", onKey);
      zone.removeEventListener("click", onZoneClick);
      listEl?.removeEventListener("click", onList);
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
    const count = Math.min(21, Math.floor((c.max - c.min) / c.step) + 1);
    mount(inst.elem, html`
<div class="Catui_field">
  <label class="Catui_label" for="${id}">${c.label}${c.tips ? html` <output for="${id}" class="Catui_num" data-catui-tip>${tip(c.value)}</output>` : ""}</label>
  <input class="Catui_range" id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" aria-valuetext="${tip(c.value)}" ${c.disabled ? "disabled" : ""}>
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
    inst.setValue = (v) => { input.value = String(v); sync(); onChange(); };
    inst.getValue = () => Number(input.value);
    inst.use(() => { input.removeEventListener("input", onInput); input.removeEventListener("change", onChange); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  setValue(id, v) { slider.getThis(id)?.setValue(v); },
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
      mount(inst.elem, html`<span class="Catui_rating" role="img" aria-label="${c.label ? `${c.label} ` : ""}${c.length}점 중 ${c.value}점">${Array.from({ length: c.length }, (_, i) => html`<span style="color:var(${i < c.value ? "--Catui_rating-on" : "--Catui_rating-off"})">${icon("star", 16)}</span>`)}</span>`);
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
    inst.setValue = (v) => set(Number(v) || 0, false);
    inst.use(() => { inst.elem.removeEventListener("change", onChange); inst.elem.removeEventListener("click", onClick); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
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
    const byId = new Map();
    const index = (nodes, parent) => nodes.forEach((n) => { n.__parent = parent; byId.set(String(n.id), n); if (n.children) index(n.children, n); });
    index(c.data, null);
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
      const id = String(n.id), on = s.selected === id;
      if (n.children?.length) {
        return html`<details data-catui-tid="${id}" ${s.open.has(id) ? "open" : ""}><summary data-catui-titem="${id}" class="${on ? "Catui_tree-on" : ""}" ${on ? html`aria-current="true"` : ""}>${icon("chevron-right", 16, "Catui_tree-toggle")}${c.showCheckbox ? cbx(n) : ""}${icon("folder", 16)}<span>${n.title}</span></summary><div class="Catui_tree-kids">${n.children.map(node)}</div></details>`;
      }
      return html`<div class="Catui_tree-row${on ? " Catui_tree-on" : ""}">${c.showCheckbox ? cbx(n) : ""}<button type="button" data-catui-titem="${id}" ${n.disabled ? "disabled" : ""} ${on ? html`aria-current="true"` : ""} style="flex:1;text-align:left;display:flex;align-items:center;gap:inherit">${icon(n.icon || "file-text", 16)}<span>${n.title}</span></button></div>`;
    };
    const draw = () => {
      inst.elem.classList.add("Catui_tree");
      inst.elem.setAttribute("aria-label", c.label);
      mount(inst.elem, html`${c.data.map(node)}`);
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
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (det?.open) det.open = false; else if (n.__parent) focusItem(String(n.__parent.id)); }
    };
    inst.elem.addEventListener("toggle", onToggle, true);
    inst.elem.addEventListener("click", onClick);
    inst.elem.addEventListener("change", onChange);
    inst.elem.addEventListener("keydown", onKey);
    inst.getChecked = () => [...s.checked].map((id) => byId.get(id)).filter(Boolean);
    inst.setChecked = (ids) => { [].concat(ids).forEach((id) => { const n = byId.get(String(id)); if (n) leaves(n).forEach((l) => s.checked.add(String(l.id))); }); draw(); };
    inst.getSelected = () => (s.selected ? byId.get(s.selected) : null);
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
  open(filter, index) { const d = collapseItems(filter)[index]; if (d) d.open = true; },
  close(filter, index) { collapseItems(filter).forEach((d, i) => { if (index == null || i === index) d.open = false; }); },
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
      const key = (e) => { if (e.key === "Escape") { open = false; el.classList.remove("Catui_fx-on"); front.focus(); } };
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
      if (clash) { console.warn(`[catui.fx] ${name}과 ${clash[0]}는 같은 요소에서 함께 쓸 수 없어 ${name}을 건너뜁니다 (겹치는 자리: ${mine.filter((x) => clash[1].slots.includes(x)).join(", ")})`, el); return null; }
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

// ── core/catui.js ──

// 전역 catui 객체 (layui에 해당).
//   <script src="ui/dist/catui.js"></script>
//   catui.use(['layer', 'form'], function (layer, form) { layer.msg('안녕하세요'); });
const catuiModules = { layer, form, laypage, table, tabs, dropdown, util, datePicker, upload, slider, rate, tree, collapse, canvas, fx };
let catuiReady = false;
let catuiOffs = [];

const catui = {
  version: "1.0.0",
  config,
  get cache() { return { config: getConfig(), modules: Object.keys(catuiModules) }; },
  $, el, html, raw, escape, mount, icon, hint, data, sessionData, url, device, component,
  ...catuiModules,

  // 모듈 불러오기. 모두 한 파일에 들어 있으므로 즉시(문서 준비 후) 콜백한다. Promise도 돌려준다.
  use(mods, callback) {
    if (typeof mods === "function") { callback = mods; mods = []; }
    const list = [].concat(mods || []);
    const missing = list.filter((m) => !catuiModules[m]);
    if (missing.length) hint.error(`없는 모듈: ${missing.join(", ")} (catui.extend로 추가할 수 있습니다)`, "error");
    const args = list.map((m) => catuiModules[m]);
    return new Promise((resolve) => {
      const run = () => { callback?.apply(catui, args); resolve(args); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
    });
  },

  // 사용자 모듈 추가: catui.extend({ chart: myChart }) → catui.use('chart', fn) / catui.chart
  extend(obj) {
    for (const [name, mod] of Object.entries(obj || {})) {
      if (catuiModules[name]) { hint.error(`이미 있는 모듈 이름입니다: ${name}`); continue; }
      catuiModules[name] = mod;
      catui[name] = mod;
    }
    return catui;
  },
  // 정의형: catui.define('chart', ['layer'], (layer) => ({ ... }))
  define(name, deps, factory) {
    if (typeof deps === "function") { factory = deps; deps = []; }
    return catui.extend({ [name]: factory(...deps.map((d) => catuiModules[d])) });
  },

  // 어느 모듈이든 이벤트: catui.onevent('form', 'submit(login)', fn) / catui.event('form', 'submit', 'login', data)
  onevent: onEvent,
  event: emit,

  // data-catui-* 선언형 마크업 연결. 자동 1회 실행되며, 새로 그린 영역은 catui.init(영역)으로 다시 준비한다.
  init(scope = document) {
    if (!catuiReady) {
      catuiReady = true;
      catuiOffs = [form.bind(), tabs.bind(), table.bindStatic(), dropdown.bindDetails(), slider.bind(), rate.bind(), collapse.bind(), fx.bind()];
      const overlays = bindToggleOverlays();
      catuiOffs.push(overlays.off);
      catui._prepareOverlays = overlays.prepare;
    } else catui._prepareOverlays?.(scope);
    form.render(scope);
    table.enhance(scope);
    datePicker.enhance(scope);
    return catui;
  },
  // 전역 연결 해제 (테스트·SPA 정리용)
  destroy() {
    catuiOffs.forEach((f) => f());
    catuiOffs = [];
    catuiReady = false;
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
