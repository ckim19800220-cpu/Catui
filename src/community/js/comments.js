// comments — 댓글 트리
//   <section data-catui-cm-comments="comments-1201">  data/comments-1201.json 을 읽어 그린다
//   · 베스트 댓글: 추천 10 이상 중 상위 3개를 맨 위에 한 번 더 (원래 자리에도 남김)
//   · 답글: "답글 N개" 버튼으로 펼치기/접기(aria-expanded, 높이 전환 250ms) · 정렬: 등록순 / 추천순
//   · 쓰기: 본문 textarea — Enter는 줄바꿈, Ctrl/⌘+Enter 등록(한글 조합 중에는 무시) · 300자
//   · 답글 쓰기: 댓글의 "답글" 버튼 → 그 아래에 같은 입력 폼
community.comments = {
  init(root) {
    root.querySelectorAll("[data-catui-cm-comments]").forEach((box) => this.mount(box));
  },
  mount(box) {
    const name = box.getAttribute("data-catui-cm-comments");
    Promise.all([community.data(name), community.load()]).then(([list, d]) => {
      const state = { list: structuredClone(list), sort: "old", users: d.U };
      const draw = () => this.draw(box, state);
      community._on(box, "click", (e) => {
        const t = e.target.closest("button");
        if (!t) return;
        if (t.dataset.sort) { state.sort = t.dataset.sort; draw(); box.querySelector(`[data-sort="${state.sort}"]`)?.focus(); }
        else if (t.hasAttribute("data-catui-cm-replies")) {
          const open = t.getAttribute("aria-expanded") !== "true";
          t.setAttribute("aria-expanded", String(open));
          document.getElementById(t.getAttribute("aria-controls"))?.toggleAttribute("data-open", open);
          t.querySelector("[data-label]").textContent = open ? "답글 접기" : `답글 ${t.dataset.count}개`;
        } else if (t.hasAttribute("data-catui-cm-reply")) {
          const host = t.closest(".Catui_cm-c");
          let f = host.querySelector(":scope > .Catui_cm-c-form");
          if (f) { f.remove(); t.focus(); return; }
          f = this.form(`답글 · ${host.dataset.nick}`, t.dataset.catuiCmReply);
          host.querySelector(".Catui_cm-c-body").after(f);
          f.querySelector("textarea").focus();
        } else if (t.hasAttribute("data-catui-cm-report")) {
          catui.layer.confirm("이 댓글을 신고할까요? 운영진이 확인합니다.", { title: "댓글 신고", okText: "신고" }, (i) => { catui.layer.close(i); catui.layer.msg("신고했습니다", { icon: "success" }); });
        }
      });
      community._on(box, "keydown", (e) => {
        if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || e.isComposing || e.keyCode === 229) return;
        const f = e.target.closest("form.Catui_cm-c-form");
        if (f) { e.preventDefault(); f.requestSubmit(); }
      });
      community._on(box, "submit", (e) => {
        const f = e.target.closest("form.Catui_cm-c-form");
        if (!f) return;
        e.preventDefault();
        const ta = f.querySelector("textarea"), text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        const item = { id: `n${Date.now()}`, user: "me", text, time: community.now().toISOString(), up: 0, replies: [] };
        const parent = f.dataset.parent;
        if (parent) { const p = state.list.find((c) => c.id === parent); p.replies = [...(p.replies || []), item]; state.openParent = parent; }
        else state.list.push(item);
        draw();
        community.emit("comment", { item, parent });
        const added = document.getElementById(`c-${item.id}`);
        added?.querySelector(".Catui_cm-c-body")?.setAttribute("tabindex", "-1");
        added?.querySelector(".Catui_cm-c-body")?.focus();
        catui.layer.msg("댓글을 달았습니다", { icon: "success", time: 1200 });
      });
      draw();
    }).catch(() => {});
  },
  form(label, parent = "") {
    const f = document.createElement("form");
    f.className = "Catui_cm-c-form";
    if (parent) f.dataset.parent = parent;
    const id = `cf-${Math.random().toString(36).slice(2, 8)}`;
    catui.mount(f, catui.html`<label class="Catui_clip" for="${id}">${label}</label><textarea class="Catui_input" id="${id}" rows="3" maxlength="300" data-catui-counter="300" placeholder="${label} — Ctrl+Enter로 등록"></textarea><div class="Catui_actions"><button class="Catui_btn Catui_btn-sm Catui_btn-primary" type="submit">등록</button></div>`);
    catui.init?.(f);
    return f;
  },
  item(c, users, { best = false } = {}) {
    const u = users[c.user] || { nick: c.user === "me" ? "나" : "탈퇴한 회원", level: 1 };
    const kids = c.replies || [];
    const rid = `r-${c.id}${best ? "-b" : ""}`;
    return catui.html`<li class="Catui_cm-c${best ? " Catui_cm-c-best" : ""}" id="${best ? "" : `c-${c.id}`}" data-nick="${u.nick}">
      <div class="Catui_cm-c-head"><span class="Catui_av Catui_av-sm" aria-hidden="true">${u.nick.slice(0, 1)}</span><b>${community.badge(u)}${u.nick}</b>${best ? catui.html`<span class="Catui_badge Catui_badge-success">베스트</span>` : ""}<time class="Catui_cm-meta" datetime="${c.time}">${community.ago(c.time)}</time></div>
      <p class="Catui_cm-c-body">${c.text}</p>
      <div class="Catui_cm-c-acts">
        <div class="Catui_cm-vote Catui_cm-vote-sm" data-catui-cm-vote="c:${c.id}" data-up="${c.up}" data-down="0"><button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-dir="up">${catui.icon("thumbs-up", 16)}<b data-n>${c.up}</b></button></div>
        ${best ? "" : catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-cm-reply="${c.id}">답글</button>`}
        <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-cm-report aria-label="${u.nick}의 댓글 신고">신고</button>
      </div>
      ${!best && kids.length ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_cm-c-more" type="button" data-catui-cm-replies data-count="${kids.length}" aria-expanded="false" aria-controls="${rid}">${catui.icon("corner-down-right", 16)}<span data-label>답글 ${kids.length}개</span></button>
        <div class="Catui_cm-c-kids" id="${rid}"><ul>${kids.map((k) => this.item(k, users))}</ul></div>` : ""}
    </li>`;
  },
  draw(box, state) {
    const total = state.list.reduce((a, c) => a + 1 + (c.replies || []).length, 0);
    const best = state.list.filter((c) => c.up >= 10).sort((a, b) => b.up - a.up).slice(0, 3);
    const list = state.sort === "up" ? [...state.list].sort((a, b) => b.up - a.up) : state.list;
    catui.mount(box, catui.html`
      <div class="Catui_cm-c-top"><h2 class="Catui_h3">댓글 <span class="Catui_num">${total}</span></h2>
        <div class="Catui_segment" role="group" aria-label="댓글 정렬"><button type="button" data-sort="old" aria-pressed="${state.sort === "old"}">등록순</button><button type="button" data-sort="up" aria-pressed="${state.sort === "up"}">추천순</button></div></div>
      ${best.length ? catui.html`<ul class="Catui_cm-cs Catui_cm-cs-best" aria-label="베스트 댓글">${best.map((c) => this.item(c, state.users, { best: true }))}</ul>` : ""}
      <ul class="Catui_cm-cs" aria-label="댓글 목록">${list.map((c) => this.item(c, state.users))}</ul>`);
    box.appendChild(this.form("댓글 쓰기"));
    community.vote.paintAll(box);
    if (state.openParent) { const b = box.querySelector(`[aria-controls="r-${state.openParent}"]`); b?.click(); state.openParent = null; }
  },
};
