// notify — 상단 바 알림 버튼 + 패널(.Catui_notifs). 데이터: <script type="application/json" id="adm-notify-data">[…]</script>
//   <button data-catui-adm-notify="notifications.html"> — 값은 "전체 알림 보기" 주소
//   항목: { id, who?, text, time(ISO 또는 글자), unread, icon?, href? }
//   admin.notify.add({ text, who }) · markRead(id) · markAll() · count()  · 이벤트 admin.on('notify', { unread })
admin.notify = {
  items: [],
  count() { return this.items.filter((x) => x.unread).length; },
  init(root) {
    const btn = root.querySelector("[data-catui-adm-notify]");
    if (!btn) return;
    this.btn = btn;
    this.more = btn.getAttribute("data-catui-adm-notify") || "";   // "전체 알림 보기" 주소 (비우면 링크 없음)
    const take = (list) => { this.items = (list || []).map((x, i) => ({ id: x.id ?? `n${i}`, ...x })); this.badge(); if (this.pop && !this.pop.hidden) this.render(); };
    // 화면 안 JSON(#adm-notify-data)이 없으면 data/notifications.json 모의 데이터를 읽는다
    const inline = admJson("adm-notify-data");
    this.items = [];
    if (inline) take(inline); else admin.data("notifications").then(take).catch(() => {});
    const pop = document.createElement("section");
    pop.className = "Catui_notifs Catui_adm-pop";
    pop.id = "adm-notify-pop";
    pop.hidden = true;
    pop.setAttribute("aria-labelledby", "adm-notify-t");
    pop.tabIndex = -1;
    root.appendChild(pop);   // 셸 루트 안에 둬야 Catui 기본 글꼴·크기·목록 리셋이 적용된다 (body에 두면 브라우저 기본 16px)
    this.pop = pop;
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-controls", pop.id);
    btn.setAttribute("aria-expanded", "false");
    const place = () => {
      const r = btn.getBoundingClientRect();
      pop.style.top = `${Math.round(r.bottom + 8)}px`;
      pop.style.right = `${Math.max(12, Math.round(innerWidth - r.right))}px`;
    };
    const close = (restore) => { if (pop.hidden) return; pop.hidden = true; btn.setAttribute("aria-expanded", "false"); if (restore) btn.focus(); };
    const openPop = () => { this.render(); place(); pop.hidden = false; btn.setAttribute("aria-expanded", "true"); pop.focus(); };
    admin._on(btn, "click", () => (pop.hidden ? openPop() : close(false)));
    // 패널 안 버튼을 눌러 목록을 다시 그리면 눌린 요소가 DOM에서 빠진다 — 그건 바깥 클릭이 아니다
    admin._on(document, "click", (e) => { if (!pop.hidden && e.target.isConnected && !pop.contains(e.target) && !btn.contains(e.target)) close(false); });
    admin._on(document, "keydown", (e) => { if (e.key === "Escape" && !e.isComposing && !pop.hidden) { e.preventDefault(); close(true); } });
    admin._on(window, "resize", () => { if (!pop.hidden) place(); });
    admin._on(pop, "click", (e) => {
      if (e.target.closest("[data-catui-adm-readall]")) { this.markAll(); return; }
      const li = e.target.closest("[data-catui-adm-nid]");
      if (li) this.markRead(li.dataset.catuiAdmNid);
    });
    admin._offs.push(() => pop.remove());
    this.badge();
  },
  // 알림 시각: ISO면 상대 시간("5분 전"), 글자면 그대로
  when(t) { const d = new Date(t); return t && !Number.isNaN(d.getTime()) && /\d{4}-\d{2}/.test(String(t)) ? catui.util.timeAgo(d) : String(t || ""); },
  render() {
    if (!this.pop) return;
    const n = this.count();
    catui.mount(this.pop, catui.html`<div class="Catui_notifs-h"><span id="adm-notify-t">알림</span>${n ? catui.html`<span class="Catui_count" aria-label="읽지 않음 ${n}건">${n}</span>` : ""}<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-adm-readall ${n ? "" : catui.raw("disabled")}>모두 읽음</button></div>
      ${this.items.length ? catui.html`<ul class="Catui_notifs-list">${this.items.map((x) => catui.html`<li class="Catui_notif${x.unread ? " Catui_notif-unread" : ""}" data-catui-adm-nid="${x.id}">${x.who ? catui.html`<span class="Catui_av Catui_av-sm" aria-hidden="true">${String(x.who).slice(0, 1)}</span>` : catui.html`<span class="Catui_file-ico${[2, 3, 5].includes(x.tone) ? ` Catui_file-ico-${x.tone}` : ""}" aria-hidden="true">${catui.icon(x.icon || "bell", 16)}</span>`}<div class="Catui_notif-body"><p>${x.who ? catui.html`<b>${x.who}</b>님이 ` : ""}${x.text}${x.unread ? catui.html`<span class="Catui_clip"> (읽지 않음)</span>` : ""}</p><span class="Catui_notif-time">${this.when(x.time)}</span></div></li>`)}</ul>` : catui.html`<p class="Catui_adm-empty">새 알림이 없습니다.</p>`}
      ${this.more ? catui.html`<a class="Catui_notifs-f" href="${this.more}">전체 알림 보기</a>` : ""}`);
  },
  badge() {
    if (!this.btn) return;
    const n = this.count();
    let c = this.btn.querySelector(".Catui_count");
    if (n && !c) { c = document.createElement("span"); c.className = "Catui_count"; c.setAttribute("aria-hidden", "true"); this.btn.appendChild(c); }
    if (c) { c.textContent = String(n); c.hidden = !n; }
    this.btn.setAttribute("aria-label", n ? `알림 (읽지 않음 ${n}건)` : "알림");
    admin.emit("notify", { unread: n });
  },
  add(item) { this.items.unshift({ id: `n${Date.now()}`, unread: true, time: new Date().toISOString(), ...item }); this.badge(); if (!this.pop?.hidden) this.render(); },
  markRead(id) { const x = this.items.find((i) => String(i.id) === String(id)); if (x && x.unread) { x.unread = false; this.badge(); this.render(); } },
  markAll() { this.items.forEach((x) => { x.unread = false; }); this.badge(); this.render(); this.pop?.focus(); },
};
