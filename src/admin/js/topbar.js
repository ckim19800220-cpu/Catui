// topbar — 명령 팔레트(Ctrl/⌘+K, 화면 이동) · 사용자 메뉴
//   <button data-catui-adm-cmd> + <script type="application/json" id="adm-cmd-data">[{ group, title, href, icon }]</script>
//   <button data-catui-adm-user> + <script type="application/json" id="adm-user-data">[{ title, href, icon } | { type:'-' }]</script>
admin.topbar = {
  init(root) {
    const cmdBtn = root.querySelector("[data-catui-adm-cmd]");
    const pages = admJson("adm-cmd-data") || [];
    if (cmdBtn || pages.length) {
      const extra = [
        { group: "작업", title: "어두운/밝은 화면 전환", icon: "moon", keywords: "theme dark 다크 테마", handler: () => admin.theme.set(admin.theme.get() === "dark" ? "light" : "dark") },
        { group: "작업", title: "사이드바 접기/펼치기", icon: "panel-left", keywords: "sidebar menu 메뉴", handler: () => admin.shell.collapse(!root.hasAttribute("data-catui-adm-collapsed")) },
      ];
      catui.command.render({ id: "adm-cmd", hotkey: "mod+k", placeholder: "화면 이름이나 명령 검색 (초성 가능)", data: [...pages, ...extra] });
      admin._on(cmdBtn, "click", () => catui.command.open("adm-cmd"));
      admin._offs.push(() => catui.command.destroy("adm-cmd"));
    }
    const userBtn = root.querySelector("[data-catui-adm-user]");
    const menu = admJson("adm-user-data");
    if (userBtn && menu) {
      const id = "adm-user";
      catui.dropdown.render({ elem: userBtn, id, align: "right", data: menu.map((m, i) => (m.type ? m : { id: `u${i}`, ...m })) });
      admin._offs.push(() => catui.dropdown.destroy(id));
    }
  },
};
