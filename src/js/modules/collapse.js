import { component } from "../core/component.js";
import { html, isRaw } from "../core/html.js";
import { mount, icon } from "../core/dom.js";
import { emit } from "../core/events.js";

// collapse — 접기 패널(질문·아코디언). 네이티브 <details class="Catui_faq"> 묶음.
//   마크업: <div data-catui-collapse="accordion" data-catui-filter="faq"> <details class="Catui_faq">…</details> …</div>
//   collapse.render({ elem: '#faq', accordion: true, data: [{ title, content, open }] })
//   collapse.on('collapse(faq)', ({ index, title, open }) => {}) / collapse.open('faq', 1) / collapse.close('faq')
export const collapse = component({
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
