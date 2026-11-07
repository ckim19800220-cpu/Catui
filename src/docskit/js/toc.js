// toc — 목차 자동 생성 · 제목 앵커(주소 복사) · 코드 블록 복사
//   docs.toc(본문, 상자, { levels: "h2, h3" })  본문의 h2/h3 → 목차 링크(h3는 h2 아래 목록), id 없으면 제목으로 만든다
//     · 스크롤하면 지나간 마지막 제목의 링크에 aria-current="location" (화면 위 30% 선 기준)
//       (본체 site의 [data-catui-spy]는 <section> 단위라 섹션 없는 본문의 h3까지 따라가도록 제목 기준으로 따로 계산)
//     · 제목마다 앵커 버튼(# 모양, 숨김 글자 "… 제목 주소 복사") — 누르면 주소#id를 복사하고 주소창도 바꾼다
//     · [data-catui-dk-notoc] 안의 제목은 넣지 않는다 · 제목이 없으면 상자를 숨긴다
//   docs.code(범위)  범위 안 <pre>마다 머리줄(언어 이름 + 복사 버튼)을 붙인다. 이미 붙인 것은 건너뜀
//     · 복사는 catui.util.copy(비보안 주소에서도 동작), 결과는 버튼 글자("복사됨") + 화면 낭독기 알림 + 'copy' 이벤트
//   선언형: <article data-catui-dk-toc="#목차상자">  ·  <div data-catui-dk-code>
docs._tocs = [];
docs.toc = function (article, box, { levels = docs.rules.tocLevels, title = "이 쪽에서" } = {}) {
  const art = catui.el(article), out = catui.el(box);
  if (!art) return { items: [], el: null };
  const taken = new Set();
  const hs = [...art.querySelectorAll(levels)].filter((h) => !h.closest("[data-catui-dk-notoc]") && h.textContent.trim());
  const items = hs.map((h) => {
    const text = (h.querySelector("[data-dk-text]")?.textContent || h.textContent).trim();
    if (!h.id) h.id = docs.slug(text, taken); else taken.add(h.id);
    if (!h.querySelector(".Catui_dk-anchor")) {
      // 제목 글자는 그대로 두고 끝에 앵커를 붙인다 (제목 글자를 다시 읽을 수 있게 data-dk-text로 감쌈)
      const span = document.createElement("span");
      span.setAttribute("data-dk-text", "");
      while (h.firstChild) span.appendChild(h.firstChild);
      h.appendChild(span);
      const a = document.createElement("a");
      a.className = "Catui_dk-anchor";
      a.href = `#${h.id}`;
      catui.mount(a, catui.html`${catui.icon("link-2", 16)}${dkClip(`${text} 제목 주소 복사`)}`);
      h.appendChild(a);
    }
    return { id: h.id, text, level: Number(h.tagName.slice(1)), el: h };
  });
  if (docs._once(art, "anchor")) docs._on(art, "click", (e) => { const a = e.target.closest(".Catui_dk-anchor"); if (a) { e.preventDefault(); docs.anchor(a.getAttribute("href").slice(1)); } });
  if (!out) return { items, el: null };
  if (!items.length) { out.hidden = true; return { items, el: out }; }
  out.hidden = false;
  // 첫 단계(가장 큰 제목) 아래에 다음 단계를 한 겹 넣는다
  const top = Math.min(...items.map((x) => x.level));
  const groups = [];
  for (const it of items) { if (it.level === top || !groups.length) groups.push({ it, kids: [] }); else groups[groups.length - 1].kids.push(it); }
  const link = (it) => catui.html`<a href="#${it.id}">${it.text}</a>`;
  const mobile = matchMedia("(max-width: 991px)");
  const opened = out.querySelector("details")?.open ?? !mobile.matches;
  catui.mount(out, catui.html`<details class="Catui_dk-toc"${opened ? catui.html` open` : ""}><summary class="Catui_dk-toc-t">${title}${catui.icon("chevron-down", 16)}</summary><nav aria-label="${title}"><ol>${groups.map((g) => catui.html`<li>${link(g.it)}${g.kids.length ? catui.html`<ol>${g.kids.map((k) => catui.html`<li>${link(k)}</li>`)}</ol>` : ""}</li>`)}</ol></nav></details>`);
  if (out.closest(".Catui_dk-docs") && docs._once(out, "toc-layout")) {
    const parent = out.parentElement, next = out.nextSibling;
    const place = () => {
      if (mobile.matches) art.querySelector(":scope > header")?.after(out);
      else parent.insertBefore(out, next?.parentNode === parent ? next : art);
    };
    docs._on(mobile, "change", () => { place(); out.querySelector("details").open = !mobile.matches; });
    place();
  }
  const t = { items, links: [...out.querySelectorAll("a[href^='#']")], box: out };
  docs._tocs = docs._tocs.filter((x) => x.box !== out && x.box.isConnected).concat(t);
  if (docs._once(window, "spy")) {
    let raf = 0;
    const sync = () => { raf = 0; docs.tocSync(); };
    docs._on(window, "scroll", () => { if (!raf) raf = requestAnimationFrame(sync); }, { passive: true });
    docs._on(window, "resize", () => docs.tocSync());
    docs._offs.push(() => cancelAnimationFrame(raf));
  }
  docs.tocSync();
  return { items, el: out };
};
/** 현재 위치 다시 계산 (스크롤·크기 바뀜 때 자동, 내용을 바꾼 뒤 직접 불러도 된다) */
docs.tocSync = function () {
  const line = innerHeight * 0.3, atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
  for (const t of docs._tocs) {
    const live = t.items.filter((x) => x.el.isConnected);
    let cur = null;
    for (const x of live) if (x.el.getBoundingClientRect().top <= line) cur = x;
    if (atEnd && live.length && live[live.length - 1].el.getBoundingClientRect().top < innerHeight) cur = live[live.length - 1];
    t.links.forEach((a) => { if (cur && a.getAttribute("href") === `#${cur.id}`) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  }
};
/** 제목 주소 복사: 주소창을 #id로 바꾸고(기록 안 남김) 전체 주소를 복사 */
docs.anchor = async function (id) {
  const url = `${location.href.split("#")[0]}#${id}`;
  try { history.replaceState(history.state, "", `#${id}`); } catch { /* file:// 등 */ }
  document.getElementById(id)?.scrollIntoView({ behavior: dkReduced() ? "auto" : "smooth", block: "start" });
  const ok = await catui.util.copy(url);
  catui.layer.msg(ok ? "제목 주소를 복사했습니다" : "주소를 복사하지 못했습니다", { icon: ok ? "success" : "warn", time: 1400 });
  docs.emit("copy", { text: url, ok, kind: "anchor" });
  return ok;
};

// ── 코드 블록 ──
docs.code = function (scope = document) {
  const root = scope?.nodeType === 9 ? scope : catui.el(scope);   // 문서(document)도 받는다
  if (!root) return 0;
  let n = 0;
  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.closest(".Catui_dk-code") || pre.closest("[data-catui-dk-nocopy]")) return;
    const wrap = document.createElement("div");
    wrap.className = "Catui_codeblock Catui_dk-code";
    pre.replaceWith(wrap);
    const lang = pre.getAttribute("data-lang") || pre.querySelector("code")?.getAttribute("data-lang") || "코드";
    catui.mount(wrap, catui.html`<div class="Catui_codeblock-h"><span>${lang}</span><button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_dk-copy" type="button" data-catui-dk-copy>${catui.icon("copy", 16)}<span data-label>복사</span>${dkClip(` ${lang} 코드`)}</button></div>`);
    pre.tabIndex = 0;   // 가로로 넘치는 코드를 키보드로도 밀 수 있게
    wrap.appendChild(pre);
    n += 1;
  });
  if (docs._once(root, "copy")) docs._on(root, "click", (e) => { const b = e.target.closest("[data-catui-dk-copy]"); if (b && root.contains(b) && !e.catuiDkCopy) { e.catuiDkCopy = true; docs.copyCode(b); } });   // 겹친 범위에 붙여도 한 번만
  return n;
};
docs.copyCode = async function (btn) {
  const pre = btn.closest(".Catui_dk-code")?.querySelector("pre");
  const text = (pre?.querySelector("code") || pre)?.textContent ?? "";
  const ok = text ? await catui.util.copy(text) : false;
  const label = btn.querySelector("[data-label]");
  if (label) {
    label.textContent = ok ? "복사됨" : "실패";
    clearTimeout(Number(btn.dataset.timer));
    btn.dataset.timer = String(setTimeout(() => { label.textContent = "복사"; }, 1500));
  }
  docs.announce(ok ? "코드를 복사했습니다" : "코드를 복사하지 못했습니다");
  docs.emit("copy", { text, ok, kind: "code" });
  return ok;
};
