import { component } from "../core/component.js";

// canvas — 반응형·고해상도(DPR) 캔버스.
//   canvas.render({ elem: '#c', ratio: '16/9', label: '매출 추이', draw(ctx, s) { … }, animate: false })
//   draw(ctx, { width, height, dpr, time, token, font, reduced }) — 좌표는 CSS 픽셀, token('--Catui_color-brand')로 토큰 색.
// 크기 변화(ResizeObserver)·테마 전환(data-catui-theme) 때 다시 그리고, animate면 rAF로 그리되
// 모션 줄이기·백그라운드 탭에서는 멈춘다. destroy 시 관찰자·rAF를 모두 정리한다.
export const canvas = component({
  name: "canvas",
  config: { ratio: "16/9", label: "", draw: null, animate: false, maxDpr: 2 },
  render(inst) {
    const c = inst.config;
    const host = inst.elem;
    if (!host) return;
    host.classList.add("Catui_canvas");
    if (c.ratio) host.style.aspectRatio = String(c.ratio);
    let cv = host.querySelector("canvas");
    if (!cv) { cv = document.createElement("canvas"); host.prepend(cv); inst.use(() => cv.remove()); }
    cv.setAttribute("role", "img");
    if (c.label) cv.setAttribute("aria-label", c.label);
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const token = (name) => getComputedStyle(host).getPropertyValue(name).trim();
    // 페이지와 같은 글꼴로 캔버스 글자를 그리기 위한 font 문자열 (예: s.font(11), s.font(13, 600))
    const font = (size = 12, weight = 400) => `${weight} ${size}px ${getComputedStyle(host).fontFamily}`;
    const start = performance.now();
    let w = 1, h = 1, dpr = 1, raf = 0;

    const paint = (t = performance.now()) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      c.draw?.call(inst, ctx, { width: w, height: h, dpr, time: (t - start) / 1000, token, font, reduced: reduce.matches });
    };
    const resize = () => {
      // 테두리를 뺀 안쪽 크기 = canvas가 채우는 영역
      dpr = Math.min(window.devicePixelRatio || 1, c.maxDpr);
      w = Math.max(1, host.clientWidth);
      h = Math.max(1, host.clientHeight);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      paint();
    };
    const loop = (t) => { paint(t); raf = requestAnimationFrame(loop); };
    const startLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (c.animate && !reduce.matches && !document.hidden) raf = requestAnimationFrame(loop);
      else paint();
    };
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : startLoop());

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const mo = new MutationObserver(() => paint());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-catui-theme"] });
    document.addEventListener("visibilitychange", onVis);
    reduce.addEventListener?.("change", startLoop);
    resize();
    startLoop();

    inst.canvas = cv;
    inst.ctx = ctx;
    inst.redraw = () => paint();
    inst.toBlob = (cb, type = "image/png") => cv.toBlob(cb, type);
    inst.use(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduce.removeEventListener?.("change", startLoop);
      host.style.aspectRatio = "";
    });
  },
  redraw(id) { canvas.getThis(id)?.redraw(); },
});
