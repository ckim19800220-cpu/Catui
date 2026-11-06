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
