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

export const booking = {
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
