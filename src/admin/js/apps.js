// apps — 앱 화면 공통 동작
//   admin.split(el)                  767px 이하에서 목록 ↔ 본문 한 단씩 (data-catui-adm-pane="list|detail", [data-catui-adm-back])
//   admin.chat({ log, form, me })     보내기(한글 조합 중 Enter는 무시) · 기록 아래로 스크롤 · 이벤트 admin.on('chat', { text })
//   admin.kanban(el)                 카드 끌어 옮기기 + 키보드(←→ 열 이동 · ↑↓ 순서) · 열 개수 갱신 · 이벤트 admin.on('kanban', { card, from, to })
admin.split = function (el) {
  const box = catui.el(el);
  if (!box) return null;
  const show = (pane) => { box.setAttribute("data-catui-adm-pane", pane); };
  admin._on(box, "click", (e) => { if (e.target.closest("[data-catui-adm-back]")) { show("list"); box.querySelector('[aria-current="true"]')?.focus(); } });
  show("list");
  return { show };
};

const admNow = () => catui.util.toDateString(new Date(), "HH:mm");
admin.chat = function ({ log, form, me = "나" }) {
  const box = catui.el(log), f = catui.el(form);
  if (!box || !f) return null;
  const chat = box.querySelector(".Catui_chat") || box;
  const scroll = () => { box.scrollTop = box.scrollHeight; };
  const add = (text, who) => {
    const mine = !who;
    const msg = document.createElement("div");
    msg.className = `Catui_chat-msg${mine ? " Catui_chat-me" : ""}`;
    catui.mount(msg, catui.html`${mine ? "" : catui.html`<span class="Catui_av Catui_av-sm" aria-hidden="true">${String(who).slice(0, 1)}</span>`}<p class="Catui_chat-bubble"><span class="Catui_clip">${mine ? me : who}: </span>${text}</p><time class="Catui_chat-time" datetime="${new Date().toISOString()}">${admNow()}</time>`);
    const input = chat.querySelector(".Catui_chat-input");
    if (input && input.parentElement === chat) chat.insertBefore(msg, input); else chat.appendChild(msg);
    scroll();
    return msg;
  };
  const input = f.querySelector("input, textarea");
  // 한글 조합 중 Enter(확정용)는 보내지 않는다 — Safari는 keyCode 229
  admin._on(input, "keydown", (e) => { if (e.key === "Enter" && catui.imeBusy(e)) e.preventDefault(); });
  admin._on(f, "submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    add(text);
    input.value = "";
    admin.emit("chat", { text });
  });
  scroll();
  return { add, scroll };
};

admin.kanban = function (el) {
  const board = catui.el(el);
  if (!board) return null;
  board.classList.add("Catui_adm-kanban");
  const cols = () => [...board.querySelectorAll(".Catui_kanban-col")];
  const live = document.createElement("p");
  live.className = "Catui_clip"; live.setAttribute("aria-live", "polite");
  board.after(live);
  admin._offs.push(() => live.remove());
  const colName = (c) => c.querySelector(".Catui_kanban-h")?.firstChild?.textContent.trim() || "";
  const sync = () => cols().forEach((c) => {
    const n = c.querySelectorAll(".Catui_kanban-card").length, cnt = c.querySelector(".Catui_kanban-h .Catui_count");
    if (cnt) { cnt.textContent = String(n); cnt.setAttribute("aria-label", `카드 ${n}개`); }
    c.querySelector("[data-catui-adm-empty]")?.toggleAttribute("hidden", n > 0);
  });
  const prep = (card) => {
    card.draggable = true;
    if (!card.hasAttribute("tabindex")) card.tabIndex = 0;
    const t = card.querySelector(".Catui_kanban-title")?.textContent.trim() || "카드";
    card.setAttribute("aria-label", `${t} — ←→ 열 이동, ↑↓ 순서 바꾸기`);
  };
  board.querySelectorAll(".Catui_kanban-card").forEach(prep);
  const moved = (card, from, to) => {
    sync();
    const t = card.querySelector(".Catui_kanban-title")?.textContent.trim();
    live.textContent = from === to ? `${t} 순서를 바꿨습니다` : `${admin.josa(t, "을")} ${admin.josa(colName(to), "으로")} 옮겼습니다`;
    admin.emit("kanban", { card, from, to });
  };
  // 끌어 옮기기
  let drag = null;
  admin._on(board, "dragstart", (e) => { const c = e.target.closest?.(".Catui_kanban-card"); if (!c) return; drag = c; c.classList.add("Catui_adm-drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ""); });
  admin._on(board, "dragend", () => { drag?.classList.remove("Catui_adm-drag"); board.querySelectorAll(".Catui_adm-drop").forEach((c) => c.classList.remove("Catui_adm-drop")); drag = null; });
  admin._on(board, "dragover", (e) => {
    const col = e.target.closest?.(".Catui_kanban-col");
    if (!drag || !col) return;
    e.preventDefault();
    cols().forEach((c) => c.classList.toggle("Catui_adm-drop", c === col));
  });
  admin._on(board, "drop", (e) => {
    const col = e.target.closest?.(".Catui_kanban-col");
    if (!drag || !col) return;
    e.preventDefault();
    const from = drag.closest(".Catui_kanban-col");
    const after = [...col.querySelectorAll(".Catui_kanban-card:not(.Catui_adm-drag)")].find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
    if (after) col.insertBefore(drag, after); else col.appendChild(drag);
    moved(drag, from, col);
  });
  // 키보드
  admin._on(board, "keydown", (e) => {
    const card = e.target.closest?.(".Catui_kanban-card");
    if (!card || e.target !== card || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const from = card.closest(".Catui_kanban-col"), list = cols(), i = list.indexOf(from);
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const sib = e.key === "ArrowUp" ? card.previousElementSibling : card.nextElementSibling;
      if (!sib?.classList.contains("Catui_kanban-card")) return;
      if (e.key === "ArrowUp") from.insertBefore(card, sib); else from.insertBefore(sib, card);
      card.focus(); moved(card, from, from); return;
    }
    const to = list[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (!to) return;
    to.appendChild(card); card.focus(); moved(card, from, to);
  });
  sync();
  return { add(col, card) { catui.el(col)?.appendChild(card); prep(card); sync(); }, sync };
};
