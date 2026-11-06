// flow2 — 좌석 · 객실 · 예약자 정보 · 확인 · 완료 화면, 예약 한 건 보기 마크업
//   [data-catui-bk-seats]     좌석 배치도 (booking.seats.mount)    [data-catui-bk-rooms]  숙박 기간·인원·객실
//   form[data-catui-bk-info]  예약자 정보·요청사항·약관              [data-catui-bk-confirm] 확인 후 저장
//   [data-catui-bk-complete]  예약 번호·QR 자리(?no=)

// ── 예약 한 건 보기 (확인·완료·상세가 같이 씀) ──
booking.view = {
  when(d, r) {
    const svc = d.S[r.svc] || {};
    if (svc.kind === "room") return `${booking.dateLabel(r.date)} ${d.B[r.branch]?.open || ""} 체크인 → ${booking.dateLabel(r.checkout)} 체크아웃 · ${booking.nights(r.date, r.checkout)}박`;
    return `${booking.dateLabel(r.date, { year: true })} ${r.time}–${booking.fromMin(booking.toMin(r.time || "00:00") + (svc.duration || 0))}`;
  },
  dl(d, r) {
    const svc = d.S[r.svc] || {}, br = d.B[r.branch] || {};
    const rows = [["서비스", svc.name], ["지점", catui.html`${br.name}<small>${br.addr} · <a class="Catui_link" href="tel:${String(br.phone || "").replace(/-/g, "")}">${br.phone}</a></small>`], ["일정", this.when(d, r)],
      ["인원", `어른 ${r.adult || 0}명${r.child ? ` · 어린이 ${r.child}명` : ""}`]];
    if (svc.kind === "seat") rows.push([d.maps[svc.map]?.cap ? "테이블" : "좌석", (r.seats || []).join(", ") || "—"]);
    if (svc.kind === "room") rows.push(["객실", d.R[r.room]?.name || "—"]);
    rows.push(["옵션", (r.options || []).map((id) => svc.options?.find((o) => o.id === id)?.name).filter(Boolean).join(", ") || "없음"]);
    if (r.name) rows.push(["예약자", `${r.name} · ${r.phone}${r.email ? ` · ${r.email}` : ""}`]);
    if (r.request) rows.push(["요청사항", r.request]);
    return catui.html`<dl class="Catui_bk-sum Catui_bk-sum-lg">${rows.map(([k, x]) => catui.html`<div><dt>${k}</dt><dd>${x}</dd></div>`)}</dl>`;
  },
  amount(d, r, { label = "결제 금액" } = {}) {
    const a = booking.amountOf(d, r), lines = [...a.price.lines];
    if (a.stay) {
      if (a.stay.weekday) lines.unshift({ label: `객실 평일`, unit: d.R[r.room]?.price || 0, qty: a.stay.weekday, amount: a.stay.lines.filter((x) => !x.weekend).reduce((s, x) => s + x.rate, 0) });
      if (a.stay.weekend) lines.splice(a.stay.weekday ? 1 : 0, 0, { label: `객실 주말(+${booking.rules.weekendRate}%)`, unit: a.stay.lines.find((x) => x.weekend).rate, qty: a.stay.weekend, amount: a.stay.lines.filter((x) => x.weekend).reduce((s, x) => s + x.rate, 0) });
      if (a.stay.extra) lines.splice(a.stay.weekday && a.stay.weekend ? 2 : 1, 0, { label: "추가 인원", unit: a.stay.lines[0].extra, qty: a.stay.nights, amount: a.stay.extra });
    }
    return booking.flow.lines(lines, a.total, { label });
  },
  /** 환불 규정 표 — at(이용일·시각)을 주면 지금 적용되는 줄에 aria-current + "지금 적용" 글자 */
  refund(at) {
    const cur = at ? booking.refund(100, at.date, at.time || "00:00") : null;
    return catui.html`<div class="Catui_table-wrap Catui_bk-scroll"><table class="Catui_tbl Catui_bk-refund"><caption class="Catui_clip">취소 환불 규정</caption>
      <thead><tr><th scope="col">취소 시점 (한국 시간 날짜 기준)</th><th scope="col">환불</th></tr></thead>
      <tbody>${booking.refundTable().map((x) => { const now = cur?.ok && cur.rule?.days === x.days; return catui.html`<tr${now ? catui.html` aria-current="true" data-now` : ""}><td>${x.text}${now ? catui.html` <span class="Catui_badge Catui_badge-info">지금 적용</span>` : ""}</td><td>${x.rate}%${x.rate ? "" : " (환불 없음)"}</td></tr>`; })}
      ${cur && !cur.ok ? catui.html`<tr data-now aria-current="true"><td>이용 시작 이후 <span class="Catui_badge Catui_badge-danger">지금 적용</span></td><td>취소 불가</td></tr>` : ""}</tbody></table></div>`;
  },
  /** QR 코드 자리 — 예약 번호로 정해지는 무늬(실제 QR 아님, 실서비스는 서버가 만든 이미지로 바꾼다) */
  qr(no) {
    let h = 2166136261;
    const bit = (i) => { h ^= no.charCodeAt(i % no.length) + i; h = Math.imul(h, 16777619) >>> 0; return h & 1; };
    const N = 21, finder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
    const ring = (x, y) => { for (const [a, b] of [[0, 0], [N - 7, 0], [0, N - 7]]) { const dx = x - a, dy = y - b; if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4); } return false; };
    let rects = "";
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (finder(x, y) ? ring(x, y) : bit(y * N + x)) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    return catui.html`<svg class="Catui_bk-qr" viewBox="-2 -2 25 25" role="img" aria-label="예약 번호 ${no} QR 코드 자리 (예제 무늬)">${catui.raw(rects)}</svg>`;
  },
};

// ── 좌석 ──
booking.seatPage = {
  init(root) {
    const box = root.querySelector("[data-catui-bk-seats]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      let v = booking.draft.fromQuery();
      booking.flow.frame(root, d, v, "seats");
      const body = box.querySelector("[data-body]") || box;
      if (!booking.flow.need(body, d, v, { kind: "seat" })) return d;
      if (!v.date || !v.time) { catui.mount(body, catui.html`<div class="Catui_empty"><p class="Catui_empty-title">날짜와 회차를 먼저 골라 주세요</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="date.html">날짜·회차 고르기</a></div>`); return d; }
      const svc = d.S[v.svc], map = d.maps[svc.map], table = !!map.cap, people = (v.adult || 0) + (v.child || 0), max = table ? 1 : people;
      const taken = booking.seatsTaken(d, v.svc, v.date, v.time, { except: v.change });
      const adj = box.querySelector("[data-adjacent]"), msg = box.querySelector("[data-msg]");
      if (adj) { adj.closest("[data-adjacent-wrap]").hidden = table || max < 2; adj.checked = !!svc.adjacent && !table && max > 1; }
      const need = box.querySelector("[data-need]");
      if (need) need.textContent = table ? `${people}명이 앉을 테이블 1개를 고르세요 (작은 테이블은 고를 수 없습니다)` : `좌석 ${max}개를 고르세요 · ${booking.dateLabel(v.date)} ${v.time}`;
      const legendGrades = box.querySelector("[data-grades]");
      if (legendGrades) catui.mount(legendGrades, map.grades ? catui.html`${map.grades.map((g) => catui.html`<li><b>${g.id}석</b> ${g.rows.join("·")}열 ${booking.won(g.price)}</li>`)}` : catui.html`<li>테이블 번호 아래 숫자가 앉을 수 있는 인원입니다</li>`);
      const picked = box.querySelector("[data-picked]"), priceBox = box.querySelector("[data-price]");
      const paint = () => {
        if (picked) picked.textContent = (v.seats || []).length ? `${v.seats.join(", ")} (${v.seats.length}/${max})` : `아직 고르지 않음 (0/${max})`;
        const p = booking.price(svc, { adult: v.adult, child: v.child, options: v.options || [], seats: v.seats || [], map });
        if (priceBox) catui.mount(priceBox, booking.flow.lines(p.lines, p.total));
        booking.flow.frame(root, d, v, "seats");
      };
      const ctrl = booking.seats.mount(box.querySelector("[data-map]"), {
        map, taken, max, people, mode: adj?.checked ? "adjacent" : "single", label: `${map.title} ${table ? "테이블" : "좌석"} 배치도`,
        selected: (v.seats || []).filter((s) => !taken.includes(s)).slice(0, max),
        onChange: ({ selected, reason }) => { v = booking.draft.set({ seats: selected }); paint(); booking.warn(msg, ""); booking.emit("seats", { selected, reason }); },
      });
      this.ctrl = ctrl;
      if (adj) booking._on(adj, "change", () => { v = booking.draft.set({ seats: ctrl.set({ mode: adj.checked ? "adjacent" : "single" }) }); paint(); });
      booking._on(box.querySelector("[data-go]"), "click", () => {
        if ((v.seats || []).length !== max) return booking.warn(msg, table ? "테이블을 골라 주세요" : `좌석 ${max}개를 골라 주세요 (지금 ${(v.seats || []).length}개)`, ctrl.el.querySelector('[tabindex="0"]'));
        bkGo(bkNextOf("seat", "seats"));
      });
      paint();
      return d;
    }).catch(() => null);
  },
};

// ── 객실 ──
booking.roomPage = {
  draw(box, d, v) {
    const svc = d.S[v.svc], people = (v.adult || 0) + (v.child || 0), n = booking.nights(v.date, v.checkout);
    box.querySelectorAll("[data-out]").forEach((o) => { o.textContent = String(v[o.dataset.out] || 0); });
    box.querySelectorAll("[data-step]").forEach((b) => {
      const [k, s] = b.dataset.step.split(":"), val = v[k] || 0;
      b.disabled = Number(s) < 0 ? val <= (k === "adult" ? 1 : 0) : people >= (svc.maxPeople || 6);
    });
    const base = booking.stay(d.rooms[0], v.date, v.checkout, { holidays: d.holidays });
    const nightsBox = box.querySelector("[data-nights]");
    if (nightsBox) nightsBox.textContent = n ? `${n}박 · 평일 ${base.weekday}박 · 주말 ${base.weekend}박` : "체크아웃은 체크인 다음 날 이후로 골라 주세요";
    const list = box.querySelector("[data-rooms]");
    catui.mount(list, catui.html`${d.rooms.map((r) => {
      const st = booking.stay(r, v.date, v.checkout, { adult: v.adult, child: v.child, holidays: d.holidays }), left = n ? booking.roomLeft(d, r.id, v.date, v.checkout, { except: v.change }) : 0;
      const why = !n ? "기간을 골라 주세요" : left <= 0 ? "만실" : st.over ? `최대 ${r.max}명` : "";
      const id = `bk-r-${r.id}`;
      return catui.html`<li class="Catui_bk-room" data-tone="${r.tone || 1}"><input class="Catui_clip" type="radio" name="bk-room" id="${id}" value="${r.id}"${why ? catui.html` disabled` : ""}${v.room === r.id && !why ? catui.html` checked` : ""}>
        <label class="Catui_bk-room-l" for="${id}">
          <span class="Catui_bk-room-ic" aria-hidden="true">${catui.icon(r.icon || "bed", 24)}</span>
          <span class="Catui_bk-room-b"><b class="Catui_bk-room-t">${r.name}</b><small>${r.size}㎡ · ${r.beds} · 기준 ${r.base}명 / 최대 ${r.max}명</small><small>${r.amen.join(" · ")}</small></span>
          <span class="Catui_bk-room-p">${why ? catui.html`<span class="Catui_badge Catui_badge-neutral">${why}</span>` : catui.html`<b>${booking.won(st.total)}</b><small>${n}박 합계 · 남은 객실 ${left}</small>`}</span>
        </label></li>`;
    })}`);
    const room = d.R[v.room], st = booking.stay(room, v.date, v.checkout, { adult: v.adult, child: v.child, holidays: d.holidays });
    const bd = box.querySelector("[data-breakdown]");
    if (bd) catui.mount(bd, room && !st.error ? catui.html`<div class="Catui_table-wrap Catui_bk-scroll"><table class="Catui_tbl Catui_tbl-compact"><caption class="Catui_clip">${room.name} 박마다 요금</caption>
      <thead><tr><th scope="col">밤</th><th scope="col">구분</th><th scope="col" class="Catui_text-right">객실</th><th scope="col" class="Catui_text-right">추가 인원</th></tr></thead>
      <tbody>${st.lines.map((x) => catui.html`<tr><td>${booking.dateLabel(x.date)}</td><td>${x.weekend ? catui.html`<span class="Catui_pill Catui_pill-warning">${x.holiday ? "공휴일 전날" : "주말"} +${booking.rules.weekendRate}%</span>` : catui.html`<span class="Catui_pill Catui_pill-neutral">평일</span>`}</td><td class="Catui_text-right">${booking.won(x.rate)}</td><td class="Catui_text-right">${x.extra ? booking.won(x.extra) : "—"}</td></tr>`)}</tbody></table></div>`
      : catui.html`<p class="Catui_help">${room ? st.error : "객실을 고르면 박마다 요금을 보여 드립니다."}</p>`);
    const opts = box.querySelector("[data-opts]");
    if (opts && !opts.dataset.drawn) {
      opts.dataset.drawn = "1";
      catui.mount(opts, catui.html`${(svc.options || []).map((o) => catui.html`<label class="Catui_choice Catui_bk-opt" for="bk-o-${o.id}"><input class="Catui_clip" type="checkbox" id="bk-o-${o.id}" value="${o.id}"${(v.options || []).includes(o.id) ? catui.html` checked` : ""}><span class="Catui_cbx">${catui.icon("check", 12)}</span><span class="Catui_bk-opt-t">${o.name}</span><span class="Catui_bk-opt-p">+${booking.won(o.price)}${o.per === "person-night" ? " / 1인 1박" : o.per === "person" ? " / 1인" : ""}</span></label>`)}`);
    }
    const priceBox = box.querySelector("[data-price]");
    if (priceBox) catui.mount(priceBox, room && !st.error ? booking.view.amount(d, { ...v, room: v.room }, { label: "합계" }) : booking.flow.lines([], 0));
    return st;
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-rooms]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      let v = booking.draft.fromQuery();
      const svc = d.S[v.svc];
      if (svc && !v.branch) v = booking.draft.set({ branch: svc.branches[0] });
      booking.flow.frame(root, d, v, "rooms");
      const body = box.querySelector("[data-body]") || box;
      if (!booking.flow.need(body, d, v, { kind: "room" })) return d;
      const q = booking.query(), today = booking.today();
      const cin = q.get("in") || (v.date && v.date >= today ? v.date : booking.addDays(today, 1));
      const cout = q.get("out") || (v.checkout && v.checkout > cin ? v.checkout : booking.addDays(cin, 1));
      v = booking.draft.set({ date: cin, checkout: cout, time: d.B[v.branch]?.open || "15:00", adult: Math.max(1, v.adult || 2) });
      const inEl = box.querySelector("[data-in]"), outEl = box.querySelector("[data-out-date]"), msg = box.querySelector("[data-msg]");
      const maxKey = booking.addDays(today, booking.rules.maxDays);
      inEl.min = today; inEl.max = maxKey; inEl.value = v.date;
      outEl.min = booking.addDays(v.date, 1); outEl.max = booking.addDays(maxKey, 1); outEl.value = v.checkout;
      const sync = (say) => {
        const st = this.draw(box, d, v); booking.flow.frame(root, d, v, "rooms");
        if (say) booking.announce(say);
        booking.emit("stay", { checkin: v.date, checkout: v.checkout, room: v.room, total: st.total });
      };
      booking._on(box, "change", (e) => {
        if (e.target === inEl || e.target === outEl) {
          let a = inEl.value, b = outEl.value, say = "";
          if (!a || a < today) { a = today; inEl.value = a; }
          if (!b || b <= a) { b = booking.addDays(a, 1); outEl.value = b; say = "체크아웃을 체크인 다음 날로 맞췄습니다. "; }
          outEl.min = booking.addDays(a, 1);
          v = booking.draft.set({ date: a, checkout: b });
          if (v.room && booking.roomLeft(d, v.room, a, b, { except: v.change }) <= 0) { v = booking.draft.set({ room: "" }); say += "고른 객실이 그 기간에 만실이라 선택을 풀었습니다. "; }
          sync(`${say}${booking.nights(a, b)}박`);
        } else if (e.target.name === "bk-room") { v = booking.draft.set({ room: e.target.value }); sync(); booking.warn(msg, ""); }
        else if (e.target.closest("[data-opts]")) { v = booking.draft.set({ options: [...box.querySelectorAll("[data-opts] input:checked")].map((x) => x.value) }); sync(); }
      });
      booking._on(box, "click", (e) => {
        const b = e.target.closest("[data-step]");
        if (b && !b.disabled) {
          const [k, n] = b.dataset.step.split(":");
          v = booking.draft.set({ [k]: Math.max(k === "adult" ? 1 : 0, (v[k] || 0) + Number(n)) });
          const r = d.R[v.room];
          if (r && v.adult + v.child > r.max) { v = booking.draft.set({ room: "" }); booking.announce(`${r.name}은 최대 ${r.max}명이라 선택을 풀었습니다`); }
          sync(`${k === "adult" ? "어른" : "어린이"} ${v[k]}명`);
          if (b.disabled) b.closest("[role=group]")?.querySelector("button:not(:disabled)")?.focus();
        }
        if (e.target.closest("[data-go]")) {
          const st = booking.stay(d.R[v.room], v.date, v.checkout, { adult: v.adult, child: v.child, holidays: d.holidays });
          if (!v.room) return booking.warn(msg, "객실을 골라 주세요", box.querySelector("[name=bk-room]:not(:disabled)"));
          if (st.error) return booking.warn(msg, st.error);
          bkGo(bkNextOf("room", "rooms"));
        }
      });
      sync();
      return d;
    }).catch(() => null);
  },
};

// ── 예약자 정보 ──
booking.infoPage = {
  init(root) {
    const form = root.querySelector("form[data-catui-bk-info]");
    if (!form) return;
    this.ready = booking.load().then((d) => {
      let v = booking.draft.get();
      booking.flow.frame(root, d, v, "info");
      if (!d.S[v.svc]) { form.hidden = true; const e = document.createElement("div"); form.after(e); booking.flow.need(e, d, v); return d; }
      for (const k of ["name", "phone", "email", "request"]) if (v[k] && form.elements[k]) form.elements[k].value = v[k];
      root.querySelectorAll("[data-refund-table]").forEach((b) => catui.mount(b, booking.view.refund(v.date ? { date: v.date, time: v.time } : null)));
      const all = form.querySelector("[data-agree-all]"), each = () => [...form.querySelectorAll("[data-agree]")], msg = form.querySelector("[data-msg]");
      booking._on(form, "change", (e) => {
        if (e.target === all) each().forEach((x) => { x.checked = all.checked; });
        else if (e.target.matches("[data-agree]")) all.checked = each().every((x) => x.checked);
      });
      booking._on(form, "submit", (e) => {
        e.preventDefault();
        if (!catui.form.validate(form)) { booking.warn(msg, "입력 내용을 확인해 주세요", form.querySelector("[aria-invalid=true]")); return; }
        const miss = each().find((x) => x.required && !x.checked);
        if (miss) { booking.warn(msg, "필수 약관에 동의해 주세요", miss); return; }
        const f = form.elements;
        v = booking.draft.set({ name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), request: f.request.value.trim(), notify: !!f.notify?.checked });
        bkGo("confirm.html");
      });
      return d;
    }).catch(() => null);
  },
};

// ── 확인 → 저장 ──
booking.confirmPage = {
  init(root) {
    const box = root.querySelector("[data-catui-bk-confirm]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      const v = booking.draft.get();
      booking.flow.frame(root, d, v, "confirm");
      const body = box.querySelector("[data-body]") || box;
      if (!booking.flow.need(body, d, v)) return d;
      const msg = box.querySelector("[data-msg]");
      catui.mount(box.querySelector("[data-detail]"), booking.view.dl(d, v));
      catui.mount(box.querySelector("[data-amount]"), booking.view.amount(d, v));
      catui.mount(box.querySelector("[data-refund-table]"), booking.view.refund({ date: v.date, time: v.time }));
      const kind = box.querySelector("[data-change-note]");
      if (kind) kind.hidden = !v.change;
      const problems = booking.check(d, v);
      if (problems.length) booking.warn(msg, problems.join(" · "));
      booking._on(box.querySelector("[data-confirm]"), "click", (e) => {
        const p = booking.check(d, booking.draft.get());
        if (p.length) return booking.warn(msg, p.join(" · "), e.currentTarget);
        const r = booking.save(booking.draft.get());
        booking.draft.clear();
        bkGo(`complete.html?no=${encodeURIComponent(r.no)}`);
      });
      return d;
    }).catch(() => null);
  },
};

// ── 완료 ──
booking.completePage = {
  init(root) {
    const box = root.querySelector("[data-catui-bk-complete]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      const no = booking.query().get("no") || bkGet("last", "");
      const r = no ? booking.find(d, no) : null;
      if (!r) { catui.mount(box, catui.html`<div class="Catui_empty"><p class="Catui_empty-title">예약 번호를 찾지 못했습니다</p><p class="Catui_empty-text">내 예약 목록에서 확인해 주세요.</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="mine.html">내 예약</a></div>`); return d; }
      box.querySelectorAll("[data-no]").forEach((x) => { x.textContent = r.no; });
      catui.mount(box.querySelector("[data-qr]"), booking.view.qr(r.no));
      catui.mount(box.querySelector("[data-detail]"), booking.view.dl(d, r));
      catui.mount(box.querySelector("[data-amount]"), booking.view.amount(d, r));
      box.querySelectorAll("[data-detail-link]").forEach((a) => { a.href = `detail.html?no=${encodeURIComponent(r.no)}`; });
      return d;
    }).catch(() => null);
  },
};
