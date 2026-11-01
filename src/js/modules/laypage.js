import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon } from "../core/dom.js";

// laypage — 페이지 이동.
//   laypage.render({ elem: '#pager', count: 120, limit: 10, curr: 1, jump(obj, first) { obj.curr } })
export const laypage = component({
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
