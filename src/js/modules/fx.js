import { reducedMotion } from "../core/dom.js";
import { canvas } from "./canvas.js";

// fx — 텍스트·스크롤·커서·배경 효과. 각 함수는 { destroy() }를 돌려주고, 모션 줄이기에서는 최종 상태를 바로 보인다.
//   fx.reveal(el, { y, delay, once }) · fx.split(el, { by:'char'|'word', stagger }) · fx.count(el, { to, from, duration, decimals })
//   fx.type(el, { words, speed, pause, loop }) · fx.scramble(el, { duration, chars })
//   fx.tilt(el, { max }) · fx.spotlight(el) · fx.magnet(el, { strength }) · fx.spark(el, { count })
//   fx.particles(el, { count, link }) · fx.waves(el, { lines, amplitude }) · fx.aurora(el)
//   fx.shiny · fx.gradient · fx.rotate(el, { words, interval }) · fx.glitch · fx.border · fx.glare · fx.ripple · fx.marquee(el, { speed }) · fx.dock(el, { scale, radius })
//   fx.hold(el, { duration, onHold }) · fx.swipe(row) · fx.list(ul) · fx.indicator(nav) · fx.flip(card) · fx.check(svg) · fx.pulse(btn) · fx.press(영역)
//   fx.circle(el, { radius }) · fx.velocity(el) · fx.focus(el) · fx.stroke · fx.edge · fx.noise · fx.dotgrid(el) · fx.ripplegrid(el) · fx.cursor(el, { type })
//   fx.bind(scope) — data-catui-fx="이름 이름…" (위 38종)
export const fx = (() => {
  const list = (target) => (typeof target === "string" ? [...document.querySelectorAll(target)] : target instanceof Element ? [target] : [...(target || [])]);
  const many = (target, one) => {
    const hs = list(target).map(one).filter(Boolean);
    return { destroy() { hs.forEach((h) => h.destroy()); } };
  };
  // 화면에 들어올 때 한 번(또는 매번) fn 실행
  const onView = (el, fn, once = true) => {
    if (typeof IntersectionObserver !== "function") { fn(true); return () => {}; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { fn(true); if (once) io.disconnect(); } else if (!once) fn(false);
    }), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  };
  const pointer = (el, move, leave) => {
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  };
  const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

  function reveal(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-reveal");
      if (o.y != null) el.style.setProperty("--Catui_fx-y", `${o.y}px`);
      if (o.delay) el.style.setProperty("--Catui_fx-delay", `${o.delay}ms`);
      if (reducedMotion()) { el.classList.add("Catui_fx-in"); return { destroy() { el.classList.remove("Catui_fx-reveal", "Catui_fx-in"); } }; }
      const off = onView(el, (v) => el.classList.toggle("Catui_fx-in", v), o.once !== false);
      return { destroy() { off(); el.classList.remove("Catui_fx-reveal", "Catui_fx-in"); el.style.removeProperty("--Catui_fx-y"); el.style.removeProperty("--Catui_fx-delay"); } };
    });
  }

  // 글자(또는 단어)를 span으로 나누되, 스크린리더는 원문 한 덩어리로 읽게 한다
  function split(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent, label = el.getAttribute("aria-label");
      const parts = o.by === "word" ? text.split(/(\s+)/) : [...text];
      el.setAttribute("aria-label", label || text.trim());
      el.textContent = "";
      let i = 0;
      parts.forEach((p) => {
        if (!p) return;
        const s = document.createElement("span");
        s.className = "Catui_fx-char";
        s.setAttribute("aria-hidden", "true");
        s.textContent = p;
        if (!/^\s+$/.test(p)) s.style.setProperty("--i", String(i++));
        el.appendChild(s);
      });
      if (o.stagger) el.style.setProperty("--Catui_fx-stagger", `${o.stagger}ms`);
      const off = reducedMotion() ? (el.classList.add("Catui_fx-in"), () => {}) : onView(el, () => el.classList.add("Catui_fx-in"));
      return { destroy() { off(); el.textContent = text; el.classList.remove("Catui_fx-in"); el.style.removeProperty("--Catui_fx-stagger"); if (label == null) el.removeAttribute("aria-label"); else el.setAttribute("aria-label", label); } };
    });
  }

  // 숫자 올라가기 (천 단위 구분 ko-KR). 화면 리더는 최종 값을 aria-label로 읽는다
  function count(target, o = {}) {
    return many(target, (el) => {
      const orig = el.textContent;
      const to = Number(o.to ?? el.dataset.catuiTo ?? (orig.replace(/[^\d.-]/g, "") || 0));
      const from = Number(o.from ?? 0), dur = o.duration ?? 1200, dec = o.decimals ?? (String(to).split(".")[1]?.length || 0);
      const fmt = (v) => v.toLocaleString("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      el.style.fontVariantNumeric = "tabular-nums";
      el.setAttribute("aria-label", (o.prefix || "") + fmt(to) + (o.suffix || ""));
      const show = (v) => { el.textContent = (o.prefix || "") + fmt(v) + (o.suffix || ""); };
      let raf = 0, done = 0;
      const run = () => {
        if (reducedMotion()) return show(to);
        const t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; show(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
        raf = requestAnimationFrame(step);
        // 프레임이 멈춘 환경(백그라운드 탭 등)에서도 최종 값은 반드시 보이게
        done = setTimeout(() => { cancelAnimationFrame(raf); show(to); }, dur + 200);
      };
      show(from);
      const off = onView(el, run);
      return { destroy() { off(); cancelAnimationFrame(raf); clearTimeout(done); el.textContent = orig; el.style.fontVariantNumeric = ""; el.removeAttribute("aria-label"); } };
    });
  }

  // 타자기: words를 차례로 쓰고 지움. 바뀌는 글자는 aria-hidden, 전체 목록은 화면 리더용 글자로
  function type(target, o = {}) {
    return many(target, (el) => {
      const orig = el.innerHTML;
      const words = o.words || (el.dataset.catuiWords || el.textContent).split("|").map((s) => s.trim()).filter(Boolean);
      const speed = o.speed ?? 70, pause = o.pause ?? 1400, loop = o.loop !== false;
      el.textContent = "";
      const sr = document.createElement("span"); sr.className = "Catui_clip"; sr.textContent = words.join(", ");
      const out = document.createElement("span"); out.setAttribute("aria-hidden", "true");
      const caret = document.createElement("span"); caret.className = "Catui_fx-caret"; caret.setAttribute("aria-hidden", "true");
      el.append(sr, out, caret);
      if (reducedMotion()) { out.textContent = words[0] || ""; return { destroy() { el.innerHTML = orig; } }; }
      let w = 0, n = 0, del = false, timer = 0;
      const tick = () => {
        const word = words[w] || "";
        n += del ? -1 : 1;
        out.textContent = word.slice(0, n);
        let wait = del ? speed / 2 : speed;
        if (!del && n >= word.length) { if (!loop && w === words.length - 1) return; del = true; wait = pause; }
        else if (del && n <= 0) { del = false; w = (w + 1) % words.length; wait = speed * 4; }
        timer = setTimeout(tick, wait);
      };
      timer = setTimeout(tick, speed);
      return { destroy() { clearTimeout(timer); el.innerHTML = orig; } };
    });
  }

  // 글자 해독: 무작위 글자에서 원문으로 왼쪽부터 확정
  function scramble(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent, chars = o.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*", dur = o.duration ?? 900;
      el.setAttribute("aria-label", text);
      let raf = 0, done = 0;
      const run = () => {
        if (reducedMotion()) { el.textContent = text; return; }
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur), done = Math.floor(text.length * k);
          el.textContent = [...text].map((c, i) => (i < done || /\s/.test(c) ? c : chars[(Math.random() * chars.length) | 0])).join("");
          if (k < 1) raf = requestAnimationFrame(step); else el.textContent = text;
        };
        raf = requestAnimationFrame(step);
        clearTimeout(done);
        done = setTimeout(() => { cancelAnimationFrame(raf); el.textContent = text; }, dur + 200);
      };
      const off = onView(el, run);
      const enter = () => run();
      if (o.hover) el.addEventListener("pointerenter", enter);
      return { destroy() { off(); cancelAnimationFrame(raf); clearTimeout(done); el.removeEventListener("pointerenter", enter); el.textContent = text; el.removeAttribute("aria-label"); } };
    });
  }

  function tilt(target, o = {}) {
    return many(target, (el) => {
      if (!finePointer()) return null;
      const max = o.max ?? 8;
      el.classList.add("Catui_fx-tilt");
      const move = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--Catui_fx-rx", `${(-y * max).toFixed(2)}deg`);
        el.style.setProperty("--Catui_fx-ry", `${(x * max).toFixed(2)}deg`);
      };
      const leave = () => { el.style.setProperty("--Catui_fx-rx", "0deg"); el.style.setProperty("--Catui_fx-ry", "0deg"); };
      const off = pointer(el, move, leave);
      return { destroy() { off(); el.classList.remove("Catui_fx-tilt"); el.style.removeProperty("--Catui_fx-rx"); el.style.removeProperty("--Catui_fx-ry"); } };
    });
  }

  function spotlight(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-spot");
      const move = (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--Catui_fx-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--Catui_fx-y", `${e.clientY - r.top}px`);
        el.style.setProperty("--Catui_fx-o", "1");
      };
      const leave = () => el.style.setProperty("--Catui_fx-o", "0");
      const off = pointer(el, move, leave);
      const focusIn = () => { el.style.setProperty("--Catui_fx-x", "50%"); el.style.setProperty("--Catui_fx-y", "50%"); el.style.setProperty("--Catui_fx-o", "1"); };
      el.addEventListener("focusin", focusIn); el.addEventListener("focusout", leave);
      return { destroy() { off(); el.removeEventListener("focusin", focusIn); el.removeEventListener("focusout", leave); el.classList.remove("Catui_fx-spot"); ["x", "y", "o"].forEach((k) => el.style.removeProperty(`--Catui_fx-${k}`)); } };
    });
  }

  function magnet(target, o = {}) {
    return many(target, (el) => {
      if (!finePointer()) return null;
      const k = o.strength ?? 0.3;
      el.classList.add("Catui_fx-magnet");
      const move = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--Catui_fx-mx", `${((e.clientX - r.left - r.width / 2) * k).toFixed(1)}px`);
        el.style.setProperty("--Catui_fx-my", `${((e.clientY - r.top - r.height / 2) * k).toFixed(1)}px`);
      };
      const leave = () => { el.style.setProperty("--Catui_fx-mx", "0px"); el.style.setProperty("--Catui_fx-my", "0px"); };
      const off = pointer(el, move, leave);
      return { destroy() { off(); el.classList.remove("Catui_fx-magnet"); el.style.removeProperty("--Catui_fx-mx"); el.style.removeProperty("--Catui_fx-my"); } };
    });
  }

  // 클릭 불꽃: 클릭 위치에 선 조각을 퍼뜨리고 애니메이션이 끝나면 제거 (장식, aria-hidden)
  function spark(target, o = {}) {
    return many(target, (el) => {
      const n = o.count ?? 8;
      const click = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect();
        const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
        const box = document.createElement("span");
        box.className = "Catui_fx-spark"; box.setAttribute("aria-hidden", "true");
        box.style.left = `${x}px`; box.style.top = `${y}px`;
        for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.style.setProperty("--a", `${(360 / n) * i}deg`); box.appendChild(s); }
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 600);
      };
      el.addEventListener("click", click);
      return { destroy() { el.removeEventListener("click", click); } };
    });
  }

  // 점과 선 배경 (canvas 모듈). 색은 토큰, 다크 모드·크기 변화·모션 줄이기 자동 대응
  function particles(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-bg");
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      el.prepend(host);
      const N = o.count ?? 40, link = o.link ?? 90;
      let pts = null;
      const inst = canvas.render({
        elem: host, ratio: "", label: "", animate: true,
        draw(ctx, s) {
          if (!pts) pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006 }));
          const dot = s.token("--Catui_color-brand"), line = s.token("--Catui_color-neutral-300");
          if (!s.reduced) pts.forEach((p) => { p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1; });
          ctx.lineWidth = 1;
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
            const a = pts[i], b = pts[j], dx = (a.x - b.x) * s.width, dy = (a.y - b.y) * s.height, d = Math.hypot(dx, dy);
            if (d < link) { ctx.globalAlpha = 1 - d / link; ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(a.x * s.width, a.y * s.height); ctx.lineTo(b.x * s.width, b.y * s.height); ctx.stroke(); }
          }
          ctx.globalAlpha = 0.9; ctx.fillStyle = dot;
          pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x * s.width, p.y * s.height, 2, 0, Math.PI * 2); ctx.fill(); });
          ctx.globalAlpha = 1;
        },
      });
      host.removeAttribute("role");
      host.querySelector("canvas")?.removeAttribute("role");
      return { destroy() { inst.destroy(); host.remove(); el.classList.remove("Catui_fx-bg"); } };
    });
  }

  // 클래스만 붙이는 CSS 효과 (빛 글자·그라디언트 글자·테두리 빛·광택·오로라)
  const cls = (name) => (target) => many(target, (el) => { el.classList.add(name); return { destroy() { el.classList.remove(name); } }; });
  const shiny = cls("Catui_fx-shiny"), gradient = cls("Catui_fx-gradient"), border = cls("Catui_fx-border"), glare = cls("Catui_fx-glare"), aurora = cls("Catui_fx-aurora");

  // 위아래로 바뀌는 단어. 화면 리더는 전체 목록을 한 번 읽는다
  function rotate(target, o = {}) {
    return many(target, (el) => {
      const orig = el.innerHTML;
      const words = o.words || (el.dataset.catuiWords || el.textContent).split("|").map((s) => s.trim()).filter(Boolean);
      el.textContent = "";
      el.setAttribute("aria-label", words.join(", "));
      el.classList.add("Catui_fx-rotate");
      words.forEach((w) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = w; el.appendChild(s); });
      let k = 0;
      const timer = reducedMotion() ? 0 : setInterval(() => { k = (k + 1) % words.length; el.style.setProperty("--Catui_fx-k", String(k)); }, o.interval ?? 2200);
      return { destroy() { clearInterval(timer); el.innerHTML = orig; el.classList.remove("Catui_fx-rotate"); el.removeAttribute("aria-label"); el.style.removeProperty("--Catui_fx-k"); } };
    });
  }

  function glitch(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-glitch");
      el.dataset.text = el.textContent;
      return { destroy() { el.classList.remove("Catui_fx-glitch"); delete el.dataset.text; } };
    });
  }

  // 클릭 물결: 누른 지점에서 원이 퍼짐 (키보드 실행은 가운데)
  function ripple(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-ripple");
      const down = (e) => {
        if (reducedMotion()) return;
        const r = el.getBoundingClientRect(), size = Math.hypot(r.width, r.height) * 2;
        const x = (e.clientX || r.left + r.width / 2) - r.left, y = (e.clientY || r.top + r.height / 2) - r.top;
        const w = document.createElement("span");
        w.className = "Catui_fx-wave"; w.setAttribute("aria-hidden", "true");
        Object.assign(w.style, { width: `${size}px`, height: `${size}px`, left: `${x - size / 2}px`, top: `${y - size / 2}px` });
        el.appendChild(w);
        setTimeout(() => w.remove(), 700);
      };
      el.addEventListener("click", down);
      return { destroy() { el.removeEventListener("click", down); el.classList.remove("Catui_fx-ripple"); } };
    });
  }

  // 끝없는 띠: 자식들을 트랙으로 감싸고 한 벌 더 복제(복제본은 aria-hidden·포커스 제외)
  function marquee(target, o = {}) {
    return many(target, (el) => {
      const orig = [...el.childNodes];
      const track = document.createElement("div");
      track.className = "Catui_fx-track";
      orig.forEach((n) => track.appendChild(n));
      const copy = document.createElement("div");
      copy.style.display = "contents";
      copy.setAttribute("aria-hidden", "true");
      [...track.children].forEach((c) => { const k = c.cloneNode(true); k.querySelectorAll("a,button,input,[tabindex]").forEach((f) => f.setAttribute("tabindex", "-1")); if (k.matches("a,button")) k.setAttribute("tabindex", "-1"); copy.appendChild(k); });
      track.appendChild(copy);
      el.classList.add("Catui_fx-marquee");
      el.appendChild(track);
      if (o.speed) el.style.setProperty("--Catui_fx-speed", `${o.speed}s`);
      return { destroy() { el.classList.remove("Catui_fx-marquee"); el.style.removeProperty("--Catui_fx-speed"); orig.forEach((n) => el.appendChild(n)); track.remove(); } };
    });
  }

  // 독: 커서와 가까운 항목일수록 커짐 (최대 scale, 반경 px)
  function dock(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-dock");
      const max = o.scale ?? 1.5, radius = o.radius ?? 120;
      const items = () => [...el.children];
      const move = (e) => {
        if (reducedMotion() || !finePointer()) return;
        items().forEach((it) => {
          const r = it.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
          it.style.setProperty("--Catui_fx-s", (1 + (max - 1) * Math.max(0, 1 - d / radius)).toFixed(3));
        });
      };
      const leave = () => items().forEach((it) => it.style.setProperty("--Catui_fx-s", "1"));
      const off = pointer(el, move, leave);
      return { destroy() { off(); el.classList.remove("Catui_fx-dock"); items().forEach((it) => it.style.removeProperty("--Catui_fx-s")); } };
    });
  }

  // 물결 선 배경 (canvas)
  function waves(target, o = {}) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-bg");
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      el.prepend(host);
      const lines = o.lines ?? 3, amp = o.amplitude ?? 14;
      const inst = canvas.render({
        elem: host, ratio: "", label: "", animate: true,
        draw(ctx, s) {
          const tk = ["--Catui_chart-series-1", "--Catui_chart-series-2", "--Catui_chart-series-3"];
          const t = s.reduced ? 0 : s.time;
          for (let k = 0; k < lines; k++) {
            ctx.beginPath();
            for (let x = 0; x <= s.width; x += 6) {
              const y = s.height * (0.35 + k * 0.15) + Math.sin(x / (70 + k * 20) + t * (0.8 + k * 0.25) + k) * (amp + k * 4);
              x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = s.token(tk[k % tk.length]); ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.globalAlpha = 1;
        },
      });
      host.querySelector("canvas")?.removeAttribute("role");
      return { destroy() { inst.destroy(); host.remove(); el.classList.remove("Catui_fx-bg"); } };
    });
  }

  // ---- 3차: 화면 기능 · 마이크로 · 꾸밈 ----
  const stroke = cls("Catui_fx-stroke"), edge = cls("Catui_fx-edge"), noise = cls("Catui_fx-noise"), press = cls("Catui_fx-press");
  const emitFx = (el, name, detail) => el.dispatchEvent(new CustomEvent(`catui:${name}`, { bubbles: true, detail }));

  // 누르고 있기: duration 동안 누르면 실행(catui:hold 이벤트 + onHold). Space·Enter로도 동작, 떼면 취소
  function hold(target, o = {}) {
    return many(target, (el) => {
      const dur = (o.duration ?? Number(el.dataset.catuiDuration)) || 1200;
      el.classList.add("Catui_fx-hold");
      const hint = document.createElement("span"); hint.className = "Catui_clip"; hint.textContent = " (길게 눌러 실행)";
      el.appendChild(hint);
      let t0 = 0, timer = 0, fired = false;
      const set = (p) => el.style.setProperty("--Catui_fx-p", p.toFixed(3));
      const stop = () => { clearTimeout(timer); timer = 0; if (!fired) set(0); };
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / dur);
        set(p);
        if (p >= 1) { fired = true; timer = 0; emitFx(el, "hold", {}); o.onHold?.call(el); setTimeout(() => { fired = false; set(0); }, 400); }
        else timer = setTimeout(tick, 16);
      };
      const start = (e) => { if (timer || el.disabled || (e.type === "keydown" && e.key !== " " && e.key !== "Enter") || e.repeat) return; if (e.type === "keydown") e.preventDefault(); t0 = performance.now(); fired = false; tick(); };
      const keyup = (e) => { if (e.key === " " || e.key === "Enter") stop(); };
      const block = (e) => { if (!fired) e.preventDefault(); };
      el.addEventListener("pointerdown", start); el.addEventListener("keydown", start);
      ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((n) => el.addEventListener(n, stop));
      el.addEventListener("keyup", keyup); el.addEventListener("click", block);
      return { destroy() { stop(); hint.remove(); el.classList.remove("Catui_fx-hold"); el.style.removeProperty("--Catui_fx-p"); el.removeEventListener("pointerdown", start); el.removeEventListener("keydown", start); ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((n) => el.removeEventListener(n, stop)); el.removeEventListener("keyup", keyup); el.removeEventListener("click", block); } };
    });
  }

  // 밀어서 동작: .Catui_fx-swipe-front를 왼쪽으로 밀면 .Catui_fx-swipe-actions가 드러남. 키보드는 포커스로 열림
  function swipe(target) {
    return many(target, (el) => {
      const front = el.querySelector(".Catui_fx-swipe-front"), acts = el.querySelector(".Catui_fx-swipe-actions");
      if (!front || !acts) return null;
      el.classList.add("Catui_fx-swipe");
      const aw = () => acts.getBoundingClientRect().width;
      el.style.setProperty("--Catui_fx-aw", `${aw()}px`);
      let x0 = null, dx = 0, open = false;
      const down = (e) => { if (e.button) return; x0 = e.clientX; dx = 0; front.style.transition = "none"; front.setPointerCapture?.(e.pointerId); };
      const move = (e) => { if (x0 == null) return; dx = e.clientX - x0; const base = open ? -aw() : 0; front.style.setProperty("--Catui_fx-sx", `${Math.max(-aw(), Math.min(0, base + dx))}px`); };
      const up = () => {
        if (x0 == null) return;
        front.style.transition = ""; front.style.removeProperty("--Catui_fx-sx");
        if (Math.abs(dx) > 8) { open = open ? dx < aw() / 2 : dx < -aw() / 2; el.classList.toggle("Catui_fx-on", open); }
        x0 = null;
      };
      const key = (e) => { if (e.key === "Escape") { open = false; el.classList.remove("Catui_fx-on"); front.focus(); } };
      front.addEventListener("pointerdown", down); front.addEventListener("pointermove", move);
      front.addEventListener("pointerup", up); front.addEventListener("pointercancel", up); el.addEventListener("keydown", key);
      return { close() { open = false; el.classList.remove("Catui_fx-on"); }, destroy() { front.removeEventListener("pointerdown", down); front.removeEventListener("pointermove", move); front.removeEventListener("pointerup", up); front.removeEventListener("pointercancel", up); el.removeEventListener("keydown", key); el.classList.remove("Catui_fx-swipe", "Catui_fx-on"); el.style.removeProperty("--Catui_fx-aw"); } };
    });
  }

  // 목록: 항목 차례 등장 + 위·아래·Home·End로 이동, Enter·Space로 선택(catui:select)
  function listFx(target) {
    return many(target, (el) => {
      const items = () => [...el.children];
      el.classList.add("Catui_fx-list");
      if (!el.getAttribute("role")) el.setAttribute("role", "listbox");
      items().forEach((it, i) => { it.style.setProperty("--i", String(i)); it.setAttribute("role", "option"); it.tabIndex = i ? -1 : 0; it.setAttribute("aria-selected", it.getAttribute("aria-selected") || "false"); });
      const pick = (it) => { items().forEach((x) => x.setAttribute("aria-selected", String(x === it))); emitFx(el, "select", { index: items().indexOf(it), item: it }); };
      const go = (it) => { items().forEach((x) => (x.tabIndex = x === it ? 0 : -1)); it.focus(); };
      const key = (e) => {
        const all = items(), i = all.indexOf(document.activeElement);
        if (i < 0) return;
        const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
        if (to != null) { e.preventDefault(); go(all[Math.max(0, Math.min(all.length - 1, to))]); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(all[i]); }
      };
      const click = (e) => { const it = items().find((x) => x.contains(e.target)); if (it) { go(it); pick(it); } };
      el.addEventListener("keydown", key); el.addEventListener("click", click);
      return { destroy() { el.removeEventListener("keydown", key); el.removeEventListener("click", click); el.classList.remove("Catui_fx-list"); items().forEach((it) => it.style.removeProperty("--i")); } };
    });
  }

  // 움직이는 현재 표시: 현재 항목(aria-current·aria-pressed·aria-selected·checked 라벨) 아래로 표시가 미끄러짐.
  // aria-pressed 버튼 묶음은 하나만 눌리도록 바꿔 줌
  function indicator(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-ind");
      const cur = () => el.querySelector('[aria-current="page"],[aria-pressed="true"],[aria-selected="true"],input:checked + label');
      const place = () => {
        const c = cur(); if (!c) return el.style.setProperty("--Catui_fx-iw", "0px");
        const r = el.getBoundingClientRect(), b = c.getBoundingClientRect();
        el.style.setProperty("--Catui_fx-ix", `${b.left - r.left + el.scrollLeft}px`); el.style.setProperty("--Catui_fx-iy", `${b.top - r.top}px`);
        el.style.setProperty("--Catui_fx-iw", `${b.width}px`); el.style.setProperty("--Catui_fx-ih", `${b.height}px`);
      };
      const click = (e) => {
        const b = e.target.closest("[aria-pressed]");
        if (b && el.contains(b)) el.querySelectorAll("[aria-pressed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        const a = e.target.closest("a");
        if (a && el.contains(a) && a.getAttribute("href") === "#") { e.preventDefault(); el.querySelectorAll("a").forEach((x) => (x === a ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current"))); }
        requestAnimationFrame(place); setTimeout(place, 30);
      };
      el.addEventListener("click", click); el.addEventListener("change", place);
      window.addEventListener("resize", place);
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null; ro?.observe(el);
      place();
      return { update: place, destroy() { el.removeEventListener("click", click); el.removeEventListener("change", place); window.removeEventListener("resize", place); ro?.disconnect(); el.classList.remove("Catui_fx-ind"); ["ix", "iy", "iw", "ih"].forEach((k) => el.style.removeProperty(`--Catui_fx-${k}`)); } };
    });
  }

  // 뒤집기: [data-catui-flip] 버튼으로 앞뒤 전환. 보이지 않는 면은 inert
  function flip(target) {
    return many(target, (el) => {
      el.classList.add("Catui_fx-flip");
      const front = el.querySelector(".Catui_fx-flip-front"), back = el.querySelector(".Catui_fx-flip-back");
      const sync = () => { const on = el.classList.contains("Catui_fx-flipped"); front.inert = on; back.inert = !on; el.querySelectorAll("[data-catui-flip]").forEach((b) => b.setAttribute("aria-pressed", String(on))); };
      const click = (e) => { const b = e.target.closest("[data-catui-flip]"); if (!b || !el.contains(b)) return; el.classList.toggle("Catui_fx-flipped"); sync(); (el.classList.contains("Catui_fx-flipped") ? back : front).querySelector("[data-catui-flip],button,a")?.focus(); emitFx(el, "flip", { flipped: el.classList.contains("Catui_fx-flipped") }); };
      el.addEventListener("click", click); sync();
      return { toggle() { el.classList.toggle("Catui_fx-flipped"); sync(); }, destroy() { el.removeEventListener("click", click); el.classList.remove("Catui_fx-flip", "Catui_fx-flipped"); front.inert = back.inert = false; } };
    });
  }

  // 완료 체크 다시 그리기
  function check(target) {
    return many(target, (el) => {
      el.classList.remove("Catui_fx-on"); void el.getBoundingClientRect(); el.classList.add("Catui_fx-on");
      return { replay() { el.classList.remove("Catui_fx-on"); void el.getBoundingClientRect(); el.classList.add("Catui_fx-on"); }, destroy() { el.classList.remove("Catui_fx-on"); } };
    });
  }

  // 좋아요: aria-pressed 토글 + 톡 튀기
  function pulse(target) {
    return many(target, (el) => {
      if (!el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", "false");
      const click = () => {
        el.setAttribute("aria-pressed", String(el.getAttribute("aria-pressed") !== "true"));
        if (!reducedMotion()) { el.classList.remove("Catui_fx-pop"); void el.offsetWidth; el.classList.add("Catui_fx-pop"); }
        emitFx(el, "toggle", { pressed: el.getAttribute("aria-pressed") === "true" });
      };
      const end = () => el.classList.remove("Catui_fx-pop");
      el.addEventListener("click", click); el.addEventListener("animationend", end);
      return { destroy() { el.removeEventListener("click", click); el.removeEventListener("animationend", end); el.classList.remove("Catui_fx-pop"); } };
    });
  }

  // 원형 글자
  function circle(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent.trim(), chars = [...text], r = o.radius ?? (Number(el.dataset.catuiRadius) || 60);
      el.setAttribute("aria-label", text); el.textContent = "";
      el.classList.add("Catui_fx-circle"); el.style.setProperty("--Catui_fx-r", `${r}px`);
      chars.forEach((c, i) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = c; s.style.setProperty("--a", `${(360 / chars.length) * i}deg`); el.appendChild(s); });
      return { destroy() { el.textContent = text; el.removeAttribute("aria-label"); el.classList.remove("Catui_fx-circle"); el.style.removeProperty("--Catui_fx-r"); } };
    });
  }

  // 스크롤 속도 띠: marquee 위에서 스크롤 속도만큼 빨라졌다 서서히 돌아옴
  function velocity(target, o = {}) {
    return many(target, (el) => {
      const m = marquee(el, o);
      const anim = () => el.querySelector(".Catui_fx-track")?.getAnimations?.()[0];
      let last = scrollY, boost = 0, timer = 0;
      const onScroll = () => { boost = Math.min(6, boost + Math.abs(scrollY - last) / 40); last = scrollY; };
      const tick = () => { boost *= 0.9; const a = anim(); if (a && !reducedMotion()) a.playbackRate = 1 + boost; timer = setTimeout(tick, 50); };
      addEventListener("scroll", onScroll, { passive: true }); tick();
      return { destroy() { clearTimeout(timer); removeEventListener("scroll", onScroll); m.destroy(); } };
    });
  }

  // 초점 글자: 단어를 차례로 또렷하게
  function focus(target, o = {}) {
    return many(target, (el) => {
      const text = el.textContent.trim(), words = text.split(/\s+/);
      el.setAttribute("aria-label", text); el.textContent = "";
      el.classList.add("Catui_fx-focus");
      const spans = words.map((w, i) => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(" ")); return s; });
      let k = 0; spans[0]?.classList.add("Catui_fx-on");
      const timer = reducedMotion() ? 0 : setInterval(() => { spans[k].classList.remove("Catui_fx-on"); k = (k + 1) % spans.length; spans[k].classList.add("Catui_fx-on"); }, o.interval ?? 1100);
      if (reducedMotion()) spans.forEach((s) => s.classList.add("Catui_fx-on"));
      return { destroy() { clearInterval(timer); el.textContent = text; el.removeAttribute("aria-label"); el.classList.remove("Catui_fx-focus"); } };
    });
  }

  // 배경 캔버스 공통 (점 격자·물결 격자)
  const bgCanvas = (el, draw, extra = () => () => {}) => {
    el.classList.add("Catui_fx-bg");
    const host = document.createElement("div"); host.setAttribute("aria-hidden", "true"); el.prepend(host);
    const inst = canvas.render({ elem: host, ratio: "", label: "", animate: true, draw });
    host.querySelector("canvas")?.removeAttribute("role");
    const off = extra(inst);
    return { destroy() { off(); inst.destroy(); host.remove(); el.classList.remove("Catui_fx-bg"); } };
  };
  // 점 격자: 커서 근처 점이 커지고 브랜드 색으로
  function dotgrid(target, o = {}) {
    return many(target, (el) => {
      const gap = o.gap ?? 22, reach = o.reach ?? 110;
      let mx = -999, my = -999;
      return bgCanvas(el, (ctx, s) => {
        const base = s.token("--Catui_color-neutral-300"), hot = s.token("--Catui_color-brand");
        for (let y = gap / 2; y < s.height; y += gap) for (let x = gap / 2; x < s.width; x += gap) {
          const k = Math.max(0, 1 - Math.hypot(x - mx, y - my) / reach);
          ctx.globalAlpha = 0.6 + k * 0.4; ctx.fillStyle = k > 0.05 ? hot : base;
          ctx.beginPath(); ctx.arc(x, y, 1.4 + k * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }, () => {
        const move = (e) => { const r = el.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
        const leave = () => { mx = my = -999; };
        el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
        return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
      });
    });
  }
  // 물결 격자: 가운데에서 퍼지는 파동이 격자 선을 휘게
  function ripplegrid(target, o = {}) {
    return many(target, (el) => {
      const gap = o.gap ?? 28;
      return bgCanvas(el, (ctx, s) => {
        const t = s.reduced ? 0 : s.time, cx = s.width / 2, cy = s.height / 2;
        const off = (x, y) => Math.sin(Math.hypot(x - cx, y - cy) / 18 - t * 2.4) * 4;
        ctx.strokeStyle = s.token("--Catui_color-brand"); ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
        for (let y = 0; y <= s.height; y += gap) { ctx.beginPath(); for (let x = 0; x <= s.width; x += 8) { const yy = y + off(x, y); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
        for (let x = 0; x <= s.width; x += gap) { ctx.beginPath(); for (let y = 0; y <= s.height; y += 8) { const xx = x + off(x, y); y ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); } ctx.stroke(); }
        ctx.globalAlpha = 1;
      });
    });
  }

  // 커스텀 커서: 요소 위에서만 빛(glow)·고리(ring)가 따라옴. 마우스 환경·모션 허용일 때만
  function cursor(target, o = {}) {
    return many(target, (el) => {
      if (!finePointer()) return null;
      const c = document.createElement("span");
      c.className = "Catui_fx-cursor"; c.setAttribute("aria-hidden", "true");
      if ((o.type || el.dataset.catuiCursor) === "ring") c.dataset.type = "ring";
      document.body.appendChild(c);
      const move = (e) => { if (reducedMotion()) return; c.style.setProperty("--Catui_fx-cx", `${e.clientX}px`); c.style.setProperty("--Catui_fx-cy", `${e.clientY}px`); c.classList.add("Catui_fx-on"); };
      const leave = () => c.classList.remove("Catui_fx-on");
      const off = pointer(el, move, leave);
      return { destroy() { off(); c.remove(); } };
    });
  }

  const effects = { reveal, split, count, type, scramble, tilt, spotlight, magnet, spark, particles, shiny, gradient, rotate, glitch, border, glare, ripple, marquee, dock, aurora, waves,
    hold, swipe, list: listFx, indicator, flip, check, pulse, press, circle, velocity, focus, stroke, edge, noise, dotgrid, ripplegrid, cursor };
  // data-catui-fx="이름[ 이름…]" 선언형 연결. 돌려준 함수로 모두 해제
  function bind(scope = document) {
    const hs = [];
    scope.querySelectorAll?.("[data-catui-fx]").forEach((el) => {
      if (el.catuiFx) return;
      el.catuiFx = el.dataset.catuiFx.split(/\s+/).filter((n) => effects[n]).map((n) => effects[n](el, {
        by: el.dataset.catuiBy, to: el.dataset.catuiTo, delay: Number(el.dataset.catuiDelay) || 0,
      }));
      hs.push(...el.catuiFx);
    });
    return () => hs.forEach((h) => h.destroy());
  }
  return { ...effects, bind };
})();
