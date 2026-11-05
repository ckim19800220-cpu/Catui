// auth — 로그인·가입 보조 (선언형)
//   <div class="Catui_adm-pw"><input type="password" …><button data-catui-adm-pwtoggle>…</button></div>   비밀번호 보기/숨기기
//   <p class="Catui_adm-caps" data-catui-adm-caps="#pw" hidden>                                         Caps Lock 켜짐 알림
//   <div class="Catui_adm-strength" data-catui-adm-strength="#pw"><i></i><i></i><i></i><i></i><span></span></div>  강도
admin.auth = {
  // 0~4: 길이 8·12, 대소문자, 숫자, 특수문자
  score(v) {
    if (!v) return 0;
    let s = 0;
    if (v.length >= 8) s++;
    if (v.length >= 12) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
    return Math.max(1, Math.min(4, s));
  },
  init(root = document) {
    root.querySelectorAll("[data-catui-adm-pwtoggle]").forEach((b) => {
      const input = b.closest(".Catui_adm-pw")?.querySelector("input");
      if (!input || !admin._once(b, "pw")) return;
      const sync = () => { const shown = input.type === "text"; b.setAttribute("aria-pressed", String(shown)); b.setAttribute("aria-label", shown ? "비밀번호 숨기기" : "비밀번호 보기"); catui.mount(b, catui.icon(shown ? "eye-off" : "eye", 16)); };
      admin._on(b, "click", () => { input.type = input.type === "password" ? "text" : "password"; sync(); input.focus(); });
      sync();
    });
    root.querySelectorAll("[data-catui-adm-caps]").forEach((note) => {
      const input = catui.el(note.getAttribute("data-catui-adm-caps"));
      if (!input || !admin._once(note, "caps")) return;
      const check = (e) => { if (typeof e.getModifierState === "function") note.hidden = !e.getModifierState("CapsLock"); };
      admin._on(input, "keydown", check);
      admin._on(input, "keyup", check);
      admin._on(input, "blur", () => { note.hidden = true; });
    });
    const NAMES = ["", "약함", "보통", "좋음", "강함"];
    root.querySelectorAll("[data-catui-adm-strength]").forEach((meter) => {
      const input = catui.el(meter.getAttribute("data-catui-adm-strength"));
      if (!input || !admin._once(meter, "strength")) return;
      const out = meter.querySelector("span");
      meter.setAttribute("role", "img");
      const sync = () => { const n = this.score(input.value); meter.dataset.level = String(n); if (out) out.textContent = NAMES[n] || ""; meter.setAttribute("aria-label", n ? `비밀번호 강도: ${NAMES[n]}` : "비밀번호 강도: 입력 전"); };
      admin._on(input, "input", sync);
      sync();
    });
  },
};
