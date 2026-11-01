import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon } from "../core/dom.js";

// tree — 트리. 접힘은 네이티브 <details>, 선택 행은 brand-soft, 체크박스는 부모·자식 상태가 전파된다(일부 선택 = indeterminate).
//   tree.render({ elem: '#tree', id: 'docs', data: [{ id, title, children: [...], spread: true, disabled }],
//                 showCheckbox: true, accordion: false, click(obj) {}, oncheck(obj) {} })
//   tree.getChecked('docs') → 체크된 잎 노드 배열 / tree.setChecked('docs', [id...]) / tree.getSelected('docs')
// 키보드: ↑↓ 보이는 항목 이동, → 펼치기, ← 접기·부모로, Home/End.
export const tree = component({
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
