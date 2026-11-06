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
