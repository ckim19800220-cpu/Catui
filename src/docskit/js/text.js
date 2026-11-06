// text — 글자 도구: 안전한 마크다운 일부 · 본문 블록 · 읽는 시간 · 제목 id · 한글 초성 검색
//
// 마크다운(docs.md / docs.mdInline): 먼저 & < > " 를 모두 이스케이프한 뒤 아래만 바꾼다 — 마크업 주입 없음
//   **굵게** · `코드` · [글자](https://주소) (https만, 새 창 + 숨김 글자 "(새 창)") · 빈 줄로 문단 · "- " 목록
//   코드 안(`…`)은 굵게·링크로 바꾸지 않는다. javascript: · http: · 상대 주소 링크는 글자 그대로 둔다.
// 읽는 시간(docs.readTime): 분 = 올림(한글 음절 수 ÷ 500 + 그 밖의 단어 수 ÷ 200), 최소 1분
//   · 한글 음절 = 가–힣, 단어 = 영문·숫자 묶음 · 요소를 넘기면 코드 블록(pre)은 세지 않는다 · rules.readKo/readWords로 바꿈
// 검색 일치(docs.search.match): 본체 command(명령 팔레트)와 같은 규칙 — 띄어쓰기·대소문자 무시, 한글 초성
//   ('ㄷㅅㅂㄷ' · '대ㅅ'(입력 중) · 'ㄷ시' → 대시보드)

const dkEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** 한 줄 마크다운 → HTML 문자열 (이스케이프 후 굵게·코드·https 링크만) */
docs.mdInline = function (src) {
  return dkEsc(src).split(/(`[^`\n]+`)/g).map((seg, i) => (i % 2
    ? `<code>${seg.slice(1, -1)}</code>`
    : seg.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow" target="_blank">$1<span class="Catui_clip"> (새 창)</span></a>'))).join("");
};
/** 여러 줄 마크다운 → HTML 문자열: 빈 줄로 문단, 모든 줄이 "- "면 목록 */
docs.md = function (src) {
  return String(src ?? "").replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim()).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${docs.mdInline(l.slice(2))}</li>`).join("")}</ul>`;
    return `<p>${lines.map((l) => docs.mdInline(l)).join("<br>")}</p>`;
  }).join("");
};

/** 본문 블록(JSON) → 마크업. 글자는 모두 이스케이프(p·list·note는 docs.mdInline)
 *  { h2 } · { h3 } · { p } · { list: [] } · { code, lang } · { note, tone: "tip"|"warn" } */
docs.blocks = function (list = []) {
  const md = (s) => catui.raw(docs.mdInline(s));
  return catui.html`${list.map((b) => {
    if (b.h2) return catui.html`<h2>${b.h2}</h2>`;
    if (b.h3) return catui.html`<h3>${b.h3}</h3>`;
    if (b.list) return catui.html`<ul>${b.list.map((x) => catui.html`<li>${md(x)}</li>`)}</ul>`;
    if (b.code != null) return catui.html`<pre data-lang="${b.lang || ""}"><code>${b.code}</code></pre>`;
    if (b.note) {
      const t = { tip: ["Catui_callout-tip", "팁", "sparkles"], warn: ["Catui_callout-warn", "주의", "alert-triangle"] }[b.tone] || ["", "참고", "info"];
      return catui.html`<div class="Catui_callout ${t[0]}">${catui.icon(t[2], 18)}<p class="Catui_callout-title">${t[1]}</p><p>${md(b.note)}</p></div>`;
    }
    return b.p ? catui.html`<p>${md(b.p)}</p>` : "";
  })}`;
};

/** 읽는 시간 — 글자(문자열) 또는 요소(코드 블록 제외)
 *  → { minutes, ko, words, label: "3분" } */
docs.readTime = function (src) {
  let text = "";
  if (typeof src === "string") text = src;
  else if (src?.nodeType) {
    const w = document.createTreeWalker(src, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest("pre, script, style, .Catui_clip") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) text += ` ${n.nodeValue}`;
  }
  const ko = (text.match(/[가-힣]/g) || []).length;
  const words = (text.replace(/[가-힣]/g, " ").match(/[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g) || []).length;
  const minutes = Math.max(1, Math.ceil(ko / docs.rules.readKo + words / docs.rules.readWords));
  return { minutes, ko, words, label: `${minutes}분` };
};

/** 제목 글자 → id (한글 그대로, 공백·기호는 "-"), 문서 안에서 겹치면 -2, -3 … */
docs.slug = function (text, taken = null) {
  const base = String(text ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "sec";
  let id = base, n = 1;
  const used = (x) => (taken ? taken.has(x) : false) || !!document.getElementById(x);
  while (used(id)) id = `${base}-${++n}`;
  taken?.add(id);
  return id;
};

// ── 한글 초성 (본체 command와 같은 표) ──
const DK_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
docs.chosung = (s) => [...String(s)].map((ch) => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? DK_CHO[Math.floor(k / 588)] : ch; }).join("");
