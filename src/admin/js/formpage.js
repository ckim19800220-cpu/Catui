// formpage — 편집 화면: 변경 감지 · 고정 저장 바 · 떠날 때 경고 · 저장 중 잠금
//   <form data-catui-adm-form data-catui-form …> … <div class="Catui_adm-savebar" data-catui-adm-savebar>…</div></form>
//   저장(submit) 성공 = form 모듈 'done' 이벤트 또는 admin.form.saved(form) 호출 → 변경 없음으로 되돌림
//   이벤트: admin.on('dirty', { form, dirty })
admin.form = {
  forms: new Map(),
  snapshot(f) { return new URLSearchParams(new FormData(f)).toString(); },
  isDirty(f) { const s = this.forms.get(f); return !!s && this.snapshot(f) !== s.base; },
  saved(f) { const s = this.forms.get(f); if (!s) return; s.base = this.snapshot(f); this.sync(f); },
  sync(f) {
    const s = this.forms.get(f), dirty = this.isDirty(f);
    if (s.dirty === dirty) return;
    s.dirty = dirty;
    f.toggleAttribute("data-catui-adm-dirty", dirty);
    const bar = f.querySelector("[data-catui-adm-savebar]");
    const note = bar?.querySelector("[data-catui-adm-savenote]");
    if (note) note.textContent = dirty ? "저장하지 않은 변경 사항이 있습니다" : "모든 변경 사항이 저장되었습니다";
    admin.emit("dirty", { form: f, dirty });
  },
  init(root = document) {
    root.querySelectorAll("form[data-catui-adm-form]").forEach((f) => {
      if (this.forms.has(f)) return;
      this.forms.set(f, { base: this.snapshot(f), dirty: false });
      const check = () => this.sync(f);
      admin._on(f, "input", check);
      admin._on(f, "change", check);
      admin._on(f, "reset", () => setTimeout(() => this.saved(f), 0));
    });
    if (!this.forms.size || !admin._once(document, "dirty")) return;   // 나가기 확인 창이 두 번 뜨지 않게
    const anyDirty = () => [...this.forms.keys()].some((f) => f.isConnected && this.isDirty(f));
    // 새로 고침·창 닫기: 브라우저 기본 확인 창
    admin._on(window, "beforeunload", (e) => { if (anyDirty()) { e.preventDefault(); e.returnValue = ""; } });
    // 화면 안 링크: Catui 확인 창
    admin._on(document, "click", (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || e.defaultPrevented || a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || a.getAttribute("href").startsWith("#") || !anyDirty()) return;
      e.preventDefault();
      catui.layer.confirm("저장하지 않은 변경 사항이 있습니다. 저장하지 않고 이동할까요?", { title: "페이지 나가기", okText: "나가기", cancelText: "머무르기", danger: true }, (i) => {
        catui.layer.close(i);
        this.forms.forEach((s, f) => { s.base = this.snapshot(f); });
        location.assign(a.href);
      });
    }, true);
    // form 모듈 Ajax 저장 성공 → 기준점 갱신
    admin._offs.push(catui.form.on("done", (d) => { if (this.forms.has(d?.form)) { this.saved(d.form); catui.layer.msg("저장했습니다", { icon: "success" }); } }));
  },
  destroy() { this.forms.clear(); },
};
