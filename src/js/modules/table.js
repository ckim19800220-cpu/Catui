import { component } from "../core/component.js";
import { html, raw, isRaw, escape } from "../core/html.js";
import { mount, icon, uid } from "../core/dom.js";
import { emit } from "../core/events.js";
import { csrfHeaders } from "../core/base.js";
import { laypage } from "./laypage.js";

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
export const table = component({
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
          method: c.method, signal: ac.signal, headers: { Accept: "application/json", ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }), ...csrfHeaders(c.url, c.method), ...c.headers },
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
