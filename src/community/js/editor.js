// editor — 글쓰기
//   <form data-catui-cm-editor> 안에 board(select) · cat(select) · title · body(textarea) · 사진(input file)
//   · 게시판을 바꾸면 말머리 목록을 boards.json에서 다시 채운다
//   · 서식 버튼 [data-md="bold|quote|list|link"]: 선택한 글자를 간단한 마크다운으로 감싼다
//   · 미리보기 [data-catui-cm-preview]: 글자를 이스케이프한 뒤 굵게·인용·목록·링크(https만)만 바꿈 — 마크업 주입 없음
//   · 임시 저장: 입력이 멈추면 0.8초 뒤 기억("임시 저장됨 10:42"), 다시 열면 이어 쓰기 안내 · 등록·지우기 후 삭제
//   · 떠날 때 확인: 저장하지 않은 내용이 있으면 브라우저 확인 창
community.md = function (src) {
  const esc = String(src).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return esc.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${l.slice(2)}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^&gt; /.test(l))) return `<blockquote>${lines.map((l) => l.slice(5)).join("<br>")}</blockquote>`;
    return `<p>${lines.join("<br>")}</p>`;
  }).join("")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow ugc" target="_blank">$1</a>');
};
community.editor = {
  init(root) {
    const f = root.querySelector("form[data-catui-cm-editor]");
    if (!f) return;
    const $ = (n) => f.elements[n], note = f.querySelector("[data-catui-cm-saved]");
    const snapshot = () => JSON.stringify({ board: $("board").value, cat: $("cat").value, title: $("title").value, body: $("body").value });
    let base = snapshot(), timer;
    community.data("boards").then((boards) => {
      const fill = () => {
        const b = boards.find((x) => x.id === $("board").value);
        const cur = $("cat").value;
        $("cat").replaceChildren(...(b?.cats || []).filter((c) => !["공지", "이벤트"].includes(c)).map((c) => new Option(c, c, false, c === cur)));
      };
      $("board").replaceChildren(...boards.filter((b) => b.write !== false).map((b) => new Option(b.name, b.id)));
      const want = community.query().get("b");
      if (want) $("board").value = want;
      fill();
      community._on($("board"), "change", fill);
      const draft = cmGet("draft", null);
      if (draft && (draft.title || draft.body)) {
        catui.layer.confirm(`${community.ago(draft.at)} 임시 저장한 글이 있습니다. 이어서 쓸까요?`, { title: "임시 저장 글", okText: "이어 쓰기", cancelText: "새로 쓰기" }, (i) => {
          catui.layer.close(i);
          $("board").value = draft.board; fill(); $("cat").value = draft.cat; $("title").value = draft.title; $("body").value = draft.body;
          [$("title"), $("body")].forEach((x) => x.dispatchEvent(new Event("input", { bubbles: true })));
        }, () => cmSet("draft", null));
      }
      base = snapshot();
    });
    const save = () => {
      if (snapshot() === base) return;
      cmSet("draft", { ...JSON.parse(snapshot()), at: community.now().toISOString() });
      if (note) note.textContent = `임시 저장됨 ${catui.util.toDateString(new Date(), "HH:mm")}`;
      community.emit("draft", { saved: true });
    };
    community._on(f, "input", () => { clearTimeout(timer); timer = setTimeout(save, 800); });
    community._on(window, "beforeunload", (e) => { if (snapshot() !== base && !f.dataset.sent) { e.preventDefault(); e.returnValue = ""; } });
    community._on(f, "click", (e) => {
      const b = e.target.closest("[data-md]");
      if (!b) return;
      const ta = $("body"), s = ta.selectionStart, t = ta.selectionEnd, sel = ta.value.slice(s, t) || "글자";
      const wrap = { bold: `**${sel}**`, quote: sel.split("\n").map((l) => `> ${l}`).join("\n"), list: sel.split("\n").map((l) => `- ${l}`).join("\n"), link: `[${sel}](https://)` }[b.dataset.md];
      ta.setRangeText(wrap, s, t, "select"); ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const prev = f.querySelector("[data-catui-cm-preview]");
    if (prev) community._on(f, "change", (e) => { if (e.target.name === "cm-mode" && e.target.value === "preview") prev.innerHTML = community.md($("body").value) || "<p class=\"Catui_help\">미리 볼 내용이 없습니다.</p>"; });
    const pics = f.querySelector("[data-catui-cm-pics]"), file = f.querySelector("input[type=file]");
    if (file && pics) community._on(file, "change", () => {
      [...file.files].slice(0, 10).forEach((fl) => {
        if (!fl.type.startsWith("image/")) return;
        const fig = document.createElement("figure"); fig.className = "Catui_cm-pic";
        const img = document.createElement("img"); img.src = URL.createObjectURL(fl); img.alt = fl.name;
        const x = document.createElement("button"); x.type = "button"; x.className = "Catui_btn Catui_btn-sm Catui_btn-secondary Catui_btn-icon"; x.setAttribute("aria-label", `${fl.name} 빼기`);
        catui.mount(x, catui.icon("x", 16));
        x.addEventListener("click", () => { URL.revokeObjectURL(img.src); fig.remove(); file.focus(); });
        fig.append(img, x); pics.appendChild(fig);
      });
      file.value = "";
    });
    community._on(f, "reset", () => { setTimeout(() => { cmSet("draft", null); base = snapshot(); if (note) note.textContent = ""; }, 0); });
    community._on(f, "submit", (e) => {
      e.preventDefault();
      if (!catui.form.validate(f)) return;
      f.dataset.sent = "1"; cmSet("draft", null);
      catui.layer.msg(`${community.josa($("title").value.trim().slice(0, 20), "을")} 올렸습니다`, { icon: "success" });
      setTimeout(() => { location.href = "post.html?id=1201"; }, 700);
    });
  },
};
