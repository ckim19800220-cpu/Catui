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
