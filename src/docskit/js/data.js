// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API·정적 JSON으로 바꾸면 된다)
//   catui.docs.data('posts').then((rows) => …)   data/posts.json 을 한 번만 읽어 캐시
//   catui.docs.dataBase = '/api/docs/'           주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   파일: nav(문서 메뉴) · pages(문서 본문 블록) · posts · authors · tags · changelog · search-index
docs.dataBase = "data/";
docs._dataCache = new Map();
docs.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiDocs: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
/** "2026-10-28" → "2026.10.28" */
docs.date = (iso, fmt = "yyyy.MM.dd") => catui.util.toDateString(new Date(iso), fmt);
/** 블로그 글·저자·태그를 합쳐 화면 값으로: 글마다 저자 객체·태그 객체, 최신 순 */
docs.blog = function () {
  if (this._blog) return this._blog;
  this._blog = Promise.all(["posts", "authors", "tags"].map((n) => this.data(n))).then(([posts, authors, tags]) => {
    const A = Object.fromEntries(authors.map((a) => [a.id, a]));
    const T = Object.fromEntries(tags.map((t) => [t.id, t]));
    const list = [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => ({ ...p, authorObj: A[p.author] || { id: p.author, name: p.author }, tagObjs: (p.tags || []).map((t) => T[t] || { id: t, name: t }) }));
    const count = Object.fromEntries(tags.map((t) => [t.id, list.filter((p) => (p.tags || []).includes(t.id)).length]));
    const d = { posts: list, byId: Object.fromEntries(list.map((p) => [p.id, p])), authors, A, tags, T, count };
    this.emit("data", { blog: d });
    return d;
  });
  this._blog.catch(() => { this._blog = null; });
  return this._blog;
};
/** 글 본문(블록)의 읽는 시간 — 제목·문단·목록·참고 글자만 센다(코드 제외) */
docs.postTime = (p) => docs.readTime([p.title, p.summary, ...(p.body || []).map((b) => b.h2 || b.h3 || b.p || b.note || (b.list || []).join(" ") || "")].join(" "));
