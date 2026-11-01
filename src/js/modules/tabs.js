import { component } from "../core/component.js";
import { html, isRaw } from "../core/html.js";
import { mount, uid } from "../core/dom.js";
import { emit } from "../core/events.js";
import { hint } from "../core/base.js";

// tabs — 탭. CSS만으로도 동작하는 radio 구조(.Catui_tabs)를 그대로 쓰고, JS는 이벤트·추가·삭제·전환을 더한다.
//   마크업: <div class="Catui_tabs" data-catui-filter="doc"> <input type=radio> <label class="Catui_tab"> <div class="Catui_panel"> ...
//   tabs.on('tab(doc)', ({ index, title }) => {})
//   tabs.render({ elem: '#box', data: [{ title: '개요', content: '...' }], index: 0 })
//   tabs.change('doc', 1) / tabs.add('doc', { title, content, change: true }) / tabs.close('doc', 0)
export const tabs = component({
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
