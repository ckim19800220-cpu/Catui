// widgets — 대시보드 위젯 (선언형)
//   <b data-catui-adm-count>12,480</b>          보이면 0부터 그 값까지 세어 올라감(형식 유지: 쉼표·소수·접두/접미)
//   <div class="Catui_adm-chart" data-catui-adm-chart="area|line|bar|donut|spark" data-catui-adm-label="설명"
//        data-catui-adm-data='{"labels":["1월",…],"series":[{"name":"방문","data":[…]}]}'>  (donut: {"labels":[…],"data":[…]})
//   <time data-catui-adm-ago="2026-11-02T09:00:00+09:00">            "5분 전" 형식, 1분마다 갱신
//   <input type="checkbox" data-catui-adm-pref="키">                   켬/끔을 기억
//   admin.widgets.chart(elem, { type, labels, series }) · admin.widgets.update(elem, data)
const admSeries = (s, i) => s.token(`--Catui_chart-series-${(i % 5) + 1}`) || s.token("--Catui_color-brand-fill");
// 축 최대값: 4등분 눈금이 깔끔한 수(1·1.2·1.5·2·2.5·3·4·5·6·8·10 × 10ⁿ) 중 v 이상인 가장 작은 값
const admNice = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s >= n) || 10) * p; };
const admShort = (n) => (Math.abs(n) >= 1e8 ? `${+(n / 1e8).toFixed(1)}억` : Math.abs(n) >= 1e4 ? `${+(n / 1e4).toFixed(1)}만` : catui.util.number(n));

function admDrawAxes(ctx, s, labels, max, box) {
  ctx.font = s.font(11);
  ctx.fillStyle = s.token("--Catui_chart-axis") || s.token("--Catui_color-text-secondary");
  ctx.strokeStyle = s.token("--Catui_chart-grid") || s.token("--Catui_color-border");
  ctx.lineWidth = 1;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const y = box.t + (box.h * i) / 4;
    ctx.beginPath(); ctx.moveTo(box.l, Math.round(y) + 0.5); ctx.lineTo(box.l + box.w, Math.round(y) + 0.5); ctx.stroke();
    ctx.fillText(admShort(max - (max * i) / 4), box.l - 6, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(box.w / 56))));
  labels.forEach((t, i) => { if (i % every === 0) ctx.fillText(String(t), box.l + (labels.length === 1 ? box.w / 2 : (box.w * (i + 0.5)) / labels.length), box.t + box.h + 6); });
}

function admDraw(type, d) {
  return function (ctx, s) {
    const W = s.width, H = s.height;
    if (type === "donut") {
      const vals = d.data || [], sum = vals.reduce((a, b) => a + b, 0) || 1;
      const r = Math.min(W, H) / 2 - 4, cx = W / 2, cy = H / 2, th = Math.max(10, r * 0.28);
      let a = -Math.PI / 2;
      ctx.lineWidth = th;
      vals.forEach((v, i) => { const e = a + (Math.PI * 2 * v) / sum; ctx.strokeStyle = admSeries(s, i); ctx.beginPath(); ctx.arc(cx, cy, r - th / 2, a, e); ctx.stroke(); a = e; });
      ctx.fillStyle = s.token("--Catui_color-text-primary"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // 가운데: center를 주면 그 값, 없으면 가장 큰 조각의 비율과 이름
      const top = vals.indexOf(Math.max(...vals));
      const big = d.center ?? (vals.length ? `${Math.round((vals[top] / sum) * 100)}%` : "—"), small = d.center ? d.caption : d.labels?.[top];
      ctx.font = s.font(Math.round(r * 0.3), 700); ctx.fillText(big, cx, cy - (small ? r * 0.1 : 0));
      if (small) { ctx.font = s.font(11); ctx.fillStyle = s.token("--Catui_color-text-secondary"); ctx.fillText(small, cx, cy + r * 0.22); }
      return;
    }
    const labels = d.labels || [], series = d.series || [];
    const all = series.flatMap((x) => x.data);
    const spark = type === "spark";
    const max = spark ? Math.max(...all, 1) : admNice(Math.max(...all, 1) * 1.05);
    const min = spark ? Math.min(...all, 0) : 0;
    const box = spark ? { l: 2, t: 2, w: W - 4, h: H - 4 } : { l: 44, t: 8, w: W - 52, h: H - 32 };
    if (!spark) admDrawAxes(ctx, s, labels, max, box);
    const n = Math.max(1, labels.length || series[0]?.data.length || 1);
    const X = (i) => box.l + (n === 1 ? box.w / 2 : (box.w * (i + 0.5)) / n);
    const Y = (v) => box.t + box.h - ((v - min) / (max - min || 1)) * box.h;
    if (type === "bar") {
      const slot = box.w / n, bw = Math.max(2, (slot * 0.64) / series.length);
      series.forEach((sr, si) => { ctx.fillStyle = admSeries(s, si); sr.data.forEach((v, i) => { const x = box.l + slot * i + slot * 0.18 + bw * si, y = Y(v); ctx.fillRect(x, y, bw - 1, box.t + box.h - y); }); });
      return;
    }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = parseFloat(s.token("--Catui_chart-line-w")) || 2;
    series.forEach((sr, si) => {
      const col = admSeries(s, si);
      ctx.beginPath();
      sr.data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      ctx.strokeStyle = col; ctx.stroke();
      if (type === "area" || spark) {
        ctx.lineTo(X(sr.data.length - 1), box.t + box.h); ctx.lineTo(X(0), box.t + box.h); ctx.closePath();
        ctx.globalAlpha = si ? 0.08 : 0.16; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
      }
    });
  };
}
// 차트 설명(화면 낭독기): 계열별 최소·최대·마지막 값
const admDescribe = (type, d, label) => {
  if (type === "donut") { const sum = d.data.reduce((a, b) => a + b, 0) || 1; return `${label}: ${d.labels.map((l, i) => `${l} ${Math.round((d.data[i] / sum) * 100)}%`).join(", ")}`; }
  return `${label}: ${(d.series || []).map((sr) => `${sr.name || "값"} ${d.labels?.[0] ?? ""}~${d.labels?.at(-1) ?? ""}, 최저 ${catui.util.number(Math.min(...sr.data))}, 최고 ${catui.util.number(Math.max(...sr.data))}, 마지막 ${catui.util.number(sr.data.at(-1))}`).join(" / ")}`;
};

admin.widgets = {
  charts: new Map(),
  chart(elem, opt) {
    const el = catui.el(elem);
    if (!el) return null;
    const type = opt.type || "line", label = opt.label || el.getAttribute("data-catui-adm-label") || "차트";
    this.charts.get(el)?.destroy();
    const inst = catui.canvas.render({ elem: el, ratio: "", label: admDescribe(type, opt, label), draw: admDraw(type, opt) });
    inst.admType = type; inst.admLabel = label;
    this.charts.set(el, inst);
    this.legend(el, type, opt);
    return inst;
  },
  // 범례를 차트 자료에서 만든다: 차트 바로 다음 <ul class="Catui_legend" data-catui-adm-legend>
  //   선·막대·영역 = 계열 이름, 도넛 = 항목 이름 + 비율(합에서 계산, 소수 없이) — 숫자가 차트와 항상 같다
  legend(el, type, opt) {
    const ul = el.nextElementSibling;
    if (!ul?.hasAttribute("data-catui-adm-legend")) return;
    let items;
    if (type === "donut") {
      const sum = (opt.data || []).reduce((a, b) => a + b, 0) || 1;
      items = (opt.labels || []).map((name, i) => ({ name, value: `${Math.round(((opt.data || [])[i] || 0) / sum * 100)}%` }));
    } else items = (opt.series || []).map((s) => ({ name: s.name || "" }));
    catui.mount(ul, catui.html`${items.map((it, i) => catui.html`<li><i class="Catui_s${(i % 5) + 1}"></i>${it.name}${it.value ? catui.html`<b>${it.value}</b>` : ""}</li>`)}`);
  },
  update(elem, data) {
    const el = catui.el(elem), inst = this.charts.get(el);
    if (!inst) return;
    inst.config.draw = admDraw(inst.admType, data);
    inst.redraw();
    this.legend(el, inst.admType, data);
    el.querySelector("canvas")?.setAttribute("aria-label", admDescribe(inst.admType, data, inst.admLabel));
  },
  count(el) {
    const text = el.textContent.trim();
    const m = /-?[\d,]*\.?\d+/.exec(text);
    if (!m || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = parseFloat(m[0].replace(/,/g, "")), dec = (m[0].split(".")[1] || "").length, comma = m[0].includes(",");
    const pre = text.slice(0, m.index), post = text.slice(m.index + m[0].length);
    const fmt = (v) => `${pre}${comma ? catui.util.number(v, dec) : v.toFixed(dec)}${post}`;
    el.setAttribute("aria-label", text);   // 세는 동안 바뀌는 숫자를 읽지 않게
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - (1 - p) ** 3; el.textContent = fmt(target * e); if (p < 1) requestAnimationFrame(step); else { el.textContent = text; el.removeAttribute("aria-label"); } };
    el.textContent = fmt(0);
    requestAnimationFrame(step);
  },
  init(root = document) {
    root.querySelectorAll("[data-catui-adm-chart]:not([data-catui-adm-ready])").forEach((el) => {
      el.setAttribute("data-catui-adm-ready", "");
      let d = {};
      try { d = JSON.parse(el.getAttribute("data-catui-adm-data") || "{}"); } catch (err) { catui.hint.error("CatuiAdmin: 차트 data JSON 오류", "error", err, el); return; }
      this.chart(el, { type: el.getAttribute("data-catui-adm-chart"), ...d });
    });
    const counts = [...root.querySelectorAll("[data-catui-adm-count]:not([data-catui-adm-ready])")];
    counts.forEach((el) => el.setAttribute("data-catui-adm-ready", ""));
    if (counts.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((ents) => ents.forEach((x) => { if (x.isIntersecting) { io.unobserve(x.target); this.count(x.target); } }), { threshold: 0.4 });
      counts.forEach((el) => io.observe(el));
      admin._offs.push(() => io.disconnect());
    }
    // 상대 시간: 문서 전체를 1분마다(타이머는 한 개만)
    const ago = () => document.querySelectorAll("[data-catui-adm-ago]").forEach((el) => { const d = new Date(el.getAttribute("data-catui-adm-ago")); if (!Number.isNaN(d.getTime())) { el.textContent = catui.util.timeAgo(d); if (!el.getAttribute("datetime")) el.setAttribute("datetime", d.toISOString()); } });
    ago();
    if (admin._once(document, "ago")) {
      const timer = setInterval(ago, 60000);
      admin._offs.push(() => clearInterval(timer));
    }
    const prefs = admGet("prefs", {});
    root.querySelectorAll("input[data-catui-adm-pref]").forEach((el) => { const k = el.getAttribute("data-catui-adm-pref"); if (k in prefs) el.checked = !!prefs[k]; });
    if (admin._once(root, "prefs")) admin._on(root, "change", (e) => {
      const el = e.target.closest?.("input[data-catui-adm-pref]");
      if (!el) return;
      admSet("prefs", { ...admGet("prefs", {}), [el.getAttribute("data-catui-adm-pref")]: el.checked });
      catui.layer.msg(`${el.closest(".Catui_setting")?.querySelector(".Catui_setting-title")?.textContent.trim() || "설정"} ${el.checked ? "켬" : "끔"}`, { time: 1200 });
    });
  },
  destroy() { this.charts.forEach((c) => c.destroy()); this.charts.clear(); },
};
