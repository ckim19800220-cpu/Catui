import { component } from "../core/component.js";
import { html, isRaw } from "../core/html.js";
import { mount, uid } from "../core/dom.js";
import { emit } from "../core/events.js";
import { hint } from "../core/base.js";

// tabs — 탭. 두 가지 마크업을 같은 API로 다룬다.
//   1) CSS만으로 동작하는 radio 구조(정적 마크업): <div class="Catui_tabs" data-catui-filter="doc"> <input type=radio> <label class="Catui_tab"> <div class="Catui_panel"> ...
//   2) tabs.render가 그리는 WAI-ARIA 탭: [role=tablist] > button[role=tab] + [role=tabpanel] — ←→(세로는 ↑↓)·Home·End, 로빙 tabindex
//   tabs.on('tab(doc)', ({ index, title }) => {})
//   tabs.render({ elem: '#box', data: [{ title: '개요', content: '...' }], index: 0, label: '문서', vertical })
//   tabs.change('doc', 1) / tabs.add('doc', { title, content, change: true }) / tabs.close('doc', 0)
export const tabs = component({
  name: "tabs",
  config: { data: [], index: 0, label: "", vertical: false },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    if (!c.label) hint.error("tabs: label이 없어 화면 낭독기가 탭 묶음 이름을 읽지 못합니다", "warn", inst.elem);
    mount(inst.elem, html`<div class="Catui_tabs${c.vertical ? " Catui_tabs-v" : ""}" data-catui-filter="${inst.filter}" data-catui-aria><div role="tablist" ${c.label ? html`aria-label="${c.label}"` : ""} ${c.vertical ? html`aria-orientation="vertical"` : ""}></div></div>`);
    const box = inst.elem.firstElementChild;
    box.dataset.catuiName = uid("catui-tabs");
    c.data.forEach((item) => catuiTabsAppend(box, item));
    // 범위 밖·NaN index면 아무 탭도 선택되지 않으므로 0~마지막으로 맞춘다
    catuiTabsSelect(box, Math.min(Math.max(0, Math.floor(Number(c.index)) || 0), Math.max(0, c.data.length - 1)), false);
    const list = box.firstElementChild;
    const onClick = (e) => { const t = e.target.closest('[role="tab"]'); if (t) catuiTabsSelect(box, catuiTabsItems(box).indexOf(t), true); };
    const onKey = (e) => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      const items = catuiTabsItems(box), i = items.indexOf(t), n = items.length;
      const v = list.getAttribute("aria-orientation") === "vertical";
      const k = { [v ? "ArrowDown" : "ArrowRight"]: i + 1, [v ? "ArrowUp" : "ArrowLeft"]: i - 1, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      const to = (k + n) % n;
      catuiTabsSelect(box, to, true);   // 자동 활성화: 포커스가 옮겨진 탭을 바로 연다
      items[to].focus();
    };
    list.addEventListener("click", onClick);
    list.addEventListener("keydown", onKey);
    inst.use(() => { list.removeEventListener("click", onClick); list.removeEventListener("keydown", onKey); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },

  change(filter, index) { const box = catuiTabsFind(filter); if (box) catuiTabsSelect(box, index, true); },
  add(filter, item = {}) {
    const box = catuiTabsFind(filter);
    if (!box) return -1;
    catuiTabsAppend(box, item);
    const i = catuiTabsItems(box).length - 1;
    if (item.change !== false) catuiTabsSelect(box, i, true);
    else if (box.hasAttribute("data-catui-aria")) catuiTabsSelect(box, catuiTabsCurrent(box), false);   // 새 탭·패널의 tabindex·hidden 맞춤
    return i;
  },
  close(filter, index) {
    const box = catuiTabsFind(filter);
    if (!box) return;
    const items = catuiTabsItems(box), tab = items[index];
    if (!tab) return;
    const aria = box.hasAttribute("data-catui-aria");
    const wasOn = aria ? tab.getAttribute("aria-selected") === "true" : tab.checked;
    const label = aria ? tab : box.querySelector(`:scope > label[for="${CSS.escape(tab.id)}"]`);
    const panel = aria ? document.getElementById(tab.getAttribute("aria-controls"))
      : label?.nextElementSibling?.classList.contains("Catui_panel") ? label.nextElementSibling : null;
    const title = label?.textContent.trim() ?? "";   // 지우기 전에 — 문서 계약 { index, title, elem }
    const hadFocus = aria && tab.contains(document.activeElement);
    [tab, aria ? null : label, panel].forEach((n) => n?.remove());
    emit("tabs", "close", box.getAttribute("data-catui-filter"), { index, title, elem: box });
    if (wasOn && items.length > 1) catuiTabsSelect(box, Math.max(0, index - 1), true);
    if (hadFocus) catuiTabsItems(box)[Math.max(0, index - 1)]?.focus();   // 지운 탭에 있던 포커스를 이웃 탭으로
  },
  // 전역 위임: 정적 radio 탭이 바뀌면 tab(filter) 이벤트 (ARIA 탭은 render가 직접 낸다)
  bind() {
    const onChange = (e) => {
      const r = e.target;
      if (!(r instanceof HTMLInputElement) || r.type !== "radio" || !r.parentElement?.classList.contains("Catui_tabs")) return;
      const box = r.parentElement;
      const index = catuiTabsItems(box).indexOf(r);
      emit("tabs", "tab", box.getAttribute("data-catui-filter"), { index, title: box.querySelector(`:scope > label[for="${CSS.escape(r.id)}"]`)?.textContent.trim() ?? "", elem: box });
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  },
});

function catuiTabsFind(filter) {
  const byId = document.getElementById(filter);   // id를 가진 요소 자신이 .Catui_tabs일 수도 있다
  const box = document.querySelector(`.Catui_tabs[data-catui-filter="${CSS.escape(filter)}"]`) || (byId?.matches(".Catui_tabs") ? byId : byId?.querySelector(".Catui_tabs"));
  if (!box) hint.error(`tabs: data-catui-filter="${filter}" 탭이 없습니다`);
  return box;
}

// 탭 목록: ARIA 모드는 button[role=tab], radio 모드는 input
function catuiTabsItems(box) {
  return [...box.querySelectorAll(box.hasAttribute("data-catui-aria") ? ':scope > [role="tablist"] > [role="tab"]' : ":scope > input[type=radio]")];
}
function catuiTabsCurrent(box) {
  return Math.max(0, catuiTabsItems(box).findIndex((t) => t.getAttribute("aria-selected") === "true" || t.checked));
}

function catuiTabsAppend(box, item) {
  const aria = box.hasAttribute("data-catui-aria");
  const name = box.dataset.catuiName || box.querySelector(":scope > input[type=radio]")?.name || (box.dataset.catuiName = uid("catui-tabs"));
  // 이미 쓰인 id면 label[for]·aria-controls가 엉뚱한 요소를 가리키므로 새 id로
  if (item.id && document.getElementById(item.id)) hint.error(`tabs: id '${item.id}'가 이미 있어 새 id를 씁니다`, "warn");
  const id = item.id && !document.getElementById(item.id) ? item.id : uid(`${name}-t`);
  const panel = Object.assign(document.createElement("div"), { className: "Catui_panel" });
  if (item.content instanceof Element) panel.appendChild(item.content);
  else if (isRaw(item.content)) mount(panel, item.content);
  else panel.appendChild(Object.assign(document.createElement("p"), { textContent: String(item.content ?? "") }));
  if (aria) {
    const tl = box.querySelector(':scope > [role="tablist"]');
    if (!tl) { hint.error("tabs: data-catui-aria 탭에 role=\"tablist\"가 없습니다", "error", box); return; }
    const tab = Object.assign(document.createElement("button"), { type: "button", className: "Catui_tab", id, textContent: item.title ?? "" });
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", `${id}-p`);
    tab.tabIndex = -1;
    // 패널 안에 포커스할 것이 없을 때만 패널 자체를 Tab 정지점으로(있으면 정지점이 겹친다 — APG)
    const hasFocusable = !!panel.querySelector('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    Object.assign(panel, { id: `${id}-p`, hidden: true, tabIndex: hasFocusable ? -1 : 0 });
    if (hasFocusable) panel.removeAttribute("tabindex");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", id);
    tl.appendChild(tab);
    box.appendChild(panel);
    return;
  }
  const input = Object.assign(document.createElement("input"), { className: "Catui_clip", type: "radio", name, id });
  const label = Object.assign(document.createElement("label"), { className: "Catui_tab", htmlFor: id, textContent: item.title ?? "" });
  box.append(input, label, panel);
}

function catuiTabsSelect(box, index, fire) {
  const items = catuiTabsItems(box), t = items[index];
  if (!t) return;
  if (!box.hasAttribute("data-catui-aria")) {
    t.checked = true;
    if (fire) t.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const was = t.getAttribute("aria-selected") === "true";
  items.forEach((x) => {
    const on = x === t;
    x.setAttribute("aria-selected", String(on));
    x.tabIndex = on ? 0 : -1;
    const p = document.getElementById(x.getAttribute("aria-controls"));
    if (p) p.hidden = !on;
  });
  if (fire && !was) emit("tabs", "tab", box.getAttribute("data-catui-filter"), { index, title: t.textContent.trim(), elem: box });
}
