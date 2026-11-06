// CatuiShop — catui.js 위에 얹는 한국형 쇼핑몰 앞단 확장 (catui.shop)
//   전역: <script src="catui.js"></script><script src="catshop.js"></script> → catui.shop
//   ESM : import shop from "@imcat-ckim/catui/shop"
// 화면 루트: <div class="Catui_site Catui_sh" data-catui-sh> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 상태(테마·장바구니·찜·최근 본 상품·바로 구매·마지막 주문·보기 방식)는 catui.data('shop')(localStorage "catui:shop")에 기억한다.

const SH_STORE = "shop";
const shGet = (k, d) => { const v = catui.data(SH_STORE)[k]; return v === undefined ? d : v; };
const shSet = (k, v) => catui.data(SH_STORE, { key: k, value: v });
const shQuery = () => new URLSearchParams(location.search);
// 숨김 글자(화면 낭독기용) — 역할 없는 span에 aria-label을 달지 않고 이 글자로 의미를 보충한다
const shClip = (t) => catui.html`<span class="Catui_clip">${t}</span>`;

export const shop = {
  version: catui.version,
  root: null,
  /** 금액·재고 규칙 (실서비스 정책에 맞게 바꿔 쓴다) */
  rules: { shipFee: 3000, freeOver: 30000, pointRate: 1, pointMin: 1000, pointUnit: 10, lowStock: 5, newDays: 14, maxQty: 99 },
  store: { get: shGet, set: shSet, clear: () => catui.data(SH_STORE, null) },
  /** 이벤트: 'theme' · 'cart' { lines } · 'wish' { id, on } · 'recent' · 'order' { order } · 'review' · 'data' */
  on: (evt, fn) => catui.onevent("shop", evt, fn),
  emit: (evt, payload) => catui.event("shop", evt, null, payload),
  query: shQuery,
  _offs: [],
  // destroy 뒤에 늦게 도착한 응답(.then 안의 연결)은 등록하지 않는다 — 해제 목록이 이미 비워져 새는 것을 막음
  _on(target, type, fn, opt) { if (!target || this._dead) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
  _seen: new WeakMap(),
  _once(target, key) { let s = this._seen.get(target); if (!s) this._seen.set(target, (s = new Set())); if (s.has(key)) return false; s.add(key); return true; },
};

// ── 금액 ──
/** 12900 → "12,900원" */
shop.won = (n) => `${catui.util.number(Math.round(Number(n) || 0))}원`;
/** 할인 판매가: 정가 × (100 − 할인율)% 를 10원 단위로 내림 */
shop.saleOf = (price, rate = 0) => {
  const r = Math.min(95, Math.max(0, Math.floor(Number(rate) || 0)));
  return r ? Math.floor((Number(price) * (100 - r)) / 1000) * 10 : Number(price);
};
/** 상품 한 개의 가격: { list(정가), sale(판매가), rate, save, coupon, couponPrice }
 *  옵션 추가금(extra)은 할인 없이 판매가에 더한다. coupons를 주면 이 상품 하나에 쓸 수 있는 가장 큰 쿠폰으로 쿠폰가 계산 */
shop.price = function (p, { extra = 0, coupons = null } = {}) {
  const base = shop.saleOf(p.price, p.rate);
  const list = Number(p.price) + Number(extra || 0), sale = base + Number(extra || 0);
  const rate = list > sale ? Math.round(((list - sale) / list) * 100) : 0;
  let best = null, off = 0;
  for (const c of coupons || []) {
    if (c.type === "ship") continue;
    const r = shop.coupon.apply(c, { items: [{ cat: p.cat, amount: sale }], ship: 0 });
    if (r.ok && r.amount > off) { off = r.amount; best = c; }
  }
  return { list, sale, rate, save: list - sale, coupon: best, couponPrice: sale - off };
};
/** 가격 표시 마크업: 할인율 · 판매가 · 정가(취소선) — 글자는 이스케이프 */
shop.priceHtml = function (p, { extra = 0, size = "" } = {}) {
  const v = shop.price(p, { extra });
  return catui.html`<p class="Catui_sh-price${size === "lg" ? " Catui_sh-price-lg" : ""}">${v.rate ? catui.html`<span class="Catui_sh-rate">${v.rate}%${shClip(" 할인")}</span>` : ""}<b class="Catui_sh-sale">${shClip("판매가 ")}${shop.won(v.sale)}</b>${v.rate ? catui.html`<del class="Catui_sh-list">${shClip("정가 ")}${shop.won(v.list)}</del>` : ""}</p>`;
};

// ── 재고 · 옵션 ──
// stock: 숫자(옵션 없음) 또는 { "색상/사이즈": 수량 } — 옵션 하나만 있으면 다른 쪽은 "-" ("black/-", "-/red"). 없는 조합은 0(품절)
shop.optKey = (color, size) => `${color || "-"}/${size || "-"}`;
shop.stock = function (p, color, size) {
  if (typeof p.stock === "number") return p.stock;
  return Math.max(0, Number((p.stock || {})[shop.optKey(color, size)]) || 0);
};
shop.stockTotal = (p) => (typeof p.stock === "number" ? Math.max(0, p.stock) : Object.values(p.stock || {}).reduce((a, n) => a + Math.max(0, Number(n) || 0), 0));
shop.extra = (p, size) => Number((p.options?.size?.items || []).find((s) => s.id === size)?.extra || 0);
shop.optLabel = function (p, color, size) {
  const c = (p.options?.color?.items || []).find((x) => x.id === color), s = (p.options?.size?.items || []).find((x) => x.id === size);
  return [c?.name, s ? s.name || s.id : ""].filter(Boolean).join(" / ");
};
/** 옵션 상태: 색상마다 남은 수(모든 사이즈 합) · 고른 색상 기준 사이즈마다 남은 수 · 품절 여부 */
shop.optionState = function (p, color) {
  const colors = p.options?.color?.items || [], sizes = p.options?.size?.items || [];
  const sumColor = (c) => (sizes.length ? sizes.reduce((a, s) => a + shop.stock(p, c, s.id), 0) : shop.stock(p, c, null));
  const sizeStock = (s) => (colors.length ? (color ? shop.stock(p, color, s) : colors.reduce((a, c) => a + shop.stock(p, c.id, s), 0)) : shop.stock(p, null, s));
  return {
    colors: colors.map((c) => { const n = sumColor(c.id); return { ...c, stock: n, soldOut: n <= 0 }; }),
    sizes: sizes.map((s) => { const n = sizeStock(s.id); return { ...s, stock: n, soldOut: n <= 0, low: n > 0 && n <= shop.rules.lowStock }; }),
  };
};
/** 옵션이 다 골라졌는지(있는 옵션만) */
shop.optReady = (p, color, size) => (!p.options?.color || !!color) && (!p.options?.size || !!size);

// ── 테마: 관리 화면·커뮤니티와 같은 규칙(저장값 없으면 시스템) ──
shop.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => shGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-sh-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) { shSet("theme", v); this.apply(v); shop.emit("theme", { value: this.get(), saved: v }); },
  init() {
    // <html data-catui-theme-lock>: 다른 쪽(예: 문서 사이트)이 테마를 관리하는 화면 — 덮어쓰지 않는다
    if (document.documentElement.hasAttribute("data-catui-theme-lock")) return;
    this.apply(this.saved());
    if (!shop._once(document, "theme")) return;   // 재호출 시 클릭이 두 번 처리돼 토글이 상쇄되지 않게
    const mq = matchMedia("(prefers-color-scheme: dark)");
    shop._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    shop._on(document, "click", (e) => { if (e.target.closest("[data-catui-sh-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};
