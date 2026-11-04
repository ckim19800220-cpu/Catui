import { escape, html, raw } from "../core/html.js";
import { hint } from "../core/base.js";

// util — 자주 쓰는 도구.
export const util = (() => {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  // 'YYYY-MM-DD'만 있는 문자열은 new Date()가 UTC 자정으로 읽어 시간대만큼 밀리므로 현지 자정으로 만든다
  const toDate = (t) => {
    if (t instanceof Date) return t;
    if (typeof t === "string") {
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.trim());
      if (d) return new Date(+d[1], +d[2] - 1, +d[3]);
      if (/^\d+$/.test(t)) return new Date(Number(t));
    }
    return new Date(t);
  };
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  // util.toDateString(Date.now(), 'yyyy-MM-dd HH:mm:ss')
  // 토큰: yyyy yy · MM M · dd d · HH H · hh h(12시간) · mm m · ss s · a(오전/오후) · E(요일 한 글자). 따옴표 안 글자는 그대로: "yyyy'년'"
  function toDateString(time = Date.now(), format = "yyyy-MM-dd HH:mm:ss") {
    const d = toDate(time);
    if (Number.isNaN(d.getTime())) return "";
    const h = d.getHours(), h12 = h % 12 || 12;
    const map = {
      yyyy: d.getFullYear(), yy: pad(d.getFullYear() % 100), MM: pad(d.getMonth() + 1), M: d.getMonth() + 1, dd: pad(d.getDate()), d: d.getDate(),
      HH: pad(h), H: h, hh: pad(h12), h: h12, mm: pad(d.getMinutes()), m: d.getMinutes(), ss: pad(d.getSeconds()), s: d.getSeconds(),
      a: h < 12 ? "오전" : "오후", E: DOW[d.getDay()],
    };
    return format.replace(/'([^']*)'|yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|a|E/g, (k, lit) => (lit != null ? lit : map[k]));
  }

  // util.timeAgo(시각) → '방금' · '5분 전' · '3시간 전' · '2일 전' · 30일 넘으면 날짜
  function timeAgo(time, onlyDate = false) {
    const d = toDate(time), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 0) return toDateString(d, onlyDate ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm");
    if (diff < 60) return "방금";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
    return toDateString(d, onlyDate ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm");
  }

  // util.countdown({ date: 목표시각, ready(t){ t.d, t.h, t.m, t.s }, clear(){} }) → { clear() }
  function countdown({ date, now = Date.now(), ready, clear } = {}) {
    const end = toDate(date).getTime(), offset = Date.now() - toDate(now).getTime();
    // 잘못된 날짜면 남은 시간이 NaN이라 끝나지 않는 타이머가 된다 → 시작하지 않음
    if (!Number.isFinite(end) || !Number.isFinite(offset)) { hint.error(`util.countdown: 날짜를 해석할 수 없습니다 (${date})`); return { clear() {} }; }
    let timer = 0;
    const tick = () => {
      const left = Math.max(0, end - (Date.now() - offset));
      const t = { d: Math.floor(left / 86400000), h: Math.floor(left / 3600000) % 24, m: Math.floor(left / 60000) % 60, s: Math.floor(left / 1000) % 60, left };
      ready?.(t);
      if (left <= 0) { clearInterval(timer); timer = 0; clear?.(); }
    };
    timer = setInterval(tick, 1000);
    tick();
    return { clear() { clearInterval(timer); timer = 0; } };
  }

  function debounce(fn, wait = 200) {
    let t = 0;
    const d = function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  function throttle(fn, wait = 200) {
    let last = 0, t = 0;
    const th = function (...args) {
      const now = Date.now(), rest = wait - (now - last);
      if (rest <= 0) { last = now; fn.apply(this, args); }
      else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, rest); }
    };
    th.cancel = () => clearTimeout(t);
    return th;
  }

  // 클립보드 복사. http 같은 비보안 환경에서는 Clipboard API가 없으므로 숨긴 textarea로 대신한다
  async function copy(text) {
    const s = String(text ?? "");
    try { await navigator.clipboard.writeText(s); return true; } catch { /* 대체 경로 */ }
    const ta = Object.assign(document.createElement("textarea"), { value: s, readOnly: true });
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    const back = document.activeElement;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    back?.focus?.({ preventScroll: true });
    return ok;
  }

  // util.number(1234567.8, 1) → '1,234,567.8' (한국어 천 단위 구분)
  function number(n, decimals) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v.toLocaleString("ko-KR", decimals == null ? undefined : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  // util.fileSize(1536) → '1.5KB' · 'B·KB·MB·GB·TB'
  function fileSize(bytes, decimals = 1) {
    const v = Number(bytes);
    if (!Number.isFinite(v) || v < 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = v === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(v) / Math.log(1024)));
    return `${Number((v / 1024 ** i).toFixed(i ? decimals : 0))}${units[i]}`;
  }

  return { toDateString, timeAgo, countdown, debounce, throttle, copy, number, fileSize, escape, html, raw };
})();
