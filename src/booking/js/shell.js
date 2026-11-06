// shell — 사이트 머리·선언형 속성
//   [data-catui-bk-won="45000"]     금액 글자 "45,000원"
//   [data-catui-bk-today]           오늘 날짜 글자 (한국 시간, 모의 "지금" 기준)
//   [data-catui-bk-reset]           진행 중 예약 비우기 (누르면 처음 단계로)
//   [data-catui-bk-theme]           테마 전환 (booking.theme)
booking.shell = {
  init(root) {
    root.querySelectorAll("[data-catui-bk-won]").forEach((el) => { el.textContent = booking.won(el.getAttribute("data-catui-bk-won")); });
    root.querySelectorAll("[data-catui-bk-today]").forEach((el) => { el.textContent = booking.dateLabel(booking.today(), { year: true }); });
    booking._on(root, "click", (e) => {
      const r = e.target.closest("[data-catui-bk-reset]");
      if (r) { booking.draft.clear(); booking.announce("진행 중인 예약을 비웠습니다"); }
    });
  },
};
