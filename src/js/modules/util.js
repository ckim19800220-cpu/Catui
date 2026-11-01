import { escape, html, raw } from "../core/html.js";

// util — 자주 쓰는 도구.
export const util = (() => {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const toDate = (t) => (t instanceof Date ? t : new Date(typeof t === "string" && /^\d+$/.test(t) ? Number(t) : t));

  // util.toDateString(Date.now(), 'yyyy-MM-dd HH:mm:ss')
  function toDateString(time = Date.now(), format = "yyyy-MM-dd HH:mm:ss") {
    const d = toDate(time);
    if (Number.isNaN(d.getTime())) return "";
    const map = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) };
    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => map[k]);
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
    let timer = 0;
    const tick = () => {
      const left = Math.max(0, end - (Date.now() - offset));
      const t = { d: Math.floor(left / 86400000), h: Math.floor(left / 3600000) % 24, m: Math.floor(left / 60000) % 60, s: Math.floor(left / 1000) % 60, left };
      ready?.(t);
      if (left <= 0) { clearInterval(timer); clear?.(); }
    };
    tick();
    timer = setInterval(tick, 1000);
    return { clear() { clearInterval(timer); } };
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

  async function copy(text) {
    try { await navigator.clipboard.writeText(String(text)); return true; } catch { return false; }
  }

  return { toDateString, timeAgo, countdown, debounce, throttle, copy, escape, html, raw };
})();
