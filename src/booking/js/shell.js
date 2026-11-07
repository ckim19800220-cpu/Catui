// shell — 사이트 머리·선언형 속성
//   [data-catui-bk-won="45000"]     금액 글자 "45,000원"
//   [data-catui-bk-today]           오늘 날짜 글자 (한국 시간, 모의 "지금" 기준)
//   [data-catui-bk-reset]           진행 중 예약 비우기 (누르면 처음 단계로)
//   [data-catui-bk-theme]           테마 전환 (booking.theme)
booking.shell = {
  init(root) {
    const nav = root.querySelector(".Catui_bk-nav");
    if (nav && booking._once(nav, "current-visible")) {
      const layout = () => {
        const active = nav.querySelector('[aria-current="page"]');
        if (!active) return;
        const outer = nav.getBoundingClientRect(), item = active.getBoundingClientRect();
        if (item.left < outer.left) nav.scrollLeft += item.left - outer.left;
        else if (item.right > outer.right) nav.scrollLeft += item.right - outer.right;
      };
      booking._on(window, "resize", layout);
      layout();
    }
    root.querySelectorAll("[data-catui-bk-summary]").forEach((summary) => {
      if (!booking._once(summary, "responsive-summary")) return;
      const parent = summary.parentElement, main = parent.querySelector(".Catui_bk-flow-main"), bar = main?.querySelector(".Catui_bk-next-bar");
      if (!bar) return;
      const mobile = matchMedia("(max-width: 991px)");
      const layout = () => { if (mobile.matches) bar.before(summary); else parent.appendChild(summary); };
      booking._on(mobile, "change", layout);
      layout();
    });
    if (booking._once(root, "photo-errors")) booking._on(root, "error", (e) => { if (e.target.matches?.(".Catui_bk-photo, .Catui_bk-hero-img, .Catui_bk-pack-intro > img")) e.target.hidden = true; }, true);
    root.querySelectorAll("[data-catui-bk-won]").forEach((el) => { el.textContent = booking.won(el.getAttribute("data-catui-bk-won")); });
    root.querySelectorAll("[data-catui-bk-today]").forEach((el) => { el.textContent = booking.dateLabel(booking.today(), { year: true }); });
    booking._on(root, "click", (e) => {
      const r = e.target.closest("[data-catui-bk-reset]");
      if (r) { booking.draft.clear(); booking.announce("진행 중인 예약을 비웠습니다"); }
    });
  },
};
