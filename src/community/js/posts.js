// posts — 게시판·글·회원 모의 데이터를 합쳐 화면에 쓰는 값으로 (모든 목록 화면이 같은 규칙을 쓴다)
//   community.load()            → Promise<{ boards, posts, users, byId }>  (한 번만 계산)
//   인기글  = 추천 − 비추천 ≥ 게시판 hotCut (공지·이벤트 말머리 제외)
//   레벨    = 활동 점수(글 10 · 댓글 2 · 받은 추천 1) 구간 → LEVELS
//   community.row(post, opt)    → 목록 한 줄 마크업 (catui.html, 글자는 모두 이스케이프)
const CM_LEVELS = [0, 300, 1000, 2500, 5000, 8000, 12000, 18000, 26000];
community.level = (score) => { let lv = 1; CM_LEVELS.forEach((c, i) => { if (score >= c) lv = i + 1; }); return Math.min(lv, CM_LEVELS.length); };
community.load = function () {
  if (this._loaded) return this._loaded;
  this._loaded = Promise.all([this.data("boards"), this.data("posts"), this.data("users")]).then(([boards, posts, users]) => {
    const B = Object.fromEntries(boards.map((b) => [b.id, b])), U = Object.fromEntries(users.map((u) => [u.id, u]));
    users.forEach((u) => { u.score = u.posts * 10 + u.comments * 2 + u.likes; u.level = community.level(u.score); });
    const list = posts.map((p) => {
      const b = B[p.board] || { name: p.board, hotCut: 9999 };
      const score = p.up - p.down;
      return { ...p, boardName: b.name, score, hot: !["공지", "이벤트"].includes(p.cat) && score >= b.hotCut, author: U[p.user] || { nick: "탈퇴한 회원", level: 1 } };
    }).sort((a, b) => (a.time < b.time ? 1 : -1));
    boards.forEach((b) => { const own = list.filter((p) => p.board === b.id); b.count = own.length; b.today = own.filter((p) => p.time.slice(0, 10) === community.now().toISOString().slice(0, 10)).length; });
    return { boards, B, posts: list, users, U, byId: Object.fromEntries(list.map((p) => [p.id, p])) };
  });
  return this._loaded;
};
// 읽은 글(목록에서 흐리게 + "읽음" 표시)
community.read = {
  has: (id) => cmGet("read", []).includes(id),
  add: (id) => { const r = cmGet("read", []).filter((x) => x !== id); r.unshift(id); cmSet("read", r.slice(0, 300)); },
};
// 회원 레벨 배지
community.badge = (u) => catui.html`<span class="Catui_cm-lv" data-lv="${Math.min(u.level, 9)}" title="레벨 ${u.level}"><span class="Catui_clip">레벨 </span>${u.level}</span>`;
// 목록 한 줄: <li> — 제목(말머리·사진·댓글 수) · 작성자 · 시간 · 추천 · 조회
community.row = function (p, { board = true, rank } = {}) {
  const read = this.read.has(p.id);
  return catui.html`<li class="Catui_cm-row${read ? " Catui_cm-read" : ""}${p.hot ? " Catui_cm-hot" : ""}">
    ${rank ? catui.html`<span class="Catui_cm-rank" aria-label="${rank}위">${rank}</span>` : ""}
    <div class="Catui_cm-row-main">
      <a class="Catui_cm-title" href="post.html?id=${p.id}">${board ? catui.html`<span class="Catui_cm-board">${p.boardName}</span>` : ""}${p.cat ? catui.html`<span class="Catui_cm-cat">${p.cat}</span>` : ""}<span class="Catui_cm-title-t">${p.title}</span>${p.photo ? catui.html`${catui.icon("image", 12)}<span class="Catui_clip"> 사진</span>` : ""}${p.comments ? catui.html`<span class="Catui_cm-cmt" aria-label="댓글 ${p.comments}개">${p.comments}</span>` : ""}${read ? catui.html`<span class="Catui_clip"> (읽음)</span>` : ""}</a>
      <span class="Catui_cm-meta"><span class="Catui_cm-nick">${this.badge(p.author)}${p.author.nick}</span><time datetime="${p.time}">${this.ago(p.time)}</time><span>조회 ${this.format(p.views, "compact")}</span></span>
    </div>
    <span class="Catui_cm-up${p.hot ? " Catui_cm-up-hot" : ""}" aria-label="추천 ${p.score}">${catui.icon("arrow-up", 12)}${p.score}</span>
  </li>`;
};
// 빈 목록
community.empty = (text) => catui.html`<li class="Catui_cm-empty">${catui.icon("inbox", 24)}<p>${text}</p></li>`;
