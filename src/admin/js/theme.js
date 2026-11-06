// theme — 라이트/다크 전환. 저장한 값이 없으면 시스템 설정(prefers-color-scheme)을 따른다.
//   <button data-catui-adm-theme>  · admin.theme.set('dark' | 'light' | 'system')
admin.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => admGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-adm-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) {
    admSet("theme", v);
    this.apply(v);
    admin.emit("theme", { value: this.get(), saved: v });
  },
  init() {
    // <html data-catui-theme-lock>: 다른 쪽(예: 문서 사이트)이 테마를 관리하는 화면 — 덮어쓰지 않는다
    if (document.documentElement.hasAttribute("data-catui-theme-lock")) return;
    this.apply(this.saved());
    if (!admin._once(document, "theme")) return;   // 재호출 시 클릭이 두 번 처리돼 토글이 상쇄되지 않게
    const mq = matchMedia("(prefers-color-scheme: dark)");
    admin._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    admin._on(document, "click", (e) => { if (e.target.closest("[data-catui-adm-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};
