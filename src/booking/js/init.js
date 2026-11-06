// 초기화 — 테마는 어느 화면에서나, 화면 부품은 [data-catui-bk] 루트가 있을 때
//   모의 데이터의 "지금" 기준 시각: <html data-catui-bk-now="2026-11-04T13:10:00+09:00"> (없으면 실제 시각)
//   루트가 없는 화면(예: 문서)에서는 데이터를 읽지 않는다 — slots·price·stay·refund·layout 같은 순수 함수와 seats.mount·calendar.mount만 쓸 수 있다
booking.init = function (scope = document) {
  this.fixedNow = document.documentElement.getAttribute("data-catui-bk-now") || undefined;
  this._dead = false;
  this.theme.init();
  const root = scope.matches?.("[data-catui-bk]") ? scope : scope.querySelector?.("[data-catui-bk]");
  if (root && !root.hasAttribute("data-catui-bk-ready")) {
    root.setAttribute("data-catui-bk-ready", "");
    this.root = root;
    const parts = ["shell", "home", "datePage", "peoplePage", "seatPage", "roomPage", "infoPage", "confirmPage", "completePage", "minePage", "detailPage", "waitPage", "adminPage"];
    for (const part of parts) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiBooking: ${part} 연결 실패`, "error", err); }
    }
    // 모든 부품이 데이터를 다 그린 뒤 풀린다
    this.ready = Promise.all(parts.map((p) => this[p]?.ready)).then(() => this, () => this);
  } else this.ready = Promise.resolve(this);
  return this;
};
booking.destroy = function () {
  this._dead = true;
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this._seen = new WeakMap();
  this.ready = undefined;
  for (const p of ["home", "datePage", "peoplePage", "seatPage", "roomPage", "infoPage", "confirmPage", "completePage", "minePage", "detailPage", "waitPage", "adminPage"]) if (this[p]) this[p].ready = undefined;
  this.root?.removeAttribute("data-catui-bk-ready");
  this.root = null;
};

catui.extend({ booking });
catui.use(() => { if (catui.config().autoInit !== false) booking.init(); });
