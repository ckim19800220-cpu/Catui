// cards — 상품 카드 · 상품 묶음 · 카테고리 · 기획전 (홈·목록·찜·최근 본 상품이 같은 카드를 쓴다)
//   shop.card(p, { rank, remove })            카드 한 장 <li> (글자는 모두 이스케이프)
//   <ul data-catui-sh-products="best|new|sale|cat:food|ids:101,201|related:101" data-size="8">   상품 묶음
//   <div data-catui-sh-cats>                  카테고리 바로가기
//   <div data-catui-sh-promos>                기획전 카드
const shTag = (text, cls = "") => catui.html`<li class="Catui_sh-tag${cls ? ` ${cls}` : ""}">${text}</li>`;
shop.tags = function (p) {
  const t = [];
  if (p.best) t.push(shTag("BEST", "Catui_sh-tag-best"));
  if (p.isNew) t.push(shTag("NEW", "Catui_sh-tag-new"));
  if (p.ship === "free") t.push(shTag("무료배송"));
  if (p.ship === "today") t.push(shTag("오늘출발"));
  if (p.couponPrice < p.sale) t.push(shTag("쿠폰", "Catui_sh-tag-coupon"));
  return t.length ? catui.html`<ul class="Catui_sh-tags" aria-label="상품 혜택">${t}</ul>` : "";
};
shop.card = function (p, { rank = 0, remove = false } = {}) {
  const wish = shop.wish.has(p.id);
  return catui.html`<li class="Catui_sh-card${p.soldOut ? " Catui_sh-card-out" : ""}">
    <a class="Catui_sh-card-link" href="product.html?id=${p.id}">
      <span class="Catui_sh-card-img"><img src="${shop.thumb(p)}" alt="" width="400" height="400" loading="lazy">${p.soldOut ? catui.html`<span class="Catui_sh-soldout">품절</span>` : ""}${rank ? catui.html`<span class="Catui_sh-rank">${rank}${shClip("위")}</span>` : ""}</span>
      <span class="Catui_sh-card-brand">${p.brand}</span>
      <b class="Catui_sh-card-name">${p.name}</b>
    </a>
    ${shop.priceHtml(p)}
    ${p.reviewCount ? catui.html`<p class="Catui_sh-card-meta">${shop.stars(p.rating)}<span class="Catui_num">${p.rating.toFixed(1)}</span><span>${shClip("리뷰 ")}(${catui.util.number(p.reviewCount)})</span></p>` : ""}
    ${shop.tags(p)}
    <div class="Catui_sh-card-acts">
      <button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon Catui_sh-wish" type="button" data-catui-sh-wish="${p.id}" aria-pressed="${wish}" aria-label="${p.name} 찜하기">${catui.icon("heart", 18)}</button>
      ${remove ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-catui-sh-remove="${p.id}" aria-label="${p.name} 목록에서 빼기">${catui.icon("x", 16)}</button>` : ""}
      ${p.soldOut ? "" : catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-secondary Catui_btn-icon" type="button" data-catui-sh-add-cart="${p.id}" aria-label="${p.name} 장바구니에 담기">${catui.icon("shopping-cart", 16)}</button>`}
    </div>
  </li>`;
};
shop.empty = (title, text = "", action = "") => catui.html`<div class="Catui_empty Catui_sh-empty">${catui.icon("shopping-bag", 24)}<p class="Catui_empty-title">${title}</p>${text ? catui.html`<p class="Catui_empty-text">${text}</p>` : ""}${action}</div>`;
// 묶음 고르기: best · new · sale(할인율 순) · cat:분류 · ids:a,b · related:상품(같은 분류, 자기 제외)
shop.pick = function (d, spec) {
  const [kind, arg = ""] = String(spec || "best").split(":");
  const all = d.products;
  switch (kind) {
    case "best": return all.filter((p) => p.best).sort((a, b) => a.bestRank - b.bestRank);
    case "new": return all.filter((p) => p.isNew).sort((a, b) => (a.created < b.created ? 1 : -1));
    case "sale": return all.filter((p) => p.rateShown > 0 && !p.soldOut).sort((a, b) => b.rateShown - a.rateShown);
    case "cat": return all.filter((p) => p.cat === arg);
    case "ids": return arg.split(",").map((id) => d.byId[id.trim()]).filter(Boolean);
    case "related": { const me = d.byId[arg]; return me ? all.filter((p) => p.cat === me.cat && p.id !== me.id) : []; }
    default: return all;
  }
};
shop.cards = {
  init(root) {
    const boxes = [...root.querySelectorAll("[data-catui-sh-products], [data-catui-sh-cats], [data-catui-sh-promos]")];
    if (!boxes.length) return;
    shop.load().then((d) => boxes.forEach((b) => this.fill(b, d))).catch(() => {});
  },
  fill(box, d) {
    if (box.hasAttribute("data-catui-sh-cats")) {
      catui.mount(box, catui.html`<ul class="Catui_sh-cats">${d.categories.map((c) => catui.html`<li><a href="list.html?c=${c.id}"><span class="Catui_sh-cat-ic" aria-hidden="true">${catui.icon(c.icon, 24)}</span><span>${c.name}</span></a></li>`)}</ul>`);
      return;
    }
    if (box.hasAttribute("data-catui-sh-promos")) {
      catui.mount(box, catui.html`<ul class="Catui_sh-promos">${d.promos.map((m) => catui.html`<li><a class="Catui_sh-promo" data-tone="${m.tone}" href="event.html?e=${m.id}">${m.image ? catui.html`<img class="Catui_sh-promo-img" src="${m.image}" alt="" aria-hidden="true" width="80" height="96" loading="lazy" decoding="async">` : ""}<b>${m.title}</b><span>${m.desc}</span><time class="Catui_sh-left" data-catui-sh-until="${m.until}" datetime="${m.until}"></time></a></li>`)}</ul>`);
      shop.shell.tick(box);
      return;
    }
    const spec = box.getAttribute("data-catui-sh-products").replace("{id}", shop.query().get("id") || "101");
    const list = shop.pick(d, spec).slice(0, Number(box.dataset.size || 8));
    const ranked = spec === "best" && box.hasAttribute("data-rank");
    catui.mount(box, list.length ? catui.html`${list.map((p, i) => shop.card(p, { rank: ranked ? i + 1 : 0 }))}` : catui.html`<li class="Catui_sh-wide">${shop.empty("보여 줄 상품이 없습니다")}</li>`);
  },
};
