// mine — 내 예약 목록 · 예약 상세 · 취소(환불 규정) · 변경 · 대기 명단
//   [data-catui-bk-mine]      예정/지난/취소 (?tab=)   [data-catui-bk-detail]  예약 상세 (?no=)
//   [data-catui-bk-waitlist]  대기 신청·순번·호출       [data-cancel="번호"] · [data-change="번호"] 버튼은 어디서나 동작
const BK_PHASE = { upcoming: ["예정", "Catui_badge-info"], past: ["이용 완료", "Catui_badge-neutral"], cancelled: ["취소됨", "Catui_badge-danger"] };

/** 취소 묻기 — 환불 금액을 먼저 보여 주고 확인을 받는다. 반환 Promise<refund | null> */
booking.cancelAsk = function (d, no) {
  const r = booking.find(d, no);
  if (!r) return Promise.resolve(null);
  const ref = booking.refund(r.amount, r.date, r.time || "00:00");
  if (r.phase !== "upcoming" || !ref.ok) { catui.layer.alert(ref.ok ? "취소할 수 있는 예약이 아닙니다" : ref.label, { title: "취소할 수 없습니다" }); return Promise.resolve(null); }
  return new Promise((resolve) => {
    catui.layer.confirm(catui.html`<div class="Catui_bk-refundbox">
      <p><b>${r.svcObj.name}</b><br>${booking.view.when(d, r)}</p>
      <dl class="Catui_bk-sum">
        <div><dt>결제 금액</dt><dd>${booking.won(r.amount)}</dd></div>
        <div><dt>적용 규정</dt><dd>${ref.label}</dd></div>
        <div><dt>취소 수수료</dt><dd>${booking.won(ref.fee)}</dd></div>
        <div><dt>환불 금액</dt><dd><b>${booking.won(ref.refund)}</b></dd></div>
      </dl>
      <p class="Catui_help">환불은 결제 수단으로 3~5 영업일 안에 돌아갑니다(예제).</p>
    </div>`, { title: "예약을 취소할까요?", okText: "예약 취소", cancelText: "돌아가기" }, (idx) => {
      catui.layer.close(idx);
      const res = booking.cancel(d, no);
      catui.layer.msg(res.ok ? `취소했습니다 — ${booking.won(res.refund)} 환불 예정` : res.label, { icon: res.ok ? "success" : "warn" });
      booking.announce(res.ok ? `예약을 취소했습니다. 환불 금액 ${booking.won(res.refund)}` : res.label);
      resolve(res.ok ? res : null);
    }, () => resolve(null));
  });
};
/** 변경 시작 — 예약 내용을 진행 중 예약에 담고 첫 단계로(같은 번호로 다시 저장) */
booking.changeStart = function (d, no) {
  const r = booking.find(d, no);
  if (!r || r.phase !== "upcoming") return false;
  const pick = ({ svc, branch, date, time, adult, child, options, seats, room, checkout, name, phone, email, request }) => ({ svc, branch, date, time, adult, child, options, seats, room, checkout, name, phone, email, request });
  booking.draft.set({ ...pick(r), change: no });
  booking.go(r.svcObj.kind === "room" ? "rooms.html" : "date.html");
  return true;
};

booking.minePage = {
  tabs: [["upcoming", "예정"], ["past", "지난 예약"], ["cancelled", "취소"]],
  card(d, r) {
    const [ph, cls] = BK_PHASE[r.phase], ref = r.phase === "upcoming" ? booking.refund(r.amount, r.date, r.time || "00:00") : null;
    const dday = booking.diffDays(booking.today(), r.date);
    const extra = r.svcObj.kind === "room" ? ` · ${d.R[r.room]?.name || ""}` : (r.seats || []).length ? ` · ${d.maps[r.svcObj.map]?.cap ? "테이블" : "좌석"} ${r.seats.join(", ")}` : "";
    return catui.html`<li class="Catui_bk-res" data-phase="${r.phase}">
      <span class="Catui_bk-svc-ic" data-tone="${r.svcObj.tone || 1}" aria-hidden="true">${catui.icon(r.svcObj.icon || "calendar", 20)}</span>
      <div class="Catui_bk-res-b">
        <p class="Catui_bk-res-h"><span class="Catui_badge ${cls}">${ph}${r.phase === "upcoming" ? ` · ${dday ? `D-${dday}` : "오늘"}` : ""}</span><span class="Catui_bk-no">${r.no}</span></p>
        <h3 class="Catui_bk-res-t"><a href="detail.html?no=${r.no}">${r.svcObj.name}</a></h3>
        <p class="Catui_bk-res-m">${booking.view.when(d, r)} · ${r.branchObj.name} · 어른 ${r.adult}${r.child ? ` · 어린이 ${r.child}` : ""}${extra}</p>
        <p class="Catui_bk-res-m"><b>${booking.won(r.amount)}</b>${ref?.ok ? catui.html` <span class="Catui_bk-muted">· 지금 취소하면 ${booking.won(ref.refund)} 환불(${ref.rate}%)</span>` : ""}${r.phase === "cancelled" && r.cancel ? catui.html` <span class="Catui_bk-muted">· ${r.cancel.rate}% 환불 ${booking.won(r.cancel.refund ?? Math.floor((r.amount * r.cancel.rate) / 1000) * 10)}</span>` : ""}</p>
      </div>
      <div class="Catui_bk-res-acts">
        <a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="detail.html?no=${r.no}">상세${bkClip(` — ${r.svcObj.name}`)}</a>
        ${r.phase === "upcoming" ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-change="${r.no}">변경${bkClip(` — ${r.svcObj.name}`)}</button><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-cancel="${r.no}">취소${bkClip(` — ${r.svcObj.name}`)}</button>` : ""}
      </div>
    </li>`;
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-mine]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      let tab = booking.query().get("tab") || "upcoming";
      if (!this.tabs.some(([k]) => k === tab)) tab = "upcoming";
      const tabsBox = box.querySelector("[data-tabs]"), list = box.querySelector("[data-list]");
      const draw = (focusSel) => {
        const all = booking.mine(d), rows = all.filter((r) => r.phase === tab);
        catui.mount(tabsBox, catui.html`${this.tabs.map(([k, t]) => catui.html`<button class="Catui_bk-chip" type="button" data-tab="${k}" aria-pressed="${String(k === tab)}">${k === tab ? catui.icon("check", 14) : ""}${t}<span class="Catui_bk-chip-n">${all.filter((r) => r.phase === k).length}${bkClip("건")}</span></button>`)}`);
        catui.mount(list, rows.length ? catui.html`${rows.map((r) => this.card(d, r))}` : catui.html`<li class="Catui_empty"><p class="Catui_empty-title">${tab === "upcoming" ? "예정된 예약이 없습니다" : tab === "past" ? "지난 예약이 없습니다" : "취소한 예약이 없습니다"}</p>${tab === "upcoming" ? catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="index.html">예약하러 가기</a>` : ""}</li>`);
        if (focusSel) box.querySelector(focusSel)?.focus();
      };
      booking._on(box, "click", (e) => {
        const t = e.target.closest("[data-tab]");
        if (t) {
          tab = t.dataset.tab;
          const u = new URL(location.href); if (tab === "upcoming") u.searchParams.delete("tab"); else u.searchParams.set("tab", tab);
          history.replaceState(null, "", u);
          draw(`[data-tab="${tab}"]`);
          booking.announce(`${t.textContent.replace(/\d+건$/, "").trim()} ${booking.mine(d).filter((r) => r.phase === tab).length}건`);
          return;
        }
        const c = e.target.closest("[data-cancel]");
        if (c) { booking.cancelAsk(d, c.dataset.cancel).then((res) => { if (res) draw(`[data-tab="${tab}"]`); }); return; }
        const ch = e.target.closest("[data-change]");
        if (ch) booking.changeStart(d, ch.dataset.change);
      });
      draw();
      return d;
    }).catch(() => null);
  },
};

booking.detailPage = {
  init(root) {
    const box = root.querySelector("[data-catui-bk-detail]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      const no = booking.query().get("no") || "";
      const body = box.querySelector("[data-body]");
      const draw = () => {
        const r = booking.find(d, no);
        if (!r) { catui.mount(body, catui.html`<div class="Catui_empty"><p class="Catui_empty-title">예약을 찾지 못했습니다</p><p class="Catui_empty-text">예약 번호(${no || "없음"})를 확인해 주세요.</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="mine.html">내 예약</a></div>`); return; }
        const [ph, cls] = BK_PHASE[r.phase], ref = booking.refund(r.amount, r.date, r.time || "00:00");
        box.querySelectorAll("[data-no]").forEach((x) => { x.textContent = r.no; });
        catui.mount(body, catui.html`<div class="Catui_bk-flow">
          <div class="Catui_bk-flow-main">
            <section class="Catui_bk-box" aria-labelledby="dt-h1"><div class="Catui_bk-box-h"><h2 class="Catui_h3" id="dt-h1">예약 내용</h2><span class="Catui_badge ${cls}">${ph}</span></div>${booking.view.dl(d, r)}</section>
            <section class="Catui_bk-box" aria-labelledby="dt-h2"><h2 class="Catui_h3" id="dt-h2">결제 금액</h2>${booking.view.amount(d, r)}</section>
            <section class="Catui_bk-box" aria-labelledby="dt-h3"><h2 class="Catui_h3" id="dt-h3">취소 · 환불 규정</h2>${booking.view.refund(r.phase === "cancelled" ? null : { date: r.date, time: r.time })}
              ${r.phase === "upcoming" && ref.ok ? catui.html`<p class="Catui_bk-refundnow" data-refund-now>${catui.icon("info", 16)}<span>지금 취소하면 <b>${booking.won(ref.refund)}</b> 환불 · 수수료 ${booking.won(ref.fee)} (${ref.label})</span></p>` : ""}
              ${r.phase === "cancelled" && r.cancel ? catui.html`<p class="Catui_bk-refundnow">${catui.icon("circle-check", 16)}<span>${booking.date(r.cancel.at)} 취소 · ${r.cancel.rate}% 환불</span></p>` : ""}
            </section>
          </div>
          <aside class="Catui_bk-flow-side Catui_bk-box" aria-labelledby="dt-h4">
            <h2 class="Catui_h3" id="dt-h4">예약 번호</h2>
            <p class="Catui_bk-no Catui_bk-no-lg">${r.no}</p>
            ${r.phase === "upcoming" ? booking.view.qr(r.no) : ""}
            <div class="Catui_bk-acts">
              ${r.phase === "upcoming" ? catui.html`<button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-change="${r.no}">${catui.icon("calendar-edit", 16)}일정 변경</button><button class="Catui_btn Catui_btn-md Catui_btn-danger" type="button" data-cancel="${r.no}">${catui.icon("calendar-x", 16)}예약 취소</button>` : ""}
              <a class="Catui_btn Catui_btn-md Catui_btn-ghost" href="mine.html">${catui.icon("arrow-left", 16)}내 예약 목록</a>
            </div>
          </aside>
        </div>`);
      };
      booking._on(box, "click", (e) => {
        const c = e.target.closest("[data-cancel]");
        if (c) { booking.cancelAsk(d, c.dataset.cancel).then((res) => { if (res) { draw(); box.querySelector("h1")?.focus(); } }); return; }
        const ch = e.target.closest("[data-change]");
        if (ch) booking.changeStart(d, ch.dataset.change);
      });
      draw();
      return d;
    }).catch(() => null);
  },
};
booking.date = (iso, fmt = "yyyy.MM.dd HH:mm") => { const k = booking.kst(iso); return fmt.replace("yyyy", k.y).replace("MM", bkPad(k.m)).replace("dd", bkPad(k.d)).replace("HH", bkPad(k.h)).replace("mm", bkPad(k.mi)); };

// ── 대기 명단 ──
booking.waitPage = {
  status: { waiting: ["대기 중", "Catui_badge-warning"], called: ["호출함", "Catui_badge-info"] },
  init(root) {
    const box = root.querySelector("[data-catui-bk-waitlist]");
    if (!box) return;
    this.ready = booking.load().then((d) => {
      const form = box.querySelector("form[data-wait-form]"), listBox = box.querySelector("[data-wait-list]"), msg = form?.querySelector("[data-msg]");
      const q = booking.query(), f = form.elements;
      const slotSvcs = d.services.filter((s) => s.kind === "slot");
      catui.mount(f.svc, catui.html`${slotSvcs.flatMap((s) => s.branches.map((b) => catui.html`<option value="${s.id}|${b}">${s.name} · ${d.B[b].name}</option>`))}`);
      if (q.get("svc") && q.get("branch")) f.svc.value = `${q.get("svc")}|${q.get("branch")}`;
      f.date.min = booking.today(); f.date.value = q.get("date") || booking.today();
      const times = () => {
        const [svc, branch] = f.svc.value.split("|"), list = booking.slotsFor(d, { svc, branch }, f.date.value).filter((s) => s.state === "full");
        catui.mount(f.time, list.length ? catui.html`${list.map((s) => catui.html`<option value="${s.time}">${s.time} (마감)</option>`)}` : catui.html`<option value="">마감된 시간이 없습니다</option>`);
        if (q.get("time") && list.some((s) => s.time === q.get("time"))) f.time.value = q.get("time");
        const hint = form.querySelector("[data-time-hint]");
        if (hint) catui.mount(hint, list.length ? catui.html`마감된 시간만 대기할 수 있습니다.` : catui.html`이 날은 마감된 시간이 없어 <a class="Catui_link" href="date.html?svc=${svc}&branch=${branch}&date=${f.date.value}">바로 예약</a>할 수 있습니다.`);
      };
      const draw = (focusId) => {
        const rows = booking.wait.list(d);
        catui.mount(listBox, rows.length ? catui.html`<div class="Catui_table-wrap Catui_bk-scroll"><table class="Catui_tbl Catui_bk-waittbl"><caption class="Catui_clip">대기 명단 — 회차마다 신청 순서</caption>
          <thead><tr><th scope="col">순번</th><th scope="col">회차</th><th scope="col">이름</th><th scope="col" class="Catui_text-right">인원</th><th scope="col">신청 시각</th><th scope="col">상태</th><th scope="col"><span class="Catui_clip">관리</span></th></tr></thead>
          <tbody>${rows.map((w) => { const [t, c] = this.status[w.status] || this.status.waiting; return catui.html`<tr data-id="${w.id}"><td><b>${w.rank}</b>${bkClip("번째")}</td><td>${d.S[w.svc]?.name || w.svc}<br><small class="Catui_bk-muted">${d.B[w.branch]?.name || ""} · ${booking.dateLabel(w.date)} ${w.time}</small></td><td>${booking.mask(w.name)}</td><td class="Catui_text-right">${w.people}명</td><td>${booking.date(w.created, "MM.dd HH:mm")}</td><td><span class="Catui_badge ${c}">${t}</span></td>
            <td><div class="Catui_bk-acts">${w.status === "waiting" ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-call="${w.id}">호출${bkClip(` — ${booking.mask(w.name)}`)}</button>` : ""}<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-drop="${w.id}">삭제${bkClip(` — ${booking.mask(w.name)}`)}</button></div></td></tr>`; })}</tbody></table></div>`
          : catui.html`<div class="Catui_empty"><p class="Catui_empty-title">대기 중인 사람이 없습니다</p></div>`);
        if (focusId) listBox.querySelector(focusId)?.focus();
        const n = box.querySelector("[data-wait-n]"); if (n) n.textContent = `${rows.filter((w) => w.status === "waiting").length}명 대기`;
      };
      booking._on(f.svc, "change", times); booking._on(f.date, "change", times);
      booking._on(form, "submit", (e) => {
        e.preventDefault();
        if (!catui.form.validate(form)) return booking.warn(msg, "입력 내용을 확인해 주세요", form.querySelector("[aria-invalid=true]"));
        if (!f.time.value) return booking.warn(msg, "대기할 시간을 골라 주세요", f.time);
        const [svc, branch] = f.svc.value.split("|");
        const w = booking.wait.add({ svc, branch, date: f.date.value, time: f.time.value, name: f.name.value.trim(), phone: f.phone.value.trim(), people: Number(f.people.value) || 1 });
        const rank = booking.wait.list(d).find((x) => x.id === w.id)?.rank;
        booking.warn(msg, "");
        draw();
        const ok = form.querySelector("[data-ok]");
        if (ok) { ok.hidden = false; ok.textContent = `${booking.dateLabel(w.date)} ${w.time} 대기 ${rank}번째로 신청했습니다. 자리가 나면 문자로 알려 드립니다(예제).`; }
        booking.announce(`대기 ${rank}번째로 신청했습니다`);
      });
      booking._on(listBox, "click", (e) => {
        const call = e.target.closest("[data-call]"), drop = e.target.closest("[data-drop]");
        if (call) { booking.wait.set(call.dataset.call, "called"); draw(); booking.announce("호출했습니다"); listBox.querySelector(`[data-id="${call.dataset.call}"] [data-drop]`)?.focus(); }
        if (drop) catui.layer.confirm("대기 명단에서 삭제할까요?", { title: "대기 삭제", okText: "삭제" }, (idx) => { catui.layer.close(idx); booking.wait.set(drop.dataset.drop, "removed"); draw(); booking.announce("삭제했습니다"); box.querySelector("h2")?.focus(); });
      });
      times(); draw();
      return d;
    }).catch(() => null);
  },
};
