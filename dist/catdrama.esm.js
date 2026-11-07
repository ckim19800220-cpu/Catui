/*! CatuiDrama 2.0.0 | MIT License (c) imcatDevs */
import catui from "./catui.esm.js";
const DR_GENRES = ["로맨스", "스릴러", "판타지", "일상"], DR_FORMATS = ["실사", "애니", "AI"];
const drStored = () => { const v = catui.data("drama").saved; return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; };
const drNorm = (s) => String(s).normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s/g, "");
const drUrl = (page, id) => `${page}.html?id=${encodeURIComponent(id)}`;
const drama = {
  version: catui.version, root: null, dataBase: "data/", photoBase: "../../../assets/photos/", items: [], ready: Promise.resolve(), _offs: [], _turn: 0,
  _on(el, type, fn, opt) { if (!el) return; el.addEventListener(type, fn, opt); this._offs.push(() => el.removeEventListener(type, fn, opt)); },
  load() {
    const url = new URL("series.json", new URL(this.dataBase, location.href)).href;
    if (this._pending && this._url === url) return this._pending;
    this._url = url;
    const pending = fetch(url, { headers: { Accept: "application/json" } }).then((r) => { if (!r.ok) throw new Error("catalog response"); return r.json(); }).then((rows) => {
      if (!Array.isArray(rows) || new Set(rows.map((x) => x?.id)).size !== rows.length || rows.some((s) => !s || typeof s.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(s.id) || typeof s.title !== "string" || !s.title.trim() || s.title.length > 160 || typeof s.desc !== "string" || s.desc.length > 2000 || !DR_GENRES.includes(s.genre) || !DR_FORMATS.includes(s.format) || !Number.isInteger(s.episodes) || s.episodes < 1 || s.episodes > 1000 || !Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 60 || !["완결", "연재 중"].includes(s.status) || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !/^[a-z0-9-]+\.(jpg|png)$/.test(s.photo))) throw new Error("catalog shape");
      return rows;
    }).catch((e) => { if (this._pending === pending) this._pending = null; throw e; });
    this._pending = pending; return pending;
  },
  state() {
    const q = new URLSearchParams(location.search), page = Number(q.get("page"));
    return { q: (q.get("q") || "").slice(0, 80), g: DR_GENRES.includes(q.get("g")) ? q.get("g") : "", t: DR_FORMATS.includes(q.get("t")) ? q.get("t") : "", sort: ["new", "title", "short"].includes(q.get("sort")) ? q.get("sort") : "new", page: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1 };
  },
  filtered(s = this.state()) {
    const q = drNorm(s.q);
    const rows = this.items.filter((x) => (!s.g || x.genre === s.g) && (!s.t || x.format === s.t) && (!q || drNorm(`${x.title} ${x.desc} ${x.genre} ${x.format}`).includes(q)));
    if (s.sort === "title") rows.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    else if (s.sort === "short") rows.sort((a, b) => a.minutes - b.minutes || b.date.localeCompare(a.date));
    else rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  },
  cover(s, eager = false) {
    const u = new URL(s.photo, new URL(this.photoBase, location.href));
    const safe = u.protocol === "https:" || (u.protocol === "http:" && u.origin === location.origin);
    return catui.html`<div class="Catui_dr-cover"><em class="Catui_dr-state">${s.status}</em>${safe ? catui.html`<img src="${u.href}" width="480" height="720" alt="" loading="${eager ? "eager" : "lazy"}" decoding="async">` : ""}<span aria-hidden="true"><small>CatuiDrama · ${s.format}</small><b>${s.title}</b></span></div>`;
  },
  saveButton(s) {
    const on = drStored().includes(s.id);
    return catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-save="${s.id}" aria-pressed="${on}" aria-label="${s.title} ${on ? "찜 해제" : "찜하기"}">${on ? "찜 해제" : "찜"}</button>`;
  },
  card(s, eager = false) {
    return catui.html`<article class="Catui_dr-card"><a class="Catui_dr-art" href="${drUrl("series", s.id)}">${this.cover(s, eager)}<h3 class="Catui_dr-name">${s.title}</h3></a><div class="Catui_dr-caption"><p class="Catui_dr-meta">${s.genre} · ${s.format}<br>${s.episodes}부작 · 회당 ${s.minutes}분</p>${this.saveButton(s)}</div></article>`;
  },
  grid(rows) { return catui.html`<ul class="Catui_dr-grid">${rows.map((s) => catui.html`<li>${this.card(s)}</li>`)}</ul>`; },
  empty(title, text, href = "catalog.html", action = "작품 찾기") { return catui.html`<div class="Catui_empty"><h2 class="Catui_empty-title">${title}</h2><p class="Catui_empty-text">${text}</p><a class="Catui_btn Catui_btn-md Catui_btn-secondary" href="${href}">${action}</a></div>`; },
  syncForm() { const s = this.state(); for (const f of this.root.querySelectorAll("form[data-filter]")) for (const k of ["q", "g", "t", "sort"]) if (f.elements[k]) f.elements[k].value = s[k]; },
  announce(text) { const live = this.root?.querySelector("[data-catui-dr-live]"); if (live) live.textContent = text; },
  _facets() {
    const state = this.state();
    return catui.html`<div class="Catui_dr-facets">${[["t", "형식", DR_FORMATS], ["g", "장르", DR_GENRES]].map(([key, label, values]) => catui.html`<nav class="Catui_dr-tags" aria-label="${label} 선택"><b>${label}</b>${["", ...values].map((value) => { const u = new URL(location.href); u.hash = ""; u.searchParams.delete("page"); if (value) u.searchParams.set(key, value); else u.searchParams.delete(key); return catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="${u.pathname}${u.search}" data-facet-key="${key}"${state[key] === value ? catui.html` aria-current="true"` : ""}>${value || "전체"}</a>`; })}</nav>`)}</div>`;
  },
  _episodes(item) {
    const entries = (from, count) => Array.from({ length: count }, (_, i) => catui.html`<li><b>${from + i}화</b><span class="Catui_dr-meta">영상 연동 전</span></li>`);
    return catui.html`<section class="Catui_dr-section" aria-labelledby="dr-episodes"><div class="Catui_dr-sec-head"><h2 class="Catui_h2" id="dr-episodes">회차 안내</h2><p class="Catui_dr-meta">총 ${item.episodes}화 · 재생 미제공</p></div><ol class="Catui_dr-episodes" data-episodes-preview>${entries(1, Math.min(12, item.episodes))}</ol>${item.episodes > 12 ? catui.html`<details class="Catui_dr-more" data-episode-more><summary>나머지 ${item.episodes - 12}개 회차</summary><ol class="Catui_dr-episodes" start="13">${entries(13, item.episodes - 12)}</ol></details>` : ""}</section>`;
  },
  _detail(item) {
    const related = this.items.filter((x) => x.id !== item.id && (x.genre === item.genre || x.format === item.format)).sort((a, b) => Number(b.genre === item.genre) - Number(a.genre === item.genre)).slice(0, 6);
    return catui.html`<nav class="Catui_dr-tags" aria-label="현재 위치"><a class="Catui_link" href="index.html">홈</a><span aria-hidden="true">/</span><a class="Catui_link" href="catalog.html?g=${encodeURIComponent(item.genre)}">${item.genre}</a><span aria-hidden="true">/</span><span aria-current="page">작품 소개</span></nav><section class="Catui_dr-detail" aria-labelledby="dr-series-title">${this.cover(item, true)}<div class="Catui_dr-copy"><h2 class="Catui_h1" id="dr-series-title">${item.title}</h2><p class="Catui_dr-tags"><a class="Catui_badge Catui_link" href="catalog.html?g=${encodeURIComponent(item.genre)}">${item.genre}</a><a class="Catui_badge Catui_link" href="catalog.html?t=${encodeURIComponent(item.format)}">${item.format}</a><span class="Catui_badge">${item.status}</span></p><p class="Catui_dr-synopsis">${item.desc}</p><p class="Catui_dr-meta">가상 ${item.episodes}부작 · 회당 ${item.minutes}분 · 전체 약 ${item.episodes * item.minutes}분 · 이용등급 미정</p><div>${this.saveButton(item)}</div><p class="Catui_banner Catui_banner-info">작품·줄거리는 가상 예제입니다. 아래는 회차 구성 견본이며 영상은 제공하지 않습니다.</p></div></section>${this._episodes(item)}${related.length ? catui.html`<section class="Catui_dr-section" data-related aria-labelledby="dr-related"><div class="Catui_dr-sec-head"><h2 class="Catui_h2" id="dr-related">함께 둘러볼 작품</h2><a class="Catui_link" href="catalog.html?g=${encodeURIComponent(item.genre)}">같은 장르 더 보기</a></div><p class="Catui_dr-meta">같은 장르를 먼저, 이어서 같은 형식의 가상 작품을 소개합니다.</p>${this.grid(related)}</section>` : ""}`;
  },
  render() {
    const root = this.root, box = root.querySelector("[data-view]"), page = root.dataset.page, s = this.state();
    let rows = this.filtered(s), markup, status = "";
    if (page === "index") {
      catui.mount(root.querySelector("[data-feature]"), catui.html`${this.items.slice(0, 4).map((x) => this.card(x, true))}`);
      markup = this.items.length ? catui.html`<section class="Catui_dr-section" aria-labelledby="dr-discover"><div class="Catui_dr-sec-head"><h2 class="Catui_h2" id="dr-discover">오늘의 발견</h2><a class="Catui_link" href="catalog.html">전체 작품</a></div>${this.grid(this.items.slice(4, 10))}</section><section class="Catui_dr-section" aria-labelledby="dr-genres"><h2 class="Catui_h2" id="dr-genres">어떤 이야기를 찾으세요?</h2><div class="Catui_dr-tags">${DR_GENRES.map((g) => catui.html`<a class="Catui_btn Catui_btn-lg Catui_btn-secondary" href="catalog.html?g=${encodeURIComponent(g)}">${g}</a>`)}</div><nav class="Catui_dr-tags" aria-label="형식별 작품">${DR_FORMATS.map((t) => catui.html`<a class="Catui_link" href="catalog.html?t=${encodeURIComponent(t)}">${t} 드라마</a>`)}</nav><p class="Catui_dr-meta">가상 작품 ${this.items.length}편으로 탐색과 보관함을 체험할 수 있습니다.</p></section>` : this.empty("준비된 작품이 없습니다", "작품이 등록되면 이곳에서 소개합니다.");
    } else if (page === "series") {
      const item = this.items.find((x) => x.id === new URLSearchParams(location.search).get("id"));
      if (!item) markup = this.empty("작품을 찾을 수 없습니다", "주소가 바뀌었거나 없는 작품입니다. 전체 목록에서 다시 골라 주세요.");
      else markup = this._detail(item);
    } else if (page === "ranking") {
      rows = this.items.filter((x) => (!s.g || x.genre === s.g) && (!s.t || x.format === s.t) && (!s.q || drNorm(`${x.title} ${x.desc}`).includes(drNorm(s.q))));
      markup = rows.length ? catui.html`<ol class="Catui_dr-rank">${rows.slice(0, 10).map((x, i) => catui.html`<li><strong>${i + 1}<span class="Catui_clip">위</span></strong><a class="Catui_dr-rank-art" href="${drUrl("series", x.id)}" aria-label="${x.title} 작품 소개">${this.cover(x)}<div><b>${x.title}</b><p class="Catui_dr-meta">${x.genre} · ${x.format} · ${x.episodes}부작 · ${x.status}</p><p class="Catui_dr-rank-desc">${x.desc}</p></div></a>${this.saveButton(x)}</li>`)}</ol>` : this.empty("조건에 맞는 작품이 없습니다", "다른 검색어나 분류로 찾아보세요.", "ranking.html", "조건 초기화");
      status = `예제 편집 순위 ${Math.min(10, rows.length)}편 · 실제 인기 집계가 아닙니다`;
    } else {
      if (page === "library") rows = this.items.filter((x) => drStored().includes(x.id));
      const count = rows.length, pages = Math.max(1, Math.ceil(count / 12)), at = Math.min(s.page, pages);
      markup = count ? catui.html`${this.grid(rows.slice((at - 1) * 12, at * 12))}${pages > 1 ? catui.html`<nav class="Catui_dr-pages" aria-label="작품 페이지">${Array.from({ length: pages }, (_, i) => { const u = new URL(location.href); u.searchParams.set("page", i + 1); return catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-secondary" href="${u.pathname}${u.search}" data-page-link${i + 1 === at ? catui.html` aria-current="page"` : ""}>${i + 1}</a>`; })}</nav>` : ""}` : page === "library" ? this.empty("찜한 작품이 없습니다", "마음에 드는 작품에서 찜을 눌러 나만의 목록을 만들어 보세요.") : this.empty("조건에 맞는 작품이 없습니다", "검색어를 바꾸거나 선택 조건을 초기화해 보세요.", "catalog.html", "조건 초기화");
      status = `${count}개 작품 · ${at}/${pages}페이지${page === "library" ? "" : ` · ${s.g || "전체 장르"} · ${s.t || "전체 형식"}${s.q ? ` · “${s.q}” 검색 결과` : ""}`}`;
    }
    if (["catalog", "search", "ranking"].includes(page)) markup = catui.html`${this._facets()}${markup}`;
    catui.mount(box, markup);
    const result = root.querySelector("[data-status]"); if (result) result.textContent = status;
    this.updateSaved();
  },
  updateSaved() {
    const saved = drStored();
    this.root?.querySelectorAll("[data-save]").forEach((b) => { const item = this.items.find((x) => x.id === b.dataset.save); if (!item) return; const on = saved.includes(item.id); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", `${item.title} ${on ? "찜 해제" : "찜하기"}`); b.textContent = on ? "찜 해제" : "찜"; });
  },
  _focusResult() {
    const status = this.root?.querySelector("[data-status]");
    const target = status?.textContent.trim() ? status : this.root?.querySelector('[data-view] h2, h1');
    if (!target) return;
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
      const clear = () => { if (target.getAttribute("tabindex") === "-1") target.removeAttribute("tabindex"); };
      this._on(target, "blur", clear, { once: true }); this._offs.push(clear);
    }
    target.focus({ preventScroll: true });
  },
  refresh(focus = false) {
    const root = this.root, turn = ++this._turn, box = root.querySelector("[data-view]");
    box.setAttribute("aria-busy", "true");
    this.ready = this.load().then((items) => {
      if (this.root !== root || this._turn !== turn) return this;
      this._available = true; this.items = items; this.render();
      if (focus && document.activeElement === document.body) this._focusResult();
      return this;
    }).catch(() => {
      if (this.root !== root || this._turn !== turn) return this;
      this._available = false;
      const feature = root.querySelector("[data-feature]"), status = root.querySelector("[data-status]");
      if (feature && !feature.querySelector(".Catui_dr-card")) catui.mount(feature, catui.html`<p class="Catui_help">추천작을 불러오지 못했습니다. 아래에서 다시 시도해 주세요.</p>`);
      if (status) status.textContent = "";
      catui.mount(box, catui.html`<div class="Catui_empty" role="alert"><h2 class="Catui_empty-title">작품을 불러오지 못했습니다</h2><p class="Catui_empty-text">연결 상태를 확인한 뒤 다시 시도해 주세요. 검색 조건과 찜은 유지됩니다.</p><button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-retry>다시 시도</button></div>`);
      if (focus && document.activeElement === document.body) box.querySelector("[data-retry]")?.focus({ preventScroll: true });
      return this;
    }).finally(() => { if (this.root === root && this._turn === turn) box.removeAttribute("aria-busy"); });
    return this.ready;
  },
  applyTheme(dark) {
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark"); else document.documentElement.removeAttribute("data-catui-theme");
    this.root?.querySelectorAll("[data-catui-dr-theme]").forEach((b) => { b.setAttribute("aria-pressed", String(dark)); b.textContent = dark ? "밝은 화면" : "어두운 화면"; });
  },
  init(scope = document) {
    const root = scope.matches?.("[data-catui-dr]") ? scope : scope.querySelector?.("[data-catui-dr]");
    if (!root || root === this.root) return this;
    this.destroy(); this._available = false; this.root = root; root.setAttribute("data-catui-dr-ready", "");
    if (!document.documentElement.hasAttribute("data-catui-theme-lock")) { const theme = catui.data("drama").theme; this.applyTheme(typeof theme === "boolean" ? theme : matchMedia("(prefers-color-scheme: dark)").matches); }
    this.syncForm();
    this._on(root, "error", (e) => { if (e.target.matches?.(".Catui_dr-cover img")) e.target.hidden = true; }, true);
    this._on(root, "click", (e) => {
      const theme = e.target.closest("[data-catui-dr-theme]");
      if (theme) { const dark = document.documentElement.getAttribute("data-catui-theme") !== "dark"; catui.data("drama", { key: "theme", value: dark }); this.applyTheme(dark); return; }
      const retry = e.target.closest("[data-retry]"); if (retry) { this.refresh(document.activeElement === retry); return; }
      const saved = e.target.closest("[data-save]");
      if (saved) {
        const item = this.items.find((x) => x.id === saved.dataset.save); if (!item) return;
        const ids = drStored(), on = ids.includes(item.id), index = [...root.querySelectorAll("[data-save]")].indexOf(saved);
        catui.data("drama", { key: "saved", value: on ? ids.filter((id) => id !== item.id) : [...ids, item.id] });
        if (root.dataset.page === "library") { this.render(); const next = [...root.querySelectorAll("[data-save]")]; (next[Math.min(index, next.length - 1)] || root.querySelector("[data-status]"))?.focus({ preventScroll: true }); }
        else this.updateSaved();
        this.announce(`${item.title} ${on ? "찜을 해제했습니다" : "찜 보관함에 추가했습니다"}`); return;
      }
      const facet = e.target.closest("[data-facet-key]");
      if (facet && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
        const key = facet.dataset.facetKey; if (!["g", "t"].includes(key)) return;
        e.preventDefault(); history.pushState(null, "", facet.href);
        if (this._available) { this.render(); root.querySelector(`[data-facet-key="${key}"][aria-current="true"]`)?.focus({ preventScroll: true }); } else this.refresh();
        return;
      }
      const page = e.target.closest("[data-page-link]"); if (page && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); history.pushState(null, "", page.href); this.render(); root.querySelector("[data-status]")?.focus({ preventScroll: true }); }
    });
    this._on(root, "keydown", (e) => { if (e.key === "Enter" && e.target.closest("form[data-filter]") && catui.imeBusy(e)) e.preventDefault(); });
    this._on(root, "submit", (e) => {
      if (!e.target.matches("form[data-filter]")) return;
      e.preventDefault(); const f = e.target, u = new URL(location.href); u.search = "";
      for (const key of ["q", "g", "t", "sort"]) { const value = (f.elements[key]?.value ?? this.state()[key]).trim(); if (value && (key !== "sort" || value !== "new")) u.searchParams.set(key, value); }
      history.pushState(null, "", u.href); this.refresh();
    });
    this._on(window, "popstate", () => { this.syncForm(); this.refresh(); });
    this._on(window, "storage", (e) => { if (e.key !== "catui:drama" || !this._available) return; if (root.dataset.page === "library") this.render(); else this.updateSaved(); });
    const reveal = () => { const nav = root.querySelector(".Catui_dr-nav"), item = nav?.querySelector('[aria-current="page"]'); if (!item) return; const a = nav.getBoundingClientRect(), b = item.getBoundingClientRect(); if (b.left < a.left) nav.scrollLeft += b.left - a.left; else if (b.right > a.right) nav.scrollLeft += b.right - a.right; };
    this._on(window, "resize", reveal); reveal(); this.refresh(); return this;
  },
  destroy() { ++this._turn; this._offs.splice(0).forEach((off) => off()); this.root?.removeAttribute("data-catui-dr-ready"); this.root = null; },
};
drama.ready = Promise.resolve(drama);
catui.extend({ drama });
catui.use(() => { if (catui.config().autoInit !== false) drama.init(); });

export { drama };
export default drama;
