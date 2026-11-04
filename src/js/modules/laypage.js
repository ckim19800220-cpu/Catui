import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon, uid, imeBusy } from "../core/dom.js";

// laypage — 페이지 이동.
//   laypage.render({ elem: '#pager', count: 120, limit: 10, curr: 1, jump(obj, first) { obj.curr; obj.limit } })
//   layout: ['count', 'prev', 'page', 'next', 'limit', 'skip'] 중 고른 순서대로 (기본 prev·page·next)
//     count 총 건수 · limit 쪽 크기 고르기(limits: [10, 20, 50, 100]) · skip 쪽 번호 입력해 바로 가기
export const laypage = component({
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
      const data = info();   // 콜백과 이벤트가 같은 { curr, limit, count, pages }를 받는다(문서 계약)
      c.jump?.call(inst, data, false);
      inst.emit("jump", data);
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
