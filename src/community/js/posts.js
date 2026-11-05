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
      return { ...p, boardName: b.name, boardTone: b.tone || 1, hotCut: b.hotCut, score, hot: !["공지", "이벤트"].includes(p.cat) && score >= b.hotCut, author: U[p.user] || { nick: "탈퇴한 회원", level: 1 } };
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
// 회원 색: 닉네임마다 고정(아이디 글자 합으로 1~5) — 정체성 표시, 데이터 아님
community.tone = (id) => (String(id).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 5) + 1;
community.avatar = (u, size = "sm") => catui.html`<span class="Catui_av Catui_av-${size}" data-tone="${community.tone(u.id || u.nick)}" aria-hidden="true">${String(u.nick).slice(0, 1)}</span>`;
// 회원 레벨 배지
community.badge = (u) => catui.html`<span class="Catui_cm-lv" data-lv="${Math.min(u.level, 9)}" title="레벨 ${u.level}"><span class="Catui_clip">레벨 </span>${u.level}</span>`;
// 숫자 표시의 읽을 이름: 역할 없는 span의 aria-label은 화면 낭독기가 무시하므로 숨김 글자로 앞뒤를 붙인다
const cmCmt = (n, word = "댓글") => catui.html`<span class="Catui_cm-cmt"><span class="Catui_clip"> ${word} </span>${n}<span class="Catui_clip">개</span></span>`;
const cmNew = () => catui.html`<span class="Catui_cm-new"><span aria-hidden="true">N</span><span class="Catui_clip"> 새 글</span></span>`;
const cmUp = (score, hot) => catui.html`<span class="Catui_cm-up${hot ? " Catui_cm-up-hot" : ""}"><span class="Catui_clip">추천 </span>${catui.icon("arrow-up", 12)}${score}</span>`;
// 목록 한 줄: <li> — 제목(말머리·사진·댓글 수) · 작성자 · 시간 · 추천 · 조회
community.row = function (p, { board = true, rank } = {}) {
  const read = this.read.has(p.id);
  return catui.html`<li class="Catui_cm-row${read ? " Catui_cm-read" : ""}${p.hot ? " Catui_cm-hot" : ""}">
    ${rank ? catui.html`<span class="Catui_cm-rank">${rank}<span class="Catui_clip">위</span></span>` : ""}
    <div class="Catui_cm-row-main">
      <a class="Catui_cm-title" href="post.html?id=${p.id}">${board ? catui.html`<span class="Catui_cm-board" data-tone="${p.boardTone}">${p.boardName}</span>` : ""}${p.cat ? catui.html`<span class="Catui_cm-cat">${p.cat}</span>` : ""}<span class="Catui_cm-title-t">${p.title}</span>${p.photo ? catui.html`${catui.icon("image", 12)}<span class="Catui_clip"> 사진</span>` : ""}${p.comments ? cmCmt(p.comments) : ""}${read ? catui.html`<span class="Catui_clip"> (읽음)</span>` : ""}</a>
      <span class="Catui_cm-meta"><span class="Catui_cm-nick">${this.avatar(p.author)}${this.badge(p.author)}${p.author.nick}</span><time datetime="${p.time}">${this.ago(p.time)}</time><span>조회 ${this.format(p.views, "compact")}</span></span>
    </div>
    <span class="Catui_cm-score-n">${p.hot ? catui.html`<i class="Catui_clip">인기 글, </i>` : ""}<b>${p.score}</b><span>추천</span></span>
  </li>`;
};
// 위젯 한 줄: 제목 [댓글] · 새 글 표시(N, 3시간 이내) · 날짜
community.isNew = (p) => community.now() - new Date(p.time) < 3 * 36e5;
community.mini = function (p, { rank } = {}) {
  const t = new Date(p.time), today = t.toDateString() === this.now().toDateString();
  return catui.html`<li${this.read.has(p.id) ? catui.html` class="Catui_cm-read"` : ""}>${rank ? catui.html`<span class="Catui_cm-rank">${rank}</span>` : ""}<a href="post.html?id=${p.id}">${p.title}</a>${p.comments ? cmCmt(p.comments) : ""}${this.isNew(p) ? cmNew() : ""}<time datetime="${p.time}">${today ? catui.util.toDateString(t, "HH:mm") : catui.util.toDateString(t, "MM.dd")}</time></li>`;
};
// 게시판 표 한 줄: 분류 · 제목[댓글] · 글쓴이 · 날짜 · 조회 · 추천
community.tr = function (p) {
  const t = new Date(p.time), today = t.toDateString() === this.now().toDateString();
  return catui.html`<tr class="${[this.read.has(p.id) ? "Catui_cm-read" : "", p.cat === "공지" ? "Catui_cm-tr-notice" : ""].filter(Boolean).join(" ")}">
    <td class="Catui_cm-td-cat">${p.cat}</td>
    <td class="Catui_cm-td-t"><a class="Catui_cm-title" href="post.html?id=${p.id}"><span class="Catui_cm-title-t">${p.title}</span>${p.photo ? catui.html`${catui.icon("image", 12)}<span class="Catui_clip"> 사진</span>` : ""}${p.comments ? cmCmt(p.comments) : ""}${this.isNew(p) ? cmNew() : ""}</a></td>
    <td><span class="Catui_cm-nick">${this.badge(p.author)}${p.author.nick}</span></td>
    <td><time datetime="${p.time}">${today ? catui.util.toDateString(t, "HH:mm") : catui.util.toDateString(t, "MM.dd")}</time></td>
    <td><span class="Catui_clip">조회 </span>${this.format(p.views, "number")}</td>
    <td class="Catui_cm-td-up"><span class="Catui_clip">추천 </span>${p.hot ? catui.html`<b>${p.score}</b>` : p.score}</td>
  </tr>`;
};
community.table = function (rows) {
  return catui.html`<table class="Catui_cm-table"><caption class="Catui_clip">글 목록</caption><colgroup><col class="Catui_cm-c-cat"><col><col class="Catui_cm-c-nick"><col class="Catui_cm-c-date"><col class="Catui_cm-c-n"><col class="Catui_cm-c-n"></colgroup>
    <thead><tr><th scope="col">분류</th><th scope="col">제목</th><th scope="col">글쓴이</th><th scope="col">날짜</th><th scope="col">조회</th><th scope="col">추천</th></tr></thead><tbody>${rows.map((p) => this.tr(p))}</tbody></table>`;
};
// 빈 목록
community.empty = (text) => catui.html`<li class="Catui_cm-empty">${catui.icon("inbox", 24)}<p>${text}</p></li>`;
