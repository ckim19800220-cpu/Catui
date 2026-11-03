/*! CatuiCommunity JS 2.0.0 | MIT License (c) imcatDevs | catui 위에 로드 */
import catui from "./catui.esm.js";

// ── community.js ──
// CatuiCommunity — catui.js 위에 얹는 커뮤니티(게시판) 확장 (catui.community)
//   전역: <script src="catui.js"></script><script src="catcommunity.js"></script> → catui.community
//   ESM : import community from "@imcat-ckim/catui/community"
// 화면 루트: <div class="Catui_site Catui_cm" data-catui-cm> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 상태(테마·추천·읽은 글·즐겨찾기 게시판·임시 저장)는 catui.data('community')(localStorage "catui:community")에 기억한다.

const CM_STORE = "community";
const cmGet = (k, d) => { const v = catui.data(CM_STORE)[k]; return v === undefined ? d : v; };
const cmSet = (k, v) => catui.data(CM_STORE, { key: k, value: v });
const cmBatchim = (word) => {
  const s = String(word).replace(/[\s)"'\]」』.,!?…]+$/, "");
  const ch = s.slice(-1);
  if (!ch) return { has: false, rieul: false };
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; return { has: jong > 0, rieul: jong === 8 }; }
  if (/\d/.test(ch)) return { has: "0136780".includes(ch), rieul: "178".includes(ch) };
  if (/[a-z]/i.test(ch)) return { has: /[lmnr]/i.test(ch), rieul: /[lr]/i.test(ch) };
  return { has: false, rieul: false };
};
const cmQuery = () => new URLSearchParams(location.search);

const community = {
  version: catui.version,
  root: null,
  /** 조사 붙이기: josa('게시판', '을') → '게시판을' */
  josa(word, pair) {
    const b = cmBatchim(word);
    const P = { 을: ["을", "를"], 를: ["을", "를"], 이: ["이", "가"], 가: ["이", "가"], 은: ["은", "는"], 는: ["은", "는"], 과: ["과", "와"], 와: ["과", "와"], 으로: ["으로", "로"], 로: ["으로", "로"] }[pair];
    if (!P) return `${word}${pair}`;
    if (P[0] === "으로") return `${word}${b.has && !b.rieul ? "으로" : "로"}`;
    return `${word}${b.has ? P[0] : P[1]}`;
  },
  store: { get: cmGet, set: cmSet, clear: () => catui.data(CM_STORE, null) },
  /** 이벤트: 'theme' · 'vote' { id, dir, up, down } · 'comment' · 'draft' · 'poll' · 'data' */
  on: (evt, fn) => catui.onevent("community", evt, fn),
  emit: (evt, payload) => catui.event("community", evt, null, payload),
  query: cmQuery,
  _offs: [],
  _on(target, type, fn, opt) { if (!target) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
};

// ── 테마: 관리 화면과 같은 규칙(저장값 없으면 시스템) ──
community.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => cmGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-cm-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) { cmSet("theme", v); this.apply(v); community.emit("theme", { value: this.get(), saved: v }); },
  init() {
    this.apply(this.saved());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    community._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    community._on(document, "click", (e) => { if (e.target.closest("[data-catui-cm-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};

// ── data.js ──
// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.community.data('orders').then((rows) => …)       data/orders.json 을 한 번만 읽어 캐시
//   catui.community.dataBase = '/api/'                      주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   선언형: <section data-catui-cm-src="dashboard-ops">  안에서
//     <b data-catui-cm-text="kpi.users.value" data-catui-cm-format="number|won|man|percent|delta">  값 채우기
//     <div data-catui-cm-chart="area" data-catui-cm-key="charts.network">                        차트 자료
//   점 경로(a.b.0.c)로 JSON 안을 가리킨다. 실패하면 칸은 그대로 두고 콘솔에 한 줄 안내.
community.dataBase = "data/";
community.derive = {};
community._dataCache = new Map();
community.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiCommunity: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
// 점 경로로 값 꺼내기
community.pick = (obj, path) => String(path || "").split(".").filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
// 표시 형식
community.format = function (v, kind) {
  if (v == null || v === "") return "";
  const n = Number(v);
  switch (kind) {
    case "number": return catui.util.number(n);
    case "won": return `${catui.util.number(n)}원`;
    case "man": return `${catui.util.number(Math.round(n / 10000))}만원`;
    case "percent": return `${n}%`;
    case "delta": return `${n > 0 ? "▲" : n < 0 ? "▼" : ""} ${Math.abs(n)}%`.trim();
    case "ms": return `${catui.util.number(n)}ms`;
    case "initial": return String(v).trim().slice(0, 1);   // 아바타 글자
    case "compact": return n >= 1e4 ? `${(Math.floor(n / 1e3) / 10).toLocaleString("ko-KR")}만` : n >= 1e3 ? `${(Math.floor(n / 100) / 10)}천` : String(n);   // 1.2만 · 3.4천
    case "ago": return community.ago(v);   // 방금 · 3분 전 · 어제 · 10월 30일
    default: return String(v);
  }
};
community.bind = function (scope = document) {
  const boxes = [...scope.querySelectorAll("[data-catui-cm-src]")];
  return Promise.all(boxes.map((box) => this.data(box.getAttribute("data-catui-cm-src")).then((raw) => {
    // 파생 값: catui.community.derive['이름'] = (json) => ({ …json, 합계 }) — 비율·합계를 원자료에서 계산해 채운다
    const fn = this.derive[box.getAttribute("data-catui-cm-src")];
    const json = fn ? (fn(structuredClone(raw)) ?? raw) : raw;
    const own = (sel) => [...(box.matches(sel) ? [box] : []), ...box.querySelectorAll(sel)];   // 자기 자신에 붙인 바인딩도
    own("[data-catui-cm-text]").forEach((el) => {
      const v = this.pick(json, el.getAttribute("data-catui-cm-text"));
      if (v !== undefined) el.textContent = this.format(v, el.getAttribute("data-catui-cm-format"));
    });
    own("[data-catui-cm-chart][data-catui-cm-key]").forEach((el) => {
      const d = this.pick(json, el.getAttribute("data-catui-cm-key"));
      if (d) el.setAttribute("data-catui-cm-data", JSON.stringify(d));
    });
    // 행 바인딩: <tbody data-catui-cm-rows="topPages"><template><tr>…</tr></template></tbody>
    //   [data-catui-cm-field="name" data-catui-cm-format?]  글자 · [data-catui-cm-field-data="trend"] 차트 자료
    //   [data-catui-cm-class="Catui_pill-:tone"]  행 값으로 클래스 붙이기 (글자만 넣으므로 마크업 주입 없음)
    own("[data-catui-cm-rows]").forEach((list) => this._rows(list, json));
    box.setAttribute("data-catui-cm-bound", "");
    community.emit("data", { name: box.getAttribute("data-catui-cm-src"), data: json, box });
    return json;
  }).catch(() => null)));
};
// 행 바인딩 (중첩 가능): <… data-catui-cm-rows="경로"><template>한 행</template></…>
community._rows = function (list, json) {
  const tpl = list.querySelector("template"), rows = this.pick(json, list.getAttribute("data-catui-cm-rows"));
  if (!tpl || !Array.isArray(rows)) return;
  [...list.children].forEach((c) => { if (c !== tpl) c.remove(); });
  rows.forEach((row) => {
    const frag = tpl.content.cloneNode(true);
    frag.querySelectorAll("[data-catui-cm-field]").forEach((el) => { el.textContent = this.format(this.pick(row, el.getAttribute("data-catui-cm-field")), el.getAttribute("data-catui-cm-format")); });
    frag.querySelectorAll("[data-catui-cm-field-data]").forEach((el) => { el.setAttribute("data-catui-cm-data", JSON.stringify(this.pick(row, el.getAttribute("data-catui-cm-field-data")))); });
    frag.querySelectorAll("[data-catui-cm-class]").forEach((el) => { const [pre, key] = el.getAttribute("data-catui-cm-class").split(":"); const v = this.pick(row, key); if (v) el.classList.add(`${pre}${String(v).replace(/[^\w-]/g, "")}`); });
    // 속성 치환: data-catui-cm-attr="aria-label:{name} 메뉴;title:{email}"
    frag.querySelectorAll("[data-catui-cm-attr]").forEach((el) => {
      el.getAttribute("data-catui-cm-attr").split(";").forEach((pair) => { const i = pair.indexOf(":"); if (i > 0) el.setAttribute(pair.slice(0, i).trim(), pair.slice(i + 1).replace(/\{(\w+)\}/g, (_, k) => row[k] ?? "")); });
      el.removeAttribute("data-catui-cm-attr");
    });
    // 참·거짓 속성: data-catui-cm-bool="checked:done"
    frag.querySelectorAll("[data-catui-cm-bool]").forEach((el) => {
      el.getAttribute("data-catui-cm-bool").split(";").forEach((pair) => { const [a, k] = pair.split(":"); if (a && k) el.toggleAttribute(a.trim(), !!this.pick(row, k.trim())); });
      el.removeAttribute("data-catui-cm-bool");
    });
    frag.querySelectorAll("[data-catui-cm-label]").forEach((el) => { el.setAttribute("data-catui-cm-label", el.getAttribute("data-catui-cm-label").replace(/\{(\w+)\}/g, (_, k) => row[k] ?? "")); });
    frag.querySelectorAll("[data-catui-cm-rows]").forEach((sub) => this._rows(sub, row));   // 행 안의 하위 목록 (예: 요금제별 기능)
    list.appendChild(frag);
  });
};
// 상대 시간: 1분 미만 방금 · 시간 전 · 어제 · 이번 해는 월 일 · 그 전은 년.월.일 (기준 시각 community.now — 모의 데이터는 고정 시각)
community.now = () => (community.fixedNow ? new Date(community.fixedNow) : new Date());
community.ago = function (iso) {
  const t = new Date(iso), now = this.now(), s = Math.round((now - t) / 1000);
  if (Number.isNaN(s)) return String(iso);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400 && t.getDate() === now.getDate()) return `${Math.floor(s / 3600)}시간 전`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (t.toDateString() === y.toDateString()) return "어제";
  if (t.getFullYear() === now.getFullYear()) return `${t.getMonth() + 1}월 ${t.getDate()}일`;
  return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, "0")}.${String(t.getDate()).padStart(2, "0")}`;
};

// ── posts.js ──
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
// 목록 한 줄: <li> — 제목(말머리·사진·댓글 수) · 작성자 · 시간 · 추천 · 조회
community.row = function (p, { board = true, rank } = {}) {
  const read = this.read.has(p.id);
  return catui.html`<li class="Catui_cm-row${read ? " Catui_cm-read" : ""}${p.hot ? " Catui_cm-hot" : ""}">
    ${rank ? catui.html`<span class="Catui_cm-rank" aria-label="${rank}위">${rank}</span>` : ""}
    <div class="Catui_cm-row-main">
      <a class="Catui_cm-title" href="post.html?id=${p.id}">${board ? catui.html`<span class="Catui_cm-board" data-tone="${p.boardTone}">${p.boardName}</span>` : ""}${p.cat ? catui.html`<span class="Catui_cm-cat">${p.cat}</span>` : ""}<span class="Catui_cm-title-t">${p.title}</span>${p.photo ? catui.html`${catui.icon("image", 12)}<span class="Catui_clip"> 사진</span>` : ""}${p.comments ? catui.html`<span class="Catui_cm-cmt" aria-label="댓글 ${p.comments}개">${p.comments}</span>` : ""}${read ? catui.html`<span class="Catui_clip"> (읽음)</span>` : ""}</a>
      <span class="Catui_cm-meta"><span class="Catui_cm-nick">${this.avatar(p.author)}${this.badge(p.author)}${p.author.nick}</span><time datetime="${p.time}">${this.ago(p.time)}</time><span>조회 ${this.format(p.views, "compact")}</span></span>
    </div>
    <span class="Catui_cm-score-n" aria-label="${p.hot ? `인기글, ` : ""}추천 ${p.score}"><b>${p.score}</b><span>추천</span></span>
  </li>`;
};
// 빈 목록
community.empty = (text) => catui.html`<li class="Catui_cm-empty">${catui.icon("inbox", 24)}<p>${text}</p></li>`;

// ── shell.js ──
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
    root.querySelectorAll("[data-catui-cm-search]").forEach((f) => community._on(f, "submit", (e) => {
      const q = f.querySelector("input[name=q]");
      if (!q.value.trim()) { e.preventDefault(); q.focus(); }
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
      const rank = (list) => catui.html`<ol class="Catui_cm-ranks">${list.map((p, i) => catui.html`<li><span class="Catui_cm-rank${i < 3 ? " Catui_cm-rank-top" : ""}">${i + 1}</span><a href="post.html?id=${p.id}">${p.title}</a>${p.comments ? catui.html`<span class="Catui_cm-cmt" aria-label="댓글 ${p.comments}개">${p.comments}</span>` : ""}</li>`)}</ol>`;
      const favs = d.boards.filter((b) => community.fav.has(b.id));
      catui.mount(box, catui.html`
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

// ── list.js ──
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

// ── vote.js ──
// vote — 추천 · 비추천 (글·댓글 공통)
//   <div class="Catui_cm-vote" data-catui-cm-vote="post:1201" data-up="512" data-down="21">
//     <button data-dir="up">…<b data-n>512</b></button><button data-dir="down">…</button></div>
//   · 한 글에 한 번(기억). 같은 버튼을 다시 누르면 취소, 반대 버튼은 바꾸기
//   · 낙관적 갱신: 숫자를 먼저 바꾸고 community.voteRequest(실서비스 API)가 실패하면 되돌린다
//   · 숫자가 바뀌면 짧게 위로 밀려 들어옴(피드백, 200ms) — 모션 줄이기면 즉시
community.voteRequest = () => Promise.resolve(true);   // 실서비스: (id, dir) => fetch('/api/vote', …)
community.vote = {
  get: (key) => cmGet("votes", {})[key] || "",
  set(key, dir) { const v = cmGet("votes", {}); if (dir) v[key] = dir; else delete v[key]; cmSet("votes", v); },
  paint(box) {
    const mine = this.get(box.dataset.catuiCmVote), up = Number(box.dataset.up) + (mine === "up" ? 1 : 0), down = Number(box.dataset.down) + (mine === "down" ? 1 : 0);
    box.querySelectorAll("button[data-dir]").forEach((b) => {
      const on = b.dataset.dir === mine, n = b.dataset.dir === "up" ? up : down;
      b.setAttribute("aria-pressed", String(on));
      const out = b.querySelector("[data-n]");
      if (out && out.textContent !== String(n)) { out.textContent = String(n); out.classList.remove("Catui_cm-bump"); void out.offsetWidth; out.classList.add("Catui_cm-bump"); }
      b.setAttribute("aria-label", `${b.dataset.dir === "up" ? "추천" : "비추천"} ${n}${on ? " (누름)" : ""}`);
    });
    const score = box.querySelector("[data-catui-cm-score]");
    if (score) score.textContent = String(up - down);
  },
  // 새로 그린 영역(댓글 등)의 추천 상태만 칠한다 — 클릭은 루트 한 곳에서 받는다
  paintAll(scope) {
    scope.querySelectorAll("[data-catui-cm-vote]").forEach((box) => {
      this.paint(box);
      box.querySelectorAll("[data-n]").forEach((n) => n.classList.remove("Catui_cm-bump"));   // 처음 칠할 때는 움직이지 않는다
    });
  },
  init(root) {
    this.paintAll(root);
    community._on(root, "click", (e) => {
      const b = e.target.closest("[data-catui-cm-vote] button[data-dir]");
      if (!b) return;
      const box = b.closest("[data-catui-cm-vote]"), key = box.dataset.catuiCmVote, before = this.get(key);
      const dir = before === b.dataset.dir ? "" : b.dataset.dir;
      this.set(key, dir); this.paint(box);
      community.voteRequest(key, dir).then((ok) => {
        if (!ok) throw new Error("vote");
        community.emit("vote", { key, dir });
        if (dir) catui.layer.msg(dir === "up" ? "추천했습니다" : "비추천했습니다", { time: 1000 });
      }).catch(() => { this.set(key, before); this.paint(box); catui.layer.msg("반영하지 못했습니다. 다시 시도해 주세요", { icon: "warn" }); });
    });
  },
};

// ── comments.js ──
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
      <div class="Catui_cm-c-head">${community.avatar({ id: c.user, nick: u.nick })}<b>${community.badge(u)}${u.nick}</b>${best ? catui.html`<span class="Catui_badge Catui_badge-success">베스트</span>` : ""}<time class="Catui_cm-meta" datetime="${c.time}">${community.ago(c.time)}</time></div>
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

// ── editor.js ──
// editor — 글쓰기
//   <form data-catui-cm-editor> 안에 board(select) · cat(select) · title · body(textarea) · 사진(input file)
//   · 게시판을 바꾸면 말머리 목록을 boards.json에서 다시 채운다
//   · 서식 버튼 [data-md="bold|quote|list|link"]: 선택한 글자를 간단한 마크다운으로 감싼다
//   · 미리보기 [data-catui-cm-preview]: 글자를 이스케이프한 뒤 굵게·인용·목록·링크(https만)만 바꿈 — 마크업 주입 없음
//   · 임시 저장: 입력이 멈추면 0.8초 뒤 기억("임시 저장됨 10:42"), 다시 열면 이어 쓰기 안내 · 등록·지우기 후 삭제
//   · 떠날 때 확인: 저장하지 않은 내용이 있으면 브라우저 확인 창
community.md = function (src) {
  const esc = String(src).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return esc.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${l.slice(2)}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^&gt; /.test(l))) return `<blockquote>${lines.map((l) => l.slice(5)).join("<br>")}</blockquote>`;
    return `<p>${lines.join("<br>")}</p>`;
  }).join("")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow ugc" target="_blank">$1</a>');
};
community.editor = {
  init(root) {
    const f = root.querySelector("form[data-catui-cm-editor]");
    if (!f) return;
    const $ = (n) => f.elements[n], note = f.querySelector("[data-catui-cm-saved]");
    const snapshot = () => JSON.stringify({ board: $("board").value, cat: $("cat").value, title: $("title").value, body: $("body").value });
    let base = snapshot(), timer;
    community.data("boards").then((boards) => {
      const fill = () => {
        const b = boards.find((x) => x.id === $("board").value);
        const cur = $("cat").value;
        $("cat").replaceChildren(...(b?.cats || []).filter((c) => !["공지", "이벤트"].includes(c)).map((c) => new Option(c, c, false, c === cur)));
      };
      $("board").replaceChildren(...boards.filter((b) => b.write !== false).map((b) => new Option(b.name, b.id)));
      const want = community.query().get("b");
      if (want) $("board").value = want;
      fill();
      community._on($("board"), "change", fill);
      const draft = cmGet("draft", null);
      if (draft && (draft.title || draft.body)) {
        catui.layer.confirm(`${community.ago(draft.at)} 임시 저장한 글이 있습니다. 이어서 쓸까요?`, { title: "임시 저장 글", okText: "이어 쓰기", cancelText: "새로 쓰기" }, (i) => {
          catui.layer.close(i);
          $("board").value = draft.board; fill(); $("cat").value = draft.cat; $("title").value = draft.title; $("body").value = draft.body;
          [$("title"), $("body")].forEach((x) => x.dispatchEvent(new Event("input", { bubbles: true })));
        }, () => cmSet("draft", null));
      }
      base = snapshot();
    });
    const save = () => {
      if (snapshot() === base) return;
      cmSet("draft", { ...JSON.parse(snapshot()), at: community.now().toISOString() });
      if (note) note.textContent = `임시 저장됨 ${catui.util.toDateString(new Date(), "HH:mm")}`;
      community.emit("draft", { saved: true });
    };
    community._on(f, "input", () => { clearTimeout(timer); timer = setTimeout(save, 800); });
    community._on(window, "beforeunload", (e) => { if (snapshot() !== base && !f.dataset.sent) { e.preventDefault(); e.returnValue = ""; } });
    community._on(f, "click", (e) => {
      const b = e.target.closest("[data-md]");
      if (!b) return;
      const ta = $("body"), s = ta.selectionStart, t = ta.selectionEnd, sel = ta.value.slice(s, t) || "글자";
      const wrap = { bold: `**${sel}**`, quote: sel.split("\n").map((l) => `> ${l}`).join("\n"), list: sel.split("\n").map((l) => `- ${l}`).join("\n"), link: `[${sel}](https://)` }[b.dataset.md];
      ta.setRangeText(wrap, s, t, "select"); ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const prev = f.querySelector("[data-catui-cm-preview]");
    if (prev) community._on(f, "change", (e) => { if (e.target.name === "cm-mode" && e.target.value === "preview") prev.innerHTML = community.md($("body").value) || "<p class=\"Catui_help\">미리 볼 내용이 없습니다.</p>"; });
    const pics = f.querySelector("[data-catui-cm-pics]"), file = f.querySelector("input[type=file]");
    if (file && pics) community._on(file, "change", () => {
      [...file.files].slice(0, 10).forEach((fl) => {
        if (!fl.type.startsWith("image/")) return;
        const fig = document.createElement("figure"); fig.className = "Catui_cm-pic";
        const img = document.createElement("img"); img.src = URL.createObjectURL(fl); img.alt = fl.name;
        const x = document.createElement("button"); x.type = "button"; x.className = "Catui_btn Catui_btn-sm Catui_btn-secondary Catui_btn-icon"; x.setAttribute("aria-label", `${fl.name} 빼기`);
        catui.mount(x, catui.icon("x", 16));
        x.addEventListener("click", () => { URL.revokeObjectURL(img.src); fig.remove(); file.focus(); });
        fig.append(img, x); pics.appendChild(fig);
      });
      file.value = "";
    });
    community._on(f, "reset", () => { setTimeout(() => { cmSet("draft", null); base = snapshot(); if (note) note.textContent = ""; }, 0); });
    community._on(f, "submit", (e) => {
      e.preventDefault();
      if (!catui.form.validate(f)) return;
      f.dataset.sent = "1"; cmSet("draft", null);
      catui.layer.msg(`${community.josa($("title").value.trim().slice(0, 20), "을")} 올렸습니다`, { icon: "success" });
      setTimeout(() => { location.href = "post.html?id=1201"; }, 700);
    });
  },
};

// ── widgets.js ──
// widgets — 투표 · 핫딜 남은 시간 · 상대 시간 갱신
//   <form data-catui-cm-poll="poll-1301">  투표: 한 번만(기억), 참여 후 결과 막대(비율은 표 수에서 계산), 결과 보기 버튼
//   <time data-catui-cm-until="ISO">       핫딜 남은 시간 "3시간 12분 남음" / "종료" (1분마다)
//   <time data-catui-cm-ago="ISO">         "5분 전" (1분마다)
community.widgets = {
  // 남은 시간·상대 시간 글자 갱신 (목록을 다시 그린 뒤에도 부른다)
  tick(scope = document) {
    scope.querySelectorAll("[data-catui-cm-until]").forEach((t) => {
      const left = new Date(t.getAttribute("data-catui-cm-until")) - community.now();
      const h = Math.floor(left / 36e5), m = Math.floor((left % 36e5) / 6e4);
      t.textContent = left <= 0 ? "종료" : h >= 24 ? `${Math.floor(h / 24)}일 남음` : h ? `${h}시간 ${m}분 남음` : `${m}분 남음`;
      t.closest("[data-catui-cm-deal]")?.toggleAttribute("data-ended", left <= 0);
    });
    scope.querySelectorAll("[data-catui-cm-ago]").forEach((t) => { t.textContent = community.ago(t.getAttribute("data-catui-cm-ago")); });
  },
  init(root) {
    root.querySelectorAll("form[data-catui-cm-poll]").forEach((f) => this.poll(f));
    this.tick(root);
    const id = setInterval(() => this.tick(root), 6e4);
    community._offs.push(() => clearInterval(id));
  },
  poll(f) {
    const name = f.getAttribute("data-catui-cm-poll");
    community.data(name).then((poll) => {
      const mine = () => cmGet("polls", {})[name];
      const draw = (showResult) => {
        const voted = mine(), votes = poll.options.map((o, i) => o.votes + (voted === i ? 1 : 0)), total = votes.reduce((a, b) => a + b, 0);
        const done = new Date(poll.until) < community.now();
        if (voted != null || showResult || done) {
          catui.mount(f, catui.html`<fieldset><legend class="Catui_label">${poll.question}</legend>
            <ul class="Catui_cm-poll-res">${poll.options.map((o, i) => { const pct = total ? Math.round(votes[i] / total * 100) : 0; return catui.html`<li${voted === i ? catui.html` aria-current="true"` : ""}><span class="Catui_cm-poll-lab">${o.label}${voted === i ? catui.html` <span class="Catui_badge Catui_badge-success">내 선택</span>` : ""}</span><span class="Catui_cm-poll-bar" role="img" aria-label="${o.label} ${pct}퍼센트, ${votes[i]}표"><i style="width:${pct}%"></i></span><span class="Catui_num">${pct}% · ${catui.util.number(votes[i])}표</span></li>`; })}</ul>
            <p class="Catui_help">${catui.util.number(total)}명 참여 · ${done ? "마감" : `${community.ago(poll.until).replace(" 전", "")} 마감`}</p>
            ${voted == null && !done ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-back>투표하러 돌아가기</button>` : ""}</fieldset>`);
          return;
        }
        catui.mount(f, catui.html`<fieldset><legend class="Catui_label">${poll.question}</legend>
          <div class="Catui_vstack Catui_gap-1">${poll.options.map((o, i) => catui.html`<label class="Catui_choice"><input class="Catui_clip" type="radio" name="${name}" value="${i}"><span class="Catui_radio"></span>${o.label}</label>`)}</div>
          <div class="Catui_actions"><button class="Catui_btn Catui_btn-md Catui_btn-primary" type="submit">투표하기</button><button class="Catui_btn Catui_btn-md Catui_btn-ghost" type="button" data-result>결과 보기</button></div></fieldset>`);
      };
      community._on(f, "submit", (e) => {
        e.preventDefault();
        const v = f.querySelector("input:checked");
        if (!v) { catui.layer.msg("항목을 골라 주세요", { icon: "warn" }); return; }
        cmSet("polls", { ...cmGet("polls", {}), [name]: Number(v.value) });
        draw(true); community.emit("poll", { name, choice: Number(v.value) });
        f.querySelector("ul")?.setAttribute("tabindex", "-1"); f.querySelector("ul")?.focus();
      });
      community._on(f, "click", (e) => { if (e.target.closest("[data-result]")) draw(true); if (e.target.closest("[data-back]")) draw(false); });
      draw(false);
    }).catch(() => {});
  },
};

// ── init.js ──
// 초기화 — 테마는 어느 화면에서나, 셸·추천·댓글·글쓰기는 [data-catui-cm] 루트가 있을 때
//   모의 데이터의 "지금" 기준 시각: <html data-catui-cm-now="2026-11-02T10:00:00+09:00"> (없으면 실제 시각)
community.init = function (scope = document) {
  this.fixedNow = document.documentElement.getAttribute("data-catui-cm-now") || this.fixedNow;
  this.theme.init();
  const root = scope.matches?.("[data-catui-cm]") ? scope : scope.querySelector?.("[data-catui-cm]");
  if (root && !root.hasAttribute("data-catui-cm-ready")) {
    root.setAttribute("data-catui-cm-ready", "");
    this.root = root;
    for (const part of ["shell", "list", "vote", "comments", "editor", "widgets"]) {
      try { this[part]?.init(root); } catch (err) { catui.hint.error(`CatuiCommunity: ${part} 연결 실패`, "error", err); }
    }
  }
  this.ready = this.bind(root || document).then(() => this);
  return this;
};
community.destroy = function () {
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this.root?.removeAttribute("data-catui-cm-ready");
  this.root = null;
};

catui.extend({ community });
catui.use(() => { if (catui.config().autoInit !== false) community.init(); });

export { community };
export default community;
