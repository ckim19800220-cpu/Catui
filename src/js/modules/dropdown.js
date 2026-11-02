import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, layerRoot, icon, uid, imeBusy } from "../core/dom.js";

// dropdown — 버튼에 붙는 메뉴. 키보드(↑↓·Home·End·Esc·Tab), 바깥 클릭 닫기, 화면 끝에서 위로 뒤집기.
//   dropdown.render({ elem: '#more', data: [{ id: 'edit', title: '수정', icon: 'pen-line' }, { type: '-' },
//                    { id: 'del', title: '삭제', danger: true }], click(item, trigger) {} })
//   dropdown.on('click(more)', ({ data }) => {})
// 또, 마크업의 <details class="Catui_dd"> 메뉴도 자동으로 하나만 열기·바깥 클릭·Esc 닫기가 붙는다(bindDetails).
export const dropdown = component({
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
