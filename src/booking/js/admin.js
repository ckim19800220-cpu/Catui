// admin — 관리자 일정표 (data/schedule.json · staff.json)
//   [data-catui-bk-admin]  일 보기(직원별 열) · 주 보기(요일별 열, 직원 거르기) — 시간축 격자에 예약 블록
//   보기 전용이라 role="grid"를 쓰지 않는다: 열마다 제목(h3) + 시간 순 목록(ol). 겹친 블록은 booking.layout으로 나란히(“겹침” 글자)
//   주소: ?view=day|week&date=YYYY-MM-DD&staff=s1
booking.adminPage = {
  status: { booked: "확정", pending: "확인 대기", done: "완료", noshow: "노쇼", cancelled: "취소" },
  /** 열 하나: { id, title, sub, items } → 마크업 */
  col(d, c, i, range, nowTop) {
    const laid = booking.layout(c.items);
    return catui.html`<section class="Catui_bk-sched-col" aria-labelledby="sc-h-${i}">
      <h3 class="Catui_bk-sched-h" id="sc-h-${i}">${c.title}<small>${c.sub} · ${c.items.filter((b) => b.status !== "cancelled").length}건</small></h3>
      <div class="Catui_bk-sched-body">
        <ol class="Catui_bk-sched-list">${laid.map((b) => {
          const p = booking.place(b, range), svc = d.S[b.svc];
          return catui.html`<li class="Catui_bk-block" data-status="${b.status}" data-tone="${d.T[b.staff]?.tone || 1}" style="top:${p.top.toFixed(3)}%;height:${p.height.toFixed(3)}%;--Catui_bk-lane:${b.lane};--Catui_bk-lanes:${b.lanes}">
            <b>${b.start}–${b.end}</b><span>${b.customer} · ${svc?.name.split(" ")[0] || b.svc}</span>${c.showStaff ? catui.html`<span>${d.T[b.staff]?.name || ""}</span>` : ""}
            <span class="Catui_bk-block-st">${this.status[b.status] || b.status}${b.lanes > 1 ? " · 겹침" : ""}</span>${b.memo ? bkClip(` 메모: ${b.memo}`) : ""}
          </li>`;
        })}</ol>
        ${nowTop != null ? catui.html`<div class="Catui_bk-sched-now" style="top:${nowTop.toFixed(3)}%" aria-hidden="true"></div>` : ""}
      </div>
    </section>`;
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-admin]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      const q = booking.query(), st = { view: q.get("view") === "week" ? "week" : "day", date: q.get("date") || booking.today(), staff: q.get("staff") || "all" };
      const board = box.querySelector("[data-board]"), title = box.querySelector("[data-title]"), sel = box.querySelector("[data-staff]"), stats = box.querySelector("[data-stats]");
      const range = { from: d.schedule.from, to: d.schedule.to };
      if (sel) catui.mount(sel, catui.html`<option value="all">모든 직원</option>${d.staff.map((s) => catui.html`<option value="${s.id}">${s.name} (${s.role})</option>`)}`);
      const draw = (say) => {
        if (sel) { sel.value = st.staff; sel.closest("[data-staff-wrap]").hidden = st.view !== "week"; }
        box.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === st.view)));
        const mon = booking.addDays(st.date, -((booking.dow(st.date) + 6) % 7));
        const days = st.view === "week" ? Array.from({ length: 7 }, (_, i) => booking.addDays(mon, i)) : [st.date];
        const items = d.schedule.items.filter((x) => days.includes(x.date) && (st.view === "day" || st.staff === "all" || x.staff === st.staff));
        const cols = st.view === "day"
          ? d.staff.map((s) => ({ id: s.id, title: s.name, sub: s.role, items: items.filter((x) => x.staff === s.id) }))
          : days.map((k) => ({ id: k, title: booking.dateLabel(k), sub: k === booking.today() ? "오늘" : booking.dow(k) === 0 || booking.dow(k) === 6 ? "주말" : "평일", items: items.filter((x) => x.date === k), showStaff: st.staff === "all" }));
        const t = booking.kst(), f = booking.toMin(range.from), span = booking.toMin(range.to) - f;
        const nowTop = t.min >= f && t.min <= f + span ? ((t.min - f) / span) * 100 : null;
        const hours = Array.from({ length: span / 60 + 1 }, (_, i) => booking.fromMin(f + i * 60));
        title.textContent = st.view === "day" ? booking.dateLabel(st.date, { year: true }) : `${booking.dateLabel(days[0], { year: true })} ~ ${booking.dateLabel(days[6])}`;
        catui.mount(board, catui.html`<div class="Catui_bk-sched-scroll" role="region" aria-label="${st.view === "day" ? "직원별 일정표" : "주간 일정표"} — 가로로 밀어 볼 수 있습니다" tabindex="0">
          <div class="Catui_bk-sched${st.view === "week" ? " Catui_bk-sched-week" : ""}" style="--Catui_bk-cols:${cols.length};--Catui_bk-hours:${hours.length - 1}">
            <div class="Catui_bk-sched-axis" aria-hidden="true">${hours.map((h, i) => catui.html`<span style="--Catui_bk-i:${i}">${h}</span>`)}</div>
            ${cols.map((c, i) => this.col(d, c, i, range, st.view === "day" ? (st.date === t.key ? nowTop : null) : (c.id === t.key ? nowTop : null)))}
          </div>
        </div>`);
        const live = items.filter((x) => x.status !== "cancelled");
        const overlaps = cols.reduce((n, c) => n + booking.layout(c.items.filter((x) => x.status !== "cancelled")).filter((b) => b.lanes > 1).length, 0);
        if (stats) catui.mount(stats, catui.html`<li><span>예약</span><b>${live.length}건</b></li><li><span>확인 대기</span><b>${live.filter((x) => x.status === "pending").length}건</b></li><li><span>겹친 블록</span><b>${overlaps}개</b></li><li><span>대기 명단</span><b>${booking.wait.list(d).filter((w) => days.includes(w.date) && w.status === "waiting").length}명</b></li>`);
        const u = new URL(location.href);
        u.searchParams.set("view", st.view); u.searchParams.set("date", st.date);
        if (st.view === "week" && st.staff !== "all") u.searchParams.set("staff", st.staff); else u.searchParams.delete("staff");
        history.replaceState(null, "", u);
        if (say) booking.announce(`${title.textContent} — 예약 ${live.length}건`);
      };
      booking._on(box, "click", (e) => {
        const v = e.target.closest("[data-view]"), m = e.target.closest("[data-move]");
        if (v) { st.view = v.dataset.view; draw(true); }
        if (m) { const n = Number(m.dataset.move); st.date = n ? booking.addDays(st.date, n * (st.view === "week" ? 7 : 1)) : booking.today(); draw(true); }
      });
      if (sel) booking._on(sel, "change", () => { st.staff = sel.value; draw(true); });
      draw();
      return d;
    }).catch(() => null);
  },
};
