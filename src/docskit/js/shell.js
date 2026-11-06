// shell — 문서 셸: 왼쪽 메뉴(data/nav.json) · 문서 본문(data/pages.json) · 이전/다음 · 피드백 · 버전 선택 · 읽는 시간
//   [data-catui-dk-nav]                  왼쪽 문서 메뉴 — 지금 쪽(파일 이름 + ?p=)에 aria-current="page"
//   <details class="Catui_dk-side">      좁은 화면(991px 이하)에서는 접어서 시작, 넓으면 펼침
//   [data-catui-dk-page="intro"]         문서 본문을 pages.json에서 그림(주소 ?p= 가 우선): 제목·마지막 수정일·편집 링크·본문 블록
//   [data-catui-dk-pager]                이전·다음 문서 (nav.json 순서)
//   <article data-catui-dk-toc="#상자">  본문을 다 그린 뒤 목차·제목 앵커·코드 복사를 붙인다(docs.refresh)
//   [data-catui-dk-readtime="#본문"]     읽는 시간 글자 "3분 읽기" (값이 없으면 가장 가까운 article)
//   [data-catui-dk-feedback="키"]        "도움이 되었나요?" 예/아니오(aria-pressed) — 키마다 기억, 다시 열어도 표시
//   select[data-catui-dk-version]        버전 선택: option value(주소)로 이동, ?v= 에 맞는 항목을 고르고 옛 버전이면 [data-catui-dk-old] 안내를 보임
docs.pageKey = (href = location.href) => { const u = new URL(href, location.href); const f = u.pathname.split("/").pop() || "index.html"; const p = u.searchParams.get("p"); return p ? `${f}?p=${p}` : f; };

/** 본문을 바꾼 뒤 부르기: 코드 복사 · 목차 · 읽는 시간 */
docs.refresh = function (article) {
  const art = catui.el(article);
  if (!art) return;
  docs.code(art);
  const sel = art.getAttribute("data-catui-dk-toc");
  if (sel != null) docs.toc(art, sel ? document.querySelector(sel) : null);
  docs.readTimeFill(document);
};
docs.readTimeFill = function (scope = document) {
  scope.querySelectorAll("[data-catui-dk-readtime]").forEach((el) => {
    const sel = el.getAttribute("data-catui-dk-readtime");
    let t = null;
    try { t = sel ? document.querySelector(sel) : el.closest("article"); } catch { t = null; }
    if (t) el.textContent = `${docs.readTime(t).label} 읽기`;
  });
};

docs.shell = {
  init(root) {
    // 좁은 화면은 메뉴를 접어서 시작 (스크립트가 없으면 펼친 그대로)
    root.querySelectorAll("details.Catui_dk-side").forEach((d) => { d.open = !matchMedia("(max-width: 991px)").matches; });
    root.querySelectorAll("[data-catui-dk-toc]").forEach((art) => { if (!art.hasAttribute("data-catui-dk-page")) docs.refresh(art); });
    if (!root.querySelector("[data-catui-dk-toc]")) docs.code(root.querySelector(".Catui_dk-main") || root);
    docs.readTimeFill(root);
    const nav = root.querySelector("[data-catui-dk-nav]"), pager = root.querySelector("[data-catui-dk-pager]"), page = root.querySelector("[data-catui-dk-page]");
    if (!nav && !pager && !page) return;
    this.ready = Promise.all([docs.data("nav"), page ? docs.data("pages") : null]).then(([groups, pages]) => {
      const flat = groups.flatMap((g) => g.items);
      let key = docs.pageKey();
      if (page) {
        const id = pages[docs.query().get("p")] ? docs.query().get("p") : page.getAttribute("data-catui-dk-page");
        key = `${location.pathname.split("/").pop() || "doc.html"}?p=${id}`;
        this.drawPage(page, pages[id], id);
      }
      if (nav) catui.mount(nav, catui.html`${groups.map((g, i) => catui.html`<div class="Catui_dk-nav-g"><p class="Catui_dk-nav-t" id="dk-nav-g${i}">${g.title}</p><ul aria-labelledby="dk-nav-g${i}">${g.items.map((it) => catui.html`<li><a href="${it.href}" ${docs.pageKey(it.href) === key ? catui.html`aria-current="page"` : ""}>${it.title}</a></li>`)}</ul></div>`)}`);
      if (pager) {
        const i = flat.findIndex((it) => docs.pageKey(it.href) === key), prev = flat[i - 1], next = i < 0 ? null : flat[i + 1];
        catui.mount(pager, catui.html`${prev ? catui.html`<a class="Catui_dk-pn" href="${prev.href}"><span>${catui.icon("arrow-left", 16)}이전</span><b>${prev.title}</b></a>` : catui.html`<span></span>`}${next ? catui.html`<a class="Catui_dk-pn Catui_dk-pn-next" href="${next.href}"><span>다음${catui.icon("arrow-right", 16)}</span><b>${next.title}</b></a>` : ""}`);
      }
      return groups;
    }, () => null);
  },
  /** pages.json 한 쪽 → 제목·수정일·편집 링크·본문 */
  drawPage(box, pg, id) {
    if (!pg) return;
    const $ = (s) => box.querySelector(s);
    if ($("[data-title]")) $("[data-title]").textContent = pg.title;
    if ($("[data-crumb]")) $("[data-crumb]").textContent = pg.group || "문서";
    if ($("[data-desc]")) $("[data-desc]").textContent = pg.desc || "";
    document.title = `${pg.title} · Catui 문서`;
    catui.mount($("[data-body]"), docs.blocks(pg.blocks));
    box.closest("[data-catui-dk]")?.querySelectorAll("[data-updated]").forEach((t) => { t.setAttribute("datetime", pg.updated); t.textContent = docs.date(pg.updated); });
    box.closest("[data-catui-dk]")?.querySelectorAll("[data-edit]").forEach((a) => { if (/^https:\/\//.test(pg.edit || "")) a.href = pg.edit; });
    box.closest("[data-catui-dk]")?.querySelectorAll("[data-catui-dk-feedback]").forEach((f) => { f.setAttribute("data-catui-dk-feedback", `doc:${id}`); docs.feedback.paint(f); });
    docs.refresh(box);
  },
};

docs.feedback = {
  get: (key) => (dkGet("helped", {}) || {})[key] || "",
  set(key, value) { const all = { ...(dkGet("helped", {}) || {}) }; if (value) all[key] = value; else delete all[key]; dkSet("helped", all); docs.emit("feedback", { key, value }); },
  keyOf: (box) => box.getAttribute("data-catui-dk-feedback") || docs.pageKey(),
  paint(box) {
    const v = this.get(this.keyOf(box));
    box.querySelectorAll("[data-vote]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vote === v)));
    const msg = box.querySelector("[data-msg]");
    if (msg) msg.textContent = v === "yes" ? "알려 주셔서 고맙습니다. 다음 문서도 이렇게 쓰겠습니다." : v === "no" ? "고맙습니다. 무엇이 부족했는지 ‘이 쪽 고치기’로 알려 주시면 바로 손보겠습니다." : "";
  },
  init(root) {
    root.querySelectorAll("[data-catui-dk-feedback]").forEach((box) => {
      this.paint(box);
      if (!docs._once(box, "fb")) return;
      docs._on(box, "click", (e) => {
        const b = e.target.closest("[data-vote]");
        if (!b) return;
        const key = this.keyOf(box), v = this.get(key) === b.dataset.vote ? "" : b.dataset.vote;   // 같은 답을 다시 누르면 취소
        this.set(key, v);
        this.paint(box);
      });
    });
  },
};

docs.version = {
  /** 이동 (테스트·SPA에서 바꿔 끼울 수 있게 함수로 둔다) */
  go: (href) => location.assign(href),
  init(root) {
    root.querySelectorAll("select[data-catui-dk-version]").forEach((sel) => {
      const v = docs.query().get("v");
      const opts = [...sel.options], cur = opts.find((o) => new URL(o.value, location.href).searchParams.get("v") === v) || opts[0];
      if (cur) sel.value = cur.value;
      const latest = opts[0] && cur === opts[0];
      root.querySelectorAll("[data-catui-dk-old]").forEach((n) => { n.hidden = latest; const b = n.querySelector("[data-ver]"); if (b && cur) b.textContent = cur.textContent.trim(); });
      root.querySelectorAll("[data-catui-dk-vername]").forEach((n) => { if (cur) n.textContent = cur.textContent.replace(/\s*\(.*\)$/, "").trim(); });
      if (!docs._once(sel, "ver")) return;
      docs._on(sel, "change", () => { docs.emit("version", { href: sel.value }); this.go(sel.value); });
    });
  },
};
