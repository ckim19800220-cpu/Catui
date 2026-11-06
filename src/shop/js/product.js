// product — 상품 상세 (product.html?id=101)
//   <article data-catui-sh-product> 안의 자리: [data-crumb] [data-gallery] [data-brand] [data-name](h1) [data-rating] [data-price]
//     [data-ship] [data-picker] [data-acts](찜·장바구니·바로 구매) [data-detail] [data-reviews] [data-rc] [data-qna] [data-qc] [data-buybar]
//   · 사진: 작은 사진 버튼(aria-pressed, ←→ 이동)으로 큰 사진 바꾸기
//   · 리뷰: 별점 평균·분포(리뷰 원자료에서 계산), 정렬(최신·도움·별점), 사진 리뷰만, 도움돼요(한 번), 5개씩 더 보기
//   · 고정 구매 막대: 본래 구매 버튼이 화면 밖으로 나가면 아래에 나타남
//   · 본 상품은 최근 본 상품에 넣는다
const SH_RV_SORT = { new: "최신순", help: "도움순", high: "별점 높은순", low: "별점 낮은순" };
shop.product = {
  init(root) { root.querySelectorAll("[data-catui-sh-product]").forEach((b) => this.mount(b)); },
  /** 도착 예정일: 오늘 출발이면 다음 날, 아니면 이틀 뒤 (일요일은 건너뜀) */
  eta(p, now = shop.now()) {
    const t = new Date(now); let n = p.ship === "today" ? 1 : 2;
    while (n > 0) { t.setDate(t.getDate() + 1); if (t.getDay() !== 0) n--; }
    return `${t.getMonth() + 1}월 ${t.getDate()}일(${"일월화수목금토"[t.getDay()]})`;
  },
  mount(box) {
    if (!shop._once(box, "product")) return;
    const id = shop.query().get("id") || box.dataset.id || "101";
    const $ = (s) => box.querySelector(s);
    Promise.all([shop.load(), shop.data("qna").catch(() => [])]).then(([d, qna]) => {
      const p = d.byId[id];
      if (!p) {
        $("[data-name]").textContent = "상품을 찾을 수 없습니다";
        catui.mount($("[data-picker]"), shop.empty("판매가 끝났거나 주소가 바뀐 상품입니다", "", catui.html`<a class="Catui_btn Catui_btn-md Catui_btn-primary" href="list.html">상품 목록으로</a>`));
        $("[data-acts]").hidden = true;
        return;
      }
      shop.recent.add(p.id);
      document.title = `${p.name} · Catui 쇼핑`;
      catui.mount($("[data-crumb]"), catui.html`<a href="index.html">홈</a><span class="Catui_crumb-sep">/</span><a href="list.html?c=${p.cat}">${p.catName}</a><span class="Catui_crumb-sep">/</span><span aria-current="page">${p.name}</span>`);
      // 사진
      const n = 4, main = (i) => catui.html`<img src="${shop.thumb(p, i)}" alt="${p.name} 사진 ${i + 1}/${n}" width="600" height="600">`;
      catui.mount($("[data-gallery]"), catui.html`<figure class="Catui_sh-gallery-main" data-main>${main(0)}${p.soldOut ? catui.html`<span class="Catui_sh-soldout">품절</span>` : ""}</figure>
        <div class="Catui_sh-thumbs" role="group" aria-label="사진 고르기">${[0, 1, 2, 3].map((i) => catui.html`<button type="button" data-shot="${i}" aria-pressed="${i === 0}"><img src="${shop.thumb(p, i)}" alt="" width="80" height="80"><span class="Catui_clip">사진 ${i + 1}</span></button>`)}</div>`);
      shop._on($("[data-gallery]"), "click", (e) => {
        const b = e.target.closest("[data-shot]"); if (!b) return;
        catui.mount($("[data-main]"), catui.html`${main(Number(b.dataset.shot))}${p.soldOut ? catui.html`<span class="Catui_sh-soldout">품절</span>` : ""}`);
        $("[data-gallery]").querySelectorAll("[data-shot]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
      shop._on($("[data-gallery]"), "keydown", (e) => {
        const b = e.target.closest("[data-shot]"); if (!b || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        const all = [...$("[data-gallery]").querySelectorAll("[data-shot]")], i = all.indexOf(b), nx = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
        e.preventDefault(); nx.focus(); nx.click();
      });
      // 머리 정보
      $("[data-brand]").textContent = p.brand;
      $("[data-name]").textContent = p.name;
      catui.mount($("[data-rating]"), p.reviewCount ? catui.html`<a class="Catui_sh-pd-rating" href="#pd-reviews">${shop.stars(p.rating, { size: 16 })}<b class="Catui_num">${p.rating.toFixed(1)}</b><span>리뷰 ${catui.util.number(p.reviewCount)}개</span></a>` : catui.html`<span class="Catui_help">아직 리뷰가 없습니다</span>`);
      const best = p.coupon ? shop.price(p, { coupons: [p.coupon] }) : null;
      catui.mount($("[data-price]"), catui.html`${shop.priceHtml(p, { size: "lg" })}${best && best.couponPrice < best.sale ? catui.html`<p class="Catui_sh-benefit">${catui.icon("coupon", 16)}<span>최대 혜택가 <b>${shop.won(best.couponPrice)}</b> · ${p.coupon.name} 적용 시</span></p>` : ""}`);
      const earn = Math.floor((p.sale * shop.rules.pointRate) / 100);
      catui.mount($("[data-ship]"), catui.html`
        <div><dt>배송비</dt><dd>${p.ship === "free" ? catui.html`<b>무료배송</b>` : catui.html`${shop.won(shop.rules.shipFee)} <span class="Catui_help">(${shop.won(shop.rules.freeOver)} 이상 구매 시 무료)</span>`}</dd></div>
        <div><dt>출발</dt><dd>${p.ship === "today" ? catui.html`<span class="Catui_sh-tag">오늘출발</span> 오후 2시 전 주문 시` : "1~2일 안에 출발"} · <b>${this.eta(p)} 도착 예정</b></dd></div>
        <div><dt>적립</dt><dd>구매 확정 시 ${shop.won(earn)} (${shop.rules.pointRate}%)</dd></div>`);
      // 옵션 · 구매
      const bar = $("[data-buybar]"), barTotal = bar?.querySelector("[data-bar-total]");
      const pk = shop.picker($("[data-picker]"), p, { onChange: (k) => { if (barTotal) barTotal.textContent = shop.won(k.ready() ? k.total() : p.sale); } });
      box.querySelectorAll("[data-act=wish]").forEach((b) => { b.setAttribute("data-catui-sh-wish", p.id); b.setAttribute("aria-label", `${p.name} 찜하기`); });
      shop.wishPaint(box);
      if (p.soldOut) box.querySelectorAll("[data-act=cart],[data-act=buy]").forEach((b) => { b.disabled = true; });
      const need = () => { catui.layer.msg("옵션을 골라 주세요", { icon: "warn" }); $("[data-picker]").scrollIntoView({ block: "center" }); pk.focus(); };
      shop._on(box, "click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b || b.disabled) return;
        if (b.dataset.act === "cart") {
          if (!pk.ready()) return need();
          pk.lines().forEach((l) => shop.cart.add(p.id, { color: l.color, size: l.size, qty: l.qty, max: l.stock }));
          pk.clear();
          catui.layer.confirm("장바구니에 담았습니다. 지금 볼까요?", { title: "장바구니", okText: "장바구니 보기", cancelText: "쇼핑 계속" }, (i) => { catui.layer.close(i); location.href = "cart.html"; });
        } else if (b.dataset.act === "buy") {
          if (!pk.ready()) return need();
          shSet("now", pk.lines().map((l) => ({ key: l.key, id: p.id, color: l.color, size: l.size, qty: l.qty, on: true })));
          location.href = "checkout.html?from=now";
        }
      });
      if (bar && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(([en]) => { bar.hidden = en.isIntersecting || en.boundingClientRect.top > 0; });
        io.observe($("[data-acts]"));
        shop._offs.push(() => io.disconnect());
        catui.mount(bar.querySelector("[data-bar-name]"), catui.html`${p.name}`);
        if (barTotal) barTotal.textContent = shop.won(pk.ready() ? pk.total() : p.sale);
      }
      // 상세 정보
      catui.mount($("[data-detail]"), catui.html`<p class="Catui_lead">${p.summary || ""}</p>
        <figure class="Catui_sh-detail-img"><img src="${shop.thumb(p, 2)}" alt="${p.name} 상세 사진" width="800" height="800" loading="lazy"></figure>
        <dl class="Catui_dl"><dt>브랜드</dt><dd>${p.brand}</dd><dt>분류</dt><dd>${p.catName}</dd><dt>상품 번호</dt><dd>${p.id}</dd><dt>누적 판매</dt><dd>${catui.util.number(p.sold)}개</dd><dt>재고</dt><dd>${p.soldOut ? "품절" : `${catui.util.number(p.stockTotal)}개`}</dd></dl>`);
      this.reviews($("[data-reviews]"), p, d.R[p.id] || []);
      const rc = $("[data-rc]"); if (rc) catui.mount(rc, catui.html`${p.reviewCount}${shClip("개")}`);
      this.qna($("[data-qna]"), p, qna.filter((q) => q.product === p.id));
    }).catch(() => {});
  },
  reviews(box, p, list) {
    if (!box) return;
    const st = { sort: "new", photo: false, shown: 5, helped: new Set(shGet("helped", [])) };
    const dist = p.ratingDist || [0, 0, 0, 0, 0];
    const draw = () => {
      let rows = list.filter((r) => !st.photo || r.photo);
      rows = [...rows].sort({ new: (a, b) => (a.time < b.time ? 1 : -1), help: (a, b) => b.helpful - a.helpful, high: (a, b) => b.rating - a.rating, low: (a, b) => a.rating - b.rating }[st.sort]);
      catui.mount(box, catui.html`
        <div class="Catui_sh-rv-sum">
          <div class="Catui_sh-rv-avg"><b class="Catui_num">${p.rating ? p.rating.toFixed(1) : "-"}</b>${shop.stars(p.rating, { size: 18 })}<span class="Catui_help">리뷰 ${list.length}개</span></div>
          <ul class="Catui_sh-rv-dist" aria-label="별점 분포">${[5, 4, 3, 2, 1].map((s, i) => { const pct = list.length ? Math.round((dist[i] / list.length) * 100) : 0; return catui.html`<li><span>${s}점</span><span class="Catui_sh-rv-bar" role="img" aria-label="${s}점 ${dist[i]}개, ${pct}퍼센트"><i style="width:${pct}%"></i></span><span class="Catui_num">${dist[i]}</span></li>`; })}</ul>
          <a class="Catui_btn Catui_btn-md Catui_btn-secondary" href="review-write.html?id=${p.id}">${catui.icon("pen-line", 16)}리뷰 쓰기</a>
        </div>
        <div class="Catui_sh-toolbar">
          <div class="Catui_segment" role="group" aria-label="리뷰 정렬">${Object.entries(SH_RV_SORT).map(([k, v]) => catui.html`<button type="button" data-rsort="${k}" aria-pressed="${st.sort === k}">${v}</button>`)}</div>
          <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-photo aria-pressed="${st.photo}">${catui.icon("image", 16)}사진 리뷰만</button>
        </div>
        ${rows.length ? catui.html`<ul class="Catui_sh-reviews">${rows.slice(0, st.shown).map((r) => { const mine = st.helped.has(r.id); return catui.html`<li class="Catui_sh-review">
          <div class="Catui_sh-review-head">${shop.stars(r.rating)}<b>${r.user}</b><time datetime="${r.time}">${shop.date(r.time)}</time>${r.photo ? catui.html`<span class="Catui_badge Catui_badge-info">포토</span>` : ""}</div>
          ${r.opt ? catui.html`<p class="Catui_help">옵션: ${r.opt}</p>` : ""}
          ${r.photo ? catui.html`<img class="Catui_sh-review-img" src="${shop.thumb(p, 3)}" alt="${r.user}님이 올린 사진" width="96" height="96" loading="lazy">` : ""}
          <p>${r.text}</p>
          <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-help="${r.id}" aria-pressed="${mine}">${catui.icon("thumbs-up", 16)}도움돼요 <span class="Catui_num">${r.helpful + (mine ? 1 : 0)}</span></button>
        </li>`; })}</ul>
        ${rows.length > st.shown ? catui.html`<button class="Catui_btn Catui_btn-md Catui_btn-secondary Catui_btn-block" type="button" data-more>리뷰 더 보기 (${rows.length - st.shown}개 남음)</button>` : ""}` : catui.html`${shop.empty(st.photo ? "사진 리뷰가 없습니다" : "아직 리뷰가 없습니다", "첫 리뷰를 남겨 주세요.")}`}`);
    };
    shop._on(box, "click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      let fk = "";
      if (b.dataset.rsort) { st.sort = b.dataset.rsort; fk = `[data-rsort="${st.sort}"]`; }
      else if (b.hasAttribute("data-photo")) { st.photo = !st.photo; st.shown = 5; fk = "[data-photo]"; }
      else if (b.hasAttribute("data-more")) { st.shown += 5; fk = `.Catui_sh-review:nth-child(${st.shown - 4}) button`; }
      else if (b.dataset.help) { const k = b.dataset.help; if (st.helped.has(k)) st.helped.delete(k); else st.helped.add(k); shSet("helped", [...st.helped]); fk = `[data-help="${k}"]`; }
      else return;
      draw();
      box.querySelector(fk)?.focus();
    });
    draw();
  },
  qna(box, p, list) {
    if (!box) return;
    const rows = [...list];
    const qc = box.closest("[data-catui-sh-product]")?.querySelector("[data-qc]");
    const draw = () => {
      if (qc) catui.mount(qc, catui.html`${rows.length}${shClip("개")}`);
      catui.mount(box, catui.html`
        <details class="Catui_sh-ask"><summary class="Catui_btn Catui_btn-md Catui_btn-secondary">${catui.icon("message-circle", 16)}상품 문의하기</summary>
          <form class="Catui_vstack Catui_gap-3" data-ask><label class="Catui_label" for="pd-ask-q">문의 내용</label><textarea class="Catui_input" id="pd-ask-q" name="q" rows="3" maxlength="300" required placeholder="사이즈·재입고·배송 등 궁금한 점을 적어 주세요"></textarea>
            <label class="Catui_choice" for="pd-ask-s"><input class="Catui_clip" type="checkbox" id="pd-ask-s" name="secret"><span class="Catui_cbx">${catui.icon("check", 12)}</span>비밀글로 쓰기</label>
            <div class="Catui_actions"><button class="Catui_btn Catui_btn-md Catui_btn-primary" type="submit">문의 등록</button></div></form></details>
        ${rows.length ? catui.html`<ul class="Catui_sh-qna">${rows.map((q) => catui.html`<li><details><summary><span class="Catui_pill ${q.a ? "Catui_pill-success" : "Catui_pill-neutral"}">${q.a ? "답변 완료" : "답변 대기"}</span><span class="Catui_sh-qna-q">${q.secret ? catui.html`${catui.icon("lock", 12)}비밀글입니다` : q.q}</span><span class="Catui_help">${q.user} · ${shop.date(q.time)}</span></summary>
          <div class="Catui_sh-qna-a">${q.secret ? catui.html`<p class="Catui_help">작성자와 판매자만 볼 수 있습니다.</p>` : q.a ? catui.html`<p><b>판매자 답변</b> ${q.a}</p>` : catui.html`<p class="Catui_help">답변을 준비하고 있습니다.</p>`}</div></details></li>`)}</ul>` : shop.empty("등록된 문의가 없습니다")}`);
    };
    shop._on(box, "submit", (e) => {
      const f = e.target.closest("form[data-ask]"); if (!f) return;
      e.preventDefault();
      const t = f.elements.q.value.trim();
      if (!t) { f.elements.q.focus(); return; }
      rows.unshift({ id: `q${Date.now()}`, product: p.id, user: "나", time: shop.now().toISOString(), q: t, a: "", secret: f.elements.secret.checked });
      draw();
      catui.layer.msg("문의를 등록했습니다", { icon: "success", time: 1200 });
      box.querySelector(".Catui_sh-qna summary")?.focus();
    });
    draw();
  },
};
