// flow — 예약 단계 화면 (진행 중 예약은 booking.draft에 기억, 단계 사이는 주소 이동)
//   [data-catui-bk-steps="date"]    단계 표시 (서비스 종류마다 단계가 다름)
//   [data-catui-bk-summary]         옆줄 예약 내용·예상 금액
//   [data-catui-bk-home]            서비스·지점 고르기      [data-catui-bk-next]   다가오는 내 예약 한 건
//   [data-catui-bk-date]            달력 + 시간 칸          [data-catui-bk-people] 인원·옵션
const BK_STEPS = {
  slot: [["home", "서비스"], ["date", "날짜·시간"], ["people", "인원·옵션"], ["info", "예약자 정보"], ["confirm", "확인"]],
  seat: [["home", "서비스"], ["date", "날짜·회차"], ["people", "인원·옵션"], ["seats", "좌석"], ["info", "예약자 정보"], ["confirm", "확인"]],
  room: [["home", "서비스"], ["rooms", "기간·객실"], ["info", "예약자 정보"], ["confirm", "확인"]],
};
const bkNextOf = (kind, step) => { const s = BK_STEPS[kind] || BK_STEPS.slot, i = s.findIndex((x) => x[0] === step); return `${(s[i + 1] || ["complete"])[0]}.html`; };
const bkPrevOf = (kind, step) => { const s = BK_STEPS[kind] || BK_STEPS.slot, i = s.findIndex((x) => x[0] === step); return `${(s[i - 1] || ["index"])[0].replace("home", "index")}.html`; };
const bkGo = (url) => booking.go(url);
const bkStepLayouts = new WeakMap();
const bkStepLayout = (box) => {
  let layout = bkStepLayouts.get(box);
  if (!layout) {
    const tabindex = box.getAttribute("tabindex");
    layout = () => {
      if (!box.isConnected) return;
      if (tabindex === null) { if (box.scrollWidth > box.clientWidth) box.setAttribute("tabindex", "0"); else box.removeAttribute("tabindex"); }
      const active = box.querySelector('[aria-current="step"]');
      if (!active) return;
      const outer = box.getBoundingClientRect(), item = active.getBoundingClientRect();
      if (item.left < outer.left) box.scrollLeft += item.left - outer.left;
      else if (item.right > outer.right) box.scrollLeft += item.right - outer.right;
    };
    bkStepLayouts.set(box, layout); booking._on(window, "resize", layout);
    booking._offs.push(() => { if (tabindex === null) box.removeAttribute("tabindex"); else box.setAttribute("tabindex", tabindex); bkStepLayouts.delete(box); });
  }
  layout();
};

booking.flow = {
  steps: BK_STEPS,
  next: bkNextOf,
  prev: bkPrevOf,
  /** 단계 표시 (본체 .Catui_steps) — 지난 단계는 체크 + 숨김 글자 "완료", 지금 단계는 aria-current="step" */
  steps_(box, kind, cur) {
    const s = BK_STEPS[kind] || BK_STEPS.slot, at = s.findIndex((x) => x[0] === cur);
    catui.mount(box, catui.html`${s.map(([, t], i) => catui.html`${i ? catui.html`<li class="Catui_step-line${i <= at ? " Catui_step-line-done" : ""}" aria-hidden="true"></li>` : ""}<li class="Catui_step${i < at ? " Catui_step-done" : i === at ? " Catui_step-current" : ""}"${i === at ? catui.html` aria-current="step"` : ""}><span class="Catui_step-dot">${i < at ? catui.icon("check", 14) : i + 1}</span><span class="Catui_step-label">${t}${i < at ? bkClip(" 완료") : ""}</span></li>`)}`);
    bkStepLayout(box);
  },
  /** 금액 줄 마크업 */
  lines(lines, total, { label = "합계" } = {}) {
    return catui.html`<ul class="Catui_bk-lines">${lines.length ? lines.map((l) => catui.html`<li><span>${l.label} <small>${booking.won(l.unit)} × ${l.qty}</small></span><b>${booking.won(l.amount)}</b></li>`) : catui.html`<li class="Catui_bk-muted"><span>아직 고른 항목이 없습니다</span></li>`}</ul>
      <p class="Catui_bk-total"><span>${label}</span><b data-total>${booking.won(total)}</b></p>`;
  },
  /** 옆줄 예약 내용 */
  summary(box, d, v) {
    if (!box) return;
    const svc = d.S[v.svc], br = d.B[v.branch];
    if (!svc || !bkHasBranch(d, v)) { catui.mount(box, catui.html`<h2 class="Catui_h3">예약 내용</h2><p class="Catui_help">${svc ? bkBranchMessage : "서비스를 먼저 골라 주세요."}</p>`); return; }
    const a = booking.amountOf(d, v), none = catui.html`<span class="Catui_bk-muted">고르지 않음</span>`;
    const rows = [["서비스", svc.name], ["지점", br?.name || none]];
    if (svc.kind === "room") {
      const n = booking.nights(v.date, v.checkout);
      rows.push(["기간", v.date && v.checkout && n ? `${booking.dateLabel(v.date)} → ${booking.dateLabel(v.checkout)} · ${n}박` : none], ["객실", d.R[v.room]?.name || none]);
    } else {
      const s = v.time ? `${v.time}–${booking.fromMin(booking.toMin(v.time) + (svc.duration || 0))}` : "";
      rows.push(["날짜", v.date ? booking.dateLabel(v.date) : none], ["시간", s || none]);
    }
    rows.push(["인원", `어른 ${v.adult || 0}${v.child ? ` · 어린이 ${v.child}` : ""}`]);
    if (svc.kind === "seat") rows.push([d.maps[svc.map]?.cap ? "테이블" : "좌석", (v.seats || []).length ? v.seats.join(", ") : none]);
    catui.mount(box, catui.html`<h2 class="Catui_h3">예약 내용</h2>
      <dl class="Catui_bk-sum">${rows.map(([k, x]) => catui.html`<div><dt>${k}</dt><dd>${x}</dd></div>`)}</dl>
      <p class="Catui_bk-total"><span>예상 금액</span><b data-sum-total>${booking.won(a.total)}</b></p>`);
  },
  /** 서비스·지점이 없으면 안내를 그리고 false */
  need(box, d, v, { kind } = {}) {
    const svc = d.S[v.svc];
    if (bkHasBranch(d, v) && (!kind || [].concat(kind).includes(svc.kind))) { this.empty(box, null); return true; }
    this.empty(box, catui.html`<p class="Catui_empty-title">예약할 서비스를 먼저 골라 주세요</p><p class="Catui_empty-text">${!svc ? "진행 중인 예약이 없습니다." : !bkHasBranch(d, v) ? bkBranchMessage : "이 단계는 고른 서비스에서 쓰지 않습니다."}</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="index.html">서비스 고르기</a>`);
    return false;
  },
  /** 빈 상태 안내 — 상자의 원래 마크업은 지우지 않고 숨겼다가(다시 연결하면 되살림) 안내만 끼운다. markup이 null이면 되돌림 */
  empty(box, markup) {
    if (!box) return;
    let e = [...box.children].find((c) => c.hasAttribute("data-bk-empty"));
    for (const c of box.children) {
      if (c === e) continue;
      if (markup) { if (!c.hasAttribute("data-bk-shown")) { c.setAttribute("data-bk-shown", c.hidden ? "0" : "1"); c.hidden = true; } }
      else if (c.hasAttribute("data-bk-shown")) { c.hidden = c.getAttribute("data-bk-shown") === "0"; c.removeAttribute("data-bk-shown"); }
    }
    if (!markup) { e?.remove(); return; }
    if (!e) { e = Object.assign(document.createElement("div"), { className: "Catui_empty" }); e.setAttribute("data-bk-empty", ""); box.prepend(e); }
    catui.mount(e, markup);
  },
  /** 공통: 단계 표시·옆줄·이전 링크 */
  frame(root, d, v, step) {
    const svc = d.S[v.svc];
    root.querySelectorAll("[data-catui-bk-steps]").forEach((b) => this.steps_(b, svc?.kind || "slot", b.getAttribute("data-catui-bk-steps") || step));
    root.querySelectorAll("[data-catui-bk-summary]").forEach((b) => this.summary(b, d, v));
    root.querySelectorAll("[data-catui-bk-prev]").forEach((a) => { a.href = bkPrevOf(svc?.kind, step); });
    root.querySelectorAll("[data-svc-name]").forEach((x) => { x.textContent = svc ? `${svc.name} · ${bkHasBranch(d, v) ? d.B[v.branch].name : "지점 재선택 필요"}` : ""; });
  },
};
/** 주소 이동 (테스트·SPA 라우터에서 바꿔 끼울 수 있음) */
booking.go = (url) => { location.href = url; };
/** 안내 메시지: 화면 글자 + 낭독기 + 초점 */
booking.warn = function (msgBox, text, focusEl) {
  if (msgBox) { msgBox.hidden = !text; catui.mount(msgBox, catui.html`${catui.icon("alert-circle", 16)}<span>${text}</span>`); }
  if (text) booking.announce(text);
  focusEl?.focus();
};

// ── 홈: 서비스·지점 ──
booking.home = {
  from(d, svc) {
    if (svc.kind === "room") {
      const room = [...d.rooms].sort((a, b) => a.price - b.price)[0];
      return room ? `평일 1박 · 기준 ${room.base}인 ${booking.won(room.price)}부터` : "객실 요금 확인";
    }
    if (svc.kind === "seat" && d.maps[svc.map]?.grades) return `성인 1인 ${booking.won(Math.min(...d.maps[svc.map].grades.map((g) => g.price)))}부터`;
    if (svc.kind === "seat") return `예약금 1인 ${booking.won(svc.price)}`;
    return `성인 1인 ${booking.won(svc.price)}부터`;
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-home]"), nextBox = root.querySelector("[data-catui-bk-next]");
    if (!box && !nextBox) return;
    this.ready = bkLoadView(box || nextBox, () => booking.load(), (d) => {
      if (box) catui.mount(box, catui.html`${d.services.map((s) => {
        const first = s.kind === "room" ? "rooms" : "date";
        return catui.html`<li class="Catui_bk-svc" data-tone="${s.tone || 1}">
          ${s.image ? catui.html`<img class="Catui_bk-photo" src="${s.image}" alt="" aria-hidden="true" width="640" height="280" loading="lazy" decoding="async">` : ""}
          <span class="Catui_bk-svc-ic" aria-hidden="true">${catui.icon(s.icon || "calendar", 24)}</span>
          <div class="Catui_bk-svc-b">
            <h3 class="Catui_bk-svc-t">${s.name}</h3>
            <p class="Catui_bk-svc-d">${s.desc}</p>
            <p class="Catui_bk-svc-meta">${s.duration ? catui.html`<span>${catui.icon("clock", 14)}${s.duration}분</span>` : catui.html`<span>${catui.icon("bed", 14)}숙박</span>`}<span>${catui.icon("users", 14)}최대 ${s.maxPeople}명</span><b>${this.from(d, s)}</b></p>
          </div>
          <div class="Catui_bk-svc-go" role="group" aria-label="${s.name} 지점 고르기">
            ${s.branches.map((b) => catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="${first}.html?svc=${s.id}&branch=${b}">${catui.icon("map-pin", 14)}${d.B[b]?.name || b}${bkClip(`에서 ${s.name} 예약`)}</a>`)}
          </div>
        </li>`;
      })}`);
      if (nextBox) {
        const up = booking.mine(d).filter((r) => r.phase === "upcoming")[0];
        catui.mount(nextBox, up
          ? catui.html`<a class="Catui_bk-upnext" href="detail.html?no=${up.no}"><span class="Catui_bk-svc-ic" aria-hidden="true">${catui.icon(up.svcObj.icon || "calendar", 20)}</span><span><b>${up.svcObj.name}</b><small>${booking.dateLabel(up.date)} ${up.time} · ${up.branchObj.name}</small></span><span class="Catui_badge Catui_badge-info">D-${booking.diffDays(booking.today(), up.date)}</span></a>`
          : catui.html`<p class="Catui_help">다가오는 예약이 없습니다.</p>`);
      }
      return d;
    }, () => { if (nextBox && box) nextBox.textContent = "예약 내역을 불러오지 못했습니다. 서비스 목록의 다시 시도를 눌러 주세요."; });
  },
};

// ── 날짜·시간 ──
booking.datePage = {
  /** 달력 날짜 상태 — 시간 칸에서 계산 */
  stateOf(d, v, date) { return booking.dayState(date, { closed: d.B[v.branch]?.closed || [], list: (k) => booking.slotsFor(d, v, k) }); },
  times(box, d, v) {
    const svc = d.S[v.svc];
    if (!v.date) { catui.mount(box, catui.html`<p class="Catui_help">먼저 달력에서 날짜를 골라 주세요.</p>`); return; }
    const list = booking.slotsFor(d, v);
    const full = list.filter((s) => s.state === "full");
    const unit = svc.kind === "seat" ? (d.maps[svc.map]?.cap ? "테이블" : "석") : "자리";
    const text = (s) => (s.state === "open" ? `${s.left}${unit} 남음` : booking.slotText(s));
    catui.mount(box, catui.html`<fieldset class="Catui_bk-times">
      <legend class="Catui_bk-legend">${booking.dateLabel(v.date)} · ${svc.kind === "seat" ? "회차" : "시간"} 고르기</legend>
      ${list.length ? catui.html`<ul class="Catui_bk-slots">${list.map((s) => {
        const id = `bk-t-${s.time.replace(":", "")}`, off = s.state !== "open";
        return catui.html`<li><input class="Catui_clip" type="radio" name="bk-time" id="${id}" value="${s.time}"${off ? catui.html` disabled` : ""}${v.time === s.time && !off ? catui.html` checked` : ""}><label class="Catui_bk-slot" for="${id}" data-state="${s.state}"${s.few ? catui.html` data-few` : ""}><b>${s.time}</b><span>${s.few ? catui.icon("alert-triangle", 12) : s.state === "full" ? catui.icon("ban", 12) : ""}${text(s)}${s.few ? " · 임박" : ""}</span></label></li>`;
      })}</ul>` : catui.html`<p class="Catui_help">이 날은 예약할 수 있는 시간이 없습니다.</p>`}
    </fieldset>
    ${full.length ? catui.html`<p class="Catui_bk-waithint">${catui.icon("hourglass", 16)}<span>마감된 시간 대기 신청:</span> ${full.map((s) => catui.html`<a class="Catui_link" href="waitlist.html?svc=${v.svc}&branch=${v.branch}&date=${v.date}&time=${s.time}">${s.time}${bkClip(" 대기 신청")}</a> `)}</p>` : ""}`);
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-date]");
    if (!box) return;
    this.ready = bkLoadView(box, () => booking.load(), (d) => {
      let v = booking.draft.fromQuery();
      const svc = d.S[v.svc];
      if (svc && !v.branch) v = booking.draft.set({ branch: svc.branches[0] });
      booking.flow.frame(root, d, v, "date");
      if (!booking.flow.need(box, d, v, { kind: ["slot", "seat"] })) return d;
      const calBox = box.querySelector("[data-cal]"), timeBox = box.querySelector("[data-times]"), msg = box.querySelector("[data-msg]");
      const refresh = () => booking.flow.frame(root, d, v, "date");
      booking.calendar.mount(calBox, {
        selected: v.date, label: `${svc.name} 날짜`,
        stateOf: (k) => this.stateOf(d, v, k),
        onSelect: (date) => {
          v = booking.draft.set({ date, time: "", seats: [] });
          this.times(timeBox, d, v); refresh();
          const n = booking.slotsFor(d, v).filter((s) => s.state === "open").length;
          booking.announce(`${booking.dateLabel(date)} — 고를 수 있는 시간 ${n}개`);
          booking.emit("date", { date });
        },
      });
      this.times(timeBox, d, v);
      booking._on(timeBox, "change", (e) => {
        if (e.target.name !== "bk-time") return;
        v = booking.draft.set({ time: e.target.value, seats: [] }); refresh();
        booking.warn(msg, "");
        booking.emit("slot", { time: v.time });
      });
      booking._on(box.querySelector("[data-go]"), "click", () => {
        if (!v.date) return booking.warn(msg, "날짜를 골라 주세요", calBox.querySelector('.Catui_bk-day[tabindex="0"]'));
        if (!v.time) return booking.warn(msg, "시간을 골라 주세요", timeBox.querySelector("input:not(:disabled)"));
        bkGo(bkNextOf(svc.kind, "date"));
      });
      return d;
    });
  },
};

// ── 인원·옵션 ──
booking.peoplePage = {
  /** 인원 한도: 서비스 최대 인원 · (시간 칸 예약) 남은 자리 · (좌석) 남은 좌석 */
  limit(d, v) {
    const svc = d.S[v.svc];
    let max = svc.maxPeople || 10;
    const s = v.time ? booking.slotsFor(d, v).find((x) => x.time === v.time) : null;
    if (s && svc.kind === "slot") max = Math.min(max, s.left);
    if (s && svc.kind === "seat" && d.maps[svc.map]?.grades) max = Math.min(max, s.left);
    if (svc.kind === "seat" && d.maps[svc.map]?.cap) max = Math.min(max, Math.max(...Object.values(d.maps[svc.map].cap)));
    return Math.max(1, max);
  },
  draw(box, d, v) {
    const svc = d.S[v.svc], max = this.limit(d, v), people = (v.adult || 0) + (v.child || 0);
    const seatGrades = svc.kind === "seat" && d.maps[svc.map]?.grades;
    box.querySelectorAll("[data-out]").forEach((o) => { o.textContent = String(v[o.dataset.out] || 0); });
    box.querySelectorAll("[data-step]").forEach((b) => {
      const [k, n] = b.dataset.step.split(":"), val = v[k] || 0, add = Number(n);
      b.disabled = add < 0 ? val <= (k === "adult" ? 1 : 0) : people >= max;
    });
    const unit = box.querySelector("[data-unit-adult]"), unitC = box.querySelector("[data-unit-child]");
    if (unit) unit.textContent = seatGrades ? "좌석 등급별 가격" : booking.won(svc.price);
    if (unitC) unitC.textContent = seatGrades ? `1인 ${booking.won(svc.childOff || 0)} 할인` : booking.won(svc.childPrice ?? svc.price);
    const lim = box.querySelector("[data-limit]");
    if (lim) lim.textContent = `한 번에 최대 ${max}명${svc.kind === "slot" && v.time ? ` (이 시간 남은 자리 기준)` : ""}`;
    const opts = box.querySelector("[data-opts]");
    if (opts && !opts.dataset.drawn) {
      opts.dataset.drawn = "1";
      catui.mount(opts, svc.options?.length ? catui.html`${svc.options.map((o) => catui.html`<label class="Catui_choice Catui_bk-opt" for="bk-o-${o.id}"><input class="Catui_clip" type="checkbox" id="bk-o-${o.id}" value="${o.id}"${(v.options || []).includes(o.id) ? catui.html` checked` : ""}><span class="Catui_cbx">${catui.icon("check", 12)}</span><span class="Catui_bk-opt-t">${o.name}</span><span class="Catui_bk-opt-p">+${booking.won(o.price)}${o.per === "person" ? " / 1인" : o.per === "person-night" ? " / 1인 1박" : ""}</span></label>`)}` : catui.html`<p class="Catui_help">추가 옵션이 없습니다.</p>`);
    }
    const p = booking.price(svc, { adult: v.adult, child: v.child, options: v.options || [] });
    const priceBox = box.querySelector("[data-price]");
    if (priceBox) catui.mount(priceBox, catui.html`${booking.flow.lines(p.lines, p.total, { label: seatGrades ? "옵션 합계 (좌석 금액 별도)" : "합계" })}`);
    return p;
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-people]");
    if (!box) return;
    this.ready = bkLoadView(box, () => booking.load(), (d) => {
      let v = booking.draft.fromQuery();
      booking.flow.frame(root, d, v, "people");
      if (!booking.flow.need(box.querySelector("[data-body]") || box, d, v, { kind: ["slot", "seat"] })) return d;
      const svc = d.S[v.svc], msg = box.querySelector("[data-msg]");
      const max = this.limit(d, v);
      if ((v.adult || 0) + (v.child || 0) > max) v = booking.draft.set({ adult: Math.min(v.adult || 1, max), child: 0 });
      const sync = (say) => {
        const p = this.draw(box, d, v); booking.flow.frame(root, d, v, "people");
        if (say) booking.announce(say);
        booking.emit("people", { adult: v.adult, child: v.child, options: v.options, total: p.total });
      };
      booking._on(box, "click", (e) => {
        const b = e.target.closest("[data-step]");
        if (b && !b.disabled) {
          const [k, n] = b.dataset.step.split(":");
          v = booking.draft.set({ [k]: Math.max(k === "adult" ? 1 : 0, (v[k] || 0) + Number(n)), seats: [] });
          sync(`${k === "adult" ? "어른" : "어린이"} ${v[k]}명`);
          if (b.disabled) b.closest("[role=group]")?.querySelector("button:not(:disabled)")?.focus();
        }
        if (e.target.closest("[data-go]")) {
          if (!(v.adult >= 1)) return booking.warn(msg, "어른 1명 이상이어야 합니다");
          if (!v.time) return booking.warn(msg, "시간을 먼저 골라 주세요 — 날짜·시간 단계로 돌아가 주세요");
          bkGo(bkNextOf(svc.kind, "people"));
        }
      });
      booking._on(box, "change", (e) => {
        if (!e.target.closest("[data-opts]")) return;
        v = booking.draft.set({ options: [...box.querySelectorAll("[data-opts] input:checked")].map((x) => x.value) });
        sync();
      });
      sync();
      return d;
    });
  },
};
