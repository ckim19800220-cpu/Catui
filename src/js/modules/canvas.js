import { component } from "../core/component.js";
import { frame } from "../core/dom.js";

// canvas — 반응형·고해상도(DPR) 캔버스.
//   canvas.render({ elem: '#c', ratio: '16/9', label: '매출 추이', draw(ctx, s) { … }, animate: false })
//   draw(ctx, { width, height, dpr, time, token, font, reduced }) — 좌표는 CSS 픽셀, token('--Catui_color-brand')로 토큰 색.
// 크기 변화(ResizeObserver)·테마 전환(data-catui-theme) 때 다시 그리고, animate면 공용 프레임 티커로 그리되
// 모션 줄이기·백그라운드 탭·화면 밖·페이지 일시정지에서는 멈춘다. destroy 시 관찰자·구독을 모두 정리한다.
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
    // time = 실제로 그린 시간의 합(초). 화면 밖·숨은 탭·페이지 일시정지 동안은 늘지 않아 다시 보일 때 튀지 않는다
    let w = 1, h = 1, dpr = 1, elapsed = 0, stopLoop = null;

    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      c.draw?.call(inst, ctx, { width: w, height: h, dpr, time: elapsed / 1000, token, font, reduced: reduce.matches });
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
    // 공용 프레임 티커(core/dom.js frame): 화면 밖(여유 120px)·숨은 탭·<html data-catui-paused>에서 자동으로 쉰다
    const startLoop = () => {
      stopLoop?.();
      stopLoop = null;
      if (c.animate && !reduce.matches) stopLoop = frame((dt) => { elapsed += dt; paint(); }, host);
      else paint();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const mo = new MutationObserver(() => paint());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-catui-theme"] });
    reduce.addEventListener?.("change", startLoop);
    resize();
    startLoop();

    inst.canvas = cv;
    inst.ctx = ctx;
    inst.redraw = () => paint();
    inst.toBlob = (cb, type = "image/png") => cv.toBlob(cb, type);
    inst.use(() => {
      stopLoop?.();
      ro.disconnect();
      mo.disconnect();
      reduce.removeEventListener?.("change", startLoop);
      host.style.aspectRatio = "";
    });
  },
  redraw(id) { canvas.getThis(id)?.redraw(); },
});
