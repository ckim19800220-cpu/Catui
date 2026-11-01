// 문서 사이트 보조 스크립트 (없어도 문서는 읽힌다): 코드 복사, 목차 현재 위치, 모바일 사이드바 기본 닫힘
(() => {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".doc-copy");
    if (!btn) return;
    const code = btn.parentElement.querySelector("pre code")?.textContent ?? "";
    try { await navigator.clipboard.writeText(code); btn.textContent = "복사됨"; } catch { btn.textContent = "복사 실패"; }
    setTimeout(() => { btn.textContent = "복사"; }, 1500);
  });

  // 다크 모드 전환 (선택은 localStorage에 저장, 깜빡임 방지는 head의 인라인 스크립트)
  const themeBtn = document.querySelector(".doc-theme");
  if (themeBtn) {
    const root = document.documentElement;
    const sync = () => {
      const on = root.getAttribute("data-catui-theme") === "dark";
      themeBtn.setAttribute("aria-pressed", String(on));
      themeBtn.title = on ? "라이트 모드로 보기" : "다크 모드로 보기";
    };
    sync();
    themeBtn.addEventListener("click", () => {
      const dark = root.getAttribute("data-catui-theme") !== "dark";
      if (dark) root.setAttribute("data-catui-theme", "dark"); else root.removeAttribute("data-catui-theme");
      try { localStorage.setItem("catui-theme", dark ? "dark" : "light"); } catch { /* 저장 불가 환경 */ }
      sync();
    });
  }

  // 아이콘 목록 검색 (이름 일부로 거르기)
  const iconList = document.querySelector(".doc-icons");
  if (iconList) {
    const items = [...iconList.children];
    const box = document.createElement("div");
    box.className = "doc-icons-search";
    box.innerHTML = '<label class="Catui_clip" for="doc-icon-q">아이콘 이름 검색</label><div class="Catui_search"><svg class="Catui_icon Catui_i16" aria-hidden="true"></svg><input class="Catui_input" id="doc-icon-q" type="search" placeholder="아이콘 이름 (예: arrow, file, user)" autocomplete="off"></div><p class="Catui_help" aria-live="polite"></p>';
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", iconList.querySelector("use").getAttribute("href").replace(/#.*$/, "#Catui_ic-search"));
    box.querySelector("svg").appendChild(use);
    iconList.before(box);
    const q = box.querySelector("input"), count = box.querySelector("p");
    const run = () => {
      const v = q.value.trim().toLowerCase();
      let n = 0;
      items.forEach((li) => { const hit = !v || li.textContent.toLowerCase().includes(v); li.hidden = !hit; if (hit) n++; });
      count.textContent = v ? `${items.length}개 중 ${n}개` : `전체 ${items.length}개`;
    };
    q.addEventListener("input", run);
    run();
  }

  const side = document.querySelector(".doc-side");
  if (side && matchMedia("(max-width: 991px)").matches) side.open = false;
  // 긴 사이드바에서 현재 페이지가 보이도록 사이드바 안에서만 스크롤
  const cur = side?.querySelector('a[aria-current="page"]');
  if (cur && side.scrollHeight > side.clientHeight) side.scrollTop = cur.offsetTop - side.clientHeight / 2;

  const links = [...document.querySelectorAll(".doc-toc a")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const map = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.remove("is-active"));
      map.get(en.target.id)?.classList.add("is-active");
    });
  }, { rootMargin: "-80px 0px -70% 0px" });
  map.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
})();
