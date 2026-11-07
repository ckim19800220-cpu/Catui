// shell — 사이트 머리·옆줄·하단 탭
//   [data-catui-cm-aside]   옆줄: 인기글 순위(실시간·일간 탭) · 공지 · 즐겨찾기 게시판 — posts.json·notices.json에서
//   [data-catui-cm-search]  머리 검색: search.html?q= 로 이동(빈 값은 막음)
//   [data-catui-cm-top]     맨 위로 (스크롤 600px 넘으면 보임)
//   [data-catui-cm-fav="게시판"] 즐겨찾기 토글(기억)
community.fav = {
  list: () => cmGet("fav", ["free", "humor", "info"]),
  has: (id) => community.fav.list().includes(id),
  toggle(id) { const l = this.list(); const on = !l.includes(id); cmSet("fav", on ? [...l, id] : l.filter((x) => x !== id)); return on; },
};
community.shell = {
  init(root) {
    if (community._once(root, "photo-errors")) community._on(root, "error", (e) => { if (e.target.matches?.("img") && !e.target.src.startsWith("data:")) e.target.src = community.thumb({ id: 1 }, true); }, true);
    root.querySelectorAll("[data-catui-cm-search]").forEach((f) => community._on(f, "submit", (e) => {
      const q = f.querySelector("input[name=q]");
      if (q && !q.value.trim()) { e.preventDefault(); q.focus(); }
    }));
    const top = root.querySelector("[data-catui-cm-top]");
    if (top) {
      const sync = () => { top.hidden = scrollY < 600; };
      community._on(window, "scroll", sync, { passive: true }); sync();
      community._on(top, "click", () => { scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); root.querySelector("main")?.focus({ preventScroll: true }); });
    }
    community._on(root, "click", (e) => {
      const b = e.target.closest("[data-catui-cm-fav]");
      if (!b) return;
      const on = community.fav.toggle(b.dataset.catuiCmFav);
      b.setAttribute("aria-pressed", String(on));
      catui.layer.msg(on ? "즐겨찾기에 넣었습니다" : "즐겨찾기에서 뺐습니다", { time: 1200 });
      this.aside(root);
    });
    root.querySelectorAll("[data-catui-cm-fav]").forEach((b) => b.setAttribute("aria-pressed", String(community.fav.has(b.dataset.catuiCmFav))));
    this.aside(root);
  },
  aside(root) {
    const box = root.querySelector("[data-catui-cm-aside]");
    if (!box) return;
    Promise.all([community.load(), community.data("notices")]).then(([d, notices]) => {
      const day = community.now() - 864e5;
      const live = d.posts.filter((p) => new Date(p.time) > day).sort((a, b) => b.score - a.score).slice(0, 10);
      const week = d.posts.filter((p) => new Date(p.time) > community.now() - 7 * 864e5).sort((a, b) => b.score - a.score).slice(0, 10);
      const rank = (list) => catui.html`<ol class="Catui_cm-ranks">${list.map((p, i) => catui.html`<li><span class="Catui_cm-rank${i < 3 ? " Catui_cm-rank-top" : ""}">${i + 1}</span><a href="post.html?id=${p.id}">${p.title}</a>${p.comments ? cmCmt(p.comments) : ""}</li>`)}</ol>`;
      const favs = d.boards.filter((b) => community.fav.has(b.id));
      const me = d.U.me, myPosts = d.posts.filter((p) => p.user === "me").length;
      catui.mount(box, catui.html`
        <section class="Catui_card" aria-label="내 정보"><div class="Catui_cm-me">
          <div class="Catui_cm-me-top">${community.avatar(me, "md")}<div><b>${me.nick}</b><div class="Catui_cm-meta">${community.badge(me)}레벨 ${me.level}</div></div><a class="Catui_btn Catui_btn-sm Catui_btn-ghost" href="settings.html" style="margin-left:auto">설정</a></div>
          <div class="Catui_cm-me-nums"><a href="profile.html"><b>${myPosts}</b>내 글</a><a href="messages.html"><b>1</b>쪽지</a><a href="notifications.html"><b>3</b>알림</a></div>
          <a class="Catui_btn Catui_btn-md Catui_btn-primary Catui_cm-write-btn" href="write.html">${catui.icon("pen-line", 16)}글쓰기</a>
        </div></section>`);
      const rest = document.createElement("div");
      rest.style.display = "contents";
      box.appendChild(rest);
      catui.mount(rest, catui.html`
        <section class="Catui_card" aria-labelledby="cm-aside-rank"><header class="Catui_card-h" id="cm-aside-rank">인기글 순위</header>
          <div class="Catui_card-b"><div class="Catui_tabs Catui_cm-tabs-sm">
            <input class="Catui_clip" type="radio" name="cm-rank" id="cm-rank-1" checked><label class="Catui_tab" for="cm-rank-1">24시간</label><div class="Catui_panel">${rank(live)}</div>
            <input class="Catui_clip" type="radio" name="cm-rank" id="cm-rank-2"><label class="Catui_tab" for="cm-rank-2">7일</label><div class="Catui_panel">${rank(week)}</div>
          </div></div></section>
        <section class="Catui_card" aria-labelledby="cm-aside-fav"><header class="Catui_card-h" id="cm-aside-fav">즐겨찾는 게시판</header>
          <div class="Catui_card-b">${favs.length ? catui.html`<ul class="Catui_cm-links">${favs.map((b) => catui.html`<li><a href="board.html?b=${b.id}">${b.name}</a><span class="Catui_cm-meta">오늘 ${b.today}</span></li>`)}</ul>` : catui.html`<p class="Catui_help">게시판의 ☆ 버튼으로 추가합니다.</p>`}</div></section>
        <section class="Catui_card" aria-labelledby="cm-aside-notice"><header class="Catui_card-h" id="cm-aside-notice">공지</header>
          <div class="Catui_card-b"><ul class="Catui_cm-links">${notices.slice(0, 4).map((n) => catui.html`<li><a href="notice.html#n${n.id}">${n.title}</a></li>`)}</ul></div></section>`);
    }).catch(() => {});
  },
};
