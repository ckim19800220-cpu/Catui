import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon, uid, el, imeBusy, reducedMotion, within } from "../core/dom.js";
import { hint, data } from "../core/base.js";
import { emit, onEvent } from "../core/events.js";
import { util } from "./util.js";
import { layer } from "./layer.js";

// site — 공개 홈페이지 도구 묶음. 대부분 선언형 속성만으로 동작한다(catui.init이 연결).
//   헤더:      <header class="Catui_site-header" data-catui-header[="hide"]>  스크롤 그림자 · 내리면 숨기고 올리면 보이기 · 모바일 메뉴 닫기
//   현재 위치:  <nav data-catui-spy> <a href="#features">  보고 있는 섹션 링크에 aria-current="location"
//   공지 띠:    <div class="Catui_announce" data-catui-dismiss="키" data-catui-days="7"> … <button class="Catui_announce-close">
//   쿠키 동의:  <div class="Catui_cookie" data-catui-cookie> <button data-catui-consent="all|necessary">   · site.consent()
//   카운트다운: <p data-catui-countdown="2026-12-31T00:00:00+09:00" data-catui-done="마감"> <b data-catui-unit="d"></b>일 …
//   라이트박스: <div class="Catui_gallery" data-catui-lightbox> <a href="큰.jpg"><img alt></a>
//   요금 전환:  <div data-catui-billing> radio(value="monthly|yearly") … <b data-catui-monthly="9,900" data-catui-yearly="7,900">
//   구독 폼:    <form class="Catui_subscribe" data-catui-form data-catui-ajax="/api/subscribe" data-catui-subscribe="감사 문구">
//   로고 흐름:  <div class="Catui_logos" data-catui-marquee="30">  (초 단위 한 바퀴, 정지 버튼 포함)
//   읽기 막대:  <div class="Catui_readbar" data-catui-readbar="#article" aria-hidden="true"><i></i></div>
//   공유:      <button data-catui-share data-catui-share-title="제목">  Web Share → 안 되면 주소 복사
//   이벤트: site.on('consent', ({ value })) · site.on('dismiss(키)') · site.on('end(필터)')(카운트다운) · site.on('billing', ({ value }))

const MOD = "site";
const STORE = "site";   // catui.data('site') 저장 표 이름
const catuiSiteGet = (k) => data(STORE)[k];
const catuiSiteSet = (k, v) => data(STORE, { key: k, value: v });

// ── 카운트다운 (정리가 필요해 컴포넌트) ──
const catuiSiteCountdown = component({
  name: "countdown",
  config: { date: "", doneText: "", end: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box) return;
    const unit = (u) => box.querySelector(`[data-catui-unit="${u}"]`);
    const hasUnits = !!box.querySelector("[data-catui-unit]");
    const pad = (n) => String(n).padStart(2, "0");
    // 매초 읽지 않도록 숫자는 aria-hidden, 이름(aria-label)은 분 단위로만 바꾼다
    box.setAttribute("role", box.getAttribute("role") || "timer");
    let lastMin = -1;
    const t0 = util.countdown({
      date: c.date,
      ready(t) {
        if (hasUnits) {
          [["d", t.d], ["h", pad(t.h)], ["m", pad(t.m)], ["s", pad(t.s)]].forEach(([u, v]) => { const n = unit(u); if (n) { n.textContent = String(v); n.setAttribute("aria-hidden", "true"); } });
        } else box.textContent = `${t.d ? `${t.d}일 ` : ""}${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
        const mins = Math.floor(t.left / 60000);
        if (mins !== lastMin) { lastMin = mins; box.setAttribute("aria-label", `남은 시간 ${t.d}일 ${t.h}시간 ${t.m}분`); }
      },
      clear() {
        if (c.doneText) { box.textContent = c.doneText; box.removeAttribute("aria-label"); }
        c.end?.call(inst);
        inst.emit("end", { elem: box });
      },
    });
    inst.use(() => t0.clear());
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 로고 흐름 (정지 버튼·모션 줄이기 대응, 정리 필요) ──
const catuiSiteMarquee = component({
  name: "marquee",
  config: { seconds: 30, label: "고객사 로고" },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box || reducedMotion()) return;           // 모션 줄이기: 원래의 줄바꿈 배치 그대로
    const items = [...box.children];
    if (!items.length) return;
    box.classList.add("Catui_logos-marquee");
    const track = document.createElement("div");
    track.className = "Catui_logos-track";
    items.forEach((n) => track.appendChild(n));
    // 끝없이 흐르도록 한 벌을 복제 (복제는 화면 낭독기·키보드에서 제외)
    items.forEach((n) => { const k = n.cloneNode(true); k.setAttribute("aria-hidden", "true"); k.inert = true; k.querySelectorAll?.("[id]").forEach((x) => x.removeAttribute("id")); k.removeAttribute("id"); k.removeAttribute?.("data-catui-fx"); k.querySelectorAll?.("[data-catui-fx]").forEach((x) => x.removeAttribute("data-catui-fx")); track.appendChild(k); });
    track.style.animationDuration = `${Math.max(5, Number(c.seconds) || 30)}s`;
    box.appendChild(track);
    // 5초 넘게 움직이는 내용에는 멈춤 수단이 있어야 한다 (WCAG 2.2.2)
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon";
    const setBtn = (paused) => { mount(btn, icon(paused ? "play" : "pause", 16)); btn.setAttribute("aria-label", `${c.label} 흐름 ${paused ? "재생" : "정지"}`); btn.setAttribute("aria-pressed", String(paused)); };
    let paused = false;
    setBtn(false);
    btn.addEventListener("click", () => { paused = !paused; track.style.animationPlayState = paused ? "paused" : ""; setBtn(paused); });
    box.insertAdjacentElement("afterend", btn);
    inst.use(() => {
      btn.remove();
      track.querySelectorAll(":scope > [aria-hidden=true]").forEach((n) => n.remove());
      [...track.children].forEach((n) => box.insertBefore(n, track));
      track.remove();
      box.classList.remove("Catui_logos-marquee");
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 공지 띠 ──
const catuiDismissed = (bar) => {
  const key = bar.getAttribute("data-catui-dismiss");
  const at = key && catuiSiteGet(`dismiss:${key}`);
  if (!at) return false;
  const days = Number(bar.getAttribute("data-catui-days"));
  return !(days > 0 && Date.now() - at > days * 86400000);   // 기간이 지나면 다시 보임
};

// ── 쿠키 동의 ──
const catuiConsent = () => catuiSiteGet("consent") || null;

// ── 요금 월/연 전환 ──
const catuiBilling = (box, value) => {
  // 프로그램으로 바꿔도 라디오가 표시와 어긋나지 않게
  const r = box.querySelector(`input[type=radio][value="${CSS.escape(String(value))}"]`);
  if (r && !r.checked) r.checked = true;
  box.querySelectorAll("[data-catui-monthly], [data-catui-yearly]").forEach((n) => {
    if (!n.hasAttribute("aria-live")) n.setAttribute("aria-live", "polite");   // 바뀐 가격을 화면 낭독기에도 알린다
    const v = n.getAttribute(`data-catui-${value}`);
    if (v != null) n.textContent = v;
  });
  box.querySelectorAll("[data-catui-billing-show]").forEach((n) => { n.hidden = n.getAttribute("data-catui-billing-show") !== value; });
};

// ── 읽기 진행 막대 ──
const catuiReadbar = () => document.querySelectorAll("[data-catui-readbar]").forEach((bar) => {
  const sel = bar.getAttribute("data-catui-readbar");
  let t = null;
  try { t = sel ? document.querySelector(sel) : null; } catch { t = null; }
  const top = t ? t.getBoundingClientRect().top + scrollY : 0;
  const height = t ? t.offsetHeight : document.documentElement.scrollHeight;
  const range = Math.max(1, height - innerHeight);
  const p = Math.min(1, Math.max(0, (scrollY - top) / range));
  bar.style.setProperty("--Catui_read", p.toFixed(4));
});

// ── 헤더: 스크롤 상태 ──
let catuiLastY = 0;
const catuiHeaders = () => document.querySelectorAll(".Catui_site-header[data-catui-header]");
const catuiHeaderSync = () => {
  const y = scrollY, down = y > catuiLastY;
  catuiHeaders().forEach((h) => {
    h.toggleAttribute("data-catui-scrolled", y > 4);
    // "hide": 내릴 때 숨기고 올릴 때 보임. 메뉴가 열렸거나 헤더 안에 포커스가 있으면 숨기지 않음
    const keep = h.querySelector(".Catui_site-menu[open]") || h.contains(document.activeElement);
    if (h.getAttribute("data-catui-header") === "hide" && !reducedMotion()) h.toggleAttribute("data-catui-hidden", down && y > h.offsetHeight * 2 && !keep);
  });
  catuiLastY = y;
};

// ── 현재 위치(스크롤 스파이) ──
// 링크 대상이 제목(h2)처럼 얇아도 되도록, 대상이 속한 <section>의 위치로 판단한다.
// 화면 위에서 35% 선을 지난 섹션 중 마지막이 현재. 맨 아래까지 내리면 마지막 섹션.
let catuiSpyMap = null;   // 섹션 → 링크들
function catuiSpy() {
  catuiSpyMap = new Map();
  document.querySelectorAll("[data-catui-spy] a[href^='#']").forEach((a) => {
    let t = null;
    try { t = document.querySelector(a.getAttribute("href")); } catch { t = null; }
    if (!t) return;
    const sec = t.closest("section") || t;
    if (!catuiSpyMap.has(sec)) catuiSpyMap.set(sec, []);
    catuiSpyMap.get(sec).push(a);
  });
  catuiSpySync();
}
function catuiSpySync() {
  if (!catuiSpyMap?.size) return;
  const line = innerHeight * 0.35;
  const secs = [...catuiSpyMap.keys()].filter((s) => s.isConnected).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  let cur = null;
  secs.forEach((s) => { if (s.getBoundingClientRect().top <= line) cur = s; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = secs[secs.length - 1] || cur;
  if (cur && cur.getBoundingClientRect().bottom < 0) cur = null;   // 마지막 섹션도 이미 지나갔으면 없음
  catuiSpyMap.forEach((as, s) => as.forEach((a) => { if (s === cur) a.setAttribute("aria-current", "location"); else if (a.getAttribute("aria-current") === "location") a.removeAttribute("aria-current"); }));
}

// ── 공유 ──
async function catuiShare(btn) {
  const title = btn.getAttribute("data-catui-share-title") || document.title;
  const url = btn.getAttribute("data-catui-share-url") || location.href;
  const text = btn.getAttribute("data-catui-share-text") || "";
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); emit(MOD, "share", null, { method: "native", url }); return; }
    catch (err) { if (err?.name === "AbortError") return; }   // 사용자가 취소
  }
  const ok = await util.copy(url);
  layer.msg(ok ? "주소를 복사했습니다" : "주소를 복사하지 못했습니다", { icon: ok ? "success" : "warn" });
  emit(MOD, "share", null, { method: "copy", url, ok });
}

const catuiSiteParts = [catuiSiteCountdown, catuiSiteMarquee];
export const site = {
  countdown: catuiSiteCountdown,
  marquee: catuiSiteMarquee,
  consent: catuiConsent,
  // 저장한 동의를 지워 쿠키 띠를 다시 보이게 (설정 화면의 "쿠키 설정 다시 하기")
  resetConsent() { data(STORE, { key: "consent", remove: true }); document.querySelectorAll(".Catui_cookie[data-catui-cookie]").forEach((n) => { n.hidden = false; }); },
  share: catuiShare,
  billing(box, value) { const b = el(box); if (b) { catuiBilling(b, value); emit(MOD, "billing", b.getAttribute("data-catui-filter"), { value, elem: b }); } },
  on: (evt, fn) => onEvent(MOD, evt, fn),

  enhance(scope = document) {
    const each = (sel, fn) => within(scope, `${sel}:not([data-catui-ready])`).forEach((n) => {
      n.setAttribute("data-catui-ready", "");
      try { fn(n); } catch (err) { n.removeAttribute("data-catui-ready"); hint.error(`site: ${sel} 연결 실패`, "error", err, n); }
    });
    each(".Catui_announce[data-catui-dismiss]", (n) => { if (catuiDismissed(n)) n.hidden = true; });
    each(".Catui_cookie[data-catui-cookie]", (n) => { n.hidden = !!catuiConsent(); if (!n.getAttribute("role")) n.setAttribute("role", "region"); if (!n.getAttribute("aria-label")) n.setAttribute("aria-label", "쿠키 안내"); });
    each("[data-catui-countdown]", (n) => catuiSiteCountdown.render({ elem: n, auto: true, date: n.getAttribute("data-catui-countdown"), doneText: n.getAttribute("data-catui-done") || "" }));
    each("[data-catui-marquee]", (n) => catuiSiteMarquee.render({ elem: n, auto: true, seconds: Number(n.getAttribute("data-catui-marquee")) || 30, label: n.getAttribute("aria-label") || "고객사 로고" }));
    each("[data-catui-billing]", (n) => { const on = n.querySelector("input[type=radio]:checked"); if (on) catuiBilling(n, on.value); });
    each("[data-catui-lightbox]", (n) => { n.querySelectorAll("a[href]").forEach((a) => { if (!a.getAttribute("aria-haspopup")) a.setAttribute("aria-haspopup", "dialog"); }); });
    each(".Catui_site-header[data-catui-header] .Catui_site-menu > summary", (s) => { s.setAttribute("aria-label", s.getAttribute("aria-label") || "메뉴"); });
    catuiSpy();
    catuiHeaderSync();
    catuiReadbar();
  },

  // 전역 위임 (catui.init에서 1회)
  bind() {
    const onClick = (e) => {
      const t = e.target;
      // 공지 띠 닫기 → 기억
      const close = t.closest?.(".Catui_announce-close");
      const bar = close?.closest(".Catui_announce");
      if (bar) {
        bar.hidden = true;
        const key = bar.getAttribute("data-catui-dismiss");
        if (key) { catuiSiteSet(`dismiss:${key}`, Date.now()); emit(MOD, "dismiss", key, { elem: bar }); }
        // 포커스가 사라진 버튼에 남지 않게 다음 요소(본문)로
        // main에 tabindex가 없으면 focus()가 무시되므로 프로그램 포커스만 받게 -1을 준다
        const main = document.querySelector("main, [role=main]");
        if (main && !main.hasAttribute("tabindex")) main.tabIndex = -1;
        (main || document.body).focus?.({ preventScroll: true });
        return;
      }
      // 쿠키 동의
      const cons = t.closest?.("[data-catui-consent]");
      if (cons) {
        const value = cons.getAttribute("data-catui-consent") || "all";
        catuiSiteSet("consent", { value, at: Date.now() });
        cons.closest(".Catui_cookie")?.setAttribute("hidden", "");
        emit(MOD, "consent", null, { value });
        dispatchEvent(new CustomEvent("catui:consent", { detail: { value } }));
        return;
      }
      // 라이트박스
      const a = t.closest?.("[data-catui-lightbox] a[href]");
      if (a && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const box = a.closest("[data-catui-lightbox]");
        const links = [...box.querySelectorAll("a[href]")];
        const items = links.map((x) => { const img = x.querySelector("img"); return { src: x.href, alt: img?.alt || "", caption: x.closest("figure")?.querySelector("figcaption")?.textContent.trim() || img?.alt || "" }; });
        e.preventDefault();
        layer.photos({ items, start: links.indexOf(a), title: box.getAttribute("aria-label") || "사진" });
        return;
      }
      // 공유
      const sh = t.closest?.("[data-catui-share]");
      if (sh) { e.preventDefault(); catuiShare(sh); return; }
      // 모바일 메뉴: 링크를 누르면 닫고, 바깥을 누르면 닫음
      document.querySelectorAll(".Catui_site-menu[open]").forEach((m) => { if (!m.contains(t) || t.closest("a[href]")) m.open = false; });
    };
    const onChange = (e) => {
      const r = e.target;
      const box = r.closest?.("[data-catui-billing]");
      if (box && r.type === "radio" && r.checked) { catuiBilling(box, r.value); emit(MOD, "billing", box.getAttribute("data-catui-filter"), { value: r.value, elem: box }); }
    };
    const onKey = (e) => {
      if (e.key !== "Escape" || imeBusy(e)) return;
      const m = document.querySelector(".Catui_site-menu[open]");
      if (m) { m.open = false; m.querySelector("summary")?.focus(); }
    };
    // 구독 폼: form 모듈의 Ajax 결과를 받아 완료 문구로 바꾼다
    const offDone = onEvent("form", "done", (d) => {
      const f = d?.form;
      if (!f?.matches?.("[data-catui-subscribe]")) return;
      const msg = f.getAttribute("data-catui-subscribe") || "구독해 주셔서 감사합니다. 확인 메일을 보냈습니다.";
      const done = Object.assign(document.createElement("p"), { className: "Catui_subscribe-done" });
      done.setAttribute("role", "status");
      done.tabIndex = -1;
      mount(done, html`${icon("check", 16)}<span>${msg}</span>`);
      f.hidden = true;
      f.insertAdjacentElement("afterend", done);
      done.focus({ preventScroll: true });
    });
    const offFail = onEvent("form", "fail", (d) => {
      const f = d?.form;
      if (!f?.matches?.("[data-catui-subscribe]")) return;
      layer.msg("구독하지 못했습니다. 잠시 후 다시 시도해 주세요.", { icon: "danger" });
    });
    let raf = 0;
    const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; catuiHeaderSync(); catuiReadbar(); catuiSpySync(); }); };
    const onResize = () => { catuiReadbar(); catuiSpySync(); };
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      offDone(); offFail();
      catuiSpyMap = null;
    };
  },
  destroyAll() { catuiSiteParts.forEach((p) => p.destroyAll()); },
  destroyDetached() { catuiSiteParts.forEach((p) => p.destroyDetached()); },
};
