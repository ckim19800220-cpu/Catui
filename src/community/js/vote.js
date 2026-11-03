// vote — 추천 · 비추천 (글·댓글 공통)
//   <div class="Catui_cm-vote" data-catui-cm-vote="post:1201" data-up="512" data-down="21">
//     <button data-dir="up">…<b data-n>512</b></button><button data-dir="down">…</button></div>
//   · 한 글에 한 번(기억). 같은 버튼을 다시 누르면 취소, 반대 버튼은 바꾸기
//   · 낙관적 갱신: 숫자를 먼저 바꾸고 community.voteRequest(실서비스 API)가 실패하면 되돌린다
//   · 숫자가 바뀌면 짧게 위로 밀려 들어옴(피드백, 200ms) — 모션 줄이기면 즉시
community.voteRequest = () => Promise.resolve(true);   // 실서비스: (id, dir) => fetch('/api/vote', …)
community.vote = {
  get: (key) => cmGet("votes", {})[key] || "",
  set(key, dir) { const v = cmGet("votes", {}); if (dir) v[key] = dir; else delete v[key]; cmSet("votes", v); },
  paint(box) {
    const mine = this.get(box.dataset.catuiCmVote), up = Number(box.dataset.up) + (mine === "up" ? 1 : 0), down = Number(box.dataset.down) + (mine === "down" ? 1 : 0);
    box.querySelectorAll("button[data-dir]").forEach((b) => {
      const on = b.dataset.dir === mine, n = b.dataset.dir === "up" ? up : down;
      b.setAttribute("aria-pressed", String(on));
      const out = b.querySelector("[data-n]");
      if (out && out.textContent !== String(n)) { out.textContent = String(n); out.classList.remove("Catui_cm-bump"); void out.offsetWidth; out.classList.add("Catui_cm-bump"); }
      b.setAttribute("aria-label", `${b.dataset.dir === "up" ? "추천" : "비추천"} ${n}${on ? " (누름)" : ""}`);
    });
    const score = box.querySelector("[data-catui-cm-score]");
    if (score) score.textContent = String(up - down);
  },
  // 새로 그린 영역(댓글 등)의 추천 상태만 칠한다 — 클릭은 루트 한 곳에서 받는다
  paintAll(scope) {
    scope.querySelectorAll("[data-catui-cm-vote]").forEach((box) => {
      this.paint(box);
      box.querySelectorAll("[data-n]").forEach((n) => n.classList.remove("Catui_cm-bump"));   // 처음 칠할 때는 움직이지 않는다
    });
  },
  init(root) {
    this.paintAll(root);
    community._on(root, "click", (e) => {
      const b = e.target.closest("[data-catui-cm-vote] button[data-dir]");
      if (!b) return;
      const box = b.closest("[data-catui-cm-vote]"), key = box.dataset.catuiCmVote, before = this.get(key);
      const dir = before === b.dataset.dir ? "" : b.dataset.dir;
      this.set(key, dir); this.paint(box);
      community.voteRequest(key, dir).then((ok) => {
        if (!ok) throw new Error("vote");
        community.emit("vote", { key, dir });
        if (dir) catui.layer.msg(dir === "up" ? "추천했습니다" : "비추천했습니다", { time: 1000 });
      }).catch(() => { this.set(key, before); this.paint(box); catui.layer.msg("반영하지 못했습니다. 다시 시도해 주세요", { icon: "warn" }); });
    });
  },
};
