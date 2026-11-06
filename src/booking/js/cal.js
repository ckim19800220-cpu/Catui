// calendar — 날짜 고르기 달력
//   보기 전용 격자가 아니라 "날짜 단추 묶음"이므로 role="grid"를 쓰지 않고 표(caption·요일 머리) + 단추.
//   Tab은 한 번만(roving tabindex), 화살표 ←→ 하루 · ↑↓ 한 주 · Home/End 주의 처음/끝 · PageUp/PageDown 한 달.
//   날짜 상태(가능·임박·마감·휴무·지난 날짜)는 글자로 함께 보여 주고, 고를 수 없는 날은 aria-disabled(초점은 받음)
booking.calendar = {
  short: { open: "가능", few: "임박", full: "마감", closed: "휴무" },
  /** month "YYYY-MM" · stateOf(date) → past|beyond|closed|full|few|open · onSelect(date) · 반환 { go(month), select(date), month() } */
  mount(box, { month, selected = "", stateOf = () => "open", onSelect = null, label = "날짜 선택" } = {}) {
    box = typeof box === "string" ? document.querySelector(box) : box;
    if (!box) return null;
    const today = booking.today(), minMonth = today.slice(0, 7);
    const maxMonth = booking.addDays(today, booking.rules.maxDays).slice(0, 7);
    const st = { month: month || (selected || today).slice(0, 7), selected, focus: selected || "" };
    const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number), t = new Date(Date.UTC(y, mo - 1 + n, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };
    const daysIn = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
    const draw = () => {
      const m = st.month, [y, mo] = m.split("-").map(Number), first = booking.dow(`${m}-01`), n = daysIn(m);
      const cells = [...Array(first).fill(""), ...Array.from({ length: n }, (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`)];
      while (cells.length % 7) cells.push("");
      const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
      if (!st.focus || st.focus.slice(0, 7) !== m) st.focus = st.selected && st.selected.slice(0, 7) === m ? st.selected : (today.slice(0, 7) === m ? today : `${m}-01`);
      catui.mount(box, catui.html`<div class="Catui_bk-cal">
        <div class="Catui_bk-cal-head">
          <button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-cal-move="-1" aria-label="이전 달"${m <= minMonth ? catui.html` disabled` : ""}>${catui.icon("chevron-left", 18)}</button>
          <p class="Catui_bk-cal-t" aria-live="polite">${y}년 ${mo}월</p>
          <button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-cal-move="1" aria-label="다음 달"${m >= maxMonth ? catui.html` disabled` : ""}>${catui.icon("chevron-right", 18)}</button>
        </div>
        <table class="Catui_bk-cal-tbl">
          <caption class="Catui_clip">${label} — ${y}년 ${mo}월. 화살표 키로 날짜를 옮기고 Enter로 고릅니다.</caption>
          <thead><tr>${[0, 1, 2, 3, 4, 5, 6].map((i) => catui.html`<th scope="col" abbr="${booking.dowName(i)}요일"${i === 0 || i === 6 ? catui.html` data-weekend` : ""}>${booking.dowName(i)}</th>`)}</tr></thead>
          <tbody>${weeks.map((w) => catui.html`<tr>${w.map((dkey) => {
            if (!dkey) return catui.html`<td></td>`;
            const s = stateOf(dkey), off = s === "past" || s === "beyond" || s === "closed";
            return catui.html`<td><button class="Catui_bk-day" type="button" data-date="${dkey}" data-state="${s}" tabindex="${dkey === st.focus ? "0" : "-1"}" aria-pressed="${String(dkey === st.selected)}"${off ? catui.html` aria-disabled="true"` : ""}${dkey === today ? catui.html` aria-current="date"` : ""}>${bkClip(`${booking.dateLabel(dkey, { long: true }).slice(6)}${dkey === today ? ", 오늘" : ""}, ${booking.dayText(s)}`)}<span class="Catui_bk-day-n" aria-hidden="true">${Number(dkey.slice(8))}</span><span class="Catui_bk-day-s" aria-hidden="true">${this.short[s] || ""}</span></button></td>`;
          })}</tr>`)}</tbody>
        </table>
      </div>`);
    };
    const focusDate = (dkey) => {
      if (dkey.slice(0, 7) !== st.month) {
        const m = dkey.slice(0, 7);
        if (m < minMonth || m > maxMonth) return;
        st.month = m;
      }
      st.focus = dkey; draw();
      box.querySelector(`[data-date="${dkey}"]`)?.focus();
    };
    booking._on(box, "click", (e) => {
      const mv = e.target.closest("[data-cal-move]");
      if (mv) { st.month = shiftMonth(st.month, Number(mv.dataset.calMove)); st.focus = ""; draw(); box.querySelector(`[data-cal-move="${mv.dataset.calMove}"]:not([disabled])`)?.focus(); return; }
      const b = e.target.closest(".Catui_bk-day");
      if (!b) return;
      st.focus = b.dataset.date;
      if (b.getAttribute("aria-disabled") === "true") { booking.announce(`${booking.dateLabel(b.dataset.date)}은(는) ${booking.dayText(b.dataset.state)}이라 고를 수 없습니다`); return; }
      st.selected = b.dataset.date; draw();
      box.querySelector(`[data-date="${st.selected}"]`)?.focus();
      onSelect?.(st.selected);
    });
    booking._on(box, "keydown", (e) => {
      const b = e.target.closest(".Catui_bk-day");
      if (!b || catui.imeBusy(e)) return;
      const dkey = b.dataset.date, dow = booking.dow(dkey);
      const go = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow }[e.key];
      if (go !== undefined) { e.preventDefault(); focusDate(booking.addDays(dkey, go)); return; }
      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        const m = shiftMonth(dkey.slice(0, 7), e.key === "PageUp" ? -1 : 1);
        focusDate(`${m}-${String(Math.min(Number(dkey.slice(8)), daysIn(m))).padStart(2, "0")}`);
      }
    });
    draw();
    return { go: (m) => { st.month = m; st.focus = ""; draw(); }, select: (dkey) => { st.selected = dkey; st.month = dkey.slice(0, 7); st.focus = dkey; draw(); }, month: () => st.month, redraw: draw };
  },
};
