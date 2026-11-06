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
