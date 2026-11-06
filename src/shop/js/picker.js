// picker — 상품 옵션 고르기 (색상 견본 · 사이즈 · 선택 목록 · 수량 · 재고 · 합계)
//   const pk = catui.shop.picker(box, product, { onChange(pk) {} })
//   · 색상: 모든 사이즈가 0이면 견본에 빗금 + "(품절)" 글자, 고를 수 없음
//   · 사이즈: 고른 색상 기준 재고 — 0이면 "품절", 5개 이하면 "N개 남음" 글자(색만으로 알리지 않음), 추가금은 "+2,000원"
//   · 옵션이 다 골라지면 선택 목록에 한 줄 추가(같은 조합이면 수량 +1), 수량은 1 ~ 재고
//   · 옵션 없는 상품은 수량 한 줄만. 다시 그려도 포커스가 같은 자리로 돌아온다
shop.picker = function (box, p, { onChange = null } = {}) {
  const uid = `pk${Math.random().toString(36).slice(2, 7)}`;
  const hasColor = !!p.options?.color, hasSize = !!p.options?.size, hasOpt = hasColor || hasSize;
  const st = { color: "", size: "", lines: hasOpt || shop.stockTotal(p) <= 0 ? [] : [{ color: "", size: "", qty: 1 }], live: "" };
  const lineOf = (l) => {
    const extra = shop.extra(p, l.size), v = shop.price(p, { extra }), stock = shop.stock(p, l.color, l.size);
    return { ...l, key: `${p.id}:${shop.optKey(l.color, l.size)}`, opt: shop.optLabel(p, l.color, l.size), unit: v.sale, amount: v.sale * l.qty, stock };
  };
  const api = {
    el: box, product: p,
    lines: () => st.lines.map(lineOf),
    qty: () => st.lines.reduce((a, l) => a + l.qty, 0),
    total: () => api.lines().reduce((a, l) => a + l.amount, 0),
    /** 옵션을 다 고르지 않았으면 false */
    ready: () => st.lines.length > 0,
    clear() { st.lines = hasOpt ? [] : st.lines.map((l) => ({ ...l, qty: 1 })); st.color = ""; st.size = ""; draw(); },
    /** 첫 옵션 칸으로 포커스 */
    focus() { box.querySelector("input:not(:disabled), button:not(:disabled)")?.focus(); },
  };
  const add = (color, size) => {
    const stock = shop.stock(p, color, size);
    if (stock <= 0) return;
    const cur = st.lines.find((l) => l.color === color && l.size === size);
    if (cur) { cur.qty = Math.min(stock, cur.qty + 1); st.live = `${shop.optLabel(p, color, size)} 수량 ${cur.qty}개`; }
    else { st.lines.push({ color, size, qty: 1 }); st.live = `${shop.optLabel(p, color, size)} 선택 목록에 추가, 모두 ${st.lines.length}개 옵션`; }
  };
  function draw() {
    const fk = document.activeElement && box.contains(document.activeElement) ? document.activeElement.closest("[data-fk]")?.dataset.fk : "";
    const os = shop.optionState(p, st.color), lines = api.lines();
    const total = lines.reduce((a, l) => a + l.amount, 0), qty = lines.reduce((a, l) => a + l.qty, 0);
    const colorName = os.colors.find((c) => c.id === st.color)?.name;
    catui.mount(box, catui.html`
      ${hasColor ? catui.html`<fieldset class="Catui_swatches Catui_sh-opt"><legend class="Catui_label">${p.options.color.label || "색상"} <span class="Catui_swatch-value">· ${colorName || "골라 주세요"}</span></legend>
        ${os.colors.map((c) => catui.html`<input class="Catui_clip" type="radio" name="${uid}-c" id="${uid}-c-${c.id}" value="${c.id}" data-fk="c:${c.id}"${st.color === c.id ? catui.html` checked` : ""}${c.soldOut ? catui.html` disabled` : ""}><label class="Catui_swatch" for="${uid}-c-${c.id}" style="--Catui_swatch:var(--Catui_color-${c.swatch || "neutral-300"})" title="${c.name}${c.soldOut ? " (품절)" : ""}"><span class="Catui_clip">${c.name}${c.soldOut ? " (품절)" : ""}</span></label>`)}</fieldset>` : ""}
      ${hasSize ? catui.html`<fieldset class="Catui_sh-opt"><legend class="Catui_label">${p.options.size.label || "사이즈"}</legend>
        ${hasColor && !st.color ? catui.html`<p class="Catui_help">${p.options.color.label || "색상"}을 먼저 골라 주세요</p>` : ""}
        <div class="Catui_sh-sizes">${os.sizes.map((s) => { const off = s.soldOut || (hasColor && !st.color); return catui.html`<input class="Catui_clip" type="radio" name="${uid}-s" id="${uid}-s-${s.id}" value="${s.id}" data-fk="s:${s.id}"${st.size === s.id ? catui.html` checked` : ""}${off ? catui.html` disabled` : ""}><label class="Catui_sh-size" for="${uid}-s-${s.id}"><b>${s.name || s.id}</b>${s.extra ? catui.html`<small>+${shop.won(s.extra)}</small>` : ""}${hasColor && !st.color ? "" : s.soldOut ? catui.html`<small class="Catui_sh-out">품절</small>` : s.low ? catui.html`<small class="Catui_sh-low">${s.stock}개 남음</small>` : ""}</label>`; })}</div></fieldset>` : ""}
      ${!hasOpt && shop.stockTotal(p) <= 0 ? catui.html`<p class="Catui_banner Catui_banner-warn">${catui.icon("alert-triangle", 16)}<span>품절된 상품입니다. 재입고되면 알려 드릴게요.</span></p>` : ""}
      ${lines.length ? catui.html`<ul class="Catui_sh-picked" aria-label="선택한 옵션">${lines.map((l) => catui.html`<li>
        <span class="Catui_sh-picked-name">${l.opt || p.name}${l.qty >= l.stock ? catui.html`<small class="Catui_sh-low">재고 ${l.stock}개 — 최대 수량</small>` : l.stock <= shop.rules.lowStock ? catui.html`<small class="Catui_sh-low">${l.stock}개 남음</small>` : ""}</span>
        <div class="Catui_stepper Catui_sh-qty" role="group" aria-label="${l.opt || p.name} 수량"><button type="button" data-step="-1" data-k="${l.key}" data-fk="q:${l.key}:-1" aria-label="수량 줄이기"${l.qty <= 1 ? catui.html` disabled` : ""}>${catui.icon("minus", 16)}</button><output aria-live="polite">${l.qty}</output><button type="button" data-step="1" data-k="${l.key}" data-fk="q:${l.key}:1" aria-label="수량 늘리기"${l.qty >= l.stock ? catui.html` disabled` : ""}>${catui.icon("plus", 16)}</button></div>
        <b class="Catui_sh-picked-amt">${shop.won(l.amount)}</b>
        ${hasOpt ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_btn-icon" type="button" data-del="${l.key}" aria-label="${l.opt} 빼기">${catui.icon("x", 16)}</button>` : ""}
      </li>`)}</ul>` : ""}
      <p class="Catui_sh-total"><span>총 상품 금액 <span class="Catui_num">(${qty}개)</span></span><b data-total>${shop.won(total)}</b></p>
      <p class="Catui_clip" role="status">${st.live}</p>`);
    st.live = "";
    if (fk) {
      let el = box.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
      if (el?.disabled) el = el.parentElement.querySelector("button:not(:disabled)") || box.querySelector("input:not(:disabled)");
      el?.focus();
    }
    onChange?.(api);
  }
  if (shop._once(box, "picker")) {
    shop._on(box, "change", (e) => {
      const i = e.target;
      if (i.name === `${uid}-c`) {
        st.color = i.value; st.size = "";
        if (!hasSize) { add(st.color, ""); st.color = ""; }
        draw();
      } else if (i.name === `${uid}-s`) {
        st.size = i.value;
        if (shop.optReady(p, st.color, st.size)) { add(st.color, st.size); st.size = ""; }
        draw();
      }
    });
    shop._on(box, "click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      const lineKey = (l) => `${p.id}:${shop.optKey(l.color, l.size)}`;
      if (b.dataset.step) {
        const l = st.lines.find((x) => lineKey(x) === b.dataset.k), stock = shop.stock(p, l.color, l.size);
        l.qty = Math.min(stock, Math.max(1, l.qty + Number(b.dataset.step)));
        draw();
      } else if (b.dataset.del) {
        const l = st.lines.find((x) => lineKey(x) === b.dataset.del);
        st.lines = st.lines.filter((x) => x !== l);
        st.live = `${shop.optLabel(p, l.color, l.size)} 뺐습니다`;
        draw();
        api.focus();
      }
    });
  }
  draw();
  return api;
};
