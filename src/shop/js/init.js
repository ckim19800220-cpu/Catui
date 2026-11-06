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
