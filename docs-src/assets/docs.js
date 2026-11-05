// 문서 사이트 보조 스크립트 (없어도 문서는 읽힌다): 코드 복사, 목차 현재 위치, 모바일 사이드바 기본 닫힘
(() => {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".doc-copy");
    if (!btn) return;
    const code = btn.parentElement.querySelector("pre code")?.textContent ?? "";
    try { await navigator.clipboard.writeText(code); btn.textContent = "복사됨"; } catch { btn.textContent = "복사 실패"; }
    setTimeout(() => { btn.textContent = "복사"; }, 1500);
  });

  // 문서 검색 (Ctrl/⌘+K 또는 머리의 검색 버튼): 빌드가 넣은 색인(제목·분류·설명)에서 찾아 링크로 보인다
  const dlg = document.querySelector(".doc-search"), sbtn = document.querySelector(".doc-search-btn");
  if (dlg && sbtn) {
    let idx = [], loading = null;
    const q = dlg.querySelector("input"), list = dlg.querySelector("#doc-search-list"), count = dlg.querySelector("#doc-search-count");
    // 색인(assets/search-index.js)은 처음 열 때 한 번만 불러온다. file://에서도 되도록 fetch 대신 script
    const load = () => loading ||= new Promise((done) => {
      const root = (dlg.dataset.home || "index.html").replace(/index\.html$/, "");
      const s = document.createElement("script");
      s.src = dlg.dataset.index;
      s.onload = () => { idx = (window.catuiDocIndex || []).map((p) => ({ ...p, u: root + p.u })); done(); };
      s.onerror = () => { count.textContent = "검색 색인을 불러오지 못했습니다."; loading = null; done(); };
      document.head.appendChild(s);
    });
    const norm = (s) => s.toLowerCase().replace(/\s+/g, "");
    const draw = () => {
      const v = norm(q.value);
      const hits = (v ? idx.filter((p) => norm(`${p.t}${p.s}${p.d}`).includes(v)) : idx.slice(0, 8)).slice(0, 20);
      list.textContent = "";
      hits.forEach((p) => {
        const li = document.createElement("li"), a = document.createElement("a"), b = document.createElement("b"), s = document.createElement("span");
        a.href = p.u; b.textContent = p.t; s.textContent = `${p.s}${p.d ? ` — ${p.d}` : ""}`;
        a.append(b, s); li.appendChild(a); list.appendChild(li);
      });
      if (!idx.length && loading) { count.textContent = "색인을 불러오는 중…"; return; }
      if (v && !hits.length) { const li = document.createElement("li"); li.className = "doc-search-empty"; li.textContent = `'${q.value.trim()}'에 맞는 문서가 없습니다. 다른 낱말로 찾아 보세요.`; list.appendChild(li); }
      count.textContent = v ? `${hits.length}개 찾음` : "자주 찾는 문서";
    };
    const open = () => {
      if (dlg.open) return;
      if (!idx.length) load().then(() => { if (dlg.open) draw(); });
      q.value = ""; draw(); dlg.showModal(); sbtn.setAttribute("aria-expanded", "true"); q.focus();
    };
    sbtn.setAttribute("aria-expanded", "false");
    dlg.addEventListener("close", () => sbtn.setAttribute("aria-expanded", "false"));
    sbtn.addEventListener("click", open);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });   // 바깥(스크림) 누르면 닫기
    q.addEventListener("input", draw);
    q.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter·↓는 글자 확정
      if (e.key === "ArrowDown") { e.preventDefault(); list.querySelector("a")?.focus(); }
      else if (e.key === "Enter") { const a = list.querySelector("a"); if (a) { e.preventDefault(); location.href = a.href; } }
    });
    list.addEventListener("keydown", (e) => {
      const links = [...list.querySelectorAll("a")], i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); links[Math.min(links.length - 1, i + 1)]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (i <= 0 ? q : links[i - 1]).focus(); }
    });
    document.addEventListener("keydown", (e) => {
      // 문서 안에 명령 팔레트 예제(.Catui_cmdk)가 있는 쪽에서는 그 예제가 Ctrl+K를 쓴다
      if (e.key.toLowerCase() !== "k" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.isComposing || document.querySelector(".Catui_cmdk")) return;
      e.preventDefault();
      open();
    });
  }

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
  if (iconList?.querySelector("use")) {
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
