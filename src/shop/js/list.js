// list — 상품 목록 · 검색 결과
//   <section data-catui-sh-list="list|search" data-size="12">
//   · 주소 ↔ 화면: ?c=분류 &q=검색어 &sort=best|new|low|high|review|rate &price=10000-30000 &free=1 &today=1 &instock=1 &brand=a,b &page=N
//     (새로 고침·공유해도 같은 목록, 뒤로 가기로 이전 조건 — 필터 폼은 그대로 두고 결과만 다시 그려 포커스를 잃지 않는다)
//   · 보기: 바둑판 / 목록 (기억) · 품절 상품은 정렬과 관계없이 맨 뒤
const SH_SORTS = { best: "판매순", new: "신상품순", low: "낮은 가격순", high: "높은 가격순", review: "리뷰 많은순", rate: "할인율순" };
const SH_PRICES = [["", "전체"], ["0-10000", "1만원 미만"], ["10000-30000", "1만~3만원"], ["30000-100000", "3만~10만원"], ["100000-", "10만원 이상"]];
shop.list = {
  sorts: SH_SORTS,
  prices: SH_PRICES,
  init(root) { root.querySelectorAll("[data-catui-sh-list]").forEach((box) => this.mount(box)); },
  /** 주소 → 조건 */
  read(qs = shop.query()) {
    return { c: qs.get("c") || "", q: (qs.get("q") || "").trim(), sort: SH_SORTS[qs.get("sort")] ? qs.get("sort") : "best", price: qs.get("price") || "",
      free: qs.get("free") === "1", today: qs.get("today") === "1", instock: qs.get("instock") === "1", brands: (qs.get("brand") || "").split(",").filter(Boolean), page: Math.max(1, Math.floor(Number(qs.get("page"))) || 1) };
  },
  /** 조건으로 거르고 정렬한 상품 (DOM 없이 쓸 수 있음) */
  filter(products, o) {
    const words = (o.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const [lo, hi] = (o.price || "").split("-").map((x) => (x === "" || x == null ? null : Number(x)));
    let rows = products.filter((p) => (!o.c || p.cat === o.c)
      && (!words.length || words.every((w) => `${p.name} ${p.brand} ${p.catName || ""} ${p.summary || ""}`.toLowerCase().includes(w)))
      && (lo == null || p.sale >= lo) && (hi == null || p.sale < hi)
      && (!o.free || p.ship === "free") && (!o.today || p.ship === "today") && (!o.instock || !p.soldOut)
      && (!o.brands?.length || o.brands.includes(p.brand)));
    const by = { best: (a, b) => b.sold - a.sold, new: (a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0), low: (a, b) => a.sale - b.sale, high: (a, b) => b.sale - a.sale, review: (a, b) => b.reviewCount - a.reviewCount, rate: (a, b) => b.rateShown - a.rateShown }[o.sort || "best"];
    rows = [...rows].sort(by);
    return [...rows.filter((p) => !p.soldOut), ...rows.filter((p) => p.soldOut)];
  },
  mount(box) {
    if (!shop._once(box, "list")) return;
    const kind = box.getAttribute("data-catui-sh-list"), size = Number(box.dataset.size || 12);
    return shLoadView(box, () => shop.load(), (d) => {
      const o0 = this.read();
      const cat = d.C[o0.c];
      const base = this.filter(d.products, { c: o0.c, q: o0.q });
      const brands = [...new Set(base.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "ko"));
      const title = kind === "search" ? (o0.q ? `‘${o0.q}’ 검색 결과` : "상품 검색") : cat ? cat.name : "전체 상품";
      const uid = `sl${Math.random().toString(36).slice(2, 7)}`;
      catui.mount(box, catui.html`
        <header class="Catui_sh-list-head"><div><h1 class="Catui_h2" tabindex="-1" data-h>${title}</h1><p class="Catui_help" data-count aria-live="polite"></p></div></header>
        ${kind === "list" ? catui.html`<nav class="Catui_sh-chips" aria-label="분류"><a href="list.html"${!o0.c ? catui.html` aria-current="page"` : ""}>전체</a>${d.categories.map((c) => catui.html`<a href="list.html?c=${c.id}"${o0.c === c.id ? catui.html` aria-current="page"` : ""}>${c.name}</a>`)}</nav>` : ""}
        <div class="Catui_sh-list-body">
          <details class="Catui_sh-filter" data-filter><summary>${catui.icon("sliders-horizontal", 16)}필터<span class="Catui_count" data-fn hidden></span></summary>
            <form class="Catui_sh-filter-form" data-form>
              <fieldset><legend class="Catui_label">가격</legend>${SH_PRICES.map(([v, t], i) => catui.html`<label class="Catui_choice" for="${uid}-p${i}"><input class="Catui_clip" type="radio" name="price" value="${v}" id="${uid}-p${i}"><span class="Catui_radio"></span>${t}</label>`)}</fieldset>
              <fieldset><legend class="Catui_label">배송 · 재고</legend>${[["free", "무료배송"], ["today", "오늘출발"], ["instock", "품절 상품 빼기"]].map(([n, t]) => catui.html`<label class="Catui_choice" for="${uid}-${n}"><input class="Catui_clip" type="checkbox" name="${n}" value="1" id="${uid}-${n}"><span class="Catui_cbx">${catui.icon("check", 12)}</span>${t}</label>`)}</fieldset>
              ${brands.length > 1 ? catui.html`<fieldset><legend class="Catui_label">브랜드</legend>${brands.map((b, i) => catui.html`<label class="Catui_choice" for="${uid}-b${i}"><input class="Catui_clip" type="checkbox" name="brand" value="${b}" id="${uid}-b${i}"><span class="Catui_cbx">${catui.icon("check", 12)}</span>${b}</label>`)}</fieldset>` : ""}
              <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="reset">${catui.icon("rotate-ccw", 16)}조건 지우기</button>
            </form>
          </details>
          <div class="Catui_sh-results">
            <div class="Catui_sh-active-filters" data-active-filters role="group" aria-label="선택한 조건" hidden></div>
            <div class="Catui_sh-toolbar">
              <div class="Catui_select-wrap"><label class="Catui_clip" for="${uid}-sort">정렬</label><select class="Catui_input Catui_input-sm Catui_select" id="${uid}-sort" data-sort>${Object.entries(SH_SORTS).map(([k, v]) => catui.html`<option value="${k}">${v}</option>`)}</select>${catui.icon("chevron-down", 16)}</div>
              <div class="Catui_segment" role="group" aria-label="보기 방식"><button type="button" data-view="grid" aria-pressed="true">${catui.icon("layout-grid", 16)}<span class="Catui_clip">바둑판으로 보기</span></button><button type="button" data-view="rows" aria-pressed="false">${catui.icon("layout-list", 16)}<span class="Catui_clip">목록으로 보기</span></button></div>
            </div>
            <ul class="Catui_sh-grid" data-grid aria-label="${title} 상품"></ul>
            <nav class="Catui_pager Catui_sh-pager" aria-label="쪽" data-pager></nav>
          </div>
        </div>`);
      const form = box.querySelector("[data-form]"), grid = box.querySelector("[data-grid]"), pager = box.querySelector("[data-pager]"), sortSel = box.querySelector("[data-sort]");
      const det = box.querySelector("[data-filter]"), wide = matchMedia("(min-width: 992px)");
      det.open = wide.matches;
      shop._on(wide, "change", () => { det.open = wide.matches; });
      const sync = (o) => {
        form.querySelectorAll("input[name=price]").forEach((i) => { i.checked = i.value === o.price; });
        ["free", "today", "instock"].forEach((n) => { const i = form.elements[n]; if (i) i.checked = o[n]; });
        form.querySelectorAll("input[name=brand]").forEach((i) => { i.checked = o.brands.includes(i.value); });
        sortSel.value = o.sort;
      };
      const view = () => shGet("view", "grid");
      const paintView = () => {
        grid.classList.toggle("Catui_sh-rows", view() === "rows");
        box.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view())));
      };
      const draw = () => {
        const o = this.read(), rows = this.filter(d.products, o);
        const pages = Math.max(1, Math.ceil(rows.length / size)), page = Math.min(o.page, pages);
        const shown = rows.slice((page - 1) * size, page * size);
        const nf = (o.price ? 1 : 0) + ["free", "today", "instock"].filter((n) => o[n]).length + o.brands.length;
        const fn = box.querySelector("[data-fn]");
        fn.hidden = !nf; catui.mount(fn, catui.html`${nf}${shClip("개 조건 적용")}`);
        const active = box.querySelector("[data-active-filters]");
        const filters = [...(o.price ? [["price", SH_PRICES.find(([v]) => v === o.price)?.[1] || o.price, ""]] : []), ...[["free", "무료배송"], ["today", "오늘출발"], ["instock", "품절 상품 빼기"]].filter(([n]) => o[n]).map(([n, label]) => [n, label, ""]), ...o.brands.map((b) => ["brand", b, b])];
        active.hidden = !nf;
        catui.mount(active, catui.html`${filters.map(([key, label, value]) => catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary" type="button" data-remove-filter="${key}" data-value="${value}" aria-label="${label} 조건 해제">${label}${catui.icon("x", 12)}</button>`)}${nf ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-clear-filters>전체 초기화</button>` : ""}`);
        box.querySelector("[data-count]").textContent = `상품 ${catui.util.number(rows.length)}개${pages > 1 ? ` · ${page}/${pages}쪽` : ""}`;
        if (!rows.length) {
          const tips = kind === "search" ? catui.html`<nav class="Catui_sh-chips" aria-label="추천 분류">${d.categories.map((c) => catui.html`<a href="list.html?c=${c.id}">${c.name}</a>`)}</nav>` : "";
          catui.mount(grid, catui.html`<li class="Catui_sh-wide">${shop.empty(o.q && kind === "search" ? `‘${o.q}’에 맞는 상품이 없습니다` : "조건에 맞는 상품이 없습니다", kind === "search" && o.q ? "철자를 확인하거나 다른 말로 찾아 보세요." : "필터를 줄여 보세요.", tips)}</li>`);
        } else catui.mount(grid, catui.html`${shown.map((p) => shop.card(p))}`);
        shop.wishPaint(grid);
        // 쪽 번호: 앞뒤 2쪽 + 처음·끝, 사이는 …
        const nums = [...new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
        pager.hidden = pages < 2;
        catui.mount(pager, pages < 2 ? "" : catui.html`<button class="Catui_pg" type="button" data-page="${page - 1}" aria-label="이전 쪽"${page === 1 ? catui.html` disabled` : ""}>${catui.icon("chevron-right", 16, "Catui_pg-prev")}</button>${nums.map((n, i) => catui.html`${i && n - nums[i - 1] > 1 ? catui.html`<span aria-hidden="true">…</span>` : ""}<button class="Catui_pg${n === page ? " Catui_pg-active" : ""}" type="button" data-page="${n}"${n === page ? catui.html` aria-current="page"` : ""}>${n}${shClip("쪽")}</button>`)}<button class="Catui_pg" type="button" data-page="${page + 1}" aria-label="다음 쪽"${page === pages ? catui.html` disabled` : ""}>${catui.icon("chevron-right", 16)}</button>`);
        paintView();
      };
      // 조건 → 주소 (쪽은 조건이 바뀌면 1쪽으로)
      const go = (patch, { keepPage = false } = {}) => {
        const qs = shop.query();
        for (const [k, v] of Object.entries(patch)) { if (v === "" || v == null || v === false || (Array.isArray(v) && !v.length)) qs.delete(k); else qs.set(k, Array.isArray(v) ? v.join(",") : v === true ? "1" : String(v)); }
        if (!keepPage) qs.delete("page");
        if (qs.get("sort") === "best") qs.delete("sort");
        history.pushState(null, "", `${location.pathname}${qs.toString() ? `?${qs}` : ""}`);
        sync(this.read());
        draw();
      };
      shop._on(form, "change", (e) => {
        const n = e.target.name;
        if (n === "brand") go({ brand: [...form.querySelectorAll("input[name=brand]:checked")].map((i) => i.value) });
        else if (n === "price") go({ price: e.target.value });
        else if (n) go({ [n]: e.target.checked });
      });
      shop._on(form, "reset", () => setTimeout(() => go({ price: "", free: false, today: false, instock: false, brand: [] }), 0));
      shop._on(sortSel, "change", () => go({ sort: sortSel.value }));
      shop._on(box, "click", (e) => {
        const remove = e.target.closest("[data-remove-filter]"), clear = e.target.closest("[data-clear-filters]");
        if (remove || clear) {
          if (clear) go({ price: "", free: false, today: false, instock: false, brand: [] });
          else { const key = remove.dataset.removeFilter; go({ [key]: key === "brand" ? this.read().brands.filter((b) => b !== remove.dataset.value) : "" }); }
          (box.querySelector("[data-remove-filter]") || box.querySelector("[data-h]")).focus({ preventScroll: true });
          return;
        }
        const v = e.target.closest("[data-view]");
        if (v) { shSet("view", v.dataset.view); paintView(); return; }
        const pg = e.target.closest("button[data-page]");
        if (pg && !pg.disabled) {
          go({ page: pg.dataset.page }, { keepPage: true });
          const h = box.querySelector("[data-h]");
          h.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          h.focus({ preventScroll: true });
        }
      });
      shop._on(window, "popstate", () => { sync(this.read()); draw(); });
      sync(o0);
      draw();
    });
  },
};
