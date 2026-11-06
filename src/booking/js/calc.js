// calc — 화면 없이 쓰는 순수 계산 (문서 예제·서버 검증에도 그대로)
//   slots · left · dayState · price · stay · refund · layout · place

/** 남은 자리 = 정원 − 이미 찬 인원 (0 아래로 내려가지 않음). booked는 숫자 또는 [{ n }] 목록 */
booking.left = (capacity, booked = 0) => Math.max(0, Number(capacity || 0) - (Array.isArray(booked) ? booked.reduce((a, b) => a + Number(b.n ?? b.people ?? 1), 0) : Number(booked || 0)));

/** 시간 칸 만들기 — 영업시간 안에서 step분 간격, 이용 시간(duration)이 끝까지 들어가는 칸만
 *  state 우선순위: closed(휴무일) > past(지난 시간: 오늘이면 지금 + lead분 이전) > break(휴게시간과 겹침) > full(마감) > open
 *  booked: { "10:00": 찬 인원 } · 반환 [{ time, end, state, left, capacity, few }] */
booking.slots = function ({ date, open = "10:00", close = "20:00", step = 30, duration, breaks = [], closed = [], capacity = 1, booked = {}, times = null, now = booking.now(), lead = booking.rules.lead } = {}) {
  const k = booking.kst(now), dur = Number(duration || step), cap = Number(capacity) || 1;
  const isClosed = !!date && closed.includes(booking.dow(date));
  const starts = times ? times.map(booking.toMin) : [];
  if (!times) for (let t = booking.toMin(open); t + dur <= booking.toMin(close); t += step) starts.push(t);
  const br = breaks.map(([a, b]) => [booking.toMin(a), booking.toMin(b)]);
  return starts.map((t) => {
    const time = booking.fromMin(t), end = booking.fromMin(t + dur);
    const left = booking.left(cap, booked[time] || 0);
    const past = date < k.key || (date === k.key && t < k.min + lead);
    const inBreak = br.some(([a, b]) => t < b && t + dur > a);
    const state = isClosed ? "closed" : past ? "past" : inBreak ? "break" : left <= 0 ? "full" : "open";
    return { time, end, state, left: state === "open" || state === "full" ? left : 0, capacity: cap, few: state === "open" && left <= booking.rules.fewLeft };
  });
};
/** 시간 칸 상태를 사람이 읽는 글자로 (색만으로 알리지 않도록 늘 함께 보여 준다) */
booking.slotText = (s) => ({ closed: "휴무", past: "지난 시간", break: "휴게 시간", full: "마감" }[s.state] || `${s.left}자리 남음`);

/** 날짜 하나의 상태(달력 표시용): past · beyond(예약 기간 밖) · closed · full(모든 칸 마감) · few · open */
booking.dayState = function (date, opt = {}) {
  const today = booking.kst(opt.now || booking.now()).key;
  if (date < today) return "past";
  if (booking.diffDays(today, date) > (opt.maxDays ?? booking.rules.maxDays)) return "beyond";
  if ((opt.closed || []).includes(booking.dow(date))) return "closed";
  // opt.list(date): 시간 칸을 직접 주는 함수(예: 날짜마다 찬 자리가 다를 때) — 없으면 opt로 booking.slots
  const list = (typeof opt.list === "function" ? opt.list(date) : booking.slots({ ...opt, date })).filter((s) => s.state === "open" || s.state === "full");
  if (!list.length) return "full";
  const open = list.filter((s) => s.state === "open");
  if (!open.length) return "full";
  return open.reduce((a, s) => a + s.left, 0) <= booking.rules.fewLeft * 2 ? "few" : "open";
};
booking.dayText = (st) => ({ past: "지난 날짜", beyond: "예약 전", closed: "휴무", full: "마감", few: "마감 임박", open: "예약 가능" }[st] || "");

/** 좌석 배치도: 칸 목록 { id, row, col(격자 열 0~), n(좌석 번호), kind: "seat"|"void", access(휠체어), grade, price, cap } */
booking.cells = function (map) {
  const out = [];
  for (const [r, row] of (map?.rows || []).entries()) {
    let n = 0;
    [...row.cells].forEach((ch, c) => {
      if (ch === "_") { out.push({ id: "", row: row.id, r, col: c, kind: "void" }); return; }
      n += 1;
      const id = `${row.id}${n}`, grade = (map.grades || []).find((g) => g.rows.includes(row.id));
      out.push({ id, row: row.id, r, col: c, n, kind: "seat", access: ch === "w", grade: grade?.id || "", price: grade?.price || 0, cap: map.cap?.[id] || 0 });
    });
  }
  return out;
};

/** 인원·옵션 금액 — lines: [{ label, unit, qty, amount }]
 *  · slot·room 외: 어른 price × 어른 + 어린이 childPrice × 어린이
 *  · 좌석 등급(map.grades)이 있으면: 고른 좌석의 등급 가격 합 − 어린이 수 × childOff
 *  · 옵션: per "person" 인원수 · "person-night" 인원수×박 수 · "once" 1 */
booking.price = function (svc, { adult = 0, child = 0, options = [], seats = [], map = null, nights = 1 } = {}) {
  const lines = [], a = Math.max(0, Number(adult) || 0), c = Math.max(0, Number(child) || 0), people = a + c;
  if (svc?.kind === "seat" && map?.grades?.length) {
    const cells = booking.cells(map), by = {};
    for (const id of seats) { const cell = cells.find((x) => x.id === id); if (cell?.grade) (by[cell.grade] = by[cell.grade] || { unit: cell.price, qty: 0 }).qty += 1; }
    for (const g of map.grades) if (by[g.id]) lines.push({ label: `${g.id}석`, unit: by[g.id].unit, qty: by[g.id].qty, amount: by[g.id].unit * by[g.id].qty });
    const kids = Math.min(c, seats.length);
    if (kids && svc.childOff) lines.push({ label: "어린이 할인", unit: -svc.childOff, qty: kids, amount: -svc.childOff * kids });
  } else if (svc && svc.kind !== "room") {
    if (a) lines.push({ label: "어른", unit: Number(svc.price) || 0, qty: a, amount: (Number(svc.price) || 0) * a });
    if (c) { const cp = Number(svc.childPrice ?? svc.price) || 0; lines.push({ label: "어린이", unit: cp, qty: c, amount: cp * c }); }
  }
  for (const id of options) {
    const o = (svc?.options || []).find((x) => x.id === id);
    if (!o) continue;
    const qty = o.per === "person" ? people : o.per === "person-night" ? people * Math.max(1, nights) : 1;
    if (qty) lines.push({ label: o.name, unit: o.price, qty, amount: o.price * qty, option: o.id });
  }
  return { lines, people, total: lines.reduce((s, l) => s + l.amount, 0) };
};

/** 숙박 기간 요금 — 밤마다: 주말(rules.weekendDays) 또는 공휴일 전날이면 객실가 × (1 + weekendRate%)를 priceUnit 단위로 반올림,
 *  기준 인원(base) 넘는 사람마다 extraPerson. 반환 { nights, weekday, weekend, lines: [{ date, weekend, holiday, rate, extra, amount }], room, extra, total, over, error } */
booking.stay = function (room, checkin, checkout, { adult = 2, child = 0, holidays = [] } = {}) {
  const n = booking.nights(checkin, checkout), people = (Number(adult) || 0) + (Number(child) || 0);
  const res = { nights: n, weekday: 0, weekend: 0, lines: [], room: 0, extra: 0, total: 0, over: !!room && people > room.max, error: "" };
  if (!room) { res.error = "객실을 골라 주세요"; return res; }
  if (!checkin || !checkout || n <= 0) { res.error = "체크아웃은 체크인 다음 날 이후여야 합니다"; return res; }
  const unit = booking.rules.priceUnit, extraN = Math.max(0, people - room.base);
  for (let i = 0; i < n; i++) {
    const date = booking.addDays(checkin, i), holiday = holidays.includes(booking.addDays(date, 1));
    const weekend = booking.rules.weekendDays.includes(booking.dow(date)) || holiday;
    const rate = weekend ? Math.round((room.price * (1 + booking.rules.weekendRate / 100)) / unit) * unit : room.price;
    const extra = extraN * (room.extraPerson || 0);
    res.lines.push({ date, weekend, holiday, rate, extra, amount: rate + extra });
    res[weekend ? "weekend" : "weekday"] += 1; res.room += rate; res.extra += extra;
  }
  res.total = res.room + res.extra;
  if (res.over) res.error = `이 객실은 최대 ${room.max}명까지 묵을 수 있습니다`;
  return res;
};

/** 취소 환불 — 이용일까지 남은 날(한국 날짜 기준)로 rules.refund에서 첫 규칙을 고른다.
 *  이용 시작 시각이 지났으면 취소할 수 없음. 반환 { ok, days, rate, refund, fee, rule, label } */
booking.refund = function (amount, date, time = "00:00", { now = booking.now(), rules = booking.rules.refund } = {}) {
  const total = Math.max(0, Number(amount) || 0);
  const days = booking.diffDays(booking.kst(now).key, date);
  if (now >= booking.at(date, time)) return { ok: false, days, rate: 0, refund: 0, fee: total, rule: null, label: "이용 시작 시각이 지나 취소할 수 없습니다" };
  const sorted = [...rules].sort((x, y) => y.days - x.days);
  const rule = sorted.find((r) => days >= r.days) || sorted[sorted.length - 1];
  const unit = booking.rules.refundUnit;
  const refund = Math.floor((total * rule.rate) / 100 / unit) * unit;
  const label = days === 0 ? "이용 당일" : `이용 ${days}일 전`;
  return { ok: true, days, rate: rule.rate, refund, fee: total - refund, rule, label: `${label} · ${rule.rate}% 환불` };
};
/** 환불 규정 표 글자: [{ days, rate, text }] */
booking.refundTable = (rules = booking.rules.refund) => [...rules].sort((x, y) => y.days - x.days).map((r, i, a) => ({
  ...r, text: r.days === 0 ? "이용 당일" : i === 0 ? `이용 ${r.days}일 전까지` : `이용 ${r.days}일 ~ ${a[i - 1].days - 1}일 전`,
}));

/** 일정 블록 겹침 처리 — 같은 열(직원·날짜)의 블록에 lane(0~)·lanes(겹친 묶음의 칸 수)를 붙인다.
 *  시작 순(같으면 긴 것 먼저)으로 놓고, 끝난 칸이 있으면 그 칸을 다시 쓴다. 이어서 겹치는 블록끼리 한 묶음 */
booking.layout = function (blocks) {
  const list = blocks.map((b) => ({ ...b, _s: booking.toMin(b.start), _e: booking.toMin(b.end) }))
    .sort((a, b) => a._s - b._s || b._e - a._e);
  const out = [];
  let group = [], ends = [], groupEnd = -1;
  const flush = () => { const n = ends.length; group.forEach((b) => { b.lanes = n; }); out.push(...group); group = []; ends = []; };
  for (const b of list) {
    if (group.length && b._s >= groupEnd) flush();
    let lane = ends.findIndex((e) => e <= b._s);
    if (lane < 0) { lane = ends.length; ends.push(b._e); } else ends[lane] = b._e;
    b.lane = lane; group.push(b); groupEnd = Math.max(groupEnd, b._e);
    if (group.length === 1) groupEnd = b._e;
  }
  flush();
  return out.map(({ _s, _e, ...b }) => b);
};
/** 시간축 위치(%) — { top, height } (from~to 범위를 넘는 부분은 잘라 냄) */
booking.place = function (b, { from = "09:00", to = "21:00" } = {}) {
  const f = booking.toMin(from), span = booking.toMin(to) - f;
  const s = Math.max(0, booking.toMin(b.start) - f), e = Math.min(span, booking.toMin(b.end) - f);
  return { top: (s / span) * 100, height: Math.max(0, ((e - s) / span) * 100) };
};
