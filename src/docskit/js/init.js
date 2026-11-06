// 초기화 — 테마는 어느 화면에서나, 셸·검색·블로그·변경 이력·피드백·버전은 [data-catui-dk] 루트가 있을 때
//   루트가 없는 화면(예: 문서)에서는 데이터를 읽지 않는다 — md·readTime·search.match 같은 순수 함수와 toc·code만 쓸 수 있다
docs.init = function (scope = document) {
  this._dead = false;
  this.theme.init();
  const root = scope.matches?.("[data-catui-dk]") ? scope : scope.querySelector?.("[data-catui-dk]");
  if (root && !root.hasAttribute("data-catui-dk-ready")) {
    root.setAttribute("data-catui-dk-ready", "");
    this.root = root;
    const parts = ["shell", "search", "feedback", "version", "blogList", "post", "tagPage", "authorPage", "recent", "changelog"];
    for (const part of parts) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiDocs: ${part} 연결 실패`, "error", err); }
    }
    // 모든 부품이 데이터를 다 그린 뒤 풀린다
    this.ready = Promise.all(parts.map((p) => this[p]?.ready)).then(() => this, () => this);
  } else this.ready = Promise.resolve(this);
  return this;
};
docs.destroy = function () {
  this._dead = true;
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this._seen = new WeakMap();
  this._tocs = [];
  this.ready = undefined;
  this.root?.removeAttribute("data-catui-dk-ready");
  this.root = null;
};

catui.extend({ docs });
catui.use(() => { if (catui.config().autoInit !== false) docs.init(); });
