// list — 게시판 목록 화면 공통
//   <section data-catui-cm-list="list|card|gallery|deal|qna|hot" data-board="free" data-size="20">
//   · 주소 ↔ 화면: ?b=게시판 &cat=말머리 &sort=new|hot|cmt &page=N  (새로 고침·공유해도 같은 목록, 뒤로 가기로 이전 조건)
//   · 게시판 머리(이름·설명·글 수·즐겨찾기·글쓰기), 말머리 탭, 정렬, 페이지 번호
//   · hot = 모든 게시판의 인기글(추천−비추천 ≥ 게시판 기준), 공지·이벤트 제외
const CM_SORTS = { new: "최신", hot: "추천", cmt: "댓글" };
community.list = {
  init(root) { root.querySelectorAll("[data-catui-cm-list]").forEach((box) => this.mount(box)); },
  mount(box) {
    const kind = box.getAttribute("data-catui-cm-list"), size = Number(box.dataset.size || 20);
    community.load().then((d) => {
      const draw = (push) => {
        const q = community.query(), bid = q.get("b") || box.dataset.board || (kind === "hot" ? "" : "free");
        const b = d.B[bid], cat = q.get("cat") || "", sort = CM_SORTS[q.get("sort")] ? q.get("sort") : kind === "hot" ? "hot" : "new";
        let rows = kind === "hot" ? d.posts.filter((p) => p.hot) : d.posts.filter((p) => p.board === bid);
        if (cat) rows = rows.filter((p) => p.cat === cat);
        if (sort === "hot") rows = [...rows].sort((x, y) => y.score - x.score);
        if (sort === "cmt") rows = [...rows].sort((x, y) => y.comments - x.comments);
        const pages = Math.max(1, Math.ceil(rows.length / size)), page = Math.min(pages, Math.max(1, Number(q.get("page")) || 1));
        const shown = rows.slice((page - 1) * size, page * size);
        const link = (patch) => { const u = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k))); if (!("page" in patch)) u.delete("page"); return `?${u}`; };
        const title = kind === "hot" ? "인기글" : b?.name || "게시판";
        document.title = `${title} · Catui 커뮤니티`;
        const body = !shown.length ? catui.html`<ul class="Catui_cm-list">${community.empty(cat ? `[${cat}] 말머리 글이 없습니다.` : "아직 글이 없습니다. 첫 글을 남겨 보세요.")}</ul>`
          : kind === "gallery" ? catui.html`<ul class="Catui_cm-gallery">${shown.map((p) => catui.html`<li><a class="Catui_cm-shot" href="post.html?id=${p.id}"><figure><img src="${community.thumb(p)}" alt="" loading="lazy" width="320" height="240"></figure><b>${p.title}</b><span class="Catui_cm-meta"><span>${p.author.nick}</span><span>추천 ${p.score}</span>${p.comments ? catui.html`<span>댓글 ${p.comments}</span>` : ""}</span></a></li>`)}</ul>`
          : kind === "card" ? catui.html`<ul class="Catui_cm-cards">${shown.map((p) => catui.html`<li class="Catui_cm-card"><a class="Catui_cm-title" href="post.html?id=${p.id}"><span class="Catui_cm-cat">${p.cat}</span><span class="Catui_cm-title-t">${p.title}</span>${p.comments ? catui.html`<span class="Catui_cm-cmt" aria-label="댓글 ${p.comments}개">${p.comments}</span>` : ""}</a><p>${p.summary}</p><span class="Catui_cm-meta"><span class="Catui_cm-nick">${community.badge(p.author)}${p.author.nick}</span><time datetime="${p.time}">${community.ago(p.time)}</time><span>추천 ${p.score}</span><span>조회 ${community.format(p.views, "compact")}</span></span></li>`)}</ul>`
          : kind === "deal" ? catui.html`<ul class="Catui_cm-list">${shown.map((p, i) => catui.html`<li class="Catui_cm-row Catui_cm-deal" data-catui-cm-deal><span class="Catui_cm-ph" data-tone="${(i % 4) + 1}" aria-hidden="true">${catui.icon("shopping-cart", 20)}</span><div class="Catui_cm-row-main"><a class="Catui_cm-title" href="post.html?id=${p.id}"><span class="Catui_cm-cat">${p.cat}</span><span class="Catui_cm-title-t">${p.title}</span>${p.comments ? catui.html`<span class="Catui_cm-cmt" aria-label="댓글 ${p.comments}개">${p.comments}</span>` : ""}</a><span class="Catui_cm-meta"><b class="Catui_cm-price">${catui.util.number(p.price)}원</b><span>${p.shop}</span><span>배송 ${p.ship}</span><time data-catui-cm-until="${p.until}"></time></span></div><span class="Catui_cm-up${p.hot ? " Catui_cm-up-hot" : ""}" aria-label="추천 ${p.score}">${catui.icon("arrow-up", 12)}${p.score}</span></li>`)}</ul>`
          : catui.html`<ul class="Catui_cm-list">${shown.map((p, i) => kind === "qna" ? this.qnaRow(p) : community.row(p, { board: kind === "hot", rank: kind === "hot" && sort === "hot" && page === 1 && i < 10 ? i + 1 : 0 }))}</ul>`;
        catui.mount(box, catui.html`
          <header class="Catui_cm-board-head" data-tone="${kind === "hot" ? 5 : b?.tone || 1}"><div><h1 class="Catui_h1">${title}</h1><p>${kind === "hot" ? "게시판별 기준 이상 추천받은 글 (추천 − 비추천)" : b?.desc || ""} · 글 <span class="Catui_num">${catui.util.number(rows.length)}</span>개</p></div>
            <div class="Catui_actions">${kind !== "hot" && b ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-cm-fav="${b.id}" aria-pressed="${community.fav.has(b.id)}">${catui.icon("star", 16)}즐겨찾기</button>` : ""}${b?.write === false ? "" : catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-primary Catui_cm-write-btn" href="write.html${kind !== "hot" && b ? `?b=${b.id}` : ""}">${catui.icon("pen-line", 16)}글쓰기</a>`}</div></header>
          <div class="Catui_cm-bar">
            ${kind !== "hot" && b ? catui.html`<nav class="Catui_cm-cats" aria-label="말머리"><a href="${link({ cat: "" })}"${!cat ? catui.html` aria-current="page"` : ""}>전체</a>${b.cats.map((c) => catui.html`<a href="${link({ cat: c })}"${cat === c ? catui.html` aria-current="page"` : ""}>${c}</a>`)}</nav>` : catui.html`<span></span>`}
            <nav class="Catui_cm-sort" aria-label="정렬">${Object.entries(CM_SORTS).map(([k, v]) => catui.html`<a href="${link({ sort: k === (kind === "hot" ? "hot" : "new") ? "" : k })}"${sort === k ? catui.html` aria-current="page"` : ""}>${v}순</a>`)}</nav>
          </div>
          ${body}
          ${pages > 1 ? catui.html`<nav class="Catui_pager" aria-label="페이지">${page > 1 ? catui.html`<a class="Catui_pg" href="${link({ page: page - 1 })}" aria-label="이전 페이지">${catui.icon("chevron-left", 16)}</a>` : ""}${Array.from({ length: pages }, (_, i) => i + 1).map((n) => catui.html`<a class="Catui_pg${n === page ? " Catui_pg-active" : ""}" href="${link({ page: n > 1 ? n : "" })}"${n === page ? catui.html` aria-current="page"` : ""}>${n}</a>`)}${page < pages ? catui.html`<a class="Catui_pg" href="${link({ page: page + 1 })}" aria-label="다음 페이지">${catui.icon("chevron-right", 16)}</a>` : ""}</nav>` : ""}`);
        community.widgets.tick(box);
        if (push) box.querySelector("h1")?.focus?.();
      };
      // 말머리·정렬·페이지는 새로 읽지 않고 주소만 바꿔 다시 그린다(뒤로 가기 지원)
      community._on(box, "click", (e) => {
        const a = e.target.closest(".Catui_cm-cats a, .Catui_cm-sort a, .Catui_pager a");
        if (!a || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        history.pushState(null, "", a.getAttribute("href"));
        draw(true);
        box.scrollIntoView({ block: "start", behavior: "auto" });
      });
      community._on(window, "popstate", () => draw(false));
      draw(false);
    });
  },
  qnaRow(p) {
    return catui.html`<li class="Catui_cm-row"><span class="Catui_badge ${p.solved ? "Catui_badge-success" : "Catui_badge-neutral"} Catui_cm-solved">${p.solved ? "해결" : "답변 대기"}</span><div class="Catui_cm-row-main"><a class="Catui_cm-title" href="post.html?id=${p.id}"><span class="Catui_cm-cat">${p.cat}</span><span class="Catui_cm-title-t">${p.title}</span>${p.comments ? catui.html`<span class="Catui_cm-cmt" aria-label="답변 ${p.comments}개">${p.comments}</span>` : ""}</a><span class="Catui_cm-meta"><span class="Catui_cm-nick">${community.badge(p.author)}${p.author.nick}</span><time datetime="${p.time}">${community.ago(p.time)}</time><span>조회 ${community.format(p.views, "compact")}</span></span></div><span class="Catui_cm-up" aria-label="추천 ${p.score}">${catui.icon("arrow-up", 12)}${p.score}</span></li>`;
  },
};
// 사진 자리표시: 토큰 색으로 그린 풍경 SVG (외부 이미지 없음). 실서비스는 p.thumb 주소를 쓴다
community.thumb = function (p) {
  if (p.thumb) return p.thumb;
  const css = getComputedStyle(document.documentElement), c = css.getPropertyValue(["--Catui_color-brand", "--Catui_color-info", "--Catui_color-purple", "--Catui_color-amber"][((p.tone || 1) - 1) % 4]).trim() || "gray";
  const n = Number(p.id) % 5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="${c}" opacity=".16"/><circle cx="${70 + n * 40}" cy="80" r="34" fill="${c}" opacity=".55"/><path d="M0 200 L${80 + n * 10} 130 L170 185 L250 120 L320 170 V240 H0Z" fill="${c}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
