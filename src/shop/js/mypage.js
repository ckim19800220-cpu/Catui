// mypage — 마이페이지 · 주문 내역 · 배송 조회 · 찜 · 최근 본 상품 · 쿠폰/적립금 · 회원 정보 · 리뷰 쓰기
//   [data-catui-sh-my]        요약: 적립금 · 쓸 수 있는 쿠폰 · 찜 수 · 주문 단계별 건수 · 최근 주문
//   [data-catui-sh-orders]    주문 내역: 상태·기간 거르기, 배송 조회·리뷰 쓰기·주문 취소(결제 완료만)
//   [data-catui-sh-track]     배송 조회: 단계(결제 완료 → 상품 준비 → 배송 중 → 배송 완료) + 택배 이동 기록
//   [data-catui-sh-wishlist]  찜 · [data-catui-sh-recent] 최근 본 상품(빼기·모두 지우기)
//   [data-catui-sh-coupons]   쿠폰(사용 가능·만료, 쿠폰 번호 등록) · [data-catui-sh-points] 적립금 잔액·내역
//   form[data-catui-sh-profile] 회원 정보 · form[data-catui-sh-review] 리뷰 쓰기(별점 필수, 10자 이상)
shop.status = {
  paid: { label: "결제 완료", step: 1, pill: "info" },
  ready: { label: "상품 준비 중", step: 2, pill: "warning" },
  shipping: { label: "배송 중", step: 3, pill: "info" },
  done: { label: "배송 완료", step: 4, pill: "success" },
  cancel: { label: "주문 취소", step: 0, pill: "neutral" },
};
const SH_STEPS = ["결제 완료", "상품 준비", "배송 중", "배송 완료"];
shop.statusPill = (s) => { const v = shop.status[s] || { label: s, pill: "neutral" }; return catui.html`<span class="Catui_pill Catui_pill-${v.pill}">${v.label}</span>`; };
/** 단계 표시 <ol class="Catui_steps"> — 완료는 체크 + 숨김 글자 "완료", 현재는 aria-current="step" */
shop.steps = function (status) {
  const at = shop.status[status]?.step || 0;
  return catui.html`<ol class="Catui_steps Catui_sh-steps" aria-label="배송 단계">${SH_STEPS.map((t, i) => {
    const n = i + 1, done = n < at || (n === at && n === 4), cur = n === at && n !== 4;
    return catui.html`${i ? catui.html`<li class="Catui_step-line${n <= at ? " Catui_step-line-done" : ""}" aria-hidden="true"></li>` : ""}<li class="Catui_step${done ? " Catui_step-done" : cur ? " Catui_step-current" : ""}"${cur ? catui.html` aria-current="step"` : ""}><span class="Catui_step-dot">${done ? catui.icon("check", 16) : n}</span><span class="Catui_step-label">${t}${done ? shClip(" 완료") : ""}</span></li>`;
  })}</ol>`;
};
shop.my = {
  init(root) {
    const map = { "[data-catui-sh-my]": "summary", "[data-catui-sh-orders]": "orders", "[data-catui-sh-track]": "track", "[data-catui-sh-wishlist]": "wishlist", "[data-catui-sh-recent]": "recentList", "[data-catui-sh-coupons]": "coupons", "[data-catui-sh-points]": "points", "form[data-catui-sh-profile]": "profile", "form[data-catui-sh-review]": "review" };
    for (const [sel, fn] of Object.entries(map)) root.querySelectorAll(sel).forEach((b) => { if (shop._once(b, fn)) this[fn](b); });
  },
  orderCard(o, d) {
    const first = d.byId[o.items[0]?.product], more = o.items.length - 1, st = shop.status[o.status] || {};
    return catui.html`<li class="Catui_sh-order">
      <div class="Catui_sh-order-head"><b>${shop.date(o.date)}</b><span class="Catui_help">주문 번호 ${o.id}</span>${shop.statusPill(o.status)}</div>
      <ul class="Catui_sh-order-items">${o.items.map((it) => { const p = d.byId[it.product]; return catui.html`<li class="Catui_sh-co-item">${p ? catui.html`<img src="${shop.thumb(p)}" alt="" width="64" height="64">` : ""}<div>${p ? catui.html`<a href="product.html?id=${p.id}">${p.name}</a>` : catui.html`<b>판매 종료 상품</b>`}${it.opt ? catui.html`<p class="Catui_help">${it.opt}</p>` : ""}<p class="Catui_help">${shop.won(it.price)} × ${it.qty}개</p></div>${o.status === "done" && p ? catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="review-write.html?id=${p.id}&amp;o=${o.id}">리뷰 쓰기</a>` : ""}</li>`; })}</ul>
      <div class="Catui_sh-order-foot"><span>결제 <b>${shop.won(o.total)}</b>${first && more > 0 ? catui.html` <span class="Catui_help">(${first.name} 외 ${more}건)</span>` : ""}</span>
        <div class="Catui_actions">${st.step >= 1 ? catui.html`<a class="Catui_btn Catui_btn-sm Catui_btn-secondary" href="order-track.html?id=${o.id}">${catui.icon("truck", 16)}배송 조회</a>` : ""}${o.status === "paid" ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-cancel="${o.id}">주문 취소</button>` : ""}</div></div>
    </li>`;
  },
  summary(box) {
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const set = (k, v) => box.querySelectorAll(`[data-my="${k}"]`).forEach((el) => catui.mount(el, v));
      set("name", catui.html`${d.user.name}`);
      set("grade", catui.html`${d.user.grade}`);
      set("points", catui.html`${shop.won(d.user.points)}`);
      set("coupons", catui.html`${d.usable.length}${shClip("장")}`);
      set("wish", catui.html`${shop.wish.list().length}${shClip("개")}`);
      const live = orders.filter((o) => o.status !== "cancel" && new Date(o.date) > shop.now() - 30 * 864e5);
      set("flow", catui.html`${["paid", "ready", "shipping", "done"].map((k) => catui.html`<li><b class="Catui_num">${live.filter((o) => o.status === k).length}</b><span>${shop.status[k].label}</span></li>`)}`);
      set("recent-orders", catui.html`${orders.slice(0, 2).map((o) => this.orderCard(o, d))}`);
    }).catch(() => {});
  },
  orders(box) {
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const st = { kind: "all", months: "3" };
      const list = box.querySelector("[data-list]"), count = box.querySelector("[data-count]");
      const draw = () => {
        const since = st.months === "all" ? 0 : shop.now() - Number(st.months) * 30 * 864e5;
        const rows = orders.filter((o) => new Date(o.date) >= since && (st.kind === "all" || (st.kind === "live" ? ["paid", "ready", "shipping"].includes(o.status) : o.status === st.kind)));
        if (count) count.textContent = `주문 ${rows.length}건`;
        catui.mount(list, rows.length ? catui.html`${rows.map((o) => this.orderCard(o, d))}` : catui.html`<li>${shop.empty("해당하는 주문이 없습니다", "기간이나 상태를 바꿔 보세요.")}</li>`);
        box.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === st.kind)));
      };
      shop._on(box, "click", (e) => {
        const k = e.target.closest("[data-kind]");
        if (k) { st.kind = k.dataset.kind; draw(); return; }
        const c = e.target.closest("[data-cancel]");
        if (c) catui.layer.confirm(`주문 ${c.dataset.cancel}을 취소할까요? 결제 금액은 3영업일 안에 돌려드립니다.`, { title: "주문 취소", okText: "주문 취소" }, (i) => {
          catui.layer.close(i);
          const o = orders.find((x) => x.id === c.dataset.cancel); o.status = "cancel";
          shSet("orders", (shGet("orders", []) || []).map((x) => (x.id === o.id ? { ...x, status: "cancel" } : x)));
          draw(); catui.layer.msg("주문을 취소했습니다", { icon: "success" });
          box.querySelector("[data-kind][aria-pressed=true]")?.focus();
        });
      });
      const per = box.querySelector("select[name=months]");
      if (per) shop._on(per, "change", () => { st.months = per.value; draw(); });
      draw();
    }).catch(() => {});
  },
  track(box) {
    Promise.all([shop.load(), shop.orders()]).then(([d, orders]) => {
      const id = shop.query().get("id");
      const o = orders.find((x) => x.id === id) || orders.find((x) => x.status === "shipping") || orders[0];
      if (!o) return;
      const $ = (s) => box.querySelector(s);
      catui.mount($("[data-track-head]"), catui.html`<div class="Catui_sh-order-head"><b>주문 번호 ${o.id}</b>${shop.statusPill(o.status)}</div>
        <dl class="Catui_sh-sum"><div><dt>상품</dt><dd>${d.byId[o.items[0].product]?.name || "-"}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}</dd></div>
        <div><dt>택배사</dt><dd>${o.track?.company || "배정 전"}</dd></div><div><dt>운송장 번호</dt><dd>${o.track?.no || "-"}</dd></div></dl>`);
      catui.mount($("[data-track-steps]"), o.status === "cancel" ? catui.html`<p class="Catui_banner Catui_banner-warn">${catui.icon("alert-circle", 16)}<span>취소된 주문입니다.</span></p>` : shop.steps(o.status));
      catui.mount($("[data-track-log]"), catui.html`${[...(o.steps || [])].reverse().map((s, i) => catui.html`<li class="Catui_sh-log${i === 0 ? " Catui_sh-log-now" : ""}"><time datetime="${s.time}">${shop.date(s.time, "MM.dd HH:mm")}</time><b>${s.text}${i === 0 ? shClip(" (최근)") : ""}</b>${s.where ? catui.html`<span class="Catui_help">${s.where}</span>` : ""}</li>`)}`);
    }).catch(() => {});
  },
  grid(box, ids, d, { remove = false, empty }) {
    const list = box.querySelector("[data-list]"), count = box.querySelector("[data-count]");
    const rows = ids.map((id) => d.byId[id]).filter(Boolean);
    if (count) count.textContent = `${rows.length}개`;
    catui.mount(list, rows.length ? catui.html`${rows.map((p) => shop.card(p, { remove }))}` : catui.html`<li class="Catui_sh-wide">${empty}</li>`);
    shop.wishPaint(list);
  },
  wishlist(box) {
    shop.load().then((d) => {
      const draw = () => this.grid(box, shop.wish.list(), d, { empty: shop.empty("찜한 상품이 없습니다", "하트를 눌러 담아 두세요.", catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="list.html">상품 보러 가기</a>`) });
      shop._offs.push(shop.on("wish", () => setTimeout(draw, 0)));
      draw();
    }).catch(() => {});
  },
  recentList(box) {
    shop.load().then((d) => {
      const draw = () => this.grid(box, shop.recent.list(), d, { remove: true, empty: shop.empty("최근 본 상품이 없습니다") });
      shop._on(box, "click", (e) => {
        const r = e.target.closest("[data-catui-sh-remove]");
        if (r) { shop.recent.remove(r.dataset.catuiShRemove); draw(); box.querySelector("[data-list] button, [data-clear]")?.focus(); return; }
        if (e.target.closest("[data-clear]")) catui.layer.confirm("최근 본 상품을 모두 지울까요?", { title: "모두 지우기", okText: "지우기" }, (i) => { catui.layer.close(i); shop.recent.clear(); draw(); });
      });
      draw();
    }).catch(() => {});
  },
  coupons(box) {
    shop.load().then((d) => {
      const list = box.querySelector("[data-list]"), now = shop.now();
      const sorted = [...d.coupons].sort((a, b) => a.expired - b.expired || (a.expires < b.expires ? -1 : 1));
      const cnt = box.querySelector("[data-count]"); if (cnt) cnt.textContent = `쓸 수 있는 쿠폰 ${d.usable.length}장`;
      catui.mount(list, catui.html`${sorted.map((c) => { const days = Math.ceil((new Date(c.expires) - now) / 864e5); return catui.html`<li class="Catui_sh-coupon${c.expired ? " Catui_sh-coupon-off" : ""}">
        <b class="Catui_sh-coupon-v">${shop.coupon.label(c)}</b>
        <div><p class="Catui_sh-coupon-name">${c.name}</p><p class="Catui_help">${c.min ? `${shop.won(c.min)} 이상 구매 시` : "조건 없음"}${c.cats?.length ? ` · ${c.cats.map((k) => d.C[k]?.name || k).join("·")} 상품만` : ""}</p>
          <p class="Catui_help">${shop.date(c.expires)}까지${!c.expired && days <= 7 ? catui.html` · <b class="Catui_sh-low">${days}일 남음</b>` : ""}</p></div>
        ${c.expired ? catui.html`<span class="Catui_pill Catui_pill-neutral">기간 만료</span>` : catui.html`<span class="Catui_pill Catui_pill-success">사용 가능</span>`}
      </li>`; })}`);
      const f = box.querySelector("form[data-coupon-form]");
      if (f) shop._on(f, "submit", (e) => {
        e.preventDefault();
        const i = f.elements.code, v = i.value.trim().toUpperCase();
        const msg = f.querySelector("[data-msg]");
        msg.textContent = !v ? "쿠폰 번호를 넣어 주세요" : d.coupons.some((c) => c.id === v) ? "이미 받은 쿠폰입니다" : "없는 쿠폰 번호입니다. 대소문자·숫자를 확인해 주세요";
        i.setAttribute("aria-invalid", "true");
        i.focus();
      });
    }).catch(() => {});
  },
  points(box) {
    shop.load().then((d) => {
      const bal = box.querySelector("[data-balance]"); if (bal) bal.textContent = shop.won(d.user.points);
      catui.mount(box.querySelector("[data-list]"), catui.html`${(d.user.pointsLog || []).map((x) => catui.html`<tr><td>${shop.date(x.date)}</td><td>${x.text}</td><td class="Catui_text-right Catui_num">${x.amount > 0 ? "+" : "−"}${shop.won(Math.abs(x.amount))}${shClip(x.amount > 0 ? " 적립" : " 사용")}</td></tr>`)}`);
    }).catch(() => {});
  },
  profile(f) {
    shop.load().then((d) => {
      for (const k of ["name", "nick", "email", "phone"]) if (f.elements[k]) f.elements[k].value = d.user[k] || "";
      const since = f.querySelector("[data-joined]"); if (since) since.textContent = shop.date(d.user.joined);
      shop._on(f, "submit", (e) => {
        e.preventDefault();
        if (catui.form?.validate && !catui.form.validate(f)) return;
        catui.layer.msg("회원 정보를 저장했습니다", { icon: "success" });
      });
    }).catch(() => {});
  },
  review(f) {
    shop.load().then((d) => {
      const p = d.byId[shop.query().get("id") || "101"];
      const box = f.querySelector("[data-rv-product]");
      if (p && box) catui.mount(box, catui.html`<img src="${shop.thumb(p)}" alt="" width="64" height="64"><div><b>${p.name}</b><p class="Catui_help">${p.brand}</p></div>`);
      const file = f.querySelector("input[type=file]"), pics = f.querySelector("[data-pics]");
      if (file && pics) shop._on(file, "change", () => {
        [...file.files].slice(0, 5).forEach((fl) => {
          if (!fl.type.startsWith("image/")) return;
          const fig = document.createElement("figure"); fig.className = "Catui_sh-pic";
          const img = document.createElement("img"); img.src = URL.createObjectURL(fl); img.alt = fl.name;
          fig.append(img); pics.appendChild(fig);
        });
        file.value = "";
      });
      shop._on(f, "submit", (e) => {
        e.preventDefault();
        const rating = f.querySelector("input[name=rating]:checked"), text = f.elements.text.value.trim(), err = f.querySelector("[data-err]");
        const bad = !rating ? "별점을 골라 주세요" : text.length < 10 ? `리뷰를 10자 이상 적어 주세요 (지금 ${text.length}자)` : "";
        err.textContent = bad; err.hidden = !bad;
        if (bad) { (rating ? f.elements.text : f.querySelector("input[name=rating]")).focus(); return; }
        const r = { id: `my${Date.now()}`, product: p?.id, rating: Number(rating.value), text, time: shop.now().toISOString() };
        shSet("myReviews", [r, ...(shGet("myReviews", []) || [])]);
        shop.emit("review", { review: r });
        catui.layer.msg("리뷰를 등록했습니다. 적립금 500원이 곧 들어옵니다", { icon: "success" });
        setTimeout(() => { location.href = "orders.html"; }, 900);
      });
    }).catch(() => {});
  },
};
