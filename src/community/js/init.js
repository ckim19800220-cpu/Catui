// 초기화 — 테마는 어느 화면에서나, 셸·추천·댓글·글쓰기는 [data-catui-cm] 루트가 있을 때
//   모의 데이터의 "지금" 기준 시각: <html data-catui-cm-now="2026-11-02T10:00:00+09:00"> (없으면 실제 시각)
community.init = function (scope = document) {
  this.fixedNow = document.documentElement.getAttribute("data-catui-cm-now") || undefined;
  this._dead = false;
  this.theme.init();
  const root = scope.matches?.("[data-catui-cm]") ? scope : scope.querySelector?.("[data-catui-cm]");
  if (root && !root.hasAttribute("data-catui-cm-ready")) {
    root.setAttribute("data-catui-cm-ready", "");
    this.root = root;
    for (const part of ["shell", "list", "vote", "comments", "editor", "widgets"]) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiCommunity: ${part} 연결 실패`, "error", err); }
    }
  }
  this.ready = this.bind(root || document).then(() => this);
  return this;
};
community.destroy = function () {
  this._dead = true;
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this._seen = new WeakMap();
  this.ready = undefined;
  this.root?.removeAttribute("data-catui-cm-ready");
  this.root = null;
};

catui.extend({ community });
catui.use(() => { if (catui.config().autoInit !== false) community.init(); });
