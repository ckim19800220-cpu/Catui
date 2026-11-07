// search — 문서 검색 (서버 없이 색인 JSON으로)
//   색인 항목: { t: 제목, u: 주소, s: 분류, x: 요약·본문 일부, k: 키워드 }
//   색인 읽기 순서: ① 화면 안 <script type="application/json" data-catui-dk-index>[…]</script>(인라인) ② data/search-index.json
//   점수: 제목에 그대로 있음 4 · 제목 초성 일치 3 · 키워드 2 · 요약·본문 1 (같으면 색인 순서) · 최대 rules.searchLimit개
//   form[data-catui-dk-search]        머리 검색: 빈 값이면 막고 입력칸으로, 한글 조합 중 Enter는 무시
//   form[data-catui-dk-search="live"] 검색 화면: 입력하는 대로 결과(조합이 끝난 뒤) + 주소 ?q= 맞춤(기록 안 남김)
//   [data-catui-dk-results] 결과 목록 · [data-catui-dk-count] 결과 수(role="status")
docs.search = {
  /** 본체 command와 같은 일치 규칙: 띄어쓰기·대소문자 무시 포함 검색 + 한글 초성(자음은 그 자리 글자의 초성과) */
  match(text, q) {
    const flat = String(text ?? "").toLowerCase().replace(/\s+/g, ""), qq = String(q ?? "").toLowerCase().replace(/\s+/g, "");
    if (!qq) return true;
    if (flat.includes(qq)) return true;
    const qa = [...qq];
    if (!qa.some((ch) => /[ㄱ-ㅎ]/.test(ch))) return false;
    const fa = [...flat], ca = [...docs.chosung(flat)];
    for (let s = 0; s + qa.length <= fa.length; s++) if (qa.every((ch, k) => fa[s + k] === ch || (/[ㄱ-ㅎ]/.test(ch) && ca[s + k] === ch))) return true;
    return false;
  },
  score(it, q) {
    const qq = String(q).toLowerCase().replace(/\s+/g, "");
    const title = String(it.t || "").toLowerCase().replace(/\s+/g, "");
    if (title.includes(qq)) return 4;
    if (this.match(it.t, q)) return 3;
    if (this.match(it.k, q)) return 2;
    if (this.match(`${it.x || ""} ${it.s || ""}`, q)) return 1;
    return 0;
  },
  /** 색인에서 찾기 → 점수 순 [{ ...항목, score }] */
  find(index, q, limit = docs.rules.searchLimit) {
    const s = String(q ?? "").trim();
    if (!s) return [];
    return (index || []).map((it, i) => ({ ...it, score: this.score(it, s), i })).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.i - b.i).slice(0, limit).map(({ i, ...x }) => x);
  },
  /** 색인 읽기 (인라인 우선) */
  load(scope = document) {
    const inline = scope.querySelector?.('script[type="application/json"][data-catui-dk-index]');
    if (inline) { try { return Promise.resolve(JSON.parse(inline.textContent)); } catch (err) { catui.hint.error("CatuiDocs: 인라인 검색 색인 JSON 문법 오류", "error", err); } }
    return docs.data("search-index");
  },
  /** 글자 안 검색어(그대로 일치하는 부분)를 <mark>로 — 글자는 이스케이프 */
  highlight(text, q) {
    const s = String(text ?? ""), k = String(q ?? "").trim();
    if (!k) return catui.html`${s}`;
    const at = s.toLowerCase().indexOf(k.toLowerCase());
    if (at < 0) return catui.html`${s}`;
    return catui.html`${s.slice(0, at)}<mark class="Catui_dk-mark">${s.slice(at, at + k.length)}</mark>${s.slice(at + k.length)}`;
  },
  render(box, results, q) {
    catui.mount(box, results.length
      ? catui.html`${results.map((r) => catui.html`<li class="Catui_dk-result"><a href="${r.u}"><span class="Catui_dk-result-s">${r.s || "문서"}</span><b>${this.highlight(r.t, q)}</b></a>${r.x ? catui.html`<p>${this.highlight(r.x, q)}</p>` : ""}</li>`)}`
      : "");
  },
  init(root) {
    root.querySelectorAll("form[data-catui-dk-search]").forEach((f) => {
      const input = f.querySelector("input[name=q]");
      if (!input || !docs._once(f, "search")) return;
      const q0 = docs.query().get("q");
      if (q0 && !input.value) input.value = q0;
      docs._on(input, "keydown", (e) => { if (e.key === "Enter" && catui.imeBusy(e)) e.preventDefault(); });   // 조합을 끝내는 Enter로 제출하지 않음
      if (f.getAttribute("data-catui-dk-search") !== "live") {
        docs._on(f, "submit", (e) => { if (!input.value.trim()) { e.preventDefault(); input.focus(); } });
        return;
      }
      const list = root.querySelector("[data-catui-dk-results]"), count = root.querySelector("[data-catui-dk-count]");
      let index = null, timer = 0;
      const run = () => {
        const q = input.value.trim(), res = this.find(index, q);
        if (list) this.render(list, res, q);
        if (count) count.textContent = !q ? "검색어를 입력해 주세요. 초성(예: ㅁㅊ)으로도 찾습니다." : res.length ? `‘${q}’ 검색 결과 ${res.length}건` : `‘${q}’에 맞는 문서가 없습니다. 다른 낱말이나 초성으로 찾아보세요.`;
        try { const u = new URL(location.href); if (q) u.searchParams.set("q", q); else u.searchParams.delete("q"); history.replaceState(history.state, "", u); } catch { /* file:// 등 */ }
        docs.emit("search", { q, count: res.length });
        return res;
      };
      this.run = run;
      docs._on(f, "submit", (e) => { e.preventDefault(); if (index) run(); });
      docs._on(input, "input", (e) => { if (e.isComposing) return; clearTimeout(timer); timer = setTimeout(() => { if (index) run(); }, 120); });
      docs._on(input, "compositionend", () => { clearTimeout(timer); timer = setTimeout(() => { if (index) run(); }, 120); });
      docs._offs.push(() => clearTimeout(timer));
      const load = () => {
        if (list) list.setAttribute("aria-busy", "true");
        if (count) count.textContent = "검색 데이터를 불러오는 중입니다…";
        return this.load(root).then((ix) => {
          index = ix; this.index = ix; run(); return ix;
        }, () => {
          if (count) count.textContent = "검색 데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.";
          if (list) {
            catui.mount(list, catui.html`<li><button class="Catui_btn Catui_btn-md Catui_btn-secondary" type="button" data-retry>다시 시도</button></li>`);
            docs._on(list.querySelector("[data-retry]"), "click", (e) => { e.currentTarget.disabled = true; this.ready = load(); }, { once: true });
          }
          return null;
        }).finally(() => list?.removeAttribute("aria-busy"));
      };
      this.ready = load();
    });
  },
};
