/*! CatuiBooking JS 2.0.0 | MIT License (c) imcatDevs | catui 위에 로드 */
(function (global) {
"use strict";
const catui = global.catui;
if (!catui) { console.error("[CatuiBooking]: catui.js를 먼저 불러와 주세요 — <script src=\"catui.js\"></script> 다음에 catbooking.js"); return; }

// ── booking.js ──
// CatuiBooking — catui.js 위에 얹는 예약·일정 확장 (catui.booking)
//   전역: <script src="catui.js"></script><script src="catbooking.js"></script> → catui.booking
//   ESM : import booking from "@imcat-ckim/catui/booking"
// 화면 루트: <div class="Catui_site Catui_bk" data-catui-bk> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 날짜·시간은 모두 한국 시간(KST, UTC+9) 기준 — 브라우저 시간대와 상관없이 같은 결과. 날짜 값은 "YYYY-MM-DD" 글자.
// 상태(테마·진행 중 예약·저장한 예약·취소·대기 명단)는 catui.data('booking')(localStorage "catui:booking")에 기억한다.

const BK_STORE = "booking";
const bkGet = (k, d) => { const v = catui.data(BK_STORE)[k]; return v === undefined ? d : v; };
const bkSet = (k, v) => catui.data(BK_STORE, { key: k, value: v });
const bkQuery = () => new URLSearchParams(location.search);
// 숨김 글자(화면 낭독기용) — 역할 없는 span에 aria-label을 달지 않고 이 글자로 의미를 보충한다
const bkClip = (t) => catui.html`<span class="Catui_clip">${t}</span>`;
const bkReduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const BK_DOW = ["일", "월", "화", "수", "목", "금", "토"];

const booking = {
  version: catui.version,
  root: null,
  /** 규칙 (서비스 정책에 맞게 바꿔 쓴다)
   *  lead: 지금부터 몇 분 뒤 시간부터 예약 가능 · fewLeft: "마감 임박" 기준 남은 자리 · maxDays: 며칠 뒤까지 예약
   *  weekendDays: 주말 요금 밤(요일, 0=일) · weekendRate: 주말 할증 % · priceUnit: 숙박 요금 반올림 단위
   *  refund: 이용일 며칠 전까지 몇 % 환불(큰 날짜부터) · refundUnit: 환불 금액 내림 단위 */
  rules: {
    lead: 30, fewLeft: 2, maxDays: 60,
    weekendDays: [5, 6], weekendRate: 30, priceUnit: 100,
    refund: [{ days: 7, rate: 100 }, { days: 3, rate: 70 }, { days: 1, rate: 50 }, { days: 0, rate: 0 }],
    refundUnit: 10,
  },
  store: { get: bkGet, set: bkSet, clear: () => catui.data(BK_STORE, null) },
  /** 이벤트: 'theme' · 'date' { date } · 'slot' { time } · 'people' { adult, child, options, total } · 'seats' { selected, reason } ·
   *  'stay' { checkin, checkout, room, total } · 'save' { reservation } · 'cancel' { no, refund } · 'wait' { entry } · 'data' */
  on: (evt, fn) => catui.onevent("booking", evt, fn),
  emit: (evt, payload) => catui.event("booking", evt, null, payload),
  query: bkQuery,
  _offs: [],
  // destroy 뒤에 늦게 도착한 응답(.then 안의 연결)은 등록하지 않는다 — 해제 목록이 이미 비워져 새는 것을 막음
  _on(target, type, fn, opt) { if (!target || this._dead) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
  _seen: new WeakMap(),
  _once(target, key) { let s = this._seen.get(target); if (!s) this._seen.set(target, (s = new Set())); if (s.has(key)) return false; s.add(key); return true; },
};

// ── 금액 ──
/** 45000 → "45,000원" (음수는 "−5,000원") */
booking.won = (n) => { const v = Math.round(Number(n) || 0); return `${v < 0 ? "−" : ""}${catui.util.number(Math.abs(v))}원`; };

// ── 한국 시간 ──
const bkPad = (n) => String(n).padStart(2, "0");
const bkUtc = (key) => { const [y, m, d] = String(key).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const bkKeyOf = (t) => `${t.getUTCFullYear()}-${bkPad(t.getUTCMonth() + 1)}-${bkPad(t.getUTCDate())}`;
/** 모의 데이터의 "지금" — <html data-catui-bk-now="ISO"> (없으면 실제 시각) */
booking.now = () => (booking.fixedNow ? new Date(booking.fixedNow) : new Date());
/** 어떤 시각을 한국 시간으로 쪼갠다: { key: "2026-11-04", y, m, d, h, mi, min(자정부터 분), dow } */
booking.kst = function (when = booking.now()) {
  const t = new Date(+new Date(when) + 9 * 3600e3);
  const h = t.getUTCHours(), mi = t.getUTCMinutes();
  return { key: bkKeyOf(t), y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h, mi, min: h * 60 + mi, dow: t.getUTCDay() };
};
booking.today = () => booking.kst().key;
booking.addDays = (key, n) => bkKeyOf(new Date(bkUtc(key) + n * 864e5));
booking.dow = (key) => new Date(bkUtc(key)).getUTCDay();
/** b − a (날짜 수). diffDays("2026-11-04", "2026-11-07") = 3 */
booking.diffDays = (a, b) => Math.round((bkUtc(b) - bkUtc(a)) / 864e5);
/** 숙박 박 수 = 체크아웃 − 체크인 (0 이하면 0) */
booking.nights = (checkin, checkout) => (checkin && checkout ? Math.max(0, booking.diffDays(checkin, checkout)) : 0);
/** "10:30" → 630 · 630 → "10:30" */
booking.toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
booking.fromMin = (n) => `${bkPad(Math.floor(n / 60))}:${bkPad(n % 60)}`;
/** 한국 시간 날짜+시각 → Date */
booking.at = (key, time = "00:00") => new Date(`${key}T${time}:00+09:00`);
/** 날짜 글자: "11월 4일 (수)" · long이면 "2026년 11월 4일 수요일" */
booking.dateLabel = function (key, { long = false, year = false } = {}) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number), w = BK_DOW[booking.dow(key)];
  return long ? `${y}년 ${m}월 ${d}일 ${w}요일` : `${year ? `${y}년 ` : ""}${m}월 ${d}일 (${w})`;
};
booking.dowName = (i) => BK_DOW[i];

// ── 화면 낭독기 알림 (한 곳) ──
booking.announce = function (msg) {
  let live = document.querySelector("[data-catui-bk-live]");
  if (!live) {
    live = Object.assign(document.createElement("p"), { className: "Catui_clip" });
    live.setAttribute("aria-live", "polite"); live.setAttribute("data-catui-bk-live", "");
    document.body.appendChild(live);
  }
  live.textContent = "";
  setTimeout(() => { live.textContent = msg; }, 30);   // 같은 문장도 다시 읽히게 비웠다가 넣음
};

// ── 테마: 다른 확장과 같은 규칙(저장값 없으면 시스템) ──
booking.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => bkGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-bk-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) { bkSet("theme", v); this.apply(v); booking.emit("theme", { value: this.get(), saved: v }); },
  init() {
    // <html data-catui-theme-lock>: 다른 쪽(예: 문서 사이트)이 테마를 관리하는 화면 — 덮어쓰지 않는다
    if (document.documentElement.hasAttribute("data-catui-theme-lock")) return;
    this.apply(this.saved());
    if (!booking._once(document, "theme")) return;   // 재호출 시 클릭이 두 번 처리돼 토글이 상쇄되지 않게
    const mq = matchMedia("(prefers-color-scheme: dark)");
    booking._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    booking._on(document, "click", (e) => { if (e.target.closest("[data-catui-bk-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};

// ── calc.js ──
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

// ── data.js ──
// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.booking.data('slots').then((v) => …)   data/slots.json 을 한 번만 읽어 캐시
//   catui.booking.dataBase = '/api/'             주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   catui.booking.load()                         services·branches·slots·seats·rooms·reservations·staff·schedule·waitlist 를 합쳐 한 번만
//     · 남은 자리 = 정원 − (slots.json 예약 현황 + 이 브라우저에서 저장한 예약), 금액 = 서비스 원자료로 계산(저장하지 않음)
booking.dataBase = "data/";
booking._dataCache = new Map();
booking.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiBooking: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
const bkById = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));
booking.load = function () {
  if (this._loaded) return this._loaded;
  const names = ["services", "branches", "slots", "seats", "rooms", "reservations", "staff", "schedule", "waitlist"];
  this._loaded = Promise.all(names.map((n) => this.data(n))).then(([services, branches, slots, seats, rooms, reservations, staff, schedule, waitlist]) => {
    const d = {
      services, S: bkById(services), branches, B: bkById(branches), slots, maps: seats,
      rooms: rooms.rooms || [], R: bkById(rooms.rooms), holidays: rooms.holidays || [],
      reservations, staff, T: bkById(staff), schedule, waitlist,
    };
    this.emit("data", { data: d });
    return d;
  });
  this._loaded.catch(() => { this._loaded = null; });
  return this._loaded;
};

// ── 진행 중인 예약(단계 사이에서 기억) ──
booking.draft = {
  get: () => ({ adult: 1, child: 0, options: [], seats: [], ...bkGet("draft", {}) }),
  set(patch) { const v = { ...this.get(), ...patch }; bkSet("draft", v); return v; },
  clear: () => bkSet("draft", {}),
  /** 주소의 ?svc=&branch=&date= 를 진행 중 예약에 합친다(서비스·지점이 바뀌면 나머지는 비움) */
  fromQuery(q = bkQuery()) {
    const cur = this.get(), svc = q.get("svc"), branch = q.get("branch"), date = q.get("date");
    if (svc && svc !== cur.svc) return this.set({ svc, branch: branch || "", date: date || "", time: "", seats: [], room: "", options: [], change: "", adult: 1, child: 0 });
    const patch = {};
    if (branch && branch !== cur.branch) Object.assign(patch, { branch, time: "", seats: [] });
    if (date && date !== cur.date) Object.assign(patch, { date, time: "", seats: [] });
    return Object.keys(patch).length ? this.set(patch) : cur;
  },
};

// ── 이미 찬 자리 ──
const bkSavedLive = () => bkGet("saved", []).filter((r) => !bkGet("cancelled", {})[r.no]);
/** 시간마다 찬 인원 { "10:00": n } — slots.json + 이 브라우저에서 저장한 예약 (except: 변경 중인 예약 번호) */
booking.bookedAt = function (d, svc, branch, date, { except = "" } = {}) {
  const out = {};
  for (const x of d.slots.people || []) if (x.svc === svc && x.branch === branch && x.date === date) out[x.time] = (out[x.time] || 0) + Number(x.n || 0);
  for (const r of bkSavedLive()) if (r.no !== except && r.svc === svc && r.branch === branch && r.date === date) out[r.time] = (out[r.time] || 0) + (r.adult || 0) + (r.child || 0);
  return out;
};
/** 그 회차에 이미 예약된 좌석 id 목록 */
booking.seatsTaken = function (d, svc, date, time, { except = "" } = {}) {
  const set = new Set();
  for (const x of d.slots.seats || []) if (x.svc === svc && x.date === date && x.time === time) x.seats.forEach((s) => set.add(s));
  for (const r of bkSavedLive()) if (r.no !== except && r.svc === svc && r.date === date && r.time === time) (r.seats || []).forEach((s) => set.add(s));
  return [...set];
};
/** 좌석 회차의 시간마다 찬 좌석 수 { "14:00": n } — 시간 칸 계산에 쓴다 */
booking.seatBooked = function (d, svc, date, opt) {
  const out = {};
  for (const t of d.S[svc]?.times || []) out[t] = booking.seatsTaken(d, svc, date, t, opt).length;
  return out;
};
/** 기간 동안 남은 객실 수 = 객실 수 − (밤마다 겹친 예약 수의 최댓값) */
booking.roomLeft = function (d, roomId, checkin, checkout, { except = "" } = {}) {
  const room = d.R[roomId];
  if (!room) return 0;
  const list = [...(d.slots.rooms || []).filter((x) => x.room === roomId).map((x) => ({ from: x.from, to: x.to, n: x.n || 1 })),
    ...bkSavedLive().filter((r) => r.no !== except && r.room === roomId).map((r) => ({ from: r.date, to: r.checkout, n: 1 }))];
  let worst = 0;
  for (let i = 0, n = booking.nights(checkin, checkout); i < n; i++) {
    const night = booking.addDays(checkin, i);
    worst = Math.max(worst, list.filter((x) => x.from <= night && night < x.to).reduce((a, x) => a + x.n, 0));
  }
  return Math.max(0, room.count - worst);
};
/** 좌석 수(배치도의 좌석 칸 수) */
booking.seatCount = (map) => booking.cells(map).filter((c) => c.kind === "seat").length;

// ── 금액 (예약 한 건) ──
booking.amountOf = function (d, r) {
  const svc = d.S[r.svc];
  if (!svc) return { total: 0, price: { lines: [], total: 0 } };
  if (svc.kind === "room") {
    const st = booking.stay(d.R[r.room], r.date, r.checkout, { adult: r.adult, child: r.child, holidays: d.holidays });
    const p = booking.price(svc, { adult: r.adult, child: r.child, options: r.options || [], nights: st.nights });
    return { stay: st, price: p, total: st.total + p.total };
  }
  const p = booking.price(svc, { adult: r.adult, child: r.child, options: r.options || [], seats: r.seats || [], map: svc.map ? d.maps[svc.map] : null });
  return { price: p, total: p.total };
};

// ── 내 예약 ──
/** reservations.json + 이 브라우저에서 저장·변경한 예약 + 취소 기록. phase: upcoming · past · cancelled */
booking.mine = function (d) {
  const all = new Map(d.reservations.map((r) => [r.no, { ...r }]));
  for (const r of bkGet("saved", [])) all.set(r.no, { ...r, saved: true });
  const cancel = bkGet("cancelled", {}), now = booking.now();
  return [...all.values()].map((r0) => {
    const r = cancel[r0.no] ? { ...r0, status: "cancelled", cancel: cancel[r0.no] } : r0;
    const svc = d.S[r.svc] || {}, a = booking.amountOf(d, r);
    const phase = r.status === "cancelled" ? "cancelled" : now >= booking.at(r.date, r.time || "00:00") ? "past" : "upcoming";
    return { ...r, phase, svcObj: svc, branchObj: d.B[r.branch] || {}, amount: a.total, calc: a };
  }).sort((x, y) => (x.phase === "upcoming" && y.phase === "upcoming" ? `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`) : `${y.date}${y.time}`.localeCompare(`${x.date}${x.time}`)));
};
booking.find = (d, no) => booking.mine(d).find((r) => r.no === no) || null;

/** 저장 전에 확인 — 문제 글자 목록 (빈 배열이면 저장 가능) */
booking.check = function (d, v) {
  const out = [], svc = d.S[v.svc], branch = d.B[v.branch];
  if (!svc || !branch) return ["서비스와 지점을 골라 주세요"];
  const people = (v.adult || 0) + (v.child || 0);
  if (!(v.adult >= 1)) out.push("어른 1명 이상이어야 합니다");
  if (svc.kind === "room") {
    const st = booking.stay(d.R[v.room], v.date, v.checkout, { adult: v.adult, child: v.child, holidays: d.holidays });
    if (st.error) out.push(st.error);
    else if (booking.roomLeft(d, v.room, v.date, v.checkout, { except: v.change }) <= 0) out.push("그 기간에 남은 객실이 없습니다");
    if (v.date && v.date < booking.today()) out.push("지난 날짜입니다");
  } else {
    if (!v.date || !v.time) out.push("날짜와 시간을 골라 주세요");
    else {
      const s = booking.slotsFor(d, v).find((x) => x.time === v.time);
      if (!s || s.state !== "open") out.push(`${v.time}은(는) 예약할 수 없는 시간입니다 (${s ? booking.slotText(s) : "없음"})`);
      else if (svc.kind === "slot" && s.left < people) out.push(`남은 자리(${s.left})보다 인원이 많습니다`);
    }
    if (svc.kind === "seat") {
      const map = d.maps[svc.map], need = map.grades ? people : 1;
      if ((v.seats || []).length !== need) out.push(`좌석 ${need}개를 골라 주세요`);
      const taken = booking.seatsTaken(d, v.svc, v.date, v.time, { except: v.change });
      if ((v.seats || []).some((s) => taken.includes(s))) out.push("그 사이 다른 사람이 고른 좌석이 있습니다 — 다시 골라 주세요");
    }
  }
  if (people > (svc.maxPeople || 99)) out.push(`한 번에 ${svc.maxPeople}명까지 예약할 수 있습니다`);
  if (!v.name || !v.phone) out.push("예약자 이름과 연락처를 넣어 주세요");
  return out;
};
/** 진행 중 예약(서비스·지점·날짜)의 시간 칸 */
booking.slotsFor = function (d, v, date = v.date) {
  const svc = d.S[v.svc], br = d.B[v.branch];
  if (!svc || !br || !date) return [];
  if (svc.kind === "seat") {
    // 좌석·테이블 회차: 정원 = 배치도의 좌석(테이블) 수, 찬 자리 = 그 회차에 예약된 좌석 수
    return booking.slots({ date, times: svc.times, duration: svc.duration, closed: br.closed, capacity: booking.seatCount(d.maps[svc.map]), booked: booking.seatBooked(d, v.svc, date, { except: v.change }) });
  }
  return booking.slots({ date, open: br.open, close: br.close, step: svc.step, duration: svc.duration, breaks: br.breaks, closed: br.closed, capacity: svc.capacity, booked: booking.bookedAt(d, v.svc, v.branch, date, { except: v.change }) });
};

/** 예약 저장 — 번호 BK-YYMMDD-NNNN(한국 날짜 + 이 브라우저 일련번호). 변경(v.change)이면 같은 번호를 덮어쓴다 */
booking.save = function (v) {
  const k = booking.kst(), seq = bkGet("seq", 0) + 1;
  const no = v.change || `BK-${String(k.y).slice(2)}${bkPad(k.m)}${bkPad(k.d)}-${String(seq).padStart(4, "0")}`;
  if (!v.change) bkSet("seq", seq);
  const r = {
    no, svc: v.svc, branch: v.branch, date: v.date, time: v.time || "", adult: v.adult || 0, child: v.child || 0,
    options: v.options || [], seats: v.seats || [], room: v.room || "", checkout: v.checkout || "",
    name: v.name || "", phone: v.phone || "", email: v.email || "", request: v.request || "",
    status: "booked", created: booking.now().toISOString(),
  };
  bkSet("saved", [...bkGet("saved", []).filter((x) => x.no !== no), r]);
  if (v.change) { const c = { ...bkGet("cancelled", {}) }; delete c[no]; bkSet("cancelled", c); }
  bkSet("last", no);
  this.emit("save", { reservation: r });
  return r;
};
/** 취소 — 환불 규정으로 계산해 기록. 반환 booking.refund 결과(ok false면 취소하지 않음) */
booking.cancel = function (d, no) {
  const r = booking.find(d, no);
  if (!r || r.phase !== "upcoming") return { ok: false, label: "취소할 수 있는 예약이 아닙니다", refund: 0, fee: 0, rate: 0, days: 0, rule: null };
  const ref = booking.refund(r.amount, r.date, r.time || "00:00");
  if (!ref.ok) return ref;
  bkSet("cancelled", { ...bkGet("cancelled", {}), [no]: { at: booking.now().toISOString(), rate: ref.rate, refund: ref.refund } });
  this.emit("cancel", { no, refund: ref });
  return ref;
};

// ── 대기 명단 ──
booking.wait = {
  /** waitlist.json + 이 브라우저에서 넣은 대기 + 상태 바꿈. 같은 회차 안 신청 순서로 rank(대기·호출만) */
  list(d) {
    const st = bkGet("waitState", {});
    const all = [...d.waitlist, ...bkGet("wait", [])].map((w) => ({ ...w, status: st[w.id] || w.status })).filter((w) => w.status !== "removed");
    all.sort((a, b) => `${a.date}${a.time}${a.created}`.localeCompare(`${b.date}${b.time}${b.created}`));
    const n = {};
    return all.map((w) => { const key = `${w.svc}|${w.branch}|${w.date}|${w.time}`; n[key] = (n[key] || 0) + 1; return { ...w, rank: n[key], key }; });
  },
  add(entry) {
    const w = { id: `w${Date.now().toString(36)}`, status: "waiting", created: booking.now().toISOString(), ...entry };
    bkSet("wait", [...bkGet("wait", []), w]);
    booking.emit("wait", { entry: w });
    return w;
  },
  set(id, status) { bkSet("waitState", { ...bkGet("waitState", {}), [id]: status }); },
};
/** 이름 가리기: 김고양 → 김*양 · 이도 → 이* */
booking.mask = (name) => { const s = [...String(name || "")]; return s.length <= 1 ? s.join("") : s.length === 2 ? `${s[0]}*` : `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`; };

// ── seats.js ──
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

// ── cal.js ──
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

// ── flow.js ──
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

booking.flow = {
  steps: BK_STEPS,
  next: bkNextOf,
  prev: bkPrevOf,
  /** 단계 표시 (본체 .Catui_steps) — 지난 단계는 체크 + 숨김 글자 "완료", 지금 단계는 aria-current="step" */
  steps_(box, kind, cur) {
    const s = BK_STEPS[kind] || BK_STEPS.slot, at = s.findIndex((x) => x[0] === cur);
    catui.mount(box, catui.html`${s.map(([, t], i) => catui.html`${i ? catui.html`<li class="Catui_step-line${i <= at ? " Catui_step-line-done" : ""}" aria-hidden="true"></li>` : ""}<li class="Catui_step${i < at ? " Catui_step-done" : i === at ? " Catui_step-current" : ""}"${i === at ? catui.html` aria-current="step"` : ""}><span class="Catui_step-dot">${i < at ? catui.icon("check", 14) : i + 1}</span><span class="Catui_step-label">${t}${i < at ? bkClip(" 완료") : ""}</span></li>`)}`);
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
    if (!svc) { catui.mount(box, catui.html`<h2 class="Catui_h3">예약 내용</h2><p class="Catui_help">서비스를 먼저 골라 주세요.</p>`); return; }
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
    if (svc && d.B[v.branch] && (!kind || [].concat(kind).includes(svc.kind))) { this.empty(box, null); return true; }
    this.empty(box, catui.html`<p class="Catui_empty-title">예약할 서비스를 먼저 골라 주세요</p><p class="Catui_empty-text">${svc ? "이 단계는 고른 서비스에서 쓰지 않습니다." : "진행 중인 예약이 없습니다."}</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="index.html">서비스 고르기</a>`);
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
    root.querySelectorAll("[data-svc-name]").forEach((x) => { x.textContent = svc ? `${svc.name} · ${d.B[v.branch]?.name || ""}` : ""; });
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
    if (svc.kind === "room") return `1박 ${booking.won(Math.min(...d.rooms.map((r) => r.price)))}부터`;
    if (svc.kind === "seat" && d.maps[svc.map]?.grades) return `${booking.won(Math.min(...d.maps[svc.map].grades.map((g) => g.price)))}부터`;
    if (svc.kind === "seat") return `예약금 1인 ${booking.won(svc.price)}`;
    return `${booking.won(svc.price)}부터`;
  },
  init(root) {
    const box = root.querySelector("[data-catui-bk-home]"), nextBox = root.querySelector("[data-catui-bk-next]");
    if (!box && !nextBox) return;
    this.ready = booking.load().then((d) => {
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
    }).catch(() => null);
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
    this.ready = booking.load().then((d) => {
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
    }).catch(() => null);
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
    this.ready = booking.load().then((d) => {
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
    }).catch(() => null);
  },
};

// ── flow2.js ──
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
      if (!v.date || !v.time) { booking.flow.empty(body, catui.html`<p class="Catui_empty-title">날짜와 회차를 먼저 골라 주세요</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="date.html">날짜·회차 고르기</a>`); return d; }
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
          ${r.image ? catui.html`<img class="Catui_bk-photo" src="${r.image}" alt="" aria-hidden="true" width="640" height="200" loading="lazy" decoding="async">` : ""}
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
      // 새로 시작한 숙박(기간 없음)은 어른 2명부터 — 이미 고른 인원은 그대로
      v = booking.draft.set({ date: cin, checkout: cout, time: d.B[v.branch]?.open || "15:00", adult: v.date && v.checkout ? Math.max(1, v.adult || 1) : 2 });
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
      if (!booking.flow.need(form, d, v)) return d;
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
      if (!r) {
        const h = box.querySelector("h1"); if (h) h.textContent = "예약 번호를 찾지 못했습니다";
        const t = box.querySelector(".Catui_bk-ticket"); if (t) catui.mount(t, catui.html`<p class="Catui_empty-text">내 예약 목록에서 확인해 주세요.</p><a class="Catui_btn Catui_btn-md Catui_btn-primary" href="mine.html">내 예약</a>`);
        box.querySelector(".Catui_bk-done-ic")?.setAttribute("hidden", "");
        box.querySelectorAll("[data-detail], [data-amount]").forEach((x) => x.closest("section")?.setAttribute("hidden", ""));
        return d;
      }
      box.querySelectorAll("[data-no]").forEach((x) => { x.textContent = r.no; });
      catui.mount(box.querySelector("[data-qr]"), booking.view.qr(r.no));
      catui.mount(box.querySelector("[data-detail]"), booking.view.dl(d, r));
      catui.mount(box.querySelector("[data-amount]"), booking.view.amount(d, r));
      box.querySelectorAll("[data-detail-link]").forEach((a) => { a.href = `detail.html?no=${encodeURIComponent(r.no)}`; });
      return d;
    }).catch(() => null);
  },
};

// ── mine.js ──
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

// ── admin.js ──
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

// ── shell.js ──
// shell — 사이트 머리·선언형 속성
//   [data-catui-bk-won="45000"]     금액 글자 "45,000원"
//   [data-catui-bk-today]           오늘 날짜 글자 (한국 시간, 모의 "지금" 기준)
//   [data-catui-bk-reset]           진행 중 예약 비우기 (누르면 처음 단계로)
//   [data-catui-bk-theme]           테마 전환 (booking.theme)
booking.shell = {
  init(root) {
    if (booking._once(root, "photo-errors")) booking._on(root, "error", (e) => { if (e.target.matches?.(".Catui_bk-photo, .Catui_bk-hero-img")) e.target.hidden = true; }, true);
    root.querySelectorAll("[data-catui-bk-won]").forEach((el) => { el.textContent = booking.won(el.getAttribute("data-catui-bk-won")); });
    root.querySelectorAll("[data-catui-bk-today]").forEach((el) => { el.textContent = booking.dateLabel(booking.today(), { year: true }); });
    booking._on(root, "click", (e) => {
      const r = e.target.closest("[data-catui-bk-reset]");
      if (r) { booking.draft.clear(); booking.announce("진행 중인 예약을 비웠습니다"); }
    });
  },
};

// ── init.js ──
// 초기화 — 테마는 어느 화면에서나, 화면 부품은 [data-catui-bk] 루트가 있을 때
//   모의 데이터의 "지금" 기준 시각: <html data-catui-bk-now="2026-11-04T13:10:00+09:00"> (없으면 실제 시각)
//   루트가 없는 화면(예: 문서)에서는 데이터를 읽지 않는다 — slots·price·stay·refund·layout 같은 순수 함수와 seats.mount·calendar.mount만 쓸 수 있다
booking.init = function (scope = document) {
  this.fixedNow = document.documentElement.getAttribute("data-catui-bk-now") || undefined;
  this._dead = false;
  this.theme.init();
  const root = scope.matches?.("[data-catui-bk]") ? scope : scope.querySelector?.("[data-catui-bk]");
  if (root && !root.hasAttribute("data-catui-bk-ready")) {
    root.setAttribute("data-catui-bk-ready", "");
    this.root = root;
    const parts = ["shell", "home", "datePage", "peoplePage", "seatPage", "roomPage", "infoPage", "confirmPage", "completePage", "minePage", "detailPage", "waitPage", "adminPage"];
    for (const part of parts) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiBooking: ${part} 연결 실패`, "error", err); }
    }
    // 모든 부품이 데이터를 다 그린 뒤 풀린다
    this.ready = Promise.all(parts.map((p) => this[p]?.ready)).then(() => this, () => this);
  } else this.ready = Promise.resolve(this);
  return this;
};
booking.destroy = function () {
  this._dead = true;
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this._seen = new WeakMap();
  this.ready = undefined;
  for (const p of ["home", "datePage", "peoplePage", "seatPage", "roomPage", "infoPage", "confirmPage", "completePage", "minePage", "detailPage", "waitPage", "adminPage"]) if (this[p]) this[p].ready = undefined;
  this.root?.removeAttribute("data-catui-bk-ready");
  this.root = null;
};

catui.extend({ booking });
catui.use(() => { if (catui.config().autoInit !== false) booking.init(); });

})(typeof window !== "undefined" ? window : globalThis);
