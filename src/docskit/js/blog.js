// blog — 블로그 목록(태그 필터·쪽 이동 ↔ 주소) · 글 보기 · 태그 · 저자 · 최근 글 · 변경 이력
//   [data-catui-dk-blog]          목록: 주소 ?tag=&page= ↔ 화면(태그 버튼 aria-pressed · 쪽 번호), 뒤로 가기 따라감
//   [data-catui-dk-post]          글 보기 ?id= (없으면 최신 글): 머리 그림·저자·날짜·읽는 시간·본문·목차·공유·관련 글
//   [data-catui-dk-tagpage]       태그 ?t= : 태그 모음(글 수) + 그 태그 글
//   [data-catui-dk-author]        저자 ?a= (없으면 첫 저자): 소개 + 그 저자 글 + 다른 저자
//   [data-catui-dk-posts="recent"] 최근 글 카드 (data-size, 기본 rules.recent)
//   [data-catui-dk-changelog]     변경 이력(data/changelog.json): 버전마다 추가·변경·고침 배지(글자 + 색), 종류 거르기
const DK_KINDS = { added: ["추가", "Catui_badge-success"], changed: ["변경", "Catui_badge-info"], fixed: ["고침", "Catui_badge-warning"] };
const DK_COVERS = { workspace: "workspace.png", reading: "reading.jpg", keyboard: "keyboard.jpg" };
const dkCover = (p, lg = false) => catui.html`<span class="Catui_dk-cover${lg ? " Catui_dk-cover-lg" : ""}" data-tone="${p.tone || 1}" aria-hidden="true">${catui.icon(p.icon || "book-open", lg ? 24 : 20)}${Object.hasOwn(DK_COVERS, p.cover) ? catui.html`<img src="../../../assets/photos/${DK_COVERS[p.cover]}" alt="" width="960" height="640" loading="${lg ? "eager" : "lazy"}" decoding="async">` : ""}</span>`;
const dkAvatar = (a, size = "md") => catui.html`<span class="Catui_av Catui_av-${size} Catui_dk-av" data-tone="${a.tone || 1}" aria-hidden="true">${String(a.name || "?").slice(0, 1)}</span>`;
const dkTags = (p) => (p.tagObjs?.length ? catui.html`<ul class="Catui_dk-tags" aria-label="태그">${p.tagObjs.map((t) => catui.html`<li><a class="Catui_dk-tag" href="tag.html?t=${encodeURIComponent(t.id)}">#${t.name}</a></li>`)}</ul>` : "");

docs.meta = (p) => catui.html`<p class="Catui_dk-meta"><a href="author.html?a=${encodeURIComponent(p.authorObj.id)}">${p.authorObj.name}</a><span aria-hidden="true">·</span><time datetime="${p.date}">${docs.date(p.date)}</time><span aria-hidden="true">·</span><span>${docs.postTime(p).label} 읽기</span></p>`;
/** 글 카드 (글자는 모두 이스케이프) */
docs.card = (p) => catui.html`<li class="Catui_dk-card"><a class="Catui_dk-card-link" href="post.html?id=${encodeURIComponent(p.id)}">${dkCover(p)}<span class="Catui_dk-card-b"><b class="Catui_dk-card-t">${p.title}</b><span class="Catui_dk-card-d">${p.summary || ""}</span></span></a>${docs.meta(p)}${dkTags(p)}</li>`;
docs.empty = (title, text = "") => catui.html`<li class="Catui_dk-wide"><div class="Catui_empty">${catui.icon("file-search", 24)}<p class="Catui_empty-title">${title}</p>${text ? catui.html`<p class="Catui_empty-text">${text}</p>` : ""}</div></li>`;
/** 쪽 이동 버튼 (현재 aria-current="page", 끝에서는 이전/다음 잠김) */
docs.pager = (page, pages) => (pages > 1 ? catui.html`<button class="Catui_pg" type="button" data-page="${page - 1}" aria-label="이전 쪽" ${page <= 1 ? catui.html`disabled` : ""}>${catui.icon("chevron-left", 16)}</button>${Array.from({ length: pages }, (_, i) => i + 1).map((n) => catui.html`<button class="Catui_pg" type="button" data-page="${n}" aria-label="${n}쪽" ${n === page ? catui.html`aria-current="page"` : ""}>${n}</button>`)}<button class="Catui_pg" type="button" data-page="${page + 1}" aria-label="다음 쪽" ${page >= pages ? catui.html`disabled` : ""}>${catui.icon("chevron-right", 16)}</button>` : "");

docs.blogList = {
  /** 주소 → { tag, page } */
  read(qs = docs.query()) { return { tag: qs.get("tag") || "", page: Math.max(1, parseInt(qs.get("page"), 10) || 1) }; },
  /** 거르고 자르기 → { rows, total, pages, page } */
  slice(posts, { tag = "", page = 1 } = {}) {
    const all = tag ? posts.filter((p) => (p.tags || []).includes(tag)) : posts;
    const pages = Math.max(1, Math.ceil(all.length / docs.rules.perPage)), cur = Math.min(Math.max(1, page), pages);
    return { rows: all.slice((cur - 1) * docs.rules.perPage, cur * docs.rules.perPage), total: all.length, pages, page: cur };
  },
  init(root) {
    const box = root.querySelector("[data-catui-dk-blog]");
    if (!box) return;
    this.box = box;
    docs._on(box, "click", (e) => {
      const t = e.target.closest("[data-tag]"), pg = e.target.closest("[data-page]");
      if (t) this.go({ tag: t.dataset.tag, page: 1 }, `[data-tag="${t.dataset.tag}"]`);
      else if (pg && !pg.disabled) this.go({ ...this.read(), page: Number(pg.dataset.page) }, `[data-page="${pg.dataset.page}"]`);
    });
    docs._on(window, "popstate", () => this.draw());
    this.ready = docs.blog().then((d) => { this.d = d; this.draw(); return d; }, () => null);
  },
  /** 상태를 바꾸고 주소에 남긴다(뒤로 가기로 돌아올 수 있게) */
  go(state, focusSel) {
    const u = new URL(location.href);
    if (state.tag) u.searchParams.set("tag", state.tag); else u.searchParams.delete("tag");
    if (state.page > 1) u.searchParams.set("page", String(state.page)); else u.searchParams.delete("page");
    if (u.href !== location.href) history.pushState(null, "", u);
    this.draw(focusSel);
    if (focusSel?.startsWith("[data-page")) this.box.scrollIntoView({ block: "start", behavior: dkReduced() ? "auto" : "smooth" });
  },
  draw(focusSel) {
    if (!this.d) return;
    const d = this.d, st = this.read(), tag = d.T[st.tag] ? st.tag : "", v = this.slice(d.posts, { tag, page: st.page });
    const chips = this.box.querySelector("[data-filter]"), list = this.box.querySelector("[data-list]"), pager = this.box.querySelector("[data-pager]"), count = this.box.querySelector("[data-count]");
    const chip = (id, name, n) => catui.html`<button class="Catui_dk-chip" type="button" data-tag="${id}" aria-pressed="${id === tag}">${id === tag ? catui.icon("check", 16) : ""}${name}<span class="Catui_dk-chip-n">${n}${dkClip("개")}</span></button>`;
    if (chips) catui.mount(chips, catui.html`${chip("", "전체", d.posts.length)}${d.tags.map((t) => chip(t.id, `#${t.name}`, d.count[t.id] || 0))}`);
    if (list) catui.mount(list, v.rows.length ? catui.html`${v.rows.map((p) => docs.card(p))}` : docs.empty("이 태그의 글이 아직 없습니다"));
    if (pager) { catui.mount(pager, docs.pager(v.page, v.pages)); pager.hidden = v.pages <= 1; }
    if (count) count.textContent = `${tag ? `#${d.T[tag].name} ` : ""}글 ${v.total}개 · ${v.page}/${v.pages}쪽`;
    if (focusSel) {
      // 다시 그려도 누른 버튼 자리로 포커스를 돌려준다 (잠긴 이전/다음이면 현재 쪽 번호로)
      const el = this.box.querySelector(focusSel);
      (el && !el.disabled ? el : this.box.querySelector('[aria-current="page"]') || this.box.querySelector("[data-tag]"))?.focus({ preventScroll: true });
    }
    docs.emit("filter", { tag, page: v.page, total: v.total });
  },
};

docs.post = {
  init(root) {
    const art = root.querySelector("[data-catui-dk-post]");
    if (!art) return;
    this.ready = docs.blog().then((d) => {
      const id = docs.query().get("id"), p = d.byId[id] || d.posts[0];
      if (!p) return null;
      const $ = (s) => art.querySelector(s);
      document.title = `${p.title} · Catui 문서`;
      $("[data-title]").textContent = p.title;
      catui.mount($("[data-tags]"), dkTags(p));
      catui.mount($("[data-meta]"), catui.html`${dkAvatar(p.authorObj, "sm")}${docs.meta(p)}`);
      catui.mount($("[data-cover]"), dkCover(p, true));
      catui.mount($("[data-body]"), catui.html`${p.summary ? catui.html`<p class="Catui_lead">${p.summary}</p>` : ""}${docs.blocks(p.body)}`);
      root.querySelectorAll("[data-catui-share]").forEach((b) => b.setAttribute("data-catui-share-title", p.title));
      const who = root.querySelector("[data-author-box]");
      if (who) catui.mount(who, catui.html`${dkAvatar(p.authorObj, "lg")}<div><p class="Catui_dk-who-n"><a href="author.html?a=${encodeURIComponent(p.authorObj.id)}">${p.authorObj.name}</a><span>${p.authorObj.role || ""}</span></p><p>${p.authorObj.bio || ""}</p></div>`);
      const rel = root.querySelector("[data-related]");
      if (rel) {
        const near = d.posts.filter((x) => x.id !== p.id).map((x) => ({ x, n: (x.tags || []).filter((t) => (p.tags || []).includes(t)).length })).filter((o) => o.n > 0).sort((a, b) => b.n - a.n).slice(0, docs.rules.related).map((o) => o.x);
        catui.mount(rel, near.length ? catui.html`${near.map((x) => docs.card(x))}` : docs.empty("관련 글이 없습니다"));
      }
      docs.refresh(art);
      return p;
    }, () => null);
  },
};

docs.tagPage = {
  init(root) {
    const box = root.querySelector("[data-catui-dk-tagpage]");
    if (!box) return;
    this.ready = docs.blog().then((d) => {
      const t = d.T[docs.query().get("t")] || null;
      const $ = (s) => box.querySelector(s);
      catui.mount($("[data-cloud]"), catui.html`${d.tags.map((x) => catui.html`<li><a class="Catui_dk-tag" href="tag.html?t=${encodeURIComponent(x.id)}" ${t && x.id === t.id ? catui.html`aria-current="page"` : ""}>#${x.name}<span class="Catui_dk-chip-n">${d.count[x.id] || 0}${dkClip("개")}</span></a></li>`)}`);
      if (t) { $("[data-title]").textContent = `#${t.name}`; $("[data-desc]").textContent = t.desc || ""; document.title = `#${t.name} · Catui 문서`; }
      const rows = t ? d.posts.filter((p) => (p.tags || []).includes(t.id)) : d.posts;
      catui.mount($("[data-list]"), rows.length ? catui.html`${rows.map((p) => docs.card(p))}` : docs.empty("이 태그의 글이 아직 없습니다"));
      return t;
    }, () => null);
  },
};

docs.authorPage = {
  init(root) {
    const box = root.querySelector("[data-catui-dk-author]");
    if (!box) return;
    this.ready = docs.blog().then((d) => {
      const a = d.A[docs.query().get("a")] || d.authors[0];
      if (!a) return null;
      const $ = (s) => box.querySelector(s);
      $("[data-title]").textContent = a.name;
      document.title = `${a.name} · Catui 문서`;
      catui.mount($("[data-profile]"), catui.html`${dkAvatar(a, "xl")}<div><p class="Catui_dk-who-n"><span>${a.role || ""}</span></p><p>${a.bio || ""}</p>${a.site ? catui.html`<p><a class="Catui_link" href="${a.site}" rel="noopener" target="_blank">${a.site.replace(/^https:\/\//, "")}${dkClip(" (새 창)")}</a></p>` : ""}</div>`);
      const rows = d.posts.filter((p) => p.author === a.id);
      catui.mount($("[data-list]"), rows.length ? catui.html`${rows.map((p) => docs.card(p))}` : docs.empty("아직 쓴 글이 없습니다"));
      const others = $("[data-others]");
      if (others) catui.mount(others, catui.html`${d.authors.filter((x) => x.id !== a.id).map((x) => catui.html`<li><a href="author.html?a=${encodeURIComponent(x.id)}">${dkAvatar(x, "sm")}<span>${x.name}</span></a></li>`)}`);
      return a;
    }, () => null);
  },
};

docs.recent = {
  init(root) {
    const boxes = root.querySelectorAll('[data-catui-dk-posts="recent"]');
    if (!boxes.length) return;
    this.ready = docs.blog().then((d) => boxes.forEach((b) => catui.mount(b, catui.html`${d.posts.slice(0, Number(b.dataset.size) || docs.rules.recent).map((p) => docs.card(p))}`)), () => null);
  },
};

docs.changelog = {
  kinds: DK_KINDS,
  /** 종류 배지: 글자("추가")와 색을 함께 */
  badge: (kind) => { const k = DK_KINDS[kind] || [kind, "Catui_badge-neutral"]; return catui.html`<span class="Catui_badge ${k[1]} Catui_dk-kind">${k[0]}</span>`; },
  init(root) {
    const box = root.querySelector("[data-catui-dk-changelog]");
    if (!box) return;
    this.ready = docs.data("changelog").then((rows) => {
      const list = box.querySelector("[data-list]") || box;
      catui.mount(list, catui.html`${rows.map((r, i) => catui.html`<section class="Catui_dk-release" aria-labelledby="v-${String(r.version).replace(/\W/g, "-")}"><h2 id="v-${String(r.version).replace(/\W/g, "-")}">v${r.version}</h2><p class="Catui_dk-meta"><time datetime="${r.date}">${docs.date(r.date)}</time>${i === 0 ? catui.html`<span class="Catui_pill Catui_pill-success">최신</span>` : ""}</p><ul class="Catui_dk-changes">${(r.items || []).map((it) => catui.html`<li data-kind="${it.type}">${this.badge(it.type)}<span>${catui.raw(docs.mdInline(it.text))}</span></li>`)}</ul></section>`)}`);
      const f = box.querySelector("[data-kinds]");
      if (f && docs._once(f, "kinds")) {
        const paint = (k) => {
          f.querySelectorAll("[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
          list.querySelectorAll("[data-kind]").forEach((li) => { li.hidden = !!k && li.dataset.kind !== k; });
          list.querySelectorAll(".Catui_dk-release").forEach((s) => { s.hidden = !s.querySelector("[data-kind]:not([hidden])"); });
        };
        docs._on(f, "click", (e) => { const b = e.target.closest("[data-k]"); if (b) paint(b.dataset.k); });
        paint("");
      }
      docs.refresh(box.closest("article") || box);
      return rows;
    }, () => null);
  },
};
