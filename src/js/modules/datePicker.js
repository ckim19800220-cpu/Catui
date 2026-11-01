import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, layerRoot, icon, uid } from "../core/dom.js";

// datePicker — 날짜·기간 선택 (layui laydate에 해당).
//   datePicker.render({ elem: '#d', min: '2026-01-01', max: '2026-12-31', done(value, date) {} })
//   datePicker.render({ elem: '#r', range: true })        // 값: 'YYYY-MM-DD ~ YYYY-MM-DD'
//   마크업: <input class="Catui_input" data-catui-date> / data-catui-date="range" data-catui-min data-catui-max
// 키보드: ↑↓←→ 하루·한 주, PageUp/PageDown 한 달, Home/End 주의 처음·끝, Enter 선택, Esc 닫기.
export const datePicker = component({
  name: "datePicker",
  config: { range: false, min: "", max: "", value: "", separator: " ~ ", disabled: null, weekStart: 1, done: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!input) return;
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parse = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
      if (!m) return null;
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return d.getMonth() === Number(m[2]) - 1 ? d : null;   // 2월 30일 같은 값 거부
    };
    const same = (a, b) => !!a && !!b && fmt(a) === fmt(b);
    const minD = parse(c.min), maxD = parse(c.max);
    const blocked = (d) => (minD && d < minD) || (maxD && d > maxD) || !!c.disabled?.(d);

    const panelId = uid("catui-dp");
    let panel = null, offs = [], view = null, focusD = null, from = null, to = null;
    if (c.value) input.value = c.value;
    const readValue = () => {
      const [a, b] = c.range ? input.value.split(c.separator) : [input.value];
      from = parse(a); to = c.range ? parse(b) : null;
    };
    input.setAttribute("aria-haspopup", "dialog");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", panelId);
    if (!input.placeholder) input.placeholder = c.range ? `YYYY-MM-DD${c.separator}YYYY-MM-DD` : "YYYY-MM-DD";
    input.autocomplete = "off";

    const draw = () => {
      const y = view.getFullYear(), m = view.getMonth();
      const lead = (new Date(y, m, 1).getDay() - c.weekStart + 7) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      const today = new Date();
      const dows = ["일", "월", "화", "수", "목", "금", "토"];
      const order = [...dows.slice(c.weekStart), ...dows.slice(0, c.weekStart)];
      const status = c.range ? (from && !to ? "끝 날짜를 고르세요" : from && to ? `${fmt(from)}${c.separator}${fmt(to)}` : "시작 날짜를 고르세요") : (from ? fmt(from) : "날짜를 고르세요");
      mount(panel, html`
<div class="Catui_dp">
  <div class="Catui_dp-head">
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-nav="-1" aria-label="이전 달">${icon("chevron-right", 16, "Catui_pg-prev")}</button>
    <span aria-live="polite">${y}년 ${m + 1}월</span>
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-nav="1" aria-label="다음 달">${icon("chevron-right", 16)}</button>
  </div>
  <div class="Catui_dp-dows" aria-hidden="true">${order.map((d) => html`<span class="Catui_dp-dow">${d}</span>`)}</div>
  <div class="Catui_dp-grid">${Array.from({ length: lead }, () => html`<span class="Catui_dp-cell Catui_dp-out" aria-hidden="true"></span>`)}${Array.from({ length: days }, (_, i) => {
    const d = new Date(y, m, i + 1);
    const sel = same(d, from) || same(d, to);
    const inRange = c.range && from && to && d > from && d < to;
    const dis = blocked(d);
    const cls = dis ? " Catui_dp-dis" : sel ? " Catui_dp-sel" : inRange ? " Catui_dp-range" : same(d, today) ? " Catui_dp-today" : "";
    return html`<button type="button" class="Catui_dp-cell${cls}" data-catui-date="${fmt(d)}" tabindex="${same(d, focusD) ? 0 : -1}" aria-pressed="${sel || !!inRange}" ${dis ? html`aria-disabled="true"` : ""} aria-label="${y}년 ${m + 1}월 ${i + 1}일 ${dows[d.getDay()]}요일${same(d, today) ? ", 오늘" : ""}${dis ? ", 선택 불가" : ""}">${i + 1}</button>`;
  })}</div>
  <p class="Catui_help" aria-live="polite">${status}</p>
  <div class="Catui_actions"><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-act="today">오늘</button><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-act="clear">지우기</button></div>
</div>`);
    };
    const focusDay = () => panel?.querySelector(`[data-catui-date="${fmt(focusD)}"]`)?.focus();
    const moveTo = (d) => {
      focusD = d;
      if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) view = new Date(d.getFullYear(), d.getMonth(), 1);
      draw(); focusDay();
    };
    const place = () => {
      const r = input.getBoundingClientRect(), p = panel.getBoundingClientRect();
      const up = innerHeight - r.bottom < p.height + 8 && r.top > p.height + 8;
      panel.style.top = `${Math.round(up ? r.top - p.height - 4 : r.bottom + 4)}px`;
      panel.style.left = `${Math.round(Math.min(Math.max(8, r.left), innerWidth - p.width - 8))}px`;
    };
    const close = (focusInput) => {
      if (!panel) return;
      offs.forEach((f) => f()); offs = [];
      panel.remove(); panel = null;
      input.setAttribute("aria-expanded", "false");
      if (focusInput) input.focus();
    };
    const commit = () => {
      const value = c.range ? (from && to ? `${fmt(from)}${c.separator}${fmt(to)}` : "") : (from ? fmt(from) : "");
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const date = c.range ? [from, to] : from;
      c.done?.call(inst, value, date);
      inst.emit("done", { value, date, elem: input });
    };
    const pick = (d) => {
      if (blocked(d)) return;
      if (!c.range) { from = d; commit(); close(true); return; }
      if (!from || to || d < from) { from = d; to = null; focusD = d; draw(); focusDay(); return; }
      to = d; commit(); close(true);
    };
    const open = () => {
      if (panel) return;
      readValue();
      focusD = from || (minD && minD > new Date() ? minD : new Date());
      view = new Date(focusD.getFullYear(), focusD.getMonth(), 1);
      panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "Catui_dd-menu Catui_dd-float";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", c.range ? "기간 선택" : "날짜 선택");
      layerRoot().appendChild(panel);
      input.setAttribute("aria-expanded", "true");
      draw(); place();
      const onDoc = (e) => { if (!panel.contains(e.target) && e.target !== input) close(false); };
      const onKey = (e) => {
        const t = e.target.closest?.("[data-catui-date]");
        if (e.key === "Escape") { e.preventDefault(); close(true); return; }
        if (!t) return;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (step) { e.preventDefault(); const d = new Date(focusD); d.setDate(d.getDate() + step); moveTo(d); return; }
        if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); const d = new Date(focusD); d.setMonth(d.getMonth() + (e.key === "PageUp" ? -1 : 1)); moveTo(d); return; }
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); const d = new Date(focusD); const dow = (d.getDay() - c.weekStart + 7) % 7; d.setDate(d.getDate() + (e.key === "Home" ? -dow : 6 - dow)); moveTo(d); }
      };
      const onClick = (e) => {
        const nav = e.target.closest("[data-catui-nav]");
        if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.catuiNav), 1); focusD = new Date(view); draw(); return; }
        const act = e.target.closest("[data-catui-act]");
        if (act?.dataset.catuiAct === "today") { const t = new Date(); t.setHours(0, 0, 0, 0); moveTo(t); if (!blocked(t)) pick(t); return; }
        if (act?.dataset.catuiAct === "clear") { from = to = null; commit(); close(true); return; }
        const day = e.target.closest("[data-catui-date]");
        if (day) { focusD = parse(day.dataset.catuiDate); pick(focusD); }
      };
      const onMove = () => place();
      document.addEventListener("pointerdown", onDoc, true);
      panel.addEventListener("keydown", onKey);
      panel.addEventListener("click", onClick);
      addEventListener("resize", onMove);
      addEventListener("scroll", onMove, true);
      offs = [() => document.removeEventListener("pointerdown", onDoc, true), () => removeEventListener("resize", onMove), () => removeEventListener("scroll", onMove, true)];
    };
    // 입력 칸: 클릭·↓키로 열고, 직접 친 값은 형식·범위를 확인
    const onInputClick = () => (panel ? close(false) : open());
    const onInputKey = (e) => {
      if (e.key === "ArrowDown" || (e.key === "Enter" && !panel)) { e.preventDefault(); open(); focusDay(); }
      else if (e.key === "Escape" && panel) { e.preventDefault(); close(true); }
    };
    const onInputChange = (e) => {
      if (!e.isTrusted) return;               // commit()이 보낸 이벤트는 건너뜀
      readValue();
      const ok = !input.value || (from && !blocked(from) && (!c.range || (to && !blocked(to) && to >= from)));
      input.setAttribute("aria-invalid", String(!ok));
    };
    input.addEventListener("click", onInputClick);
    input.addEventListener("keydown", onInputKey);
    input.addEventListener("change", onInputChange);
    inst.open = open;
    inst.close = () => close(false);
    inst.use(() => {
      close(false);
      input.removeEventListener("click", onInputClick);
      input.removeEventListener("keydown", onInputKey);
      input.removeEventListener("change", onInputChange);
    });
  },
  // 선언형: <input data-catui-date> 자동 렌더
  enhance(scope = document) {
    scope.querySelectorAll("input[data-catui-date]:not([data-catui-ready])").forEach((el) => {
      el.setAttribute("data-catui-ready", "");
      datePicker.render({ elem: el, range: el.getAttribute("data-catui-date") === "range", min: el.getAttribute("data-catui-min") || "", max: el.getAttribute("data-catui-max") || "" });
    });
  },
});
