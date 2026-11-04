import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon, reducedMotion, within } from "../core/dom.js";
import { hint } from "../core/base.js";

// carousel — CSS 스크롤 스냅 캐러셀(.Catui_carousel)에 이동·순환·자동 넘김·여러 장·가로/세로·끌기·페이드·미리보기를 붙인다.
//   carousel.render({ elem: '#hero', direction: 'horizontal' | 'vertical', autoplay: 5000, loop: true,
//                     perView: { 0: 1, 768: 2, 1200: 3 }, step: 1, align: 'start' | 'center', thumbs: true, change(index) {} })
//   마크업: <div class="Catui_carousel" data-catui-carousel data-catui-direction="vertical" data-catui-autoplay="5000" …>
//   이벤트: carousel.on('change(f)', ({ index, total, atStart, atEnd }) => {})
// 끊김 없는 순환: 양 끝에 복제 슬라이드를 두고, 복제 위치에 닿으면 스크롤이 멈춘 뒤 같은 그림인 진짜 위치로 순간 이동한다(되감기 없음).
// 자동 넘김은 정지 버튼을 함께 그리고, 포커스가 들어오면 멈추며, 모션 줄이기·숨은 탭에서는 넘기지 않는다.

// "1,768:2,1200:3" 또는 { 0: 1, 768: 2 } 또는 숫자 → 지금 폭의 장 수
const catuiPerView = (v, width) => {
  if (v == null || v === "") return 1;
  if (typeof v === "number") return Math.max(1, Math.floor(v));
  const map = typeof v === "string"
    ? Object.fromEntries(String(v).split(",").map((p) => { const [a, b] = p.split(":"); return b == null ? [0, Number(a)] : [Number(a), Number(b)]; }))
    : v;
  let n = 1;
  Object.keys(map).map(Number).sort((a, b) => a - b).forEach((bp) => { if (width >= bp) n = Number(map[bp]) || 1; });
  return Math.max(1, Math.floor(n));
};
const catuiLen = (v) => (v == null || v === "" ? "" : typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v));

export const carousel = component({
  name: "carousel",
  config: {
    direction: "horizontal", effect: "slide", loop: true, rewind: false, index: 0,
    perView: null, step: 1, gap: null, align: "start", height: null, autoHeight: false,
    autoplay: 0, pauseOnHover: true, reverse: false, stopOnInteraction: false,
    arrows: true, dots: true, thumbs: false, counter: false, progress: false, drag: true, wheel: false, keyboard: true,
    label: "", slideLabel: "{n} / {total}", before: null, change: null,
  },
  render(inst) {
    const c = inst.config;
    const root = inst.elem;
    if (!root) return;
    const track = root.querySelector(".Catui_carousel-track");
    if (!track) { hint.error("carousel: .Catui_carousel-track이 없습니다"); return; }
    const fade = c.effect === "fade";
    const V = c.direction === "vertical" && !fade;
    const center = c.align === "center" && !fade;
    const step = Math.max(1, Math.floor(Number(c.step)) || 1);
    const real = [...track.children].filter((s) => s.classList.contains("Catui_carousel-slide") && !s.hasAttribute("data-catui-clone"));
    const N = real.length;
    if (!N) return;
    // 바꾸기 전 속성을 기억해 두었다가 해제할 때 그대로 돌려놓는다(덮어쓴 aria-label 포함)
    const keep = (node, names) => { const was = names.map((n) => [n, node.getAttribute(n)]); return () => was.forEach(([n, v]) => (v == null ? node.removeAttribute(n) : node.setAttribute(n, v))); };
    const restores = [keep(root, ["role", "aria-roledescription", "aria-label"]), keep(track, ["aria-live", "tabindex", "aria-orientation"]),
      ...real.map((s) => keep(s, ["role", "aria-roledescription", "aria-label"]))];

    root.setAttribute("role", root.getAttribute("role") || "region");
    root.setAttribute("aria-roledescription", "캐러셀");
    if (c.label) root.setAttribute("aria-label", c.label);
    // 마크업에 처음부터 있던 클래스는 해제할 때 남긴다
    const hadFade = root.classList.contains("Catui_carousel-fade"), hadV = root.classList.contains("Catui_carousel-vertical");
    if (fade) root.classList.add("Catui_carousel-fade");
    if (V) { root.classList.add("Catui_carousel-vertical"); track.setAttribute("aria-orientation", "vertical"); }
    if (c.height) track.style.height = catuiLen(c.height);
    const gapCss = c.gap != null ? catuiLen(c.gap) : "var(--Catui_space-3)";
    if (c.gap != null) track.style.gap = gapCss;
    real.forEach((s, i) => {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "슬라이드");
      s.setAttribute("aria-label", String(c.slideLabel).replace("{n}", i + 1).replace("{total}", N));
      s.style.scrollSnapAlign = center ? "center" : "";
    });

    const auto = Number(c.autoplay) > 0 && N > 1 && !reducedMotion();
    let P = 1, K = 0, index = 0;               // P 한 화면 장 수 · K 앞뒤 복제 수 · index 진짜 슬라이드 번호
    const loopOn = () => !fade && c.loop && N > (center ? 1 : P);
    const maxIndex = () => (loopOn() || center || fade ? N - 1 : Math.max(0, N - P));
    index = Math.min(Math.max(0, Number(c.index) || 0), N - 1);

    // ── 축(가로/세로) ──
    const startOf = (s) => (V ? s.offsetTop - track.offsetTop : s.offsetLeft - track.offsetLeft);
    const sizeOf = (s) => (V ? s.offsetHeight : s.offsetWidth);
    const trackSize = () => (V ? track.clientHeight : track.clientWidth);
    const snapOf = (s) => (center ? startOf(s) - (trackSize() - sizeOf(s)) / 2 : startOf(s));
    const curPos = () => (V ? track.scrollTop : track.scrollLeft);
    const scrollToPos = (p, behavior) => track.scrollTo(V ? { top: p, behavior } : { left: p, behavior });
    const all = () => [...track.children].filter((s) => s.classList.contains("Catui_carousel-slide"));
    const physical = (i) => all()[i + K];
    const nearest = () => { const p = curPos(); let best = 0, dist = Infinity; all().forEach((s, k) => { const d = Math.abs(snapOf(s) - p); if (d < dist) { dist = d; best = k; } }); return best; };
    const jump = (i) => { const s = physical(i); if (s) scrollToPos(snapOf(s), "instant"); };

    // ── 탐색 줄: 기존 <nav class="Catui_carousel-nav">(점 링크)가 있으면 점은 그대로 쓰고 버튼만 더한다 ──
    let nav = root.querySelector(":scope > .Catui_carousel-nav");
    const madeNav = !nav;
    if (madeNav) {
      nav = document.createElement("div");
      nav.className = "Catui_carousel-nav";
      nav.setAttribute("role", "group");
      nav.setAttribute("aria-label", "슬라이드 이동");
      root.appendChild(nav);
    }
    const added = [];
    const addNav = (where, markup, parent = nav) => { const t = document.createElement("template"); t.innerHTML = markup.__raw; const n = t.content.firstElementChild; parent.insertAdjacentElement(where, n); added.push(n); return n; };
    const prevIcon = V ? "chevron-up" : "chevron-left", nextIcon = V ? "chevron-down" : "chevron-right";
    const prevBtn = c.arrows ? addNav("afterbegin", html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-car="prev" aria-label="이전 슬라이드">${icon(prevIcon, 16)}</button>`) : null;
    const dotBox = madeNav && c.dots ? addNav("beforeend", html`<span style="display:inline-flex;align-items:center;gap:var(--Catui_space-2)"></span>`) : null;
    const nextBtn = c.arrows ? addNav("beforeend", html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-car="next" aria-label="다음 슬라이드">${icon(nextIcon, 16)}</button>`) : null;
    const countEl = c.counter ? addNav("beforeend", html`<span class="Catui_help Catui_num" aria-hidden="true"></span>`) : null;
    const playBtn = auto ? addNav("beforeend", html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-car="play" aria-label="자동 넘김 정지">${icon("pause", 16)}</button>`) : null;
    const bar = auto && c.progress ? (() => { const b = document.createElement("span"); b.className = "Catui_prog Catui_prog-sm"; b.setAttribute("aria-hidden", "true"); b.innerHTML = '<i class="Catui_pc1" style="width:0%"></i>'; root.insertBefore(b, nav); added.push(b); return b.firstElementChild; })() : null;
    // 미리보기 줄: 슬라이드의 data-catui-thumb 또는 첫 이미지
    const thumbs = c.thumbs ? (() => {
      const box = document.createElement("div");
      box.className = "Catui_carousel-thumbs";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", "슬라이드 미리보기");
      mount(box, html`${real.map((s, i) => { const img = s.querySelector("img"); const src = s.getAttribute("data-catui-thumb") || img?.getAttribute("src") || img?.getAttribute("data-catui-src") || ""; return html`<button class="Catui_carousel-thumb" type="button" data-catui-car-thumb="${i}" aria-label="${i + 1}번 슬라이드${img?.alt ? `: ${img.alt}` : ""}">${src ? html`<img src="${src}" alt="">` : i + 1}</button>`; })}`);
      root.insertBefore(box, nav);
      added.push(box);
      return box;
    })() : null;
    track.setAttribute("aria-live", auto ? "off" : "polite");

    // ── 배치: 장 수·복제 만들기 (폭이 바뀌어 장 수가 달라지면 다시) ──
    const clone = (s) => {
      const n = s.cloneNode(true);
      n.setAttribute("data-catui-clone", "");
      n.setAttribute("aria-hidden", "true");
      n.inert = true;                                   // 복제는 키보드·화면 낭독기에서 빠진다
      n.removeAttribute("id"); n.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
      // 원본에 붙은 fx 표식은 복사되지 않으므로, 다음 catui.init이 숨은 복제에 효과를 또 붙이지 않게 속성을 뗀다
      n.removeAttribute("data-catui-fx"); n.querySelectorAll("[data-catui-fx]").forEach((x) => x.removeAttribute("data-catui-fx"));
      return n;
    };
    const drawDots = () => {
      if (!dotBox) { nav.querySelectorAll(".Catui_carousel-dot").forEach((d, i) => d.setAttribute("data-catui-car-dot", String(i))); return; }
      mount(dotBox, html`${Array.from({ length: maxIndex() + 1 }, (_, i) => html`<button class="Catui_carousel-dot" type="button" data-catui-car-dot="${i}" aria-label="${i + 1}번 슬라이드${P > 1 && !center ? "부터 보기" : ""}"></button>`)}`);
    };
    const layout = () => {
      track.querySelectorAll(":scope > [data-catui-clone]").forEach((n) => n.remove());
      P = fade ? 1 : catuiPerView(c.perView, root.clientWidth || innerWidth);
      const basis = c.perView != null && !fade ? `calc((100% - ${P - 1} * ${gapCss}) / ${P})` : "";
      real.forEach((s) => { s.style.flexBasis = basis; });
      K = loopOn() ? Math.min(N, Math.max(P, step) + (center ? 1 : 0)) : 0;
      if (K) {
        real.slice(-K).map(clone).forEach((n) => track.insertBefore(n, real[0]));
        real.slice(0, K).map(clone).forEach((n) => track.appendChild(n));
      }
      index = Math.min(index, maxIndex());
      drawDots();
      if (!fade) jump(index);
      mark();
    };

    const mark = () => {
      nav.querySelectorAll("[data-catui-car-dot]").forEach((d) => { if (Number(d.dataset.catuiCarDot) === index) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      const bounded = !(fade ? c.loop : loopOn()) && !c.rewind;
      if (prevBtn) prevBtn.disabled = bounded && index === 0;
      if (nextBtn) nextBtn.disabled = bounded && index >= maxIndex();
      if (countEl) countEl.textContent = `${index + 1} / ${N}`;
      real.forEach((s, i) => { const on = center ? i === index : i >= index && i < index + P; if (on) s.setAttribute("data-catui-active", ""); else s.removeAttribute("data-catui-active"); });
      if (thumbs) {
        thumbs.querySelectorAll("[data-catui-car-thumb]").forEach((b) => { const on = Number(b.dataset.catuiCarThumb) === index; if (on) { b.setAttribute("aria-current", "true"); thumbs.scrollTo({ left: b.offsetLeft - thumbs.offsetLeft - (thumbs.clientWidth - b.offsetWidth) / 2, behavior: reducedMotion() ? "instant" : "smooth" }); } else b.removeAttribute("aria-current"); });
      }
      // 내용 높이 맞추기 (가로 · 슬라이드마다 높이가 다를 때)
      if (c.autoHeight && !V && !fade) {
        track.style.alignItems = "flex-start";
        track.style.transition = reducedMotion() ? "" : "height calc(var(--Catui_dur-fast) * 2) var(--Catui_ease)";
        const vis = real.filter((s) => s.hasAttribute("data-catui-active"));
        const h = Math.max(...vis.map((s) => s.scrollHeight), 0);
        if (h) track.style.height = `${h}px`;
      }
    };
    const changed = (prev) => {
      if (prev === index) return;
      mark(); restartBar();
      c.change?.call(inst, index);
      inst.emit("change", { index, total: N, atStart: index === 0, atEnd: index >= maxIndex() });
    };

    // user: 사용자가 직접 넘겼는지 (stopOnInteraction·before 검사용)
    let pending = 0;   // 비동기 before를 기다리는 동안 들어온 이동은 이전 결과를 무시한다
    const go = (i, smooth = true, user = false, checked = false) => {
      if (!fade && !loopOn() && c.rewind) { if (i > maxIndex()) i = 0; else if (i < 0) i = maxIndex(); }   // 끝에서 처음으로 되감기
      const wrap = (x) => ((x % N) + N) % N;
      const to = fade ? (c.loop || c.rewind ? wrap(i) : Math.min(Math.max(0, i), N - 1)) : loopOn() ? wrap(i) : Math.min(Math.max(0, i), maxIndex());
      // before가 false(또는 false로 끝나는 Promise)면 이동 취소 — page.steps의 before와 같은 규칙
      if (!checked && to !== index && c.before) {
        const ok = c.before.call(inst, index, to);
        if (ok === false) return;
        if (ok && typeof ok.then === "function") {
          const my = ++pending;
          ok.then((v) => { if (my === pending && v !== false && !inst.dead) go(i, smooth, user, true); }, (err) => hint.error("carousel: before 처리 중 오류", "error", err));
          return;
        }
      }
      if (user && auto && c.stopOnInteraction && !paused) setPaused(true);
      const prev = index;
      if (fade) { index = to; changed(prev); return; }
      // 아직 복제 위치에 있으면(순환 직후 연달아 누름) 같은 그림인 진짜 위치로 먼저 옮겨 되감기를 막는다
      if (loopOn()) {
        const b = nearest(), lg = b - K;
        if (lg < 0 || lg >= N) { const delta = curPos() - snapOf(all()[b]); scrollToPos(snapOf(physical(wrap(lg))) + delta, "instant"); }
      }
      const target = loopOn() ? i : to;   // 순환이면 -1·N 같은 복제 위치로 먼저 간다
      const s = physical(target);
      if (!s) return;
      const instant = !smooth || reducedMotion();
      scrollToPos(snapOf(s), instant ? "instant" : "smooth");
      index = to;
      changed(prev);
      if (instant) settle();
    };
    // 스크롤이 멈추면: 가장 가까운 슬라이드를 현재로, 복제 위치면 진짜 위치로 순간 이동
    const settle = () => {
      if (fade || dragging) return;
      let logical = nearest() - K;
      if (loopOn() && (logical < 0 || logical >= N)) { logical = ((logical % N) + N) % N; jump(logical); }
      const prev = index;
      index = Math.min(Math.max(0, logical), maxIndex());
      changed(prev);
    };
    let st = 0;
    const onScroll = () => { clearTimeout(st); st = setTimeout(settle, 110); };
    const onScrollEnd = () => { clearTimeout(st); settle(); };

    // ── 마우스 끌기 (터치·트랙패드는 브라우저 스크롤이 처리) / 페이드는 손가락 밀기 ──
    let dragging = false, s0 = 0, p0 = 0, moved = 0;
    const axis = (e) => (V ? e.clientY : e.clientX);
    const onDown = (e) => {
      if (!c.drag || e.button !== 0 || e.target.closest("button, a[href], input, select, textarea")) return;
      if (!fade && e.pointerType !== "mouse") return;
      dragging = true; s0 = axis(e); p0 = curPos(); moved = 0;
      if (!fade) { track.style.scrollSnapType = "none"; track.style.scrollBehavior = "auto"; }
      track.setPointerCapture?.(e.pointerId);
    };
    const onMovePtr = (e) => { if (!dragging) return; moved = axis(e) - s0; if (!fade) { if (V) track.scrollTop = p0 - moved; else track.scrollLeft = p0 - moved; } };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (!fade) { track.style.scrollSnapType = ""; track.style.scrollBehavior = ""; }
      if (Math.abs(moved) > 40) go(index + (moved < 0 ? step : -step), true, true); else if (!fade) go(index);
    };
    const onClickCapture = (e) => { if (Math.abs(moved) > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } };   // 끌고 놓을 때 링크가 눌리지 않게

    // ── 휠: wheel 옵션이면 한 번에 한 장씩 (끝에서는 페이지 스크롤로 넘김) ──
    let wheelAt = 0;
    const onWheel = (e) => {
      if (!c.wheel) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 8) return;
      const dir = d > 0 ? 1 : -1;
      const bounded = !(fade ? c.loop : loopOn()) && !c.rewind;
      if (bounded && ((dir < 0 && index === 0) || (dir > 0 && index >= maxIndex()))) return;
      e.preventDefault();
      const now = Date.now();
      if (now - wheelAt < 450) return;   // 트랙패드 관성으로 여러 장 넘어가지 않게
      wheelAt = now;
      go(index + dir * step, true, true);
    };

    // ── 자동 넘김 ──
    let timer = 0, paused = !auto, hold = false, focusHold = false;
    // auto가 꺼진 인스턴스에서 play()를 불러도 0ms 간격 타이머가 생기지 않게 auto를 함께 본다
    const running = () => auto && !paused && !hold && !focusHold && !document.hidden;
    function restartBar() {
      if (!bar) return;
      bar.style.transition = "none"; bar.style.width = "0%";
      if (!running()) return;
      void bar.offsetWidth;   // 다시 0에서 시작하도록 강제 배치
      bar.style.transition = `width ${Number(c.autoplay)}ms linear`; bar.style.width = "100%";
    }
    const tick = () => { clearInterval(timer); timer = 0; if (running()) timer = setInterval(() => go(index + (c.reverse ? -step : step)), Number(c.autoplay)); restartBar(); };
    function setPaused(on) {
      paused = on || !auto;   // 자동 넘김이 없으면 늘 멈춤 — aria-live도 "polite"로 유지(처음 값과 같게)
      if (playBtn) { mount(playBtn, icon(paused ? "play" : "pause", 16)); playBtn.setAttribute("aria-label", paused ? "자동 넘김 시작" : "자동 넘김 정지"); }
      track.setAttribute("aria-live", paused ? "polite" : "off");
      tick();
    }
    const onEnter = () => { if (c.pauseOnHover) { hold = true; tick(); } };
    const onLeave = () => { hold = false; tick(); };
    // 키보드 포커스가 안에 있으면 항상 멈춤 (읽는 중에 바뀌지 않게)
    const onFocusIn = () => { focusHold = true; tick(); };
    const onFocusOut = (e) => { if (root.contains(e.relatedTarget)) return; focusHold = false; tick(); };
    const onVis = () => tick();

    const onClick = (e) => {
      const dot = e.target.closest("[data-catui-car-dot], [data-catui-car-thumb]");
      if (dot) { e.preventDefault(); go(Number(dot.dataset.catuiCarDot ?? dot.dataset.catuiCarThumb), true, true); return; }   // 점 링크(#id)는 페이지 점프 대신 트랙만 이동
      const b = e.target.closest("[data-catui-car]");
      if (!b) return;
      if (b.dataset.catuiCar === "play") { setPaused(!paused); return; }
      go(index + (b.dataset.catuiCar === "next" ? step : -step), true, true);
    };
    const onKey = (e) => {
      if (!c.keyboard || e.target.closest("input, textarea, select, [contenteditable=true]")) return;
      const prevKey = V ? "ArrowUp" : "ArrowLeft", nextKey = V ? "ArrowDown" : "ArrowRight";
      if (e.key === nextKey) { e.preventDefault(); go(index + step, true, true); }
      else if (e.key === prevKey) { e.preventDefault(); go(index - step, true, true); }
      else if (e.key === "Home") { e.preventDefault(); go(0, true, true); }
      else if (e.key === "End") { e.preventDefault(); go(maxIndex(), true, true); }
    };
    let lastW = 0, lastH = 0;
    // 가로 캐러셀은 높이만 바뀐 경우(autoHeight 전환 중 등) 다시 배치하지 않는다 — 배치가 진행 중인 스크롤을 끊고 튀게 만든다
    const ro = new ResizeObserver(() => {
      const w = root.clientWidth, h = track.clientHeight, dw = Math.abs(w - lastW) >= 1, dh = Math.abs(h - lastH) >= 1;
      lastW = w; lastH = h;
      if (dw || (V && dh)) layout();
    });

    root.addEventListener("click", onClick);
    track.addEventListener("click", onClickCapture, true);
    root.addEventListener("keydown", onKey);
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("scrollend", onScrollEnd);
    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMovePtr);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    track.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVis);
    if (!track.hasAttribute("tabindex")) track.tabIndex = 0;   // 키보드로 트랙에 들어와 방향키로 넘길 수 있게
    layout();
    lastW = root.clientWidth; lastH = track.clientHeight;
    ro.observe(root);
    // 이미지가 늦게 로드돼 높이가 바뀌면 autoHeight 다시 맞춤
    const onImg = () => { if (c.autoHeight) mark(); };
    track.addEventListener("load", onImg, true);
    tick();

    inst.go = (i, smooth = true) => { if (Number.isFinite(Number(i))) go(Number(i), smooth); };
    inst.next = () => go(index + step);
    inst.prev = () => go(index - step);
    inst.pause = () => setPaused(true);
    inst.play = () => setPaused(false);
    inst.isPaused = () => paused;
    inst.getIndex = () => index;
    inst.getTotal = () => N;
    inst.update = () => inst.reload();          // 슬라이드를 넣거나 뺀 뒤 다시 배치
    inst.use(() => {
      clearInterval(timer); clearTimeout(st); ro.disconnect();
      root.removeEventListener("click", onClick);
      track.removeEventListener("click", onClickCapture, true);
      root.removeEventListener("keydown", onKey);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("scrollend", onScrollEnd);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMovePtr);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("load", onImg, true);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVis);
      track.querySelectorAll(":scope > [data-catui-clone]").forEach((n) => n.remove());
      real.forEach((s) => { s.style.flexBasis = ""; s.style.scrollSnapAlign = ""; s.removeAttribute("data-catui-active"); });
      ["height", "gap", "alignItems", "transition", "scrollSnapType", "scrollBehavior"].forEach((k) => { track.style[k] = ""; });   // 끌기 도중 해제돼도 스냅이 꺼진 채 남지 않게
      dragging = false;
      restores.forEach((f) => f());
      if (madeNav) nav.remove(); else added.forEach((n) => n.remove());
      if (madeNav) added.filter((n) => !nav.contains(n)).forEach((n) => n.remove());
      if (!hadFade) root.classList.remove("Catui_carousel-fade");
      if (!hadV) root.classList.remove("Catui_carousel-vertical");
    });
  },
  go(id, i) { carousel.getThis(id)?.go(i); },
  // 선언형: [data-catui-carousel] + data-catui-direction · autoplay · loop · rewind · per-view · step · gap · align · height
  //         · effect · thumbs · counter · progress · auto-height · wheel · reverse · stop-on-interaction · pause-on-hover="false"
  enhance(scope = document) {
    within(scope, ".Catui_carousel[data-catui-carousel]:not([data-catui-ready])").forEach((el) => {
      el.setAttribute("data-catui-ready", "");
      const a = (k) => el.getAttribute(`data-catui-${k}`);
      const has = (k) => el.hasAttribute(`data-catui-${k}`) && a(k) !== "false";
      try {
        carousel.render({
          elem: el, auto: true,
          direction: a("direction") || "horizontal", effect: a("effect") || "slide",
          autoplay: Number(a("autoplay")) || 0, loop: a("loop") !== "false", rewind: has("rewind"),
          perView: a("per-view") || null, step: Number(a("step")) || 1, gap: a("gap"), align: a("align") || "start", height: a("height"),
          thumbs: has("thumbs"), counter: has("counter"), progress: has("progress"), autoHeight: has("auto-height"), wheel: has("wheel"),
          reverse: has("reverse"), stopOnInteraction: has("stop-on-interaction"), pauseOnHover: a("pause-on-hover") !== "false",
          dots: a("dots") !== "false", arrows: a("arrows") !== "false",
        });
      } catch (err) { el.removeAttribute("data-catui-ready"); hint.error("carousel 연결 실패", "error", err, el); }
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});
