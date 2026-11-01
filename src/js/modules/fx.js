import { reducedMotion } from "../core/dom.js";
import { canvas } from "./canvas.js";

// fx — 텍스트·스크롤·커서·배경 효과. 각 함수는 { destroy() }를 돌려주고, 모션 줄이기에서는 최종 상태를 바로 보인다.
//   fx.reveal(el, { y, delay, once }) · fx.split(el, { by:'char'|'word', stagger }) · fx.count(el, { to, from, duration, decimals })
//   fx.type(el, { words, speed, pause, loop }) · fx.scramble(el, { duration, chars })
//   fx.tilt(el, { max }) · fx.spotlight(el) · fx.magnet(el, { strength }) · fx.spark(el, { count })
//   fx.particles(el, { count, link }) · fx.bind(scope) — data-catui-fx="reveal|split|count|type|scramble|tilt|spotlight|magnet|spark|particles"
export const fx = (() => {
  const list = (target) => (typeof target === "string" ? [...document.querySelectorAll(target)] : target instanceof Element ? [target] : [...(target || [])]);
  const many = (target, one) => {
    const hs = list(target).map(one).filter(Boolean);
    return { destroy() { hs.forEach((h) => h.destroy()); } };
  };
  // 화면에 들어올 때 한 번(또는 매번) fn 실행
  const onView = (el, fn, once = true) => {
    if (!("IntersectionObserver" in window)) { fn(true); return () => {}; }
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
      let raf = 0;
      const run = () => {
        if (reducedMotion()) return show(to);
        const t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; show(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
        raf = requestAnimationFrame(step);
      };
      show(from);
      const off = onView(el, run);
      return { destroy() { off(); cancelAnimationFrame(raf); el.textContent = orig; el.style.fontVariantNumeric = ""; el.removeAttribute("aria-label"); } };
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
      let raf = 0;
      const run = () => {
        if (reducedMotion()) { el.textContent = text; return; }
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur), done = Math.floor(text.length * k);
          el.textContent = [...text].map((c, i) => (i < done || /\s/.test(c) ? c : chars[(Math.random() * chars.length) | 0])).join("");
          if (k < 1) raf = requestAnimationFrame(step); else el.textContent = text;
        };
        raf = requestAnimationFrame(step);
      };
      const off = onView(el, run);
      const enter = () => run();
      if (o.hover) el.addEventListener("pointerenter", enter);
      return { destroy() { off(); cancelAnimationFrame(raf); el.removeEventListener("pointerenter", enter); el.textContent = text; el.removeAttribute("aria-label"); } };
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

  const effects = { reveal, split, count, type, scramble, tilt, spotlight, magnet, spark, particles };
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
