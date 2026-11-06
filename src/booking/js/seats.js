// seats — 좌석 배치도 (공연장 좌석 · 식당 테이블)
//   키보드로 움직이는 격자이므로 ARIA grid 패턴: role="grid" > role="row" > rowheader · gridcell > button
//   화살표 키 이동(통로는 건너뜀) · Home/End 줄 처음/끝 · Ctrl+Home/End 처음/끝 좌석 · PageUp/PageDown 맨 앞/뒤 줄 — roving tabindex(Tab 한 번에 격자 안으로)
//   상태: 선택 aria-pressed="true" + 체크 아이콘 · 예약됨 aria-disabled="true" + × 아이콘 + 빗금 · 장애인석 휠체어 아이콘 — 늘 숨김 글자로도 알린다(색만으로 알리지 않음)
booking.seats = {
  /** 좌석 이름: "A열 3번" · 테이블 "B3 테이블(6인)" */
  name(map, cell) { return map?.cap ? `${cell.id} 테이블(${cell.cap}인)` : `${cell.row}열 ${cell.n}번`; },
  /** 선택 규칙(순수) — mode "single": 하나씩 켜고 끄기(max 넘으면 거절, max 1이면 바꿔 끼움) · "adjacent": 누른 좌석을 포함해 같은 줄에 붙은 빈 좌석 max개를 한 번에
   *  통로·예약된 좌석은 "붙은 좌석"을 끊는다. 테이블(cap)은 인원(people)보다 작으면 거절. 반환 { ok, selected, reason } */
  pick({ map, selected = [], taken = [], max = 1, mode = "single", people = 0 } = {}, id) {
    const cells = booking.cells(map), cell = cells.find((c) => c.id === id && c.kind === "seat");
    if (!cell) return { ok: false, selected, reason: "없는 좌석입니다" };
    const nm = this.name(map, cell);
    if (taken.includes(id)) return { ok: false, selected, reason: `${nm} — 이미 예약된 좌석입니다` };
    if (cell.cap && people && cell.cap < people) return { ok: false, selected, reason: `${nm}에는 ${people}명이 앉을 수 없습니다` };
    if (mode === "adjacent" && max > 1) {
      if (selected.includes(id)) return { ok: true, selected: [], reason: "" };
      const row = cells.filter((c) => c.r === cell.r), at = row.indexOf(cell);
      for (let s = at; s >= Math.max(0, at - max + 1); s--) {
        const block = row.slice(s, s + max);
        if (block.length === max && block.every((c) => c.kind === "seat" && !taken.includes(c.id))) return { ok: true, selected: block.map((c) => c.id), reason: "" };
      }
      return { ok: false, selected, reason: `${cell.row}열에 ${nm}을 포함해 붙어 있는 빈 좌석 ${max}개가 없습니다` };
    }
    if (selected.includes(id)) return { ok: true, selected: selected.filter((x) => x !== id), reason: "" };
    if (max === 1) return { ok: true, selected: [id], reason: "" };
    if (selected.length >= max) return { ok: false, selected, reason: `최대 ${max}석까지 고를 수 있습니다 — 고른 좌석을 먼저 풀어 주세요` };
    return { ok: true, selected: [...selected, id], reason: "" };
  },
  /** 배치도 그리기 — 반환 { selected(), set(opt), focus(id), el } · onChange({ selected, reason }) */
  mount(box, { map, taken = [], selected = [], max = 1, mode = "single", people = 0, label = "좌석 배치도", onChange = null } = {}) {
    box = typeof box === "string" ? document.querySelector(box) : box;
    if (!box || !map) return null;
    const st = { taken: [...taken], selected: [...selected], max, mode, people };
    const cells = booking.cells(map), width = Math.max(...map.rows.map((r) => r.cells.length));
    const hint = `bk-seat-hint-${Math.random().toString(36).slice(2, 8)}`;
    const gradeOf = (rowId) => (map.grades || []).find((g) => g.rows.includes(rowId));
    catui.mount(box, catui.html`<div class="Catui_bk-seatmap">
      <p class="Catui_bk-stage">${catui.icon("arrow-up", 16)}${map.stage || "앞"}</p>
      <div class="Catui_bk-seatscroll">
        <div class="Catui_bk-seatgrid${map.cap ? " Catui_bk-seatgrid-table" : ""}" role="grid" data-catui-bk-grid aria-label="${label}" aria-describedby="${hint}" style="--Catui_bk-cols:${width}">
          ${map.rows.map((row, r) => catui.html`<div class="Catui_bk-seatrow" role="row">
            <span class="Catui_bk-rowh" role="rowheader">${row.id}${bkClip("열")}${gradeOf(row.id) ? catui.html`<small>${gradeOf(row.id).id}</small>` : ""}</span>
            ${cells.filter((c) => c.r === r).map((c) => (c.kind === "void"
              ? catui.html`<span class="Catui_bk-cell Catui_bk-aisle" role="gridcell"></span>`
              : catui.html`<span class="Catui_bk-cell" role="gridcell"><button class="Catui_bk-seat" type="button" tabindex="-1" data-seat="${c.id}" data-r="${c.r}" data-c="${c.col}"${c.access ? catui.html` data-access` : ""}></button></span>`))}
          </div>`)}
        </div>
      </div>
      <p class="Catui_help" id="${hint}">화살표 키로 좌석을 옮겨 다니고 Space·Enter로 고릅니다. Home·End는 줄의 처음·끝.</p>
      <p class="Catui_bk-seatmsg" role="status" data-seat-msg></p>
    </div>`);
    const grid = box.querySelector("[role=grid]"), msg = box.querySelector("[data-seat-msg]");
    const btns = () => [...grid.querySelectorAll(".Catui_bk-seat")];
    const paint = () => {
      for (const b of btns()) {
        const c = cells.find((x) => x.id === b.dataset.seat), on = st.selected.includes(c.id), off = st.taken.includes(c.id);
        const small = !!(c.cap && st.people && c.cap < st.people);
        b.setAttribute("aria-pressed", String(on));
        if (off || small) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
        b.toggleAttribute("data-taken", off);
        const words = [c.grade ? `${c.grade}석 ${booking.won(c.price)}` : "", c.access ? "장애인석(휠체어)" : "", off ? "예약됨" : on ? "선택됨" : small ? "인원보다 작음" : ""].filter(Boolean).join(", ");
        catui.mount(b, catui.html`${off ? catui.icon("x", 14) : on ? catui.icon("check", 14) : c.access ? catui.icon("accessible-person", 14) : ""}<span class="Catui_bk-seat-n" aria-hidden="true">${map.cap ? c.id : c.n}</span>${map.cap ? catui.html`<small aria-hidden="true">${c.cap}인</small>` : ""}${bkClip(`${this.name(map, c)}${words ? `, ${words}` : ""}`)}`);
      }
      const cur = grid.querySelector('[tabindex="0"]');
      if (!cur) { const first = grid.querySelector('.Catui_bk-seat[aria-pressed="true"]') || btns().find((b) => !b.hasAttribute("aria-disabled")) || btns()[0]; if (first) first.tabIndex = 0; }
    };
    const move = (to) => { if (!to) return; grid.querySelectorAll('.Catui_bk-seat[tabindex="0"]').forEach((b) => { b.tabIndex = -1; }); to.tabIndex = 0; to.focus(); };
    const at = (r, c) => grid.querySelector(`.Catui_bk-seat[data-r="${r}"][data-c="${c}"]`);
    const inRow = (r) => btns().filter((b) => Number(b.dataset.r) === r);
    const near = (r, c) => { if (at(r, c)) return at(r, c); for (let k = 1; k <= width; k++) { const x = at(r, c - k) || at(r, c + k); if (x) return x; } return null; };
    booking._on(grid, "keydown", (e) => {
      const b = e.target.closest(".Catui_bk-seat");
      if (!b || catui.imeBusy(e)) return;
      const r = Number(b.dataset.r), c = Number(b.dataset.c), rows = map.rows.length;
      let to = null;
      if (e.key === "ArrowRight") { for (let x = c + 1; x < width && !to; x++) to = at(r, x); }
      else if (e.key === "ArrowLeft") { for (let x = c - 1; x >= 0 && !to; x--) to = at(r, x); }
      else if (e.key === "ArrowDown") { for (let y = r + 1; y < rows && !to; y++) to = near(y, c); }
      else if (e.key === "ArrowUp") { for (let y = r - 1; y >= 0 && !to; y--) to = near(y, c); }
      else if (e.key === "Home") to = e.ctrlKey ? btns()[0] : inRow(r)[0];
      else if (e.key === "End") to = e.ctrlKey ? btns().at(-1) : inRow(r).at(-1);
      else if (e.key === "PageUp") to = near(0, c);
      else if (e.key === "PageDown") to = near(rows - 1, c);
      else return;
      e.preventDefault();
      move(to);
    });
    booking._on(grid, "click", (e) => {
      const b = e.target.closest(".Catui_bk-seat");
      if (!b) return;
      move(b);
      const res = this.pick({ map, ...st }, b.dataset.seat);
      if (res.ok) st.selected = res.selected;
      msg.textContent = res.ok ? (st.selected.length ? `고른 좌석: ${st.selected.join(", ")} (${st.selected.length}/${st.max})` : "고른 좌석이 없습니다") : res.reason;
      msg.toggleAttribute("data-warn", !res.ok);
      paint();
      onChange?.({ selected: [...st.selected], reason: res.ok ? "" : res.reason, ok: res.ok });
    });
    paint();
    return {
      el: grid,
      selected: () => [...st.selected],
      set(opt = {}) {
        Object.assign(st, opt);
        if (st.mode !== "adjacent" && st.selected.length > st.max) st.selected = st.selected.slice(0, st.max);
        if (st.mode === "adjacent" && st.selected.length && st.selected.length !== st.max) st.selected = [];
        paint();
        return [...st.selected];
      },
      focus(id) { move(id ? grid.querySelector(`[data-seat="${id}"]`) : grid.querySelector('.Catui_bk-seat[tabindex="0"]')); },
    };
  },
};
