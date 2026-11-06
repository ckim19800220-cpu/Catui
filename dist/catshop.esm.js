/*! CatuiShop JS 2.0.0 | MIT License (c) imcatDevs | catui 위에 로드 */
import catui from "./catui.esm.js";

// ── shop.js ──
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

const shop = {
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

// ── data.js ──
// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.shop.data('orders').then((rows) => …)   data/orders.json 을 한 번만 읽어 캐시
//   catui.shop.dataBase = '/api/'                 주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   catui.shop.load()                             상품·분류·리뷰·쿠폰·회원·기획전을 합쳐 화면에 쓰는 값으로 (한 번만 계산)
//     · 판매가·할인율·재고 합·품절 = 상품 원자료에서, 별점 평균·리뷰 수·분포 = reviews.json에서, 적립금 = 회원 적립 내역 합
//     · 베스트 = 판매 수 상위 6개, 신상품 = 등록 14일 이내, 쿠폰 만료 = shop.now() 기준
shop.dataBase = "data/";
shop._dataCache = new Map();
shop.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiShop: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
// 모의 데이터의 "지금" — <html data-catui-sh-now="ISO"> (없으면 실제 시각)
shop.now = () => (shop.fixedNow ? new Date(shop.fixedNow) : new Date());
shop.date = (iso, fmt = "yyyy.MM.dd") => catui.util.toDateString(new Date(iso), fmt);
/** 원자료를 합쳐 계산한 값을 준다. 가공 규칙은 위 주석 참고 */
shop.enrich = function ({ products, categories = [], reviews = [], coupons = [], user = {}, promos = [] }) {
  const C = Object.fromEntries(categories.map((c) => [c.id, c]));
  const R = {};
  for (const r of reviews) (R[r.product] = R[r.product] || []).push(r);
  const now = shop.now();
  const bestIds = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 6).map((p) => p.id);
  const cs = coupons.map((c) => ({ ...c, expired: new Date(c.expires) < now }));
  const usable = cs.filter((c) => !c.expired && !c.used);
  const list = products.map((p) => {
    const rs = R[p.id] || [], v = shop.price(p, { coupons: usable }), total = shop.stockTotal(p);
    const dist = [5, 4, 3, 2, 1].map((n) => rs.filter((r) => r.rating === n).length);
    return {
      ...p, catName: C[p.cat]?.name || p.cat, sale: v.sale, rateShown: v.rate, save: v.save, couponPrice: v.couponPrice, coupon: v.coupon,
      stockTotal: total, soldOut: total <= 0, isNew: now - new Date(p.created) < shop.rules.newDays * 864e5, best: bestIds.includes(p.id), bestRank: bestIds.indexOf(p.id) + 1,
      reviewCount: rs.length, rating: rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10 : 0, ratingDist: dist,
    };
  });
  const points = (user.pointsLog || []).reduce((a, x) => a + Number(x.amount || 0), 0);
  return { products: list, byId: Object.fromEntries(list.map((p) => [p.id, p])), categories, C, reviews, R, coupons: cs, usable, user: { ...user, points }, promos };
};
shop.load = function () {
  if (this._loaded) return this._loaded;
  this._loaded = Promise.all(["products", "categories", "reviews", "coupons", "user", "promos"].map((n) => this.data(n)))
    .then(([products, categories, reviews, coupons, user, promos]) => {
      const d = this.enrich({ products, categories, reviews, coupons, user, promos });
      // 처음 여는 브라우저: 회원 데이터의 장바구니·찜·최근 본 상품으로 채운다(한 번만 — 비운 뒤에는 다시 채우지 않음)
      if (shGet("cart") === undefined) this.cart.save((user.cart || []).map((l) => ({ key: `${l.id}:${shop.optKey(l.color, l.size)}`, id: l.id, color: l.color || "", size: l.size || "", qty: l.qty || 1, on: true })), { quiet: true });
      if (shGet("wish") === undefined) shSet("wish", user.wish || []);
      if (shGet("recent") === undefined) shSet("recent", user.recent || []);
      this.emit("data", { data: d });
      return d;
    });
  this._loaded.catch(() => { this._loaded = null; });
  return this._loaded;
};

// 상품 사진 자리표시: 토큰 색으로 그린 SVG (외부 이미지 없음). 실서비스는 p.thumb(또는 p.images[n]) 주소를 쓴다
shop.thumb = function (p, n = 0) {
  if (p.images?.[n]) return p.images[n];
  if (p.thumb && !n) return p.thumb;
  const css = getComputedStyle(document.documentElement);
  const pick = (k) => css.getPropertyValue(`--Catui_color-${k}`).trim() || "gray";
  const c = pick(["brand", "info", "purple", "amber"][((p.tone || 1) - 1 + n) % 4]), ink = pick("text-primary"), paper = pick("surface");
  const k = (Number(p.id) + n) % 4;
  const shape = [
    `<rect x="110" y="90" width="180" height="220" rx="24" fill="${c}"/><rect x="150" y="60" width="100" height="40" rx="12" fill="${c}" opacity=".7"/>`,
    `<circle cx="200" cy="200" r="110" fill="${c}"/><circle cx="200" cy="200" r="56" fill="${paper}" opacity=".5"/>`,
    `<path d="M90 300 L200 90 L310 300Z" fill="${c}"/><rect x="90" y="300" width="220" height="16" rx="8" fill="${ink}" opacity=".15"/>`,
    `<rect x="80" y="130" width="240" height="160" rx="20" fill="${c}"/><rect x="110" y="160" width="120" height="14" rx="7" fill="${paper}" opacity=".6"/>`,
  ][k];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${c}" opacity=".14"/><ellipse cx="200" cy="340" rx="140" ry="16" fill="${ink}" opacity=".08"/>${shape}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
/** 별점 표시(읽기 전용): role="img" + 이름 "5점 만점에 4.5점" — 별 모양은 반올림 */
shop.stars = function (rating, { size = 12 } = {}) {
  const on = Math.round(Number(rating) || 0);
  return catui.html`<span class="Catui_sh-stars" role="img" aria-label="5점 만점에 ${Number(rating) || 0}점">${[1, 2, 3, 4, 5].map((i) => catui.html`<span${i <= on ? catui.html` data-on` : ""}>${catui.icon("star", size)}</span>`)}</span>`;
};

// ── cart.js ──
// cart — 장바구니 · 찜 · 최근 본 상품 (저장: catui.data('shop')) + 금액 계산(순수 함수)
//   줄 하나: { key: "101:black/M", id, color, size, qty, on(선택) }
//   shop.calc.cart(lines, byId)       → 선택한 줄 합계 · 상품 할인 · 배송비(무료 기준) · 무료까지 남은 금액
//   shop.coupon.apply(coupon, { items:[{cat, amount}], ship }) → { ok, amount, reason }
//   shop.calc.order({ cart, coupon, points, have }) → 쿠폰 · 적립금(1,000원 이상, 10원 단위) · 최종 결제 금액 · 적립 예정
shop.cart = {
  list: () => shGet("cart", []) || [],
  save(lines, { quiet = false } = {}) {
    shSet("cart", lines);
    shop.shell?.count();
    if (!quiet) shop.emit("cart", { lines });
    return lines;
  },
  /** 담기: 같은 상품·옵션이면 수량을 더한다. max(재고)를 주면 그 수까지만 */
  add(id, { color = "", size = "", qty = 1, max = shop.rules.maxQty } = {}) {
    const key = `${id}:${shop.optKey(color, size)}`, lines = this.list();
    const limit = Math.min(shop.rules.maxQty, Math.max(0, Number(max)));
    const cur = lines.find((l) => l.key === key);
    const want = Math.max(1, Math.floor(Number(qty)) || 1);
    if (cur) { cur.qty = Math.min(limit, cur.qty + want); cur.on = true; }
    else lines.push({ key, id: String(id), color, size, qty: Math.min(limit, want), on: true });
    this.save(lines);
    return lines.find((l) => l.key === key);
  },
  setQty(key, qty, max = shop.rules.maxQty) {
    const lines = this.list(), l = lines.find((x) => x.key === key);
    if (!l) return null;
    l.qty = Math.min(Math.min(shop.rules.maxQty, max), Math.max(1, Math.floor(Number(qty)) || 1));
    this.save(lines);
    return l;
  },
  remove(keys) { const set = new Set([].concat(keys)); return this.save(this.list().filter((l) => !set.has(l.key))); },
  select(key, on) { const lines = this.list(); lines.forEach((l) => { if (key == null || l.key === key) l.on = !!on; }); return this.save(lines); },
  selectAll(on) { return this.select(null, on); },
  clear() { return this.save([]); },
  /** 담긴 줄 수(같은 상품이라도 옵션이 다르면 따로 센다) */
  count() { return this.list().length; },
  summary(byId) { return shop.calc.cart(this.list(), byId); },
};

shop.wish = {
  list: () => shGet("wish", []) || [],
  has: (id) => shop.wish.list().includes(String(id)),
  toggle(id, on) {
    const l = this.list(), was = l.includes(String(id)), next = on == null ? !was : !!on;
    shSet("wish", next ? [String(id), ...l.filter((x) => x !== String(id))] : l.filter((x) => x !== String(id)));
    shop.emit("wish", { id: String(id), on: next });
    return next;
  },
};

shop.recent = {
  max: 20,
  list: () => shGet("recent", []) || [],
  add(id) { shSet("recent", [String(id), ...this.list().filter((x) => x !== String(id))].slice(0, this.max)); shop.emit("recent", { id: String(id) }); },
  remove(id) { shSet("recent", this.list().filter((x) => x !== String(id))); shop.emit("recent", { id: String(id), removed: true }); },
  clear() { shSet("recent", []); shop.emit("recent", { cleared: true }); },
};

// ── 쿠폰 ──
shop.coupon = {
  /** 쓸 수 있는지와 할인액. 분류 제한(cats)이 있으면 그 분류 상품 금액만, 최소 주문 금액은 그 금액 기준 */
  apply(c, { items = [], ship = 0, now = shop.now() } = {}) {
    if (!c) return { ok: false, amount: 0, reason: "" };
    if (c.used) return { ok: false, amount: 0, reason: "사용함" };
    if (c.expires && new Date(c.expires) < now) return { ok: false, amount: 0, reason: "기간 만료" };
    const eligible = items.filter((it) => !c.cats?.length || c.cats.includes(it.cat)).reduce((a, it) => a + Number(it.amount || 0), 0);
    if (c.type === "ship") return ship > 0 ? { ok: true, amount: ship, reason: "" } : { ok: false, amount: 0, reason: "배송비 없음" };
    if (!eligible) return { ok: false, amount: 0, reason: "적용 상품 없음" };
    if (eligible < Number(c.min || 0)) return { ok: false, amount: 0, reason: `${shop.won(c.min)} 이상 구매 시` };
    const raw = c.type === "rate" ? Math.floor((eligible * Number(c.value)) / 1000) * 10 : Number(c.value);
    const amount = Math.min(raw, c.max ? Number(c.max) : Infinity, eligible);
    return { ok: amount > 0, amount, reason: amount > 0 ? "" : "할인 없음" };
  },
  /** 표시용 이름: "10% (최대 10,000원)" · "3,000원" · "배송비" */
  label(c) { return c.type === "rate" ? `${c.value}%${c.max ? ` (최대 ${shop.won(c.max)})` : ""}` : c.type === "ship" ? "배송비 무료" : shop.won(c.value); },
  /** 가장 큰 할인을 주는 쿠폰 */
  best(coupons, ctx) {
    let best = null, amt = 0;
    for (const c of coupons || []) { const r = this.apply(c, ctx); if (r.ok && r.amount > amt) { amt = r.amount; best = c; } }
    return best;
  },
};

// ── 계산 (DOM 없이 쓰는 순수 함수) ──
shop.calc = {
  /** 배송비: 선택 상품이 없으면 0, 모두 무료배송 상품이거나 합계가 무료 기준 이상이면 0, 아니면 기본 배송비 */
  ship(subtotal, items = []) {
    if (!items.length || subtotal <= 0) return 0;
    if (items.every((it) => it.product?.ship === "free")) return 0;
    return subtotal >= shop.rules.freeOver ? 0 : shop.rules.shipFee;
  },
  cart(lines, byId) {
    const rows = (lines || []).map((l) => {
      const p = byId[l.id];
      if (!p) return { ...l, missing: true, soldOut: true, amount: 0, listAmount: 0, stock: 0 };
      const extra = shop.extra(p, l.size), v = shop.price(p, { extra }), stock = shop.stock(p, l.color, l.size);
      const qty = Math.max(1, Number(l.qty) || 1);
      return { ...l, qty, product: p, opt: shop.optLabel(p, l.color, l.size), unit: v.sale, unitList: v.list, rate: v.rate, stock, soldOut: stock <= 0, over: qty > stock && stock > 0, amount: v.sale * qty, listAmount: v.list * qty };
    });
    const selected = rows.filter((r) => r.on !== false && !r.soldOut);
    const subtotal = selected.reduce((a, r) => a + r.amount, 0), listTotal = selected.reduce((a, r) => a + r.listAmount, 0);
    const ship = this.ship(subtotal, selected);
    const allFree = selected.length > 0 && selected.every((r) => r.product?.ship === "free");
    return {
      lines: rows, selected, count: selected.length, qty: selected.reduce((a, r) => a + r.qty, 0),
      listTotal, subtotal, discount: listTotal - subtotal, ship,
      freeLeft: ship > 0 && !allFree ? Math.max(0, shop.rules.freeOver - subtotal) : 0, total: subtotal + ship,
    };
  },
  /** 최종 금액: 상품 합계 − 쿠폰 − 적립금 + 배송비(배송비 쿠폰은 배송비에서) · 적립 예정 = 실제 결제 상품 금액의 1% */
  order({ cart, coupon = null, points = 0, have = 0 } = {}) {
    const R = shop.rules, items = (cart?.selected || []).map((r) => ({ cat: r.product?.cat, amount: r.amount }));
    const cres = coupon ? shop.coupon.apply(coupon, { items, ship: cart.ship }) : { ok: false, amount: 0, reason: "" };
    const cAmt = cres.ok ? cres.amount : 0;
    const isShip = coupon?.type === "ship";
    const afterCoupon = cart.subtotal - (isShip ? 0 : cAmt), ship = cart.ship - (isShip ? cAmt : 0);
    const maxPoints = have >= R.pointMin ? Math.floor(Math.min(have, afterCoupon) / R.pointUnit) * R.pointUnit : 0;
    let use = Math.floor(Math.max(0, Number(points) || 0) / R.pointUnit) * R.pointUnit;
    let pointNote = "";
    if (use > maxPoints) { use = maxPoints; pointNote = maxPoints ? `최대 ${shop.won(maxPoints)}까지 쓸 수 있습니다` : `${catui.util.number(R.pointMin)}원 이상 모이면 쓸 수 있습니다`; }
    if (use > 0 && use < R.pointMin) { use = 0; pointNote = `${catui.util.number(R.pointMin)}원 이상부터 쓸 수 있습니다`; }
    const total = Math.max(0, afterCoupon - use + ship);
    return {
      listTotal: cart.listTotal, subtotal: cart.subtotal, discount: cart.discount, coupon: cAmt, couponOk: cres.ok, couponReason: cres.reason,
      shipBase: cart.ship, ship, points: use, maxPoints, pointNote, total, earn: Math.floor(((afterCoupon - use) * R.pointRate) / 100),
    };
  },
};

// ── cards.js ──
// cards — 상품 카드 · 상품 묶음 · 카테고리 · 기획전 (홈·목록·찜·최근 본 상품이 같은 카드를 쓴다)
//   shop.card(p, { rank, remove })            카드 한 장 <li> (글자는 모두 이스케이프)
//   <ul data-catui-sh-products="best|new|sale|cat:food|ids:101,201|related:101" data-size="8">   상품 묶음
//   <div data-catui-sh-cats>                  카테고리 바로가기
//   <div data-catui-sh-promos>                기획전 카드
const shTag = (text, cls = "") => catui.html`<li class="Catui_sh-tag${cls ? ` ${cls}` : ""}">${text}</li>`;
shop.tags = function (p) {
  const t = [];
  if (p.best) t.push(shTag("BEST", "Catui_sh-tag-best"));
  if (p.isNew) t.push(shTag("NEW", "Catui_sh-tag-new"));
  if (p.ship === "free") t.push(shTag("무료배송"));
  if (p.ship === "today") t.push(shTag("오늘출발"));
  if (p.couponPrice < p.sale) t.push(shTag("쿠폰", "Catui_sh-tag-coupon"));
  return t.length ? catui.html`<ul class="Catui_sh-tags" aria-label="상품 혜택">${t}</ul>` : "";
};
shop.card = function (p, { rank = 0, remove = false } = {}) {
  const wish = shop.wish.has(p.id);
  return catui.html`<li class="Catui_sh-card${p.soldOut ? " Catui_sh-card-out" : ""}">
    <a class="Catui_sh-card-link" href="product.html?id=${p.id}">
      <span class="Catui_sh-card-img"><img src="${shop.thumb(p)}" alt="" width="400" height="400" loading="lazy">${p.soldOut ? catui.html`<span class="Catui_sh-soldout">품절</span>` : ""}${rank ? catui.html`<span class="Catui_sh-rank">${rank}${shClip("위")}</span>` : ""}</span>
      <span class="Catui_sh-card-brand">${p.brand}</span>
      <b class="Catui_sh-card-name">${p.name}</b>
    </a>
    ${shop.priceHtml(p)}
    ${p.reviewCount ? catui.html`<p class="Catui_sh-card-meta">${shop.stars(p.rating)}<span class="Catui_num">${p.rating.toFixed(1)}</span><span>${shClip("리뷰 ")}(${catui.util.number(p.reviewCount)})</span></p>` : ""}
    ${shop.tags(p)}
    <div class="Catui_sh-card-acts">
      <button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon Catui_sh-wish" type="button" data-catui-sh-wish="${p.id}" aria-pressed="${wish}" aria-label="${p.name} 찜하기">${catui.icon("heart", 18)}</button>
      ${remove ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-sh-remove="${p.id}" aria-label="${p.name} 목록에서 빼기">${catui.icon("x", 16)}</button>` : ""}
      ${p.soldOut ? "" : catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary Catui_btn-icon" type="button" data-catui-sh-add-cart="${p.id}" aria-label="${p.name} 장바구니에 담기">${catui.icon("shopping-cart", 16)}</button>`}
    </div>
  </li>`;
};
shop.empty = (title, text = "", action = "") => catui.html`<div class="Catui_empty Catui_sh-empty">${catui.icon("shopping-bag", 24)}<p class="Catui_empty-title">${title}</p>${text ? catui.html`<p class="Catui_empty-text">${text}</p>` : ""}${action}</div>`;
// 묶음 고르기: best · new · sale(할인율 순) · cat:분류 · ids:a,b · related:상품(같은 분류, 자기 제외)
shop.pick = function (d, spec) {
  const [kind, arg = ""] = String(spec || "best").split(":");
  const all = d.products;
  switch (kind) {
    case "best": return all.filter((p) => p.best).sort((a, b) => a.bestRank - b.bestRank);
    case "new": return all.filter((p) => p.isNew).sort((a, b) => (a.created < b.created ? 1 : -1));
    case "sale": return all.filter((p) => p.rateShown > 0 && !p.soldOut).sort((a, b) => b.rateShown - a.rateShown);
    case "cat": return all.filter((p) => p.cat === arg);
    case "ids": return arg.split(",").map((id) => d.byId[id.trim()]).filter(Boolean);
    case "related": { const me = d.byId[arg]; return me ? all.filter((p) => p.cat === me.cat && p.id !== me.id) : []; }
    default: return all;
  }
};
shop.cards = {
  init(root) {
    const boxes = [...root.querySelectorAll("[data-catui-sh-products], [data-catui-sh-cats], [data-catui-sh-promos]")];
    if (!boxes.length) return;
    shop.load().then((d) => boxes.forEach((b) => this.fill(b, d))).catch(() => {});
  },
  fill(box, d) {
    if (box.hasAttribute("data-catui-sh-cats")) {
      catui.mount(box, catui.html`<ul class="Catui_sh-cats">${d.categories.map((c) => catui.html`<li><a href="list.html?c=${c.id}"><span class="Catui_sh-cat-ic" aria-hidden="true">${catui.icon(c.icon, 24)}</span><span>${c.name}</span></a></li>`)}</ul>`);
      return;
    }
    if (box.hasAttribute("data-catui-sh-promos")) {
      catui.mount(box, catui.html`<ul class="Catui_sh-promos">${d.promos.map((m) => catui.html`<li><a class="Catui_sh-promo" data-tone="${m.tone}" href="event.html?e=${m.id}"><b>${m.title}</b><span>${m.desc}</span><time class="Catui_sh-left" data-catui-sh-until="${m.until}" datetime="${m.until}"></time></a></li>`)}</ul>`);
      shop.shell.tick(box);
      return;
    }
    const spec = box.getAttribute("data-catui-sh-products").replace("{id}", shop.query().get("id") || "101");
    const list = shop.pick(d, spec).slice(0, Number(box.dataset.size || 8));
    const ranked = spec === "best" && box.hasAttribute("data-rank");
    catui.mount(box, list.length ? catui.html`${list.map((p, i) => shop.card(p, { rank: ranked ? i + 1 : 0 }))}` : catui.html`<li class="Catui_sh-wide">${shop.empty("보여 줄 상품이 없습니다")}</li>`);
  },
};

// ── shell.js ──
// shell — 사이트 머리·하단 탭·선언형 속성 (클릭은 루트 한 곳에서 받는다)
//   form[data-catui-sh-search]           머리 검색: search.html?q= 로 이동(빈 값은 막음)
//   [data-catui-sh-cart-count]           장바구니 담긴 수 배지 — 숫자 뒤에 숨김 글자 "개 담김"(색·숫자만으로 알리지 않음)
//   [data-catui-sh-add-cart="상품"]      담기 (data-color · data-size · data-qty). 옵션을 골라야 하는 상품이면 상세로 안내
//   [data-catui-sh-wish="상품"]          찜 토글 (aria-pressed, 기억)
//   [data-catui-sh-until="ISO"]          남은 시간 "2일 03:12:09 남음" / "종료" (1초마다)
//   [data-catui-sh-won="12900"]          금액 글자 "12,900원"
//   [data-catui-sh-top]                  맨 위로 (스크롤 600px 넘으면 보임)
shop.shell = {
  count(scope = document) {
    const n = shop.cart.count();
    scope.querySelectorAll("[data-catui-sh-cart-count]").forEach((el) => {
      el.hidden = !n;
      catui.mount(el, catui.html`${n > 99 ? "99+" : n}${shClip("개 담김")}`);
    });
  },
  tick(scope = document) {
    scope.querySelectorAll("[data-catui-sh-until]").forEach((t) => {
      const left = new Date(t.getAttribute("data-catui-sh-until")) - shop.now();
      if (Number.isNaN(left)) return;   // 잘못된 날짜면 원래 글자를 둔다
      const s = Math.floor(left / 1000), d = Math.floor(s / 86400), pad = (x) => String(x).padStart(2, "0");
      const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
      t.textContent = left <= 0 ? "종료" : `${d ? `${d}일 ` : ""}${hms} 남음`;
    });
  },
  init(root) {
    root.querySelectorAll("form[data-catui-sh-search]").forEach((f) => shop._on(f, "submit", (e) => {
      const q = f.querySelector("input[name=q]");
      if (q && !q.value.trim()) { e.preventDefault(); q.focus(); }
    }));
    const q = shop.query().get("q");
    if (q) root.querySelectorAll("form[data-catui-sh-search] input[name=q]").forEach((i) => { i.value = q; });
    // 상단 분류 메뉴: 목록 화면은 주소의 ?c= 로 현재 위치를 다시 표시
    const c = shop.query().get("c");
    if (c) root.querySelectorAll(".Catui_sh-gnb-item").forEach((a) => { if (new URL(a.href, location.href).searchParams.get("c") === c) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    root.querySelectorAll("[data-catui-sh-won]").forEach((el) => { el.textContent = shop.won(el.getAttribute("data-catui-sh-won")); });
    this.count(root);
    shop.wishPaint(root);
    this.tick(root);
    const tid = setInterval(() => this.tick(root), 1000);   // 나중에 그린 기획전 카드의 시간도 함께
    shop._offs.push(() => clearInterval(tid));
    const top = root.querySelector("[data-catui-sh-top]");
    if (top) {
      const sync = () => { top.hidden = scrollY < 600; };
      shop._on(window, "scroll", sync, { passive: true }); sync();
      shop._on(top, "click", () => { scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); root.querySelector("main")?.focus({ preventScroll: true }); });
    }
    // 다른 탭에서 장바구니가 바뀌면 배지만 맞춘다
    shop._on(window, "storage", (e) => { if (e.key === `catui:${SH_STORE}`) { this.count(root); shop.wishPaint(root); } });
    shop._on(root, "click", (e) => {
      const w = e.target.closest("[data-catui-sh-wish]");
      if (w) { const on = shop.wish.toggle(w.dataset.catuiShWish); shop.wishPaint(root); catui.layer.msg(on ? "찜 목록에 넣었습니다" : "찜을 풀었습니다", { time: 1200 }); return; }
      const a = e.target.closest("[data-catui-sh-add-cart]");
      if (a) this.addCart(a);
    });
  },
  addCart(btn) {
    const id = btn.dataset.catuiShAddCart;
    return shop.load().then((d) => {
      const p = d.byId[id];
      if (!p) return null;
      const color = btn.dataset.color || "", size = btn.dataset.size || "";
      if (!shop.optReady(p, color, size)) { catui.layer.msg("옵션을 골라 주세요 — 상품 화면으로 이동합니다", { time: 1200 }); setTimeout(() => { location.href = `product.html?id=${encodeURIComponent(id)}`; }, 800); return null; }
      const stock = shop.stock(p, color, size);
      if (stock <= 0) { catui.layer.msg("품절된 상품입니다", { icon: "warn" }); return null; }
      const line = shop.cart.add(id, { color, size, qty: Number(btn.dataset.qty || 1), max: stock });
      catui.layer.msg(`${p.name.slice(0, 18)} — 장바구니에 담았습니다`, { icon: "success", time: 1400 });
      return line;
    }).catch(() => null);
  },
};
/** 찜 버튼 상태 칠하기 (새로 그린 카드 포함) */
shop.wishPaint = (scope = document) => scope.querySelectorAll("[data-catui-sh-wish]").forEach((b) => b.setAttribute("aria-pressed", String(shop.wish.has(b.dataset.catuiShWish))));

// ── list.js ──
// list — 상품 목록 · 검색 결과
//   <section data-catui-sh-list="list|search" data-size="12">
//   · 주소 ↔ 화면: ?c=분류 &q=검색어 &sort=best|new|low|high|review|rate &price=10000-30000 &free=1 &today=1 &instock=1 &brand=a,b &page=N
//     (새로 고침·공유해도 같은 목록, 뒤로 가기로 이전 조건 — 필터 폼은 그대로 두고 결과만 다시 그려 포커스를 잃지 않는다)
//   · 보기: 바둑판 / 목록 (기억) · 품절 상품은 정렬과 관계없이 맨 뒤
const SH_SORTS = { best: "판매순", new: "신상품순", low: "낮은 가격순", high: "높은 가격순", review: "리뷰 많은순", rate: "할인율순" };
const SH_PRICES = [["", "전체"], ["0-10000", "1만원 미만"], ["10000-30000", "1만~3만원"], ["30000-100000", "3만~10만원"], ["100000-", "10만원 이상"]];
shop.list = {
  sorts: SH_SORTS,
  prices: SH_PRICES,
  init(root) { root.querySelectorAll("[data-catui-sh-list]").forEach((box) => this.mount(box)); },
  /** 주소 → 조건 */
  read(qs = shop.query()) {
    return { c: qs.get("c") || "", q: (qs.get("q") || "").trim(), sort: SH_SORTS[qs.get("sort")] ? qs.get("sort") : "best", price: qs.get("price") || "",
      free: qs.get("free") === "1", today: qs.get("today") === "1", instock: qs.get("instock") === "1", brands: (qs.get("brand") || "").split(",").filter(Boolean), page: Math.max(1, Math.floor(Number(qs.get("page"))) || 1) };
  },
  /** 조건으로 거르고 정렬한 상품 (DOM 없이 쓸 수 있음) */
  filter(products, o) {
    const words = (o.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const [lo, hi] = (o.price || "").split("-").map((x) => (x === "" || x == null ? null : Number(x)));
    let rows = products.filter((p) => (!o.c || p.cat === o.c)
      && (!words.length || words.every((w) => `${p.name} ${p.brand} ${p.catName || ""} ${p.summary || ""}`.toLowerCase().includes(w)))
      && (lo == null || p.sale >= lo) && (hi == null || p.sale < hi)
      && (!o.free || p.ship === "free") && (!o.today || p.ship === "today") && (!o.instock || !p.soldOut)
      && (!o.brands?.length || o.brands.includes(p.brand)));
    const by = { best: (a, b) => b.sold - a.sold, new: (a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0), low: (a, b) => a.sale - b.sale, high: (a, b) => b.sale - a.sale, review: (a, b) => b.reviewCount - a.reviewCount, rate: (a, b) => b.rateShown - a.rateShown }[o.sort || "best"];
    rows = [...rows].sort(by);
    return [...rows.filter((p) => !p.soldOut), ...rows.filter((p) => p.soldOut)];
  },
  mount(box) {
    if (!shop._once(box, "list")) return;
    const kind = box.getAttribute("data-catui-sh-list"), size = Number(box.dataset.size || 12);
    shop.load().then((d) => {
      const o0 = this.read();
      const cat = d.C[o0.c];
      const base = this.filter(d.products, { c: o0.c, q: o0.q });
      const brands = [...new Set(base.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "ko"));
      const title = kind === "search" ? (o0.q ? `‘${o0.q}’ 검색 결과` : "상품 검색") : cat ? cat.name : "전체 상품";
      const uid = `sl${Math.random().toString(36).slice(2, 7)}`;
      catui.mount(box, catui.html`
        <header class="Catui_sh-list-head"><div><h1 class="Catui_h2" tabindex="-1" data-h>${title}</h1><p class="Catui_help" data-count aria-live="polite"></p></div></header>
        ${kind === "list" ? catui.html`<nav class="Catui_sh-chips" aria-label="분류"><a href="list.html"${!o0.c ? catui.html` aria-current="page"` : ""}>전체</a>${d.categories.map((c) => catui.html`<a href="list.html?c=${c.id}"${o0.c === c.id ? catui.html` aria-current="page"` : ""}>${c.name}</a>`)}</nav>` : ""}
        <div class="Catui_sh-list-body">
          <details class="Catui_sh-filter" data-filter><summary>${catui.icon("sliders-horizontal", 16)}필터<span class="Catui_count" data-fn hidden></span></summary>
            <form class="Catui_sh-filter-form" data-form>
              <fieldset><legend class="Catui_label">가격</legend>${SH_PRICES.map(([v, t], i) => catui.html`<label class="Catui_choice" for="${uid}-p${i}"><input class="Catui_clip" type="radio" name="price" value="${v}" id="${uid}-p${i}"><span class="Catui_radio"></span>${t}</label>`)}</fieldset>
              <fieldset><legend class="Catui_label">배송 · 재고</legend>${[["free", "무료배송"], ["today", "오늘출발"], ["instock", "품절 상품 빼기"]].map(([n, t]) => catui.html`<label class="Catui_choice" for="${uid}-${n}"><input class="Catui_clip" type="checkbox" name="${n}" value="1" id="${uid}-${n}"><span class="Catui_cbx">${catui.icon("check", 12)}</span>${t}</label>`)}</fieldset>
              ${brands.length > 1 ? catui.html`<fieldset><legend class="Catui_label">브랜드</legend>${brands.map((b, i) => catui.html`<label class="Catui_choice" for="${uid}-b${i}"><input class="Catui_clip" type="checkbox" name="brand" value="${b}" id="${uid}-b${i}"><span class="Catui_cbx">${catui.icon("check", 12)}</span>${b}</label>`)}</fieldset>` : ""}
              <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="reset">${catui.icon("rotate-ccw", 16)}조건 지우기</button>
            </form>
          </details>
          <div class="Catui_sh-results">
            <div class="Catui_sh-toolbar">
              <div class="Catui_select-wrap"><label class="Catui_clip" for="${uid}-sort">정렬</label><select class="Catui_input Catui_input-sm Catui_select" id="${uid}-sort" data-sort>${Object.entries(SH_SORTS).map(([k, v]) => catui.html`<option value="${k}">${v}</option>`)}</select>${catui.icon("chevron-down", 16)}</div>
              <div class="Catui_segment" role="group" aria-label="보기 방식"><button type="button" data-view="grid" aria-pressed="true">${catui.icon("layout-grid", 16)}<span class="Catui_clip">바둑판으로 보기</span></button><button type="button" data-view="rows" aria-pressed="false">${catui.icon("layout-list", 16)}<span class="Catui_clip">목록으로 보기</span></button></div>
            </div>
            <ul class="Catui_sh-grid" data-grid aria-label="${title} 상품"></ul>
            <nav class="Catui_pager Catui_sh-pager" aria-label="쪽" data-pager></nav>
          </div>
        </div>`);
      const form = box.querySelector("[data-form]"), grid = box.querySelector("[data-grid]"), pager = box.querySelector("[data-pager]"), sortSel = box.querySelector("[data-sort]");
      const det = box.querySelector("[data-filter]"), wide = matchMedia("(min-width: 992px)");
      det.open = wide.matches;
      shop._on(wide, "change", () => { det.open = wide.matches; });
      const sync = (o) => {
        form.querySelectorAll("input[name=price]").forEach((i) => { i.checked = i.value === o.price; });
        ["free", "today", "instock"].forEach((n) => { const i = form.elements[n]; if (i) i.checked = o[n]; });
        form.querySelectorAll("input[name=brand]").forEach((i) => { i.checked = o.brands.includes(i.value); });
        sortSel.value = o.sort;
      };
      const view = () => shGet("view", "grid");
      const paintView = () => {
        grid.classList.toggle("Catui_sh-rows", view() === "rows");
        box.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view())));
      };
      const draw = () => {
        const o = this.read(), rows = this.filter(d.products, o);
        const pages = Math.max(1, Math.ceil(rows.length / size)), page = Math.min(o.page, pages);
        const shown = rows.slice((page - 1) * size, page * size);
        const nf = (o.price ? 1 : 0) + ["free", "today", "instock"].filter((n) => o[n]).length + o.brands.length;
        const fn = box.querySelector("[data-fn]");
        fn.hidden = !nf; catui.mount(fn, catui.html`${nf}${shClip("개 조건 적용")}`);
        box.querySelector("[data-count]").textContent = `상품 ${catui.util.number(rows.length)}개${pages > 1 ? ` · ${page}/${pages}쪽` : ""}`;
        if (!rows.length) {
          const tips = kind === "search" ? catui.html`<nav class="Catui_sh-chips" aria-label="추천 분류">${d.categories.map((c) => catui.html`<a href="list.html?c=${c.id}">${c.name}</a>`)}</nav>` : "";
          catui.mount(grid, catui.html`<li class="Catui_sh-wide">${shop.empty(o.q && kind === "search" ? `‘${o.q}’에 맞는 상품이 없습니다` : "조건에 맞는 상품이 없습니다", kind === "search" && o.q ? "철자를 확인하거나 다른 말로 찾아 보세요." : "필터를 줄여 보세요.", tips)}</li>`);
        } else catui.mount(grid, catui.html`${shown.map((p) => shop.card(p))}`);
        shop.wishPaint(grid);
        // 쪽 번호: 앞뒤 2쪽 + 처음·끝, 사이는 …
        const nums = [...new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
        pager.hidden = pages < 2;
        catui.mount(pager, pages < 2 ? "" : catui.html`<button class="Catui_pg" type="button" data-page="${page - 1}" aria-label="이전 쪽"${page === 1 ? catui.html` disabled` : ""}>${catui.icon("chevron-right", 16, "Catui_pg-prev")}</button>${nums.map((n, i) => catui.html`${i && n - nums[i - 1] > 1 ? catui.html`<span aria-hidden="true">…</span>` : ""}<button class="Catui_pg${n === page ? " Catui_pg-active" : ""}" type="button" data-page="${n}"${n === page ? catui.html` aria-current="page"` : ""}>${n}${shClip("쪽")}</button>`)}<button class="Catui_pg" type="button" data-page="${page + 1}" aria-label="다음 쪽"${page === pages ? catui.html` disabled` : ""}>${catui.icon("chevron-right", 16)}</button>`);
        paintView();
      };
      // 조건 → 주소 (쪽은 조건이 바뀌면 1쪽으로)
      const go = (patch, { keepPage = false } = {}) => {
        const qs = shop.query();
        for (const [k, v] of Object.entries(patch)) { if (v === "" || v == null || v === false || (Array.isArray(v) && !v.length)) qs.delete(k); else qs.set(k, Array.isArray(v) ? v.join(",") : v === true ? "1" : String(v)); }
        if (!keepPage) qs.delete("page");
        if (qs.get("sort") === "best") qs.delete("sort");
        history.pushState(null, "", `${location.pathname}${qs.toString() ? `?${qs}` : ""}`);
        draw();
      };
      shop._on(form, "change", (e) => {
        const n = e.target.name;
        if (n === "brand") go({ brand: [...form.querySelectorAll("input[name=brand]:checked")].map((i) => i.value) });
        else if (n === "price") go({ price: e.target.value });
        else if (n) go({ [n]: e.target.checked });
      });
      shop._on(form, "reset", () => setTimeout(() => go({ price: "", free: false, today: false, instock: false, brand: [] }), 0));
      shop._on(sortSel, "change", () => go({ sort: sortSel.value }));
      shop._on(box, "click", (e) => {
        const v = e.target.closest("[data-view]");
        if (v) { shSet("view", v.dataset.view); paintView(); return; }
        const pg = e.target.closest("button[data-page]");
        if (pg && !pg.disabled) {
          go({ page: pg.dataset.page }, { keepPage: true });
          const h = box.querySelector("[data-h]");
          h.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          h.focus({ preventScroll: true });
        }
      });
      shop._on(window, "popstate", () => { sync(this.read()); draw(); });
      sync(o0);
      draw();
    }).catch(() => {});
  },
};

// ── picker.js ──
// picker — 상품 옵션 고르기 (색상 견본 · 사이즈 · 선택 목록 · 수량 · 재고 · 합계)
//   const pk = catui.shop.picker(box, product, { onChange(pk) {} })
//   · 색상: 모든 사이즈가 0이면 견본에 빗금 + "(품절)" 글자, 고를 수 없음
//   · 사이즈: 고른 색상 기준 재고 — 0이면 "품절", 5개 이하면 "N개 남음" 글자(색만으로 알리지 않음), 추가금은 "+2,000원"
//   · 옵션이 다 골라지면 선택 목록에 한 줄 추가(같은 조합이면 수량 +1), 수량은 1 ~ 재고
//   · 옵션 없는 상품은 수량 한 줄만. 다시 그려도 포커스가 같은 자리로 돌아온다
shop.picker = function (box, p, { onChange = null } = {}) {
  const uid = `pk${Math.random().toString(36).slice(2, 7)}`;
  const hasColor = !!p.options?.color, hasSize = !!p.options?.size, hasOpt = hasColor || hasSize;
  const st = { color: "", size: "", lines: hasOpt || shop.stockTotal(p) <= 0 ? [] : [{ color: "", size: "", qty: 1 }], live: "" };
  const lineOf = (l) => {
    const extra = shop.extra(p, l.size), v = shop.price(p, { extra }), stock = shop.stock(p, l.color, l.size);
    return { ...l, key: `${p.id}:${shop.optKey(l.color, l.size)}`, opt: shop.optLabel(p, l.color, l.size), unit: v.sale, amount: v.sale * l.qty, stock };
  };
  const api = {
    el: box, product: p,
    lines: () => st.lines.map(lineOf),
    qty: () => st.lines.reduce((a, l) => a + l.qty, 0),
    total: () => api.lines().reduce((a, l) => a + l.amount, 0),
    /** 옵션을 다 고르지 않았으면 false */
    ready: () => st.lines.length > 0,
    clear() { st.lines = hasOpt ? [] : st.lines.map((l) => ({ ...l, qty: 1 })); st.color = ""; st.size = ""; draw(); },
    /** 첫 옵션 칸으로 포커스 */
    focus() { box.querySelector("input:not(:disabled), button:not(:disabled)")?.focus(); },
  };
  const add = (color, size) => {
    const stock = shop.stock(p, color, size);
    if (stock <= 0) return;
    const cur = st.lines.find((l) => l.color === color && l.size === size);
    if (cur) { cur.qty = Math.min(stock, cur.qty + 1); st.live = `${shop.optLabel(p, color, size)} 수량 ${cur.qty}개`; }
    else { st.lines.push({ color, size, qty: 1 }); st.live = `${shop.optLabel(p, color, size)} 선택 목록에 추가, 모두 ${st.lines.length}개 옵션`; }
  };
  function draw() {
    const fk = document.activeElement && box.contains(document.activeElement) ? document.activeElement.closest("[data-fk]")?.dataset.fk : "";
    const os = shop.optionState(p, st.color), lines = api.lines();
    const total = lines.reduce((a, l) => a + l.amount, 0), qty = lines.reduce((a, l) => a + l.qty, 0);
    const colorName = os.colors.find((c) => c.id === st.color)?.name;
    catui.mount(box, catui.html`
      ${hasColor ? catui.html`<fieldset class="Catui_swatches Catui_sh-opt"><legend class="Catui_label">${p.options.color.label || "색상"} <span class="Catui_swatch-value">· ${colorName || "골라 주세요"}</span></legend>
        ${os.colors.map((c) => catui.html`<input class="Catui_clip" type="radio" name="${uid}-c" id="${uid}-c-${c.id}" value="${c.id}" data-fk="c:${c.id}"${st.color === c.id ? catui.html` checked` : ""}${c.soldOut ? catui.html` disabled` : ""}><label class="Catui_swatch" for="${uid}-c-${c.id}" style="--Catui_swatch:var(--Catui_color-${c.swatch || "neutral-300"})" title="${c.name}${c.soldOut ? " (품절)" : ""}"><span class="Catui_clip">${c.name}${c.soldOut ? " (품절)" : ""}</span></label>`)}</fieldset>` : ""}
      ${hasSize ? catui.html`<fieldset class="Catui_sh-opt"><legend class="Catui_label">${p.options.size.label || "사이즈"}</legend>
        ${hasColor && !st.color ? catui.html`<p class="Catui_help">${p.options.color.label || "색상"}을 먼저 골라 주세요</p>` : ""}
        <div class="Catui_sh-sizes">${os.sizes.map((s) => { const off = s.soldOut || (hasColor && !st.color); return catui.html`<input class="Catui_clip" type="radio" name="${uid}-s" id="${uid}-s-${s.id}" value="${s.id}" data-fk="s:${s.id}"${st.size === s.id ? catui.html` checked` : ""}${off ? catui.html` disabled` : ""}><label class="Catui_sh-size" for="${uid}-s-${s.id}"><b>${s.name || s.id}</b>${s.extra ? catui.html`<small>+${shop.won(s.extra)}</small>` : ""}${hasColor && !st.color ? "" : s.soldOut ? catui.html`<small class="Catui_sh-out">품절</small>` : s.low ? catui.html`<small class="Catui_sh-low">${s.stock}개 남음</small>` : ""}</label>`; })}</div></fieldset>` : ""}
      ${!hasOpt && shop.stockTotal(p) <= 0 ? catui.html`<p class="Catui_banner Catui_banner-warn">${catui.icon("alert-triangle", 16)}<span>품절된 상품입니다. 재입고되면 알려 드릴게요.</span></p>` : ""}
      ${lines.length ? catui.html`<ul class="Catui_sh-picked" aria-label="선택한 옵션">${lines.map((l) => catui.html`<li>
        <span class="Catui_sh-picked-name">${l.opt || p.name}${l.qty >= l.stock ? catui.html`<small class="Catui_sh-low">재고 ${l.stock}개 — 최대 수량</small>` : l.stock <= shop.rules.lowStock ? catui.html`<small class="Catui_sh-low">${l.stock}개 남음</small>` : ""}</span>
        <div class="Catui_stepper Catui_sh-qty" role="group" aria-label="${l.opt || p.name} 수량"><button type="button" data-step="-1" data-k="${l.key}" data-fk="q:${l.key}:-1" aria-label="수량 줄이기"${l.qty <= 1 ? catui.html` disabled` : ""}>${catui.icon("minus", 16)}</button><output aria-live="polite">${l.qty}</output><button type="button" data-step="1" data-k="${l.key}" data-fk="q:${l.key}:1" aria-label="수량 늘리기"${l.qty >= l.stock ? catui.html` disabled` : ""}>${catui.icon("plus", 16)}</button></div>
        <b class="Catui_sh-picked-amt">${shop.won(l.amount)}</b>
        ${hasOpt ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-del="${l.key}" aria-label="${l.opt} 빼기">${catui.icon("x", 16)}</button>` : ""}
      </li>`)}</ul>` : ""}
      <p class="Catui_sh-total"><span>총 상품 금액 <span class="Catui_num">(${qty}개)</span></span><b data-total>${shop.won(total)}</b></p>
      <p class="Catui_clip" role="status">${st.live}</p>`);
    st.live = "";
    if (fk) {
      let el = box.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
      if (el?.disabled) el = el.parentElement.querySelector("button:not(:disabled)") || box.querySelector("input:not(:disabled)");
      el?.focus();
    }
    onChange?.(api);
  }
  if (shop._once(box, "picker")) {
    shop._on(box, "change", (e) => {
      const i = e.target;
      if (i.name === `${uid}-c`) {
        st.color = i.value; st.size = "";
        if (!hasSize) { add(st.color, ""); st.color = ""; }
        draw();
      } else if (i.name === `${uid}-s`) {
        st.size = i.value;
        if (shop.optReady(p, st.color, st.size)) { add(st.color, st.size); st.size = ""; }
        draw();
      }
    });
    shop._on(box, "click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      const lineKey = (l) => `${p.id}:${shop.optKey(l.color, l.size)}`;
      if (b.dataset.step) {
        const l = st.lines.find((x) => lineKey(x) === b.dataset.k), stock = shop.stock(p, l.color, l.size);
        l.qty = Math.min(stock, Math.max(1, l.qty + Number(b.dataset.step)));
        draw();
      } else if (b.dataset.del) {
        const l = st.lines.find((x) => lineKey(x) === b.dataset.del);
        st.lines = st.lines.filter((x) => x !== l);
        st.live = `${shop.optLabel(p, l.color, l.size)} 뺐습니다`;
        draw();
        api.focus();
      }
    });
  }
  draw();
  return api;
};

// ── product.js ──
// product — 상품 상세 (product.html?id=101)
//   <article data-catui-sh-product> 안의 자리: [data-crumb] [data-gallery] [data-brand] [data-name](h1) [data-rating] [data-price]
//     [data-ship] [data-picker] [data-acts](찜·장바구니·바로 구매) [data-detail] [data-reviews] [data-rc] [data-qna] [data-qc] [data-buybar]
//   · 사진: 작은 사진 버튼(aria-pressed, ←→ 이동)으로 큰 사진 바꾸기
//   · 리뷰: 별점 평균·분포(리뷰 원자료에서 계산), 정렬(최신·도움·별점), 사진 리뷰만, 도움돼요(한 번), 5개씩 더 보기
//   · 고정 구매 막대: 본래 구매 버튼이 화면 밖으로 나가면 아래에 나타남
//   · 본 상품은 최근 본 상품에 넣는다
const SH_RV_SORT = { new: "최신순", help: "도움순", high: "별점 높은순", low: "별점 낮은순" };
shop.product = {
  init(root) { root.querySelectorAll("[data-catui-sh-product]").forEach((b) => this.mount(b)); },
  /** 도착 예정일: 오늘 출발이면 다음 날, 아니면 이틀 뒤 (일요일은 건너뜀) */
  eta(p, now = shop.now()) {
    const t = new Date(now); let n = p.ship === "today" ? 1 : 2;
    while (n > 0) { t.setDate(t.getDate() + 1); if (t.getDay() !== 0) n--; }
    return `${t.getMonth() + 1}월 ${t.getDate()}일(${"일월화수목금토"[t.getDay()]})`;
  },
  mount(box) {
    if (!shop._once(box, "product")) return;
    const id = shop.query().get("id") || box.dataset.id || "101";
    const $ = (s) => box.querySelector(s);
    Promise.all([shop.load(), shop.data("qna").catch(() => [])]).then(([d, qna]) => {
      const p = d.byId[id];
      if (!p) {
        $("[data-name]").textContent = "상품을 찾을 수 없습니다";
        catui.mount($("[data-picker]"), shop.empty("판매가 끝났거나 주소가 바뀐 상품입니다", "", catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="list.html">상품 목록으로</a>`));
        $("[data-acts]").hidden = true;
        return;
      }
      shop.recent.add(p.id);
      document.title = `${p.name} · Catui 쇼핑`;
      catui.mount($("[data-crumb]"), catui.html`<a href="index.html">홈</a><span class="Catui_crumb-sep">/</span><a href="list.html?c=${p.cat}">${p.catName}</a><span class="Catui_crumb-sep">/</span><span aria-current="page">${p.name}</span>`);
      // 사진
      const n = 4, main = (i) => catui.html`<img src="${shop.thumb(p, i)}" alt="${p.name} 사진 ${i + 1}/${n}" width="600" height="600">`;
      catui.mount($("[data-gallery]"), catui.html`<figure class="Catui_sh-gallery-main" data-main>${main(0)}${p.soldOut ? catui.html`<span class="Catui_sh-soldout">품절</span>` : ""}</figure>
        <div class="Catui_sh-thumbs" role="group" aria-label="사진 고르기">${[0, 1, 2, 3].map((i) => catui.html`<button type="button" data-shot="${i}" aria-pressed="${i === 0}"><img src="${shop.thumb(p, i)}" alt="" width="80" height="80"><span class="Catui_clip">사진 ${i + 1}</span></button>`)}</div>`);
      shop._on($("[data-gallery]"), "click", (e) => {
        const b = e.target.closest("[data-shot]"); if (!b) return;
        catui.mount($("[data-main]"), catui.html`${main(Number(b.dataset.shot))}${p.soldOut ? catui.html`<span class="Catui_sh-soldout">품절</span>` : ""}`);
        $("[data-gallery]").querySelectorAll("[data-shot]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
      shop._on($("[data-gallery]"), "keydown", (e) => {
        const b = e.target.closest("[data-shot]"); if (!b || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        const all = [...$("[data-gallery]").querySelectorAll("[data-shot]")], i = all.indexOf(b), nx = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
        e.preventDefault(); nx.focus(); nx.click();
      });
      // 머리 정보
      $("[data-brand]").textContent = p.brand;
      $("[data-name]").textContent = p.name;
      catui.mount($("[data-rating]"), p.reviewCount ? catui.html`<a class="Catui_sh-pd-rating" href="#pd-reviews">${shop.stars(p.rating, { size: 16 })}<b class="Catui_num">${p.rating.toFixed(1)}</b><span>리뷰 ${catui.util.number(p.reviewCount)}개</span></a>` : catui.html`<span class="Catui_help">아직 리뷰가 없습니다</span>`);
      const best = p.coupon ? shop.price(p, { coupons: [p.coupon] }) : null;
      catui.mount($("[data-price]"), catui.html`${shop.priceHtml(p, { size: "lg" })}${best && best.couponPrice < best.sale ? catui.html`<p class="Catui_sh-benefit">${catui.icon("coupon", 16)}<span>최대 혜택가 <b>${shop.won(best.couponPrice)}</b> · ${p.coupon.name} 적용 시</span></p>` : ""}`);
      const earn = Math.floor((p.sale * shop.rules.pointRate) / 100);
      catui.mount($("[data-ship]"), catui.html`
        <div><dt>배송비</dt><dd>${p.ship === "free" ? catui.html`<b>무료배송</b>` : catui.html`${shop.won(shop.rules.shipFee)} <span class="Catui_help">(${shop.won(shop.rules.freeOver)} 이상 구매 시 무료)</span>`}</dd></div>
        <div><dt>출발</dt><dd>${p.ship === "today" ? catui.html`<span class="Catui_sh-tag">오늘출발</span> 오후 2시 전 주문 시` : "1~2일 안에 출발"} · <b>${this.eta(p)} 도착 예정</b></dd></div>
        <div><dt>적립</dt><dd>구매 확정 시 ${shop.won(earn)} (${shop.rules.pointRate}%)</dd></div>`);
      // 옵션 · 구매
      const bar = $("[data-buybar]"), barTotal = bar?.querySelector("[data-bar-total]");
      const pk = shop.picker($("[data-picker]"), p, { onChange: (k) => { if (barTotal) barTotal.textContent = shop.won(k.ready() ? k.total() : p.sale); } });
      box.querySelectorAll("[data-act=wish]").forEach((b) => { b.setAttribute("data-catui-sh-wish", p.id); b.setAttribute("aria-label", `${p.name} 찜하기`); });
      shop.wishPaint(box);
      if (p.soldOut) box.querySelectorAll("[data-act=cart],[data-act=buy]").forEach((b) => { b.disabled = true; });
      const need = () => { catui.layer.msg("옵션을 골라 주세요", { icon: "warn" }); $("[data-picker]").scrollIntoView({ block: "center" }); pk.focus(); };
      shop._on(box, "click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b || b.disabled) return;
        if (b.dataset.act === "cart") {
          if (!pk.ready()) return need();
          pk.lines().forEach((l) => shop.cart.add(p.id, { color: l.color, size: l.size, qty: l.qty, max: l.stock }));
          pk.clear();
          catui.layer.confirm("장바구니에 담았습니다. 지금 볼까요?", { title: "장바구니", okText: "장바구니 보기", cancelText: "쇼핑 계속" }, (i) => { catui.layer.close(i); location.href = "cart.html"; });
        } else if (b.dataset.act === "buy") {
          if (!pk.ready()) return need();
          shSet("now", pk.lines().map((l) => ({ key: l.key, id: p.id, color: l.color, size: l.size, qty: l.qty, on: true })));
          location.href = "checkout.html?from=now";
        }
      });
      if (bar && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(([en]) => { bar.hidden = en.isIntersecting || en.boundingClientRect.top > 0; });
        io.observe($("[data-acts]"));
        shop._offs.push(() => io.disconnect());
        catui.mount(bar.querySelector("[data-bar-name]"), catui.html`${p.name}`);
        if (barTotal) barTotal.textContent = shop.won(pk.ready() ? pk.total() : p.sale);
      }
      // 상세 정보
      catui.mount($("[data-detail]"), catui.html`<p class="Catui_lead">${p.summary || ""}</p>
        <figure class="Catui_sh-detail-img"><img src="${shop.thumb(p, 2)}" alt="${p.name} 상세 사진" width="800" height="800" loading="lazy"></figure>
        <dl class="Catui_dl"><dt>브랜드</dt><dd>${p.brand}</dd><dt>분류</dt><dd>${p.catName}</dd><dt>상품 번호</dt><dd>${p.id}</dd><dt>누적 판매</dt><dd>${catui.util.number(p.sold)}개</dd><dt>재고</dt><dd>${p.soldOut ? "품절" : `${catui.util.number(p.stockTotal)}개`}</dd></dl>`);
      this.reviews($("[data-reviews]"), p, d.R[p.id] || []);
      const rc = $("[data-rc]"); if (rc) catui.mount(rc, catui.html`${p.reviewCount}${shClip("개")}`);
      this.qna($("[data-qna]"), p, qna.filter((q) => q.product === p.id));
    }).catch(() => {});
  },
  reviews(box, p, list) {
    if (!box) return;
    const st = { sort: "new", photo: false, shown: 5, helped: new Set(shGet("helped", [])) };
    const dist = p.ratingDist || [0, 0, 0, 0, 0];
    const draw = () => {
      let rows = list.filter((r) => !st.photo || r.photo);
      rows = [...rows].sort({ new: (a, b) => (a.time < b.time ? 1 : -1), help: (a, b) => b.helpful - a.helpful, high: (a, b) => b.rating - a.rating, low: (a, b) => a.rating - b.rating }[st.sort]);
      catui.mount(box, catui.html`
        <div class="Catui_sh-rv-sum">
          <div class="Catui_sh-rv-avg"><b class="Catui_num">${p.rating ? p.rating.toFixed(1) : "-"}</b>${shop.stars(p.rating, { size: 18 })}<span class="Catui_help">리뷰 ${list.length}개</span></div>
          <ul class="Catui_sh-rv-dist" aria-label="별점 분포">${[5, 4, 3, 2, 1].map((s, i) => { const pct = list.length ? Math.round((dist[i] / list.length) * 100) : 0; return catui.html`<li><span>${s}점</span><span class="Catui_sh-rv-bar" role="img" aria-label="${s}점 ${dist[i]}개, ${pct}퍼센트"><i style="width:${pct}%"></i></span><span class="Catui_num">${dist[i]}</span></li>`; })}</ul>
          <a class="Catui_btn Catui_btn-md Catui_btn-secondary" href="review-write.html?id=${p.id}">${catui.icon("pen-line", 16)}리뷰 쓰기</a>
        </div>
        <div class="Catui_sh-toolbar">
          <div class="Catui_segment" role="group" aria-label="리뷰 정렬">${Object.entries(SH_RV_SORT).map(([k, v]) => catui.html`<button type="button" data-rsort="${k}" aria-pressed="${st.sort === k}">${v}</button>`)}</div>
          <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-photo aria-pressed="${st.photo}">${catui.icon("image", 16)}사진 리뷰만</button>
        </div>
        ${rows.length ? catui.html`<ul class="Catui_sh-reviews">${rows.slice(0, st.shown).map((r) => { const mine = st.helped.has(r.id); return catui.html`<li class="Catui_sh-review">
          <div class="Catui_sh-review-head">${shop.stars(r.rating)}<b>${r.user}</b><time datetime="${r.time}">${shop.date(r.time)}</time>${r.photo ? catui.html`<span class="Catui_badge Catui_badge-info">포토</span>` : ""}</div>
          ${r.opt ? catui.html`<p class="Catui_help">옵션: ${r.opt}</p>` : ""}
          ${r.photo ? catui.html`<img class="Catui_sh-review-img" src="${shop.thumb(p, 3)}" alt="${r.user}님이 올린 사진" width="96" height="96" loading="lazy">` : ""}
          <p>${r.text}</p>
          <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-help="${r.id}" aria-pressed="${mine}">${catui.icon("thumbs-up", 16)}도움돼요 <span class="Catui_num">${r.helpful + (mine ? 1 : 0)}</span></button>
        </li>`; })}</ul>
        ${rows.length > st.shown ? catui.html`<button class="Catui_btn Catui_btn-md Catui_btn-secondary Catui_btn-block" type="button" data-more>리뷰 더 보기 (${rows.length - st.shown}개 남음)</button>` : ""}` : catui.html`${shop.empty(st.photo ? "사진 리뷰가 없습니다" : "아직 리뷰가 없습니다", "첫 리뷰를 남겨 주세요.")}`}`);
    };
    shop._on(box, "click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      let fk = "";
      if (b.dataset.rsort) { st.sort = b.dataset.rsort; fk = `[data-rsort="${st.sort}"]`; }
      else if (b.hasAttribute("data-photo")) { st.photo = !st.photo; st.shown = 5; fk = "[data-photo]"; }
      else if (b.hasAttribute("data-more")) { st.shown += 5; fk = `.Catui_sh-review:nth-child(${st.shown - 4}) button`; }
      else if (b.dataset.help) { const k = b.dataset.help; if (st.helped.has(k)) st.helped.delete(k); else st.helped.add(k); shSet("helped", [...st.helped]); fk = `[data-help="${k}"]`; }
      else return;
      draw();
      box.querySelector(fk)?.focus();
    });
    draw();
  },
  qna(box, p, list) {
    if (!box) return;
    const rows = [...list];
    const qc = box.closest("[data-catui-sh-product]")?.querySelector("[data-qc]");
    const draw = () => {
      if (qc) catui.mount(qc, catui.html`${rows.length}${shClip("개")}`);
      catui.mount(box, catui.html`
        <details class="Catui_sh-ask"><summary class="Catui_btn Catui_btn-md Catui_btn-secondary">${catui.icon("message-circle", 16)}상품 문의하기</summary>
          <form class="Catui_vstack Catui_gap-3" data-ask><label class="Catui_label" for="pd-ask-q">문의 내용</label><textarea class="Catui_input" id="pd-ask-q" name="q" rows="3" maxlength="300" required placeholder="사이즈·재입고·배송 등 궁금한 점을 적어 주세요"></textarea>
            <label class="Catui_choice" for="pd-ask-s"><input class="Catui_clip" type="checkbox" id="pd-ask-s" name="secret"><span class="Catui_cbx">${catui.icon("check", 12)}</span>비밀글로 쓰기</label>
            <div class="Catui_actions"><button class="Catui_btn Catui_btn-md Catui_btn-primary" type="submit">문의 등록</button></div></form></details>
        ${rows.length ? catui.html`<ul class="Catui_sh-qna">${rows.map((q) => catui.html`<li><details><summary><span class="Catui_pill ${q.a ? "Catui_pill-success" : "Catui_pill-neutral"}">${q.a ? "답변 완료" : "답변 대기"}</span><span class="Catui_sh-qna-q">${q.secret ? catui.html`${catui.icon("lock", 12)}비밀글입니다` : q.q}</span><span class="Catui_help">${q.user} · ${shop.date(q.time)}</span></summary>
          <div class="Catui_sh-qna-a">${q.secret ? catui.html`<p class="Catui_help">작성자와 판매자만 볼 수 있습니다.</p>` : q.a ? catui.html`<p><b>판매자 답변</b> ${q.a}</p>` : catui.html`<p class="Catui_help">답변을 준비하고 있습니다.</p>`}</div></details></li>`)}</ul>` : shop.empty("등록된 문의가 없습니다")}`);
    };
    shop._on(box, "submit", (e) => {
      const f = e.target.closest("form[data-ask]"); if (!f) return;
      e.preventDefault();
      const t = f.elements.q.value.trim();
      if (!t) { f.elements.q.focus(); return; }
      rows.unshift({ id: `q${Date.now()}`, product: p.id, user: "나", time: shop.now().toISOString(), q: t, a: "", secret: f.elements.secret.checked });
      draw();
      catui.layer.msg("문의를 등록했습니다", { icon: "success", time: 1200 });
      box.querySelector(".Catui_sh-qna summary")?.focus();
    });
    draw();
  },
};

// ── cartview.js ──
// cartview — 장바구니 화면 (cart.html)
//   <section data-catui-sh-cart> 안의 자리: [data-lines] [data-sum]
//   · 전체 선택(선택 수/전체 수) · 선택 삭제 · 줄마다 선택·수량(1~재고)·삭제 · 품절 줄은 선택 불가 + "품절" 글자
//   · 무료배송까지 남은 금액(막대 + 글자) · 합계는 선택한 줄만 (shop.calc.cart)
//   · 다시 그려도 포커스는 같은 줄의 같은 칸으로
shop.cartView = {
  init(root) { root.querySelectorAll("[data-catui-sh-cart]").forEach((b) => this.mount(b)); },
  mount(box) {
    if (!shop._once(box, "cart")) return;
    shop.load().then((d) => {
      const linesBox = box.querySelector("[data-lines]"), sumBox = box.querySelector("[data-sum]");
      const draw = () => {
        const fk = document.activeElement && box.contains(document.activeElement) ? document.activeElement.closest("[data-fk]")?.dataset.fk : "";
        const s = shop.cart.summary(d.byId), all = s.lines, can = all.filter((l) => !l.soldOut);
        const allOn = can.length > 0 && can.every((l) => l.on !== false);
        if (!all.length) {
          catui.mount(linesBox, shop.empty("장바구니가 비어 있습니다", "마음에 드는 상품을 담아 보세요.", catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="index.html">쇼핑하러 가기</a>`));
        } else {
          catui.mount(linesBox, catui.html`
            <div class="Catui_sh-cart-bar">
              <label class="Catui_choice" for="sh-cart-all"><input class="Catui_clip" type="checkbox" id="sh-cart-all" data-all data-fk="all"${allOn ? catui.html` checked` : ""}${can.length ? "" : catui.html` disabled`}><span class="Catui_cbx">${catui.icon("check", 12)}</span>전체 선택 <span class="Catui_num">(${s.count}/${all.length})</span></label>
              <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-del-sel data-fk="delsel"${s.count ? "" : catui.html` disabled`}>선택 삭제</button>
              ${all.some((l) => l.soldOut) ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-del-out data-fk="delout">품절 상품 삭제</button>` : ""}
            </div>
            <ul class="Catui_sh-cart" aria-label="담은 상품">${all.map((l, i) => l.missing ? catui.html`<li class="Catui_sh-line Catui_sh-line-out"><span class="Catui_help">판매가 끝난 상품입니다</span><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-del="${l.key}" data-fk="del:${l.key}">삭제</button></li>` : catui.html`<li class="Catui_sh-line${l.soldOut ? " Catui_sh-line-out" : ""}">
              <label class="Catui_choice Catui_sh-line-check" for="sh-cl-${i}"><input class="Catui_clip" type="checkbox" id="sh-cl-${i}" data-on="${l.key}" data-fk="on:${l.key}"${l.on !== false && !l.soldOut ? catui.html` checked` : ""}${l.soldOut ? catui.html` disabled` : ""}><span class="Catui_cbx">${catui.icon("check", 12)}</span><span class="Catui_clip">${l.product.name} 선택</span></label>
              <a class="Catui_sh-line-img" href="product.html?id=${l.id}" tabindex="-1" aria-hidden="true"><img src="${shop.thumb(l.product)}" alt="" width="96" height="96" loading="lazy"></a>
              <div class="Catui_sh-line-main">
                <a class="Catui_sh-line-name" href="product.html?id=${l.id}">${l.product.name}</a>
                ${l.opt ? catui.html`<p class="Catui_help">옵션: ${l.opt}</p>` : ""}
                <p class="Catui_sh-line-unit">${l.rate ? catui.html`<del>${shClip("정가 ")}${shop.won(l.unitList)}</del> ` : ""}${shop.won(l.unit)}</p>
                ${l.soldOut ? catui.html`<p class="Catui_sh-out">${catui.icon("alert-circle", 12)}품절 — 결제할 수 없습니다</p>` : l.over ? catui.html`<p class="Catui_sh-low">${catui.icon("alert-triangle", 12)}재고 ${l.stock}개 — 수량을 줄여 주세요</p>` : ""}
              </div>
              <div class="Catui_stepper Catui_sh-qty" role="group" aria-label="${l.product.name} 수량"><button type="button" data-step="-1" data-k="${l.key}" data-fk="q:${l.key}:-1" aria-label="수량 줄이기"${l.qty <= 1 || l.soldOut ? catui.html` disabled` : ""}>${catui.icon("minus", 16)}</button><output aria-live="polite">${l.qty}</output><button type="button" data-step="1" data-k="${l.key}" data-fk="q:${l.key}:1" aria-label="수량 늘리기"${l.qty >= l.stock || l.soldOut ? catui.html` disabled` : ""}>${catui.icon("plus", 16)}</button></div>
              <b class="Catui_sh-line-amt">${shClip("금액 ")}${shop.won(l.amount)}</b>
              <button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon Catui_sh-line-del" type="button" data-del="${l.key}" data-fk="del:${l.key}" aria-label="${l.product.name} 삭제">${catui.icon("x", 16)}</button>
            </li>`)}</ul>`);
        }
        const pct = s.subtotal ? Math.min(100, Math.round((s.subtotal / shop.rules.freeOver) * 100)) : 0;
        catui.mount(sumBox, catui.html`<h2 class="Catui_h3">결제 예정 금액</h2>
          ${s.freeLeft ? catui.html`<div class="Catui_sh-free"><p>${catui.icon("truck", 16)}<span><b>${shop.won(s.freeLeft)}</b> 더 담으면 무료배송</span></p><div class="Catui_prog Catui_prog-sm" role="progressbar" aria-label="무료배송 기준까지" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i class="Catui_pc1" style="width:${pct}%"></i></div></div>` : s.count ? catui.html`<p class="Catui_sh-free">${catui.icon("truck", 16)}<span>무료배송</span></p>` : ""}
          <dl class="Catui_sh-sum">
            <div><dt>상품 금액</dt><dd>${shop.won(s.listTotal)}</dd></div>
            <div><dt>상품 할인</dt><dd>${s.discount ? `−${shop.won(s.discount)}` : "0원"}</dd></div>
            <div><dt>배송비</dt><dd>${s.ship ? `+${shop.won(s.ship)}` : "무료"}</dd></div>
            <div class="Catui_sh-sum-total"><dt>결제 예정</dt><dd data-cart-total>${shop.won(s.total)}</dd></div>
          </dl>
          <a class="Catui_btn Catui_btn-lg Catui_btn-primary Catui_btn-block${s.count ? "" : " Catui_sh-off"}" href="checkout.html"${s.count ? "" : catui.html` aria-disabled="true" tabindex="-1"`} data-go>${s.count ? `${s.qty}개 주문하기` : "상품을 골라 주세요"}</a>
          <p class="Catui_help">${shop.won(shop.rules.freeOver)} 이상 무료배송 · 제주·도서 산간 추가 배송비는 주문서에서 안내합니다.</p>`);
        if (fk) {
          let el = box.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
          if (!el || el.disabled) el = el?.parentElement.querySelector("button:not(:disabled)") || box.querySelector("[data-all]") || box.querySelector("h1");
          el?.focus();
        }
      };
      shop._on(box, "change", (e) => {
        const i = e.target;
        if (i.hasAttribute("data-all")) shop.cart.selectAll(i.checked);
        else if (i.dataset.on) shop.cart.select(i.dataset.on, i.checked);
      });
      shop._on(box, "click", (e) => {
        const g = e.target.closest("[data-go][aria-disabled]");
        if (g) { e.preventDefault(); return; }
        const b = e.target.closest("button"); if (!b || b.disabled) return;
        const lines = shop.cart.list();
        if (b.dataset.step) {
          const l = lines.find((x) => x.key === b.dataset.k), p = d.byId[l.id];
          shop.cart.setQty(l.key, l.qty + Number(b.dataset.step), p ? shop.stock(p, l.color, l.size) : shop.rules.maxQty);
        } else if (b.dataset.del) {
          shop.cart.remove(b.dataset.del); catui.layer.msg("삭제했습니다", { time: 1000 });
        } else if (b.hasAttribute("data-del-sel")) {
          const keys = shop.cart.summary(d.byId).selected.map((l) => l.key);
          catui.layer.confirm(`고른 상품 ${keys.length}개를 삭제할까요?`, { title: "선택 삭제", okText: "삭제" }, (i) => { catui.layer.close(i); shop.cart.remove(keys); });
        } else if (b.hasAttribute("data-del-out")) {
          shop.cart.remove(shop.cart.summary(d.byId).lines.filter((l) => l.soldOut).map((l) => l.key));
        }
      });
      // 장바구니가 바뀌면(이 화면·다른 탭·담기 버튼) 다시 그린다
      shop._offs.push(shop.on("cart", () => draw()));
      shop._on(window, "storage", (e) => { if (e.key === `catui:${SH_STORE}`) draw(); });
      draw();
    }).catch(() => {});
  },
};

// ── checkout.js ──
// checkout — 주문서 (checkout.html) · 주문 완료 (complete.html)
//   <form data-catui-sh-checkout> 안의 자리: [data-items] [data-n] [data-addr] select[name=memo] [data-memo-etc] select[name=coupon]
//     input[name=points] [data-all-points] [data-point-note] [data-have] input[name=pay] [data-pay-detail="card|bank"]
//     [data-agree-all] [data-agree](required면 필수) [data-total]
//   · 상품: ?from=now 이면 "바로 구매" 줄, 아니면 장바구니에서 고른 줄
//   · 쿠폰: 쓸 수 없는 쿠폰은 고를 수 없게 + 이유 글자, 처음에는 가장 큰 할인 쿠폰을 골라 둔다
//   · 적립금: 입력 중에는 합계만 다시 계산하고, 칸을 떠날 때 실제 쓸 금액(1,000원 이상·10원 단위·최대치)으로 맞춘다
//   · 최종 금액 = 상품 판매가 합 − 쿠폰 − 적립금 + 배송비 (shop.calc.order)
//   · 결제: 필수 약관을 확인하고 주문을 기억(lastOrder·orders) → 산 줄은 장바구니에서 빼고 complete.html?id= 로
shop.checkout = {
  init(root) { root.querySelectorAll("form[data-catui-sh-checkout]").forEach((f) => this.mount(f)); },
  /** 지금 주문할 줄 */
  source() {
    const now = shop.query().get("from") === "now" ? shGet("now", null) : null;
    return now?.length ? { from: "now", lines: now } : { from: "cart", lines: shop.cart.list().filter((l) => l.on !== false) };
  },
  mount(f) {
    if (!shop._once(f, "checkout")) return;
    shop.load().then((d) => {
      const src = this.source(), s = shop.calc.cart(src.lines, d.byId);
      // 빈 주문서: 칸은 지우지 않고 숨긴다(장바구니를 채운 뒤 init()을 다시 부르면 그대로 쓴다)
      f.querySelector(":scope > [data-empty]")?.remove();
      [...f.children].forEach((el) => { el.hidden = !s.count; });
      if (!s.count) {
        const box = document.createElement("div");
        box.setAttribute("data-empty", "");
        box.className = "Catui_sh-box";
        catui.mount(box, shop.empty("주문할 상품이 없습니다", "장바구니에서 상품을 골라 주세요.", catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="cart.html">장바구니로</a>`));
        f.appendChild(box);
        return;
      }
      const $ = (sel) => f.querySelector(sel), have = d.user.points;
      const n = $("[data-n]"); if (n) catui.mount(n, catui.html`${s.qty}${shClip("개")}`);
      catui.mount($("[data-items]"), catui.html`${s.selected.map((l) => catui.html`<li class="Catui_sh-co-item"><img src="${shop.thumb(l.product)}" alt="" width="64" height="64"><div><b>${l.product.name}</b>${l.opt ? catui.html`<p class="Catui_help">${l.opt}</p>` : ""}<p class="Catui_help">${shop.won(l.unit)} × ${l.qty}개</p></div><b class="Catui_num">${shop.won(l.amount)}</b></li>`)}`);
      const addrs = d.user.addresses || [];
      catui.mount($("[data-addr]"), catui.html`<legend class="Catui_label">배송지</legend>${addrs.map((a, i) => catui.html`<input class="Catui_clip" type="radio" name="addr" value="${a.id}" id="co-addr-${i}"${a.default ? catui.html` checked` : ""}><label class="Catui_optcard" for="co-addr-${i}"><span class="Catui_optcard-title">${a.label}${a.default ? catui.html` <span class="Catui_badge Catui_badge-neutral">기본</span>` : ""}</span><span class="Catui_optcard-text">${a.name} · ${a.phone}</span><span class="Catui_optcard-text">(${a.zip}) ${a.addr1} ${a.addr2}</span></label>`)}`);
      const items = s.selected.map((l) => ({ cat: l.product.cat, amount: l.amount }));
      const live = d.coupons.filter((c) => !c.expired && !c.used);
      const best = shop.coupon.best(live, { items, ship: s.ship });
      const sel = f.elements.coupon;
      sel.replaceChildren(new Option("쿠폰 선택 안 함", ""), ...live.map((c) => {
        const r = shop.coupon.apply(c, { items, ship: s.ship });
        const o = new Option(`${c.name} · ${shop.coupon.label(c)}${r.ok ? ` → −${shop.won(r.amount)}` : ` (사용 불가: ${r.reason})`}`, c.id, false, c === best);
        o.disabled = !r.ok;
        return o;
      }));
      const hv = $("[data-have]"); if (hv) hv.textContent = shop.won(have);
      const pts = f.elements.points;
      const calc = () => shop.calc.order({ cart: s, coupon: live.find((c) => c.id === sel.value) || null, points: pts.value.replace(/[^\d]/g, ""), have });
      const paint = () => {
        const o = calc();
        $("[data-point-note]").textContent = o.pointNote || `보유 ${shop.won(have)} · 최대 ${shop.won(o.maxPoints)} 사용 가능 (${catui.util.number(shop.rules.pointMin)}원 이상, ${shop.rules.pointUnit}원 단위)`;
        catui.mount($("[data-total]"), catui.html`<h2 class="Catui_h3" id="co-total-h">결제 금액</h2>
          <dl class="Catui_sh-sum">
            <div><dt>상품 금액</dt><dd>${shop.won(o.listTotal)}</dd></div>
            <div><dt>상품 할인</dt><dd>${o.discount ? `−${shop.won(o.discount)}` : "0원"}</dd></div>
            <div><dt>쿠폰 할인</dt><dd>${o.coupon ? `−${shop.won(o.coupon)}` : "0원"}</dd></div>
            <div><dt>적립금 사용</dt><dd>${o.points ? `−${shop.won(o.points)}` : "0원"}</dd></div>
            <div><dt>배송비</dt><dd>${o.ship ? `+${shop.won(o.ship)}` : o.shipBase ? catui.html`<del>${shop.won(o.shipBase)}</del> 무료` : "무료"}</dd></div>
            <div class="Catui_sh-sum-total"><dt>최종 결제 금액</dt><dd data-final>${shop.won(o.total)}</dd></div>
          </dl>
          <p class="Catui_help">${catui.icon("coins", 12)} 구매 확정 시 ${shop.won(o.earn)} 적립 예정</p>
          <button class="Catui_btn Catui_btn-lg Catui_btn-primary Catui_btn-block" type="submit" data-pay-btn>${shop.won(o.total)} 결제하기</button>`);
        return o;
      };
      const payDetail = () => {
        const v = f.querySelector("input[name=pay]:checked")?.value;
        f.querySelectorAll("[data-pay-detail]").forEach((x) => { x.hidden = x.dataset.payDetail !== v; });
      };
      const agrees = () => [...f.querySelectorAll("[data-agree]")];
      const syncAll = () => { const a = $("[data-agree-all]"); if (a) a.checked = agrees().every((x) => x.checked); };
      shop._on(f, "input", (e) => { if (e.target === pts) paint(); });
      shop._on(f, "change", (e) => {
        const t = e.target;
        if (t === pts) { const o = calc(); pts.value = o.points ? String(o.points) : ""; paint(); }
        else if (t === sel) { paint(); }
        else if (t.name === "pay") payDetail();
        else if (t.name === "memo") { const etc = $("[data-memo-etc]"); etc.hidden = t.value !== "etc"; if (!etc.hidden) etc.querySelector("textarea")?.focus(); }
        else if (t.hasAttribute("data-agree-all")) { agrees().forEach((x) => { x.checked = t.checked; }); }
        else if (t.hasAttribute("data-agree")) syncAll();
      });
      shop._on(f, "click", (e) => {
        if (e.target.closest("[data-all-points]")) { const o = shop.calc.order({ cart: s, coupon: live.find((c) => c.id === sel.value) || null, points: have, have }); pts.value = o.points ? String(o.points) : ""; paint(); pts.focus(); }
      });
      shop._on(f, "submit", (e) => {
        e.preventDefault();
        const miss = agrees().find((x) => x.required && !x.checked);
        if (miss) { catui.layer.msg("필수 약관에 동의해 주세요", { icon: "warn" }); miss.focus(); return; }
        const pay = f.querySelector("input[name=pay]:checked");
        if (!pay) { catui.layer.msg("결제 수단을 골라 주세요", { icon: "warn" }); f.querySelector("input[name=pay]")?.focus(); return; }
        const addr = addrs.find((a) => a.id === f.querySelector("input[name=addr]:checked")?.value) || addrs[0];
        const o = calc(), now = shop.now();
        const order = {
          id: `${catui.util.toDateString(now, "yyyyMMdd")}-${String(Math.floor(Math.random() * 9000) + 1000)}`, date: now.toISOString(), status: "paid",
          pay: f.querySelector(`label[for="${CSS.escape(pay.id)}"] .Catui_optcard-title`)?.textContent.trim() || pay.value,
          items: s.selected.map((l) => ({ product: l.id, opt: l.opt, qty: l.qty, price: l.unit })),
          ship: o.ship, coupon: o.coupon, points: o.points, total: o.total, earn: o.earn,
          addr: addr ? `(${addr.zip}) ${addr.addr1} ${addr.addr2}` : "", to: addr ? `${addr.name} · ${addr.phone}` : "",
          memo: f.elements.memo.value === "etc" ? (f.elements.memoText?.value || "").trim() : f.elements.memo.selectedOptions[0]?.textContent || "",
          steps: [{ time: now.toISOString(), text: "결제 완료" }],
        };
        const btn = $("[data-pay-btn]"); btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = "결제하는 중…";
        shSet("lastOrder", order);
        shSet("orders", [order, ...(shGet("orders", []) || [])].slice(0, 30));
        if (src.from === "now") shSet("now", null); else shop.cart.remove(s.selected.map((l) => l.key));
        shop.emit("order", { order });
        setTimeout(() => { location.href = `complete.html?id=${encodeURIComponent(order.id)}`; }, 500);
      });
      payDetail(); syncAll(); paint();
    }).catch(() => {});
  },
};

// 주문 합계(원자료에서): 상품 판매가 × 수량 합 + 배송비 − 쿠폰 − 적립금
shop.orderTotal = (o) => (o.items || []).reduce((a, it) => a + it.price * it.qty, 0) + Number(o.ship || 0) - Number(o.coupon || 0) - Number(o.points || 0);
// 주문 목록: 이 브라우저에서 한 주문(기억) + 모의 주문(orders.json)
shop.orders = function () {
  return shop.data("orders").then((list) => [...(shGet("orders", []) || []), ...list].map((o) => ({ ...o, total: shop.orderTotal(o) })));
};
shop.complete = {
  init(root) { root.querySelectorAll("[data-catui-sh-complete]").forEach((b) => this.mount(b)); },
  mount(box) {
    if (!shop._once(box, "complete")) return;
    const id = shop.query().get("id");
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const o = orders.find((x) => x.id === id) || shGet("lastOrder", null) || orders[0];
      if (!o) return;
      const $ = (s) => box.querySelector(s);
      $("[data-order-no]").textContent = o.id;
      catui.mount($("[data-order-sum]"), catui.html`
        <div><dt>결제 금액</dt><dd><b>${shop.won(shop.orderTotal(o))}</b></dd></div>
        <div><dt>결제 수단</dt><dd>${o.pay || "-"}</dd></div>
        <div><dt>받는 분</dt><dd>${o.to || `${d.user.name} · ${d.user.phone}`}</dd></div>
        <div><dt>배송지</dt><dd>${o.addr || `${d.user.addresses?.[0]?.addr1 || ""} ${d.user.addresses?.[0]?.addr2 || ""}`}</dd></div>
        ${o.memo ? catui.html`<div><dt>요청 사항</dt><dd>${o.memo}</dd></div>` : ""}
        <div><dt>도착 예정</dt><dd>${shop.product.eta({ ship: (o.items || []).every((it) => d.byId[it.product]?.ship === "today") ? "today" : "" }, new Date(o.date))}</dd></div>
        ${o.earn ? catui.html`<div><dt>적립 예정</dt><dd>${shop.won(o.earn)}</dd></div>` : ""}`);
      catui.mount($("[data-order-items]"), catui.html`${(o.items || []).map((it) => { const p = d.byId[it.product]; return catui.html`<li class="Catui_sh-co-item">${p ? catui.html`<img src="${shop.thumb(p)}" alt="" width="64" height="64">` : ""}<div><b>${p?.name || "판매 종료 상품"}</b>${it.opt ? catui.html`<p class="Catui_help">${it.opt}</p>` : ""}<p class="Catui_help">${shop.won(it.price)} × ${it.qty}개</p></div><b class="Catui_num">${shop.won(it.price * it.qty)}</b></li>`; })}`);
      const track = $("[data-track-link]"); if (track) track.href = `order-track.html?id=${encodeURIComponent(o.id)}`;
    }).catch(() => {});
  },
};

// ── mypage.js ──
// mypage — 마이페이지 · 주문 내역 · 배송 조회 · 찜 · 최근 본 상품 · 쿠폰/적립금 · 회원 정보 · 리뷰 쓰기
//   [data-catui-sh-my]        요약: 적립금 · 쓸 수 있는 쿠폰 · 찜 수 · 주문 단계별 건수 · 최근 주문
//   [data-catui-sh-orders]    주문 내역: 상태·기간 거르기, 배송 조회·리뷰 쓰기·주문 취소(결제 완료만)
//   [data-catui-sh-track]     배송 조회: 단계(결제 완료 → 상품 준비 → 배송 중 → 배송 완료) + 택배 이동 기록
//   [data-catui-sh-wishlist]  찜 · [data-catui-sh-recent] 최근 본 상품(빼기·모두 지우기)
//   [data-catui-sh-coupons]   쿠폰(사용 가능·만료, 쿠폰 번호 등록) · [data-catui-sh-points] 적립금 잔액·내역
//   form[data-catui-sh-profile] 회원 정보 · form[data-catui-sh-review] 리뷰 쓰기(별점 필수, 10자 이상)
shop.status = {
  paid: { label: "결제 완료", step: 1, pill: "info" },
  ready: { label: "상품 준비 중", step: 2, pill: "warning" },
  shipping: { label: "배송 중", step: 3, pill: "info" },
  done: { label: "배송 완료", step: 4, pill: "success" },
  cancel: { label: "주문 취소", step: 0, pill: "neutral" },
};
const SH_STEPS = ["결제 완료", "상품 준비", "배송 중", "배송 완료"];
shop.statusPill = (s) => { const v = shop.status[s] || { label: s, pill: "neutral" }; return catui.html`<span class="Catui_pill Catui_pill-${v.pill}">${v.label}</span>`; };
/** 단계 표시 <ol class="Catui_steps"> — 완료는 체크 + 숨김 글자 "완료", 현재는 aria-current="step" */
shop.steps = function (status) {
  const at = shop.status[status]?.step || 0;
  return catui.html`<ol class="Catui_steps Catui_sh-steps" aria-label="배송 단계">${SH_STEPS.map((t, i) => {
    const n = i + 1, done = n < at || (n === at && n === 4), cur = n === at && n !== 4;
    return catui.html`${i ? catui.html`<li class="Catui_step-line${n <= at ? " Catui_step-line-done" : ""}" aria-hidden="true"></li>` : ""}<li class="Catui_step${done ? " Catui_step-done" : cur ? " Catui_step-current" : ""}"${cur ? catui.html` aria-current="step"` : ""}><span class="Catui_step-dot">${done ? catui.icon("check", 16) : n}</span><span class="Catui_step-label">${t}${done ? shClip(" 완료") : ""}</span></li>`;
  })}</ol>`;
};
shop.my = {
  init(root) {
    const map = { "[data-catui-sh-my]": "summary", "[data-catui-sh-orders]": "orders", "[data-catui-sh-track]": "track", "[data-catui-sh-wishlist]": "wishlist", "[data-catui-sh-recent]": "recentList", "[data-catui-sh-coupons]": "coupons", "[data-catui-sh-points]": "points", "form[data-catui-sh-profile]": "profile", "form[data-catui-sh-review]": "review" };
    for (const [sel, fn] of Object.entries(map)) root.querySelectorAll(sel).forEach((b) => { if (shop._once(b, fn)) this[fn](b); });
  },
  orderCard(o, d) {
    const first = d.byId[o.items[0]?.product], more = o.items.length - 1, st = shop.status[o.status] || {};
    return catui.html`<li class="Catui_sh-order">
      <div class="Catui_sh-order-head"><b>${shop.date(o.date)}</b><span class="Catui_help">주문 번호 ${o.id}</span>${shop.statusPill(o.status)}</div>
      <ul class="Catui_sh-order-items">${o.items.map((it) => { const p = d.byId[it.product]; return catui.html`<li class="Catui_sh-co-item">${p ? catui.html`<img src="${shop.thumb(p)}" alt="" width="64" height="64">` : ""}<div>${p ? catui.html`<a href="product.html?id=${p.id}">${p.name}</a>` : catui.html`<b>판매 종료 상품</b>`}${it.opt ? catui.html`<p class="Catui_help">${it.opt}</p>` : ""}<p class="Catui_help">${shop.won(it.price)} × ${it.qty}개</p></div>${o.status === "done" && p ? catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="review-write.html?id=${p.id}&amp;o=${o.id}">리뷰 쓰기</a>` : ""}</li>`; })}</ul>
      <div class="Catui_sh-order-foot"><span>결제 <b>${shop.won(o.total)}</b>${first && more > 0 ? catui.html` <span class="Catui_help">(${first.name} 외 ${more}건)</span>` : ""}</span>
        <div class="Catui_actions">${st.step >= 1 ? catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="order-track.html?id=${o.id}">${catui.icon("truck", 16)}배송 조회</a>` : ""}${o.status === "paid" ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-cancel="${o.id}">주문 취소</button>` : ""}</div></div>
    </li>`;
  },
  summary(box) {
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const set = (k, v) => box.querySelectorAll(`[data-my="${k}"]`).forEach((el) => catui.mount(el, v));
      set("name", catui.html`${d.user.name}`);
      set("grade", catui.html`${d.user.grade}`);
      set("points", catui.html`${shop.won(d.user.points)}`);
      set("coupons", catui.html`${d.usable.length}${shClip("장")}`);
      set("wish", catui.html`${shop.wish.list().length}${shClip("개")}`);
      const live = orders.filter((o) => o.status !== "cancel" && new Date(o.date) > shop.now() - 30 * 864e5);
      set("flow", catui.html`${["paid", "ready", "shipping", "done"].map((k) => catui.html`<li><b class="Catui_num">${live.filter((o) => o.status === k).length}</b><span>${shop.status[k].label}</span></li>`)}`);
      set("recent-orders", catui.html`${orders.slice(0, 2).map((o) => this.orderCard(o, d))}`);
    }).catch(() => {});
  },
  orders(box) {
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const st = { kind: "all", months: "3" };
      const list = box.querySelector("[data-list]"), count = box.querySelector("[data-count]");
      const draw = () => {
        const since = st.months === "all" ? 0 : shop.now() - Number(st.months) * 30 * 864e5;
        const rows = orders.filter((o) => new Date(o.date) >= since && (st.kind === "all" || (st.kind === "live" ? ["paid", "ready", "shipping"].includes(o.status) : o.status === st.kind)));
        if (count) count.textContent = `주문 ${rows.length}건`;
        catui.mount(list, rows.length ? catui.html`${rows.map((o) => this.orderCard(o, d))}` : catui.html`<li>${shop.empty("해당하는 주문이 없습니다", "기간이나 상태를 바꿔 보세요.")}</li>`);
        box.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === st.kind)));
      };
      shop._on(box, "click", (e) => {
        const k = e.target.closest("[data-kind]");
        if (k) { st.kind = k.dataset.kind; draw(); return; }
        const c = e.target.closest("[data-cancel]");
        if (c) catui.layer.confirm(`주문 ${c.dataset.cancel}을 취소할까요? 결제 금액은 3영업일 안에 돌려드립니다.`, { title: "주문 취소", okText: "주문 취소" }, (i) => {
          catui.layer.close(i);
          const o = orders.find((x) => x.id === c.dataset.cancel); o.status = "cancel";
          shSet("orders", (shGet("orders", []) || []).map((x) => (x.id === o.id ? { ...x, status: "cancel" } : x)));
          draw(); catui.layer.msg("주문을 취소했습니다", { icon: "success" });
          box.querySelector("[data-kind][aria-pressed=true]")?.focus();
        });
      });
      const per = box.querySelector("select[name=months]");
      if (per) shop._on(per, "change", () => { st.months = per.value; draw(); });
      draw();
    }).catch(() => {});
  },
  track(box) {
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const id = shop.query().get("id");
      const o = orders.find((x) => x.id === id) || orders.find((x) => x.status === "shipping") || orders[0];
      if (!o) return;
      const $ = (s) => box.querySelector(s);
      catui.mount($("[data-track-head]"), catui.html`<div class="Catui_sh-order-head"><b>주문 번호 ${o.id}</b>${shop.statusPill(o.status)}</div>
        <dl class="Catui_sh-sum"><div><dt>상품</dt><dd>${d.byId[o.items[0].product]?.name || "-"}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}</dd></div>
        <div><dt>택배사</dt><dd>${o.track?.company || "배정 전"}</dd></div><div><dt>운송장 번호</dt><dd>${o.track?.no || "-"}</dd></div></dl>`);
      catui.mount($("[data-track-steps]"), o.status === "cancel" ? catui.html`<p class="Catui_banner Catui_banner-warn">${catui.icon("alert-circle", 16)}<span>취소된 주문입니다.</span></p>` : shop.steps(o.status));
      catui.mount($("[data-track-log]"), catui.html`${[...(o.steps || [])].reverse().map((s, i) => catui.html`<li class="Catui_sh-log${i === 0 ? " Catui_sh-log-now" : ""}"><time datetime="${s.time}">${shop.date(s.time, "MM.dd HH:mm")}</time><b>${s.text}${i === 0 ? shClip(" (최근)") : ""}</b>${s.where ? catui.html`<span class="Catui_help">${s.where}</span>` : ""}</li>`)}`);
    }).catch(() => {});
  },
  grid(box, ids, d, { remove = false, empty }) {
    const list = box.querySelector("[data-list]"), count = box.querySelector("[data-count]");
    const rows = ids.map((id) => d.byId[id]).filter(Boolean);
    if (count) count.textContent = `${rows.length}개`;
    catui.mount(list, rows.length ? catui.html`${rows.map((p) => shop.card(p, { remove }))}` : catui.html`<li class="Catui_sh-wide">${empty}</li>`);
    shop.wishPaint(list);
  },
  wishlist(box) {
    shop.load().then((d) => {
      const draw = () => this.grid(box, shop.wish.list(), d, { empty: shop.empty("찜한 상품이 없습니다", "하트를 눌러 담아 두세요.", catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="list.html">상품 보러 가기</a>`) });
      shop._offs.push(shop.on("wish", () => setTimeout(draw, 0)));
      draw();
    }).catch(() => {});
  },
  recentList(box) {
    shop.load().then((d) => {
      const draw = () => this.grid(box, shop.recent.list(), d, { remove: true, empty: shop.empty("최근 본 상품이 없습니다") });
      shop._on(box, "click", (e) => {
        const r = e.target.closest("[data-catui-sh-remove]");
        if (r) { shop.recent.remove(r.dataset.catuiShRemove); draw(); box.querySelector("[data-list] button, [data-clear]")?.focus(); return; }
        if (e.target.closest("[data-clear]")) catui.layer.confirm("최근 본 상품을 모두 지울까요?", { title: "모두 지우기", okText: "지우기" }, (i) => { catui.layer.close(i); shop.recent.clear(); draw(); });
      });
      draw();
    }).catch(() => {});
  },
  coupons(box) {
    shop.load().then((d) => {
      const list = box.querySelector("[data-list]"), now = shop.now();
      const sorted = [...d.coupons].sort((a, b) => a.expired - b.expired || (a.expires < b.expires ? -1 : 1));
      const cnt = box.querySelector("[data-count]"); if (cnt) cnt.textContent = `쓸 수 있는 쿠폰 ${d.usable.length}장`;
      catui.mount(list, catui.html`${sorted.map((c) => { const days = Math.ceil((new Date(c.expires) - now) / 864e5); return catui.html`<li class="Catui_sh-coupon${c.expired ? " Catui_sh-coupon-off" : ""}">
        <b class="Catui_sh-coupon-v">${shop.coupon.label(c)}</b>
        <div><p class="Catui_sh-coupon-name">${c.name}</p><p class="Catui_help">${c.min ? `${shop.won(c.min)} 이상 구매 시` : "조건 없음"}${c.cats?.length ? ` · ${c.cats.map((k) => d.C[k]?.name || k).join("·")} 상품만` : ""}</p>
          <p class="Catui_help">${shop.date(c.expires)}까지${!c.expired && days <= 7 ? catui.html` · <b class="Catui_sh-low">${days}일 남음</b>` : ""}</p></div>
        ${c.expired ? catui.html`<span class="Catui_pill Catui_pill-neutral">기간 만료</span>` : catui.html`<span class="Catui_pill Catui_pill-success">사용 가능</span>`}
      </li>`; })}`);
      const f = box.querySelector("form[data-coupon-form]");
      if (f) shop._on(f, "submit", (e) => {
        e.preventDefault();
        const i = f.elements.code, v = i.value.trim().toUpperCase();
        const msg = f.querySelector("[data-msg]");
        msg.textContent = !v ? "쿠폰 번호를 넣어 주세요" : d.coupons.some((c) => c.id === v) ? "이미 받은 쿠폰입니다" : "없는 쿠폰 번호입니다. 대소문자·숫자를 확인해 주세요";
        i.setAttribute("aria-invalid", "true");
        i.focus();
      });
    }).catch(() => {});
  },
  points(box) {
    shop.load().then((d) => {
      const bal = box.querySelector("[data-balance]"); if (bal) bal.textContent = shop.won(d.user.points);
      catui.mount(box.querySelector("[data-list]"), catui.html`${(d.user.pointsLog || []).map((x) => catui.html`<tr><td>${shop.date(x.date)}</td><td>${x.text}</td><td class="Catui_text-right Catui_num">${x.amount > 0 ? "+" : "−"}${shop.won(Math.abs(x.amount))}${shClip(x.amount > 0 ? " 적립" : " 사용")}</td></tr>`)}`);
    }).catch(() => {});
  },
  profile(f) {
    shop.load().then((d) => {
      for (const k of ["name", "nick", "email", "phone"]) if (f.elements[k]) f.elements[k].value = d.user[k] || "";
      const since = f.querySelector("[data-joined]"); if (since) since.textContent = shop.date(d.user.joined);
      shop._on(f, "submit", (e) => {
        e.preventDefault();
        if (catui.form?.validate && !catui.form.validate(f)) return;
        catui.layer.msg("회원 정보를 저장했습니다", { icon: "success" });
      });
    }).catch(() => {});
  },
  review(f) {
    shop.load().then((d) => {
      const p = d.byId[shop.query().get("id") || "101"];
      const box = f.querySelector("[data-rv-product]");
      if (p && box) catui.mount(box, catui.html`<img src="${shop.thumb(p)}" alt="" width="64" height="64"><div><b>${p.name}</b><p class="Catui_help">${p.brand}</p></div>`);
      const file = f.querySelector("input[type=file]"), pics = f.querySelector("[data-pics]");
      if (file && pics) shop._on(file, "change", () => {
        [...file.files].slice(0, 5).forEach((fl) => {
          if (!fl.type.startsWith("image/")) return;
          const fig = document.createElement("figure"); fig.className = "Catui_sh-pic";
          const img = document.createElement("img"); img.src = URL.createObjectURL(fl); img.alt = fl.name;
          fig.append(img); pics.appendChild(fig);
        });
        file.value = "";
      });
      shop._on(f, "submit", (e) => {
        e.preventDefault();
        const rating = f.querySelector("input[name=rating]:checked"), text = f.elements.text.value.trim(), err = f.querySelector("[data-err]");
        const bad = !rating ? "별점을 골라 주세요" : text.length < 10 ? `리뷰를 10자 이상 적어 주세요 (지금 ${text.length}자)` : "";
        err.textContent = bad; err.hidden = !bad;
        if (bad) { (rating ? f.elements.text : f.querySelector("input[name=rating]")).focus(); return; }
        const r = { id: `my${Date.now()}`, product: p?.id, rating: Number(rating.value), text, time: shop.now().toISOString() };
        shSet("myReviews", [r, ...(shGet("myReviews", []) || [])]);
        shop.emit("review", { review: r });
        catui.layer.msg("리뷰를 등록했습니다. 적립금 500원이 곧 들어옵니다", { icon: "success" });
        setTimeout(() => { location.href = "orders.html"; }, 900);
      });
    }).catch(() => {});
  },
};

// ── init.js ──
// 초기화 — 테마는 어느 화면에서나, 셸·목록·상세·장바구니·주문서·마이페이지는 [data-catui-sh] 루트가 있을 때
//   모의 데이터의 "지금" 기준 시각: <html data-catui-sh-now="2026-11-02T10:00:00+09:00"> (없으면 실제 시각)
//   루트가 없는 화면(예: 문서)에서는 데이터를 읽지 않는다 — 순수 함수(price·calc·coupon)와 picker·card만 쓸 수 있다
shop.init = function (scope = document) {
  this.fixedNow = document.documentElement.getAttribute("data-catui-sh-now") || undefined;
  this._dead = false;
  this.theme.init();
  const root = scope.matches?.("[data-catui-sh]") ? scope : scope.querySelector?.("[data-catui-sh]");
  if (root && !root.hasAttribute("data-catui-sh-ready")) {
    root.setAttribute("data-catui-sh-ready", "");
    this.root = root;
    for (const part of ["shell", "cards", "list", "product", "cartView", "checkout", "complete", "my"]) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiShop: ${part} 연결 실패`, "error", err); }
    }
    this.ready = this.load().then(() => this, () => this);
  } else this.ready = Promise.resolve(this);
  return this;
};
shop.destroy = function () {
  this._dead = true;
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this._seen = new WeakMap();
  this.ready = undefined;
  this.root?.removeAttribute("data-catui-sh-ready");
  this.root = null;
};

catui.extend({ shop });
catui.use(() => { if (catui.config().autoInit !== false) shop.init(); });

export { shop };
export default shop;
