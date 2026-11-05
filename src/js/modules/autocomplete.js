import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, floatRoot, placeFixed, uid, imeBusy } from "../core/dom.js";
import { hint } from "../core/base.js";

// autocomplete — 입력 자동완성 (WAI-ARIA combobox + listbox).
//   autocomplete.render({ elem: '#city', data: ['서울', '부산', …] })
//   autocomplete.render({ elem: '#user', data: async (q, signal) => (await fetch(`/api/users?q=${encodeURIComponent(q)}`, { signal })).json(),
//                         minLength: 1, delay: 200, limit: 8, select(item) {} })
//   항목: 문자열 또는 { value, label, desc, disabled } — value가 입력에 들어가고 label을 보여 준다(없으면 value).
//   이벤트: autocomplete.on('select(f)', ({ item, value }) => {})
// 한글은 조합 중에도 후보를 갱신하고, 조합 중 Enter는 선택하지 않는다. 늦게 온 이전 요청 결과는 버린다.
export const autocomplete = component({
  name: "autocomplete",
  config: { data: [], minLength: 1, delay: 150, limit: 8, highlight: true, empty: "결과가 없습니다.", loadingText: "찾는 중…", openOnFocus: false, select: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!(input instanceof HTMLInputElement)) return;
    const listId = uid("catui-ac");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    const prevAuto = input.getAttribute("autocomplete");   // 해제할 때 원래 값으로
    input.autocomplete = "off";
    let panel = null, items = [], active = -1, timer = 0, ctrl = null, seq = 0;

    const norm = (it) => (typeof it === "object" && it !== null ? { ...it, value: String(it.value ?? it.label ?? ""), label: String(it.label ?? it.value ?? "") } : { value: String(it), label: String(it) });
    // 검색어와 같은 부분을 굵게 (escape는 html``이 처리)
    const mark = (label, q) => {
      const i = c.highlight && q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
      return i < 0 ? label : html`${label.slice(0, i)}<b>${label.slice(i, i + q.length)}</b>${label.slice(i + q.length)}`;
    };
    const place = () => {
      const r = input.getBoundingClientRect();
      panel.style.minWidth = `${Math.round(r.width)}px`;
      const p = panel.getBoundingClientRect();
      const up = innerHeight - r.bottom < p.height + 8 && r.top > p.height + 8;
      placeFixed(panel, Math.min(Math.max(8, r.left), innerWidth - p.width - 8), up ? r.top - p.height - 4 : r.bottom + 4);
    };
    const onMove = () => panel && place();
    const ensure = () => {
      if (panel) return;
      panel = document.createElement("div");
      panel.id = listId;
      panel.className = "Catui_dd-menu Catui_dd-float";
      panel.setAttribute("role", "listbox");
      panel.setAttribute("aria-label", `${input.labels?.[0]?.textContent.trim() || "추천"} 목록`);
      panel.style.maxHeight = "min(320px, 50vh)";
      panel.style.overflowY = "auto";
      floatRoot(input).appendChild(panel);
      // 목록을 누를 때 입력 칸이 포커스를 잃어 목록이 닫히지 않게
      panel.addEventListener("pointerdown", (e) => e.preventDefault());
      panel.addEventListener("click", onPick);
      addEventListener("resize", onMove);
      addEventListener("scroll", onMove, true);
    };
    const close = () => {
      clearTimeout(timer); ctrl?.abort(); ctrl = null;
      if (!panel) return;
      panel.remove(); panel = null; items = []; active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      removeEventListener("resize", onMove);
      removeEventListener("scroll", onMove, true);
    };
    const setActive = (i) => {
      if (!panel) return;
      const opts = [...panel.querySelectorAll('[role="option"]')];
      active = i;
      opts.forEach((o, k) => o.setAttribute("aria-selected", String(k === i)));
      const on = opts[i];
      if (on) { input.setAttribute("aria-activedescendant", on.id); on.scrollIntoView({ block: "nearest" }); } else input.removeAttribute("aria-activedescendant");
    };
    const show = (q, list, status) => {
      ensure();
      items = list.slice(0, c.limit).map(norm);
      mount(panel, status
        ? html`<p class="Catui_dd-group" role="presentation" aria-live="polite">${status}</p>`
        : items.length
          ? html`${items.map((it, i) => html`<div class="Catui_dd-item" role="option" id="${listId}-${i}" data-catui-ac="${i}" aria-selected="false" ${it.disabled ? html`aria-disabled="true"` : ""}><span>${mark(it.label, q)}${it.desc ? html` <span class="Catui_help">${it.desc}</span>` : ""}</span></div>`)}`
          : html`<p class="Catui_dd-group" role="presentation" aria-live="polite">${c.empty}</p>`);
      input.setAttribute("aria-expanded", "true");
      active = -1;
      input.removeAttribute("aria-activedescendant");   // 이전 후보는 지워졌으므로 가리키던 id도 비운다
      place();
    };
    const pick = (i) => {
      const it = items[i];
      if (!it || it.disabled) return;
      input.value = it.value;
      close();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      c.select?.call(inst, it);
      inst.emit("select", { item: it, value: it.value, elem: input });
    };
    function onPick(e) { const o = e.target.closest("[data-catui-ac]"); if (o) pick(Number(o.dataset.catuiAc)); }
    const search = (q) => {
      clearTimeout(timer);
      ctrl?.abort();
      if (q.length < c.minLength) { close(); return; }
      const my = ++seq;
      const run = async () => {
        if (typeof c.data !== "function") {
          const ql = q.toLowerCase();
          show(q, (c.data || []).filter((it) => { const n = norm(it); return `${n.label} ${n.value} ${n.desc || ""}`.toLowerCase().includes(ql); }));
          return;
        }
        const mine = (ctrl = new AbortController());
        show(q, [], c.loadingText);
        // 새 검색이 시작됐거나 목록이 닫혔으면(close가 ctrl을 비움) 늦게 온 결과로 목록을 다시 열지 않는다
        const stale = () => my !== seq || ctrl !== mine;
        try {
          const res = await c.data(q, mine.signal);
          if (stale()) return;
          show(q, Array.isArray(res) ? res : res?.data || []);
        } catch (err) {
          if (err?.name === "AbortError" || stale()) return;
          hint.error("autocomplete: 후보를 불러오지 못했습니다", "error", err);
          show(q, [], "후보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      };
      timer = setTimeout(run, typeof c.data === "function" ? c.delay : 0);
    };
    const onInput = (e) => { if (e.isTrusted === false && !panel) return; search(input.value.trim()); };
    // 고를 수 없는(disabled) 후보는 건너뛴다
    const step = (dir) => {
      const n = items.length, base = active < 0 && dir < 0 ? n : active;   // 아무것도 없을 때 ↑는 마지막 후보부터
      for (let k = 1; k <= n; k++) { const i = (((base + dir * k) % n) + n) % n; if (!items[i].disabled) { setActive(i); return; } }
    };
    const onKey = (e) => {
      const n = items.length;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && imeBusy(e)) return;   // 한글 조합 중 ↑↓는 조합 확정에 쓴다
      if (e.key === "ArrowDown") { e.preventDefault(); if (!panel) { search(input.value.trim()); return; } if (n) step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (n) step(-1); }
      else if (e.key === "Enter" && panel && active >= 0 && !imeBusy(e)) { e.preventDefault(); pick(active); }
      else if (e.key === "Escape" && panel && !imeBusy(e)) { e.preventDefault(); e.stopPropagation(); close(); }   // 모달 안이면 목록만 닫힘
      else if (e.key === "Tab") close();
    };
    const onFocus = () => { if (c.openOnFocus) search(input.value.trim()); };
    const onBlur = () => close();
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKey);
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    inst.close = close;
    inst.search = (q) => search(String(q ?? input.value).trim());
    inst.use(() => {
      close();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      ["role", "aria-autocomplete", "aria-expanded", "aria-controls", "aria-activedescendant"].forEach((a) => input.removeAttribute(a));
      if (prevAuto == null) input.removeAttribute("autocomplete"); else input.setAttribute("autocomplete", prevAuto);
    });
  },
});
