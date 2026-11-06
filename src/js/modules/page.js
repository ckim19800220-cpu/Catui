import { component } from "../core/component.js";
import { html, isRaw } from "../core/html.js";
import { mount, layerRoot, floatRoot, placeFixed, icon, uid, el, imeBusy, reducedMotion, within } from "../core/dom.js";
import { hint } from "../core/base.js";
import { util } from "./util.js";

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
      to = Math.min(Math.max(0, Number(to) || 0), c.data.length - 1);
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
    let page = 0, busy = false, ended = false, io = null, gen = 0;   // gen: reset할 때마다 늘어나는 세대 번호
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
      io?.observe(bar);   // 실패로 멈춘 자동 감시를 다시 켠다(이미 감시 중이면 무해)
      page += 1;
      box.setAttribute("aria-busy", "true");
      status("loading");
      const my = page, myGen = gen;
      let answered = false;
      // next(항목들, 더 있음?) — 항목은 html``·Element·배열
      const next = (items, more = true) => {
        if (answered || my !== page || myGen !== gen) return;   // reset 이전 요청의 늦은 응답은 버린다(쪽 번호만으로는 새 1쪽과 구분 안 됨)
        answered = true;
        append(items);
        busy = false;
        box.setAttribute("aria-busy", "false");
        ended = !more;
        status(ended ? "end" : "more");
        if (ended) io?.disconnect();
        inst.emit("load", { page: my, more: !ended });
      };
      // 실패하면 "다시 시도" 버튼으로만 재요청한다 — 감시를 멈춰 막대가 다시 보일 때 저절로 반복 요청하지 않게
      const fail = (err) => { if (answered || myGen !== gen) return; answered = true; busy = false; page -= 1; box.setAttribute("aria-busy", "false"); io?.unobserve(bar); status("error"); hint.error("flow: 불러오기 실패", "error", err); };
      try {
        c.done.call(inst, my, next)?.catch?.(fail);
      } catch (err) { fail(err); }
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
    inst.reset = () => { gen += 1; page = 0; ended = false; busy = false; box.textContent = ""; status("more"); if (c.auto && io) { io.disconnect(); io.observe(bar); } else load(); };
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
  const nodes = within(scope, "img[data-catui-src], img[data-catui-srcset], iframe[data-catui-src], source[data-catui-srcset]");
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
  floatRoot(target).appendChild(catuiTip);
  catuiTipFor = target;
  target.setAttribute("aria-describedby", [target.getAttribute("aria-describedby"), catuiTip.id].filter(Boolean).join(" "));
  const r = target.getBoundingClientRect(), t = catuiTip.getBoundingClientRect(), g = 6;
  let side = target.getAttribute("data-catui-tip-side") || "top";
  if (side === "top" && r.top - t.height - g < 0) side = "bottom";
  else if (side === "bottom" && r.bottom + t.height + g > innerHeight) side = "top";
  const top = side === "top" ? r.top - t.height - g : r.bottom + g;
  placeFixed(catuiTip, Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2)), Math.max(8, top));
}

const catuiPageParts = [catuiPageSteps, catuiPageFlow];
export const page = {
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
    // 같은 대상 안에서 자식끼리 포커스가 옮겨 가면 숨겼다 다시 띄우지 않는다(깜빡임 방지)
    const onFocusOut = (e) => { const t = tipOf(e.target); if (t && t === catuiTipFor && !t.contains(e.relatedTarget)) catuiTipHide(); };
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
