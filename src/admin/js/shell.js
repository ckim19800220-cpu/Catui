// shell — 사이드바 접기(992px 이상, 기억) · 991px 이하 서랍(가림막·Esc·Tab 가두기·포커스 복귀) · 하위 메뉴 펼침 기억
admin.shell = {
  init(root) {
    const side = root.querySelector(".Catui_side");
    if (!side) return;
    const toggle = root.querySelector("[data-catui-adm-toggle]");
    const scrim = root.querySelector(".Catui_adm-scrim");
    const narrow = matchMedia("(max-width: 991px)");
    const isOpen = () => root.hasAttribute("data-catui-adm-open");
    const collapsed = () => root.hasAttribute("data-catui-adm-collapsed");
    const label = (a) => a.querySelector(".Catui_item-label")?.textContent.trim() || "";
    let last = null;

    const sync = () => {
      const rail = narrow.matches ? !isOpen() : collapsed();
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(narrow.matches ? isOpen() : !collapsed()));
        toggle.setAttribute("aria-label", narrow.matches ? (isOpen() ? "메뉴 닫기" : "메뉴 열기") : (collapsed() ? "메뉴 펼치기" : "메뉴 접기"));
      }
      // 아이콘만 보일 때는 마우스를 올리면 이름이 보이게
      side.querySelectorAll(".Catui_item").forEach((a) => { if (rail) a.title = label(a); else a.removeAttribute("title"); });
    };
    const open = () => {
      last = document.activeElement;
      root.setAttribute("data-catui-adm-open", "");
      if (scrim) scrim.hidden = false;
      sync();
      (side.querySelector('[aria-current="page"]') || side.querySelector(".Catui_item"))?.focus();
      admin.emit("drawer", { open: true });
    };
    const close = (restore = true) => {
      if (!isOpen()) return;
      root.removeAttribute("data-catui-adm-open");
      if (scrim) scrim.hidden = true;
      sync();
      if (restore) (last && last.isConnected ? last : toggle)?.focus();
      admin.emit("drawer", { open: false });
    };
    const setCollapsed = (on) => { root.toggleAttribute("data-catui-adm-collapsed", on); admSet("collapsed", on); sync(); admin.emit("collapse", { collapsed: on }); };

    if (admGet("collapsed", false)) root.setAttribute("data-catui-adm-collapsed", "");
    // 하위 메뉴: 현재 화면이 든 메뉴는 항상 펼침, 나머지는 기억한 대로
    const nest = admGet("nest", {});
    side.querySelectorAll("[data-catui-adm-key]").forEach((d) => {
      const k = d.dataset.catuiAdmKey;
      if (!d.querySelector('[aria-current="page"]') && k in nest) d.open = !!nest[k];
    });
    admin._on(side, "toggle", (e) => {
      const d = e.target;
      if (d.matches?.("[data-catui-adm-key]")) admSet("nest", { ...admGet("nest", {}), [d.dataset.catuiAdmKey]: d.open });
    }, true);
    admin._on(side, "click", (e) => {
      const s = e.target.closest("summary");
      // 아이콘만 보이는 상태에서 하위 메뉴 머리를 누르면 메뉴를 펼쳐 하위 항목을 보여 준다
      if (s && (narrow.matches ? !isOpen() : collapsed())) {
        e.preventDefault();
        s.parentElement.open = true;
        if (narrow.matches) open(); else setCollapsed(false);
        return;
      }
      if (narrow.matches && e.target.closest("a[href]")) close(false);
    });
    admin._on(toggle, "click", () => { if (narrow.matches) { if (isOpen()) close(); else open(); } else setCollapsed(!collapsed()); });
    admin._on(scrim, "click", () => close());
    admin._on(document, "keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape" && !catui.imeBusy(e)) { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const f = admFocusables(side);
      if (!f.length) return;
      const first = f[0], end = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !side.contains(document.activeElement))) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && (document.activeElement === end || !side.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
    admin._on(narrow, "change", () => { close(false); sync(); });
    sync();
    this.open = open; this.close = close; this.collapse = setCollapsed;
  },
  open() {}, close() {}, collapse() {},
};
