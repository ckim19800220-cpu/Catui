import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon } from "../core/dom.js";
import { hint } from "../core/base.js";

// tree — 트리. WAI-ARIA tree 패턴: [role=tree] > [role=treeitem](aria-expanded·aria-selected·aria-level) > [role=group]
//   선택 행은 brand-soft, 체크박스는 부모·자식 상태가 전파된다(일부 선택 = aria-checked="mixed").
//   tree.render({ elem: '#tree', id: 'docs', data: [{ id, title, children: [...], spread: true, disabled }],
//                 showCheckbox: true, accordion: false, click(obj) {}, oncheck(obj) {} })
//   tree.getChecked('docs') → 체크된 잎 노드 배열 / tree.setChecked('docs', [id...]) / tree.getSelected('docs')
// 키보드(로빙 tabindex — 트리에 Tab 한 번): ↑↓ 보이는 항목 이동, → 펼치기·첫 자식, ← 접기·부모로, Home/End,
//   Enter 선택, Space 체크(체크박스가 없으면 선택). CSS만 쓰는 <details> 트리 마크업은 그대로 쓸 수 있다.
export const tree = component({
  name: "tree",
  config: { data: [], showCheckbox: false, accordion: false, label: "트리", selected: null, click: null, oncheck: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    // 부모 관계는 내부 Map에만 둔다. 사용자 데이터에 부모 참조를 넣으면 JSON.stringify(data)가 순환 오류를 낸다
    const byId = new Map(), parentOf = new Map();
    const index = (nodes, parent) => nodes.forEach((n) => {
      // 같은 id가 둘이면 선택·체크가 엉뚱한 노드를 가리킨다 — 알리고 첫 노드를 유지
      if (byId.has(String(n.id))) hint.error(`tree: 같은 id(${n.id})가 여러 번 있습니다`, "warn", n);
      else byId.set(String(n.id), n);
      parentOf.set(n, parent);
      if (n.children) index(n.children, n);
    });
    index(c.data, null);
    const kw = () => String(s.keyword || "").trim().toLowerCase();
    // 검색어가 있으면 제목이 맞는 노드와 그 조상만 보인다
    const matches = (n) => !kw() || String(n.title ?? "").toLowerCase().includes(kw()) || (n.children || []).some(matches);
    inst.state ||= { checked: new Set(), open: new Set(c.data.flatMap(function walk(n) { return [...(n.spread ? [String(n.id)] : []), ...(n.children || []).flatMap(walk)]; })), selected: c.selected != null ? String(c.selected) : null };
    const s = inst.state;
    let focusId = null;   // 다시 그린 뒤에도 같은 항목이 탭 정지점·포커스를 갖도록
    const leaves = (n) => (n.children?.length ? n.children.flatMap(leaves) : [n]);
    const stateOf = (n) => {
      const ls = leaves(n).filter((l) => !l.disabled);
      const on = ls.filter((l) => s.checked.has(String(l.id))).length;
      return on === 0 ? "off" : on === ls.length ? "on" : "mixed";
    };
    const isOpen = (n) => s.open.has(String(n.id)) || (!!kw() && n.children.some(matches));   // 검색 중에는 맞는 자식이 있는 폴더를 펼침
    // 체크박스는 모양과 마우스용. 상태는 treeitem의 aria-checked로 읽히고, 키보드는 Space로 바꾼다(트리 안 중첩 컨트롤 금지)
    const cbx = (n, st) => html`<label class="Catui_choice" style="gap:6px" aria-hidden="true"><input class="Catui_clip" type="checkbox" tabindex="-1" data-catui-tcheck="${n.id}" ${st === "on" ? "checked" : ""} ${st === "mixed" ? html`data-catui-mixed` : ""} ${n.disabled ? "disabled" : ""}><span class="Catui_cbx">${icon("check", 12)}</span></label>`;
    const node = (n, level) => {
      if (!matches(n)) return "";
      const id = String(n.id), on = s.selected === id, parent = !!n.children?.length, open = parent && isOpen(n);
      const st = c.showCheckbox ? stateOf(n) : null;
      // html``은 false를 출력하지 않으므로 상태 값은 문자열로
      return html`<div role="treeitem" data-catui-titem="${id}" aria-level="${level}" aria-selected="${String(on)}" tabindex="-1"
        ${parent ? html`aria-expanded="${String(open)}"` : ""} ${n.disabled ? html`aria-disabled="true"` : ""} ${st ? html`aria-checked="${st === "on" ? "true" : st === "mixed" ? "mixed" : "false"}"` : ""}><div class="Catui_tree-row${on ? " Catui_tree-on" : ""}">${parent ? icon("chevron-right", 16, "Catui_tree-toggle") : ""}${st ? cbx(n, st) : ""}${icon(parent ? "folder" : n.icon || "file-text", 16)}<span>${n.title}</span></div>${parent ? html`<div role="group" class="Catui_tree-kids" ${open ? "" : "hidden"}>${n.children.map((k) => node(k, level + 1))}</div>` : ""}</div>`;
    };
    const items = () => [...inst.elem.querySelectorAll('[role="treeitem"]')];
    // 보이는 항목: 접힌 묶음(hidden) 안이 아닌 것
    const visible = () => items().filter((x) => !x.parentElement.closest('[role="group"][hidden]'));
    const itemOf = (id) => inst.elem.querySelector(`[data-catui-titem="${CSS.escape(String(id))}"]`);
    const rove = (el, focus) => {
      if (!el) return;
      items().forEach((x) => { x.tabIndex = x === el ? 0 : -1; });
      focusId = el.dataset.catuiTitem;
      if (focus) el.focus();
    };
    const draw = () => {
      const hadFocus = inst.elem.contains(document.activeElement);
      inst.elem.classList.add("Catui_tree");
      inst.elem.setAttribute("role", "tree");
      inst.elem.setAttribute("aria-label", c.label);
      const list = c.data.map((n) => node(n, 1));
      mount(inst.elem, list.some(Boolean) ? html`${list}` : html`<p class="Catui_help" role="presentation">${kw() ? "맞는 항목이 없습니다." : "항목이 없습니다."}</p>`);
      inst.elem.querySelectorAll("[data-catui-mixed]").forEach((x) => { x.indeterminate = true; });
      const vis = visible();
      const keep = (focusId && vis.find((x) => x.dataset.catuiTitem === focusId)) || (s.selected && vis.find((x) => x.dataset.catuiTitem === s.selected)) || vis[0];
      rove(keep, hadFocus);
    };
    draw();

    const toggle = (el, open) => {
      const id = el.dataset.catuiTitem, n = byId.get(id);
      if (!n?.children?.length || kw()) return;   // 검색 중 자동 펼침은 상태에 반영하지 않는다
      const on = open ?? !s.open.has(id);
      if (on === s.open.has(id)) return;
      if (on) {
        s.open.add(id);
        if (c.accordion) (parentOf.get(n)?.children || c.data).forEach((sib) => { if (sib !== n) s.open.delete(String(sib.id)); });
      } else s.open.delete(id);
      focusId = id;
      draw();
      itemOf(id)?.focus();
      inst.emit("spread", { data: n, open: on });
    };
    const select = (el) => {
      const id = el.dataset.catuiTitem, n = byId.get(id);
      if (!n || n.disabled) return;   // 막힌 항목은 펼치기만 되고 선택되지 않는다
      s.selected = id;
      items().forEach((x) => { const on = x === el; x.setAttribute("aria-selected", String(on)); x.firstElementChild.classList.toggle("Catui_tree-on", on); });
      rove(el, false);
      c.click?.call(inst, { data: n, elem: el });
      inst.emit("click", { data: n, elem: el });
    };
    const check = (n, on) => {
      leaves(n).filter((l) => !l.disabled).forEach((l) => (on ? s.checked.add(String(l.id)) : s.checked.delete(String(l.id))));
      focusId = String(n.id);
      draw();
      itemOf(n.id)?.focus();
      c.oncheck?.call(inst, { data: n, checked: on });
      inst.emit("check", { data: n, checked: on });
    };
    const onClick = (e) => {
      if (e.target.closest("label.Catui_choice")) return;      // 체크박스 클릭은 change에서
      const el = e.target.closest('[role="treeitem"]');
      if (!el || !inst.elem.contains(el)) return;
      e.stopPropagation();   // 중첩 treeitem에서 부모까지 처리되지 않게
      rove(el, true);
      if (el.hasAttribute("aria-expanded")) toggle(el);
      select(itemOf(el.dataset.catuiTitem) || el);
    };
    const onChange = (e) => {
      const cb = e.target.closest("[data-catui-tcheck]");
      if (!cb) return;
      const n = byId.get(cb.dataset.catuiTcheck);
      if (n) check(n, cb.checked);
    };
    const onKey = (e) => {
      const el = e.target.closest?.('[role="treeitem"]');
      if (!el || e.target !== el) return;   // 항목 자신에 포커스가 있을 때만
      const list = visible(), i = list.indexOf(el), n = byId.get(el.dataset.catuiTitem);
      const exp = el.getAttribute("aria-expanded");
      const go = (x) => { if (x) { e.preventDefault(); rove(x, true); } };
      if (e.key === "ArrowDown") go(list[i + 1]);
      else if (e.key === "ArrowUp") go(list[i - 1]);
      else if (e.key === "Home") go(list[0]);
      else if (e.key === "End") go(list[list.length - 1]);
      else if (e.key === "ArrowRight") { e.preventDefault(); if (exp === "false") toggle(el, true); else if (exp === "true") go(el.querySelector('[role="group"] > [role="treeitem"]')); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); const p = parentOf.get(n); if (exp === "true") toggle(el, false); else if (p) go(itemOf(p.id)); }
      else if (e.key === "Enter") { e.preventDefault(); select(el); }
      else if (e.key === " ") {
        e.preventDefault();
        if (c.showCheckbox && n && !n.disabled) check(n, el.getAttribute("aria-checked") !== "true");
        else select(el);
      }
    };
    inst.elem.addEventListener("click", onClick);
    inst.elem.addEventListener("change", onChange);
    inst.elem.addEventListener("keydown", onKey);
    inst.getChecked = () => [...s.checked].map((id) => byId.get(id)).filter(Boolean);
    inst.setChecked = (ids) => { [].concat(ids).forEach((id) => { const n = byId.get(String(id)); if (n) leaves(n).filter((l) => l === n || !l.disabled).forEach((l) => s.checked.add(String(l.id))); }); draw(); };   // 부모를 고르면 사용자 클릭처럼 비활성 자식은 빼고, 비활성 잎을 직접 지정하면 그대로
    inst.getSelected = () => (s.selected ? byId.get(s.selected) : null);
    inst.clearChecked = () => { s.checked.clear(); draw(); };
    // 모두 펼치기·접기 (open=false면 접기)
    inst.expandAll = (open = true) => { s.open = new Set(open ? [...byId.values()].filter((n) => n.children?.length).map((n) => String(n.id)) : []); draw(); };
    // 제목 검색: 맞는 노드와 조상만 보이고 펼친다. 빈 문자열이면 전체
    inst.search = (keyword) => { s.keyword = keyword; draw(); };
    inst.use(() => {
      inst.elem.removeEventListener("click", onClick);
      inst.elem.removeEventListener("change", onChange);
      inst.elem.removeEventListener("keydown", onKey);
    });
  },
  destroy(inst) {
    const el = inst.elem;
    if (!el) return;
    el.textContent = "";
    el.classList.remove("Catui_tree");
    ["role", "aria-label"].forEach((a) => el.removeAttribute(a));
  },
  getChecked(id) { return tree.getThis(id)?.getChecked() || []; },
  setChecked(id, ids) { tree.getThis(id)?.setChecked(ids); },
  getSelected(id) { return tree.getThis(id)?.getSelected() || null; },
  clearChecked(id) { tree.getThis(id)?.clearChecked(); },
  expandAll(id, open = true) { tree.getThis(id)?.expandAll(open); },
  search(id, keyword) { tree.getThis(id)?.search(keyword); },
});
