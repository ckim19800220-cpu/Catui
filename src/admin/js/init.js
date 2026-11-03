// 초기화 — 테마는 어느 화면(로그인 등 셸 없는 화면 포함)에서나, 셸 기능은 [data-catui-adm] 루트가 있을 때만
admin.init = function (scope = document) {
  this.theme.init();
  const root = scope.matches?.("[data-catui-adm]") ? scope : scope.querySelector?.("[data-catui-adm]");
  if (root && !root.hasAttribute("data-catui-adm-ready")) {
    root.setAttribute("data-catui-adm-ready", "");
    this.root = root;
    for (const part of ["shell", "notify", "topbar"]) {
      try { this[part].init(root); } catch (err) { catui.hint.error(`CatuiAdmin: ${part} 연결 실패`, "error", err); }
    }
  }
  // JSON 모의 데이터([data-catui-adm-src])를 먼저 채운 뒤 위젯(차트·카운트업)을 연결한다
  const scope2 = root || document;
  this.ready = this.bind(scope2).then(() => {
    for (const part of ["widgets", "form", "auth"]) {
      try { this[part].init(scope2); } catch (err) { catui.hint.error(`CatuiAdmin: ${part} 연결 실패`, "error", err); }
    }
    return this;
  });
  return this;
};
// 모든 리스너·차트·팝업 정리 (SPA에서 화면을 바꿀 때)
admin.destroy = function () {
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this.widgets.destroy();
  this.form.destroy();
  this.root?.removeAttribute("data-catui-adm-ready");
  document.querySelectorAll("[data-catui-adm-ready]").forEach((n) => n.removeAttribute("data-catui-adm-ready"));
  this.root = null;
};

catui.extend({ admin });
catui.use(() => { if (catui.config().autoInit !== false) admin.init(); });
