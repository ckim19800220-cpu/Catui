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
  nav(root) {
    const nav = root.querySelector('.Catui_sh-gnb-in');
    if (!nav || !shop._once(nav, 'scroll-controls')) return;
    const buttons = [...root.querySelectorAll('[data-catui-sh-nav-step]')];
    const state = () => buttons.forEach((b) => { b.disabled = Number(b.dataset.catuiShNavStep) < 0 ? nav.scrollLeft <= 1 : nav.scrollLeft >= nav.scrollWidth - nav.clientWidth - 1; });
    const layout = () => {
      buttons.forEach((b) => { b.hidden = true; });
      const overflow = nav.scrollWidth > nav.clientWidth + 1;
      buttons.forEach((b) => { b.hidden = !overflow; });
      const active = nav.querySelector('[aria-current="page"]');
      if (active) {
        const outer = nav.getBoundingClientRect(), item = active.getBoundingClientRect();
        if (item.left < outer.left) nav.scrollLeft += item.left - outer.left;
        else if (item.right > outer.right) nav.scrollLeft += item.right - outer.right;
      }
      state();
    };
    buttons.forEach((b) => shop._on(b, 'click', () => nav.scrollBy({ left: Number(b.dataset.catuiShNavStep) * nav.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })));
    shop._on(nav, 'scroll', state, { passive: true });
    shop._on(window, 'resize', layout);
    layout();
  },
  init(root) {
    if (shop._once(root, "hero-error")) shop._on(root, "error", (e) => {
      if (e.target.matches?.(".Catui_sh-hero-img, .Catui_sh-promo-img")) e.target.hidden = true;
      else if (e.target.matches?.(".Catui_sh-card-img img, .Catui_sh-gallery-main img, .Catui_sh-thumbs img, .Catui_sh-review-img") && !e.target.src.startsWith("data:")) e.target.src = shop.thumb({ id: 0 }, 0, true);
    }, true);
    root.querySelectorAll(".Catui_sh-hero-img").forEach((img) => { if (img.complete && !img.naturalWidth) img.hidden = true; });
    root.querySelectorAll("form[data-catui-sh-search]").forEach((f) => shop._on(f, "submit", (e) => {
      const q = f.querySelector("input[name=q]");
      if (q && !q.value.trim()) { e.preventDefault(); q.focus(); }
    }));
    const q = shop.query().get("q");
    if (q) root.querySelectorAll("form[data-catui-sh-search] input[name=q]").forEach((i) => { i.value = q; });
    // 상단 분류 메뉴: 목록 화면은 주소의 ?c= 로 현재 위치를 다시 표시
    const c = shop.query().get("c");
    if (c) root.querySelectorAll(".Catui_sh-gnb .Catui_hnav-item").forEach((a) => { if (new URL(a.href, location.href).searchParams.get("c") === c) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    this.nav(root);
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
