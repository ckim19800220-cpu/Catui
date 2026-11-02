import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, layerRoot, icon, uid, imeBusy } from "../core/dom.js";

// command — 명령 팔레트 (Ctrl/⌘+K). .Catui_cmdk를 네이티브 <dialog>에 띄운다.
//   command.render({ id: 'cmd', hotkey: 'mod+k', placeholder: '명령 또는 페이지 검색',
//     data: [{ group: '이동', title: '대시보드', icon: 'layout-dashboard', kbd: 'G D', keywords: 'home', href: '/dash' },
//            { group: '작성', title: '새 주문', icon: 'plus', handler(item) { … } }] })
//   command.open('cmd') / command.close('cmd') · 이벤트 command.on('select(cmd)', ({ item }) => {})
// 검색: 제목·키워드 포함, 띄어쓰기 무시, 한글 초성(ㄷㅅㅂㄷ → 대시보드).
const CATUI_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const catuiChosung = (s) => [...s].map((ch) => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CATUI_CHO[Math.floor(k / 588)] : ch; }).join("");
const catuiSafeLink = (u) => { try { const url = new URL(String(u), location.href); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; } };

export const command = component({
  name: "command",
  config: { data: [], hotkey: "mod+k", placeholder: "명령 검색", label: "명령 팔레트", empty: "맞는 명령이 없습니다.", limit: 50 },
  render(inst) {
    const c = inst.config;
    const qid = uid("catui-cmd-q"), lid = uid("catui-cmd-l");
    const dlg = document.createElement("dialog");
    dlg.className = "Catui_cmdk";
    dlg.setAttribute("aria-label", c.label);
    mount(dlg, html`<div class="Catui_cmdk-search">${icon("search", 16)}<label class="Catui_clip" for="${qid}">${c.label} 검색</label><input class="Catui_input" id="${qid}" type="search" placeholder="${c.placeholder}" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="${lid}" aria-autocomplete="list"></div><div id="${lid}" role="listbox" aria-label="${c.label} 결과"></div><div class="Catui_cmdk-hint" aria-hidden="true"><span>↑↓ 이동</span><span>Enter 실행</span><span>Esc 닫기</span></div>`);
    layerRoot().appendChild(dlg);
    const input = dlg.querySelector("input"), list = dlg.querySelector(`#${lid}`);
    let shown = [], active = 0;

    const match = (it, q) => {
      if (!q) return true;
      const hay = `${it.title} ${it.keywords || ""} ${it.group || ""}`.toLowerCase();
      const flat = hay.replace(/\s+/g, ""), qq = q.toLowerCase().replace(/\s+/g, "");
      if (flat.includes(qq)) return true;
      return /^[ㄱ-ㅎ]+$/.test(qq) && catuiChosung(flat).includes(qq);   // 초성만 친 경우
    };
    const draw = () => {
      const q = input.value.trim();
      shown = (c.data || []).filter((it) => !it.hidden && match(it, q)).slice(0, c.limit);
      const groups = [];
      shown.forEach((it, i) => { const g = it.group || "명령"; let grp = groups.find((x) => x.name === g); if (!grp) groups.push((grp = { name: g, rows: [] })); grp.rows.push([it, i]); });
      // 그룹 순서대로 다시 번호를 매겨 ↑↓ 순서와 화면 순서를 맞춘다
      shown = groups.flatMap((g) => g.rows.map(([it]) => it));
      let k = -1;
      mount(list, shown.length
        ? html`${groups.map((g, gi) => html`<details class="Catui_cmdk-grp" open role="group" aria-labelledby="${lid}-g${gi}"><summary id="${lid}-g${gi}" tabindex="-1">${g.name}</summary>${g.rows.map(([it]) => { k += 1; return html`<div class="Catui_cmdk-row" role="option" id="${lid}-${k}" data-catui-cmd="${k}" aria-selected="false" ${it.disabled ? html`aria-disabled="true"` : ""}>${it.icon ? icon(it.icon, 16) : ""}<span>${it.title}</span>${it.kbd ? html`<span class="Catui_kbd">${it.kbd}</span>` : ""}</div>`; })}</details>`)}`
        : html`<p class="Catui_cmdk-row" role="presentation" aria-live="polite">${c.empty}</p>`);
      setActive(shown.findIndex((it) => !it.disabled));
    };
    const setActive = (i) => {
      active = i;
      list.querySelectorAll("[data-catui-cmd]").forEach((r) => { const on = Number(r.dataset.catuiCmd) === i; r.classList.toggle("Catui_cmdk-row-on", on); r.setAttribute("aria-selected", String(on)); if (on) r.scrollIntoView({ block: "nearest" }); });
      if (i >= 0) input.setAttribute("aria-activedescendant", `${lid}-${i}`); else input.removeAttribute("aria-activedescendant");
    };
    const step = (d) => {
      const n = shown.length;
      if (!n) return;
      let i = active;
      for (let t = 0; t < n; t++) { i = (i + d + n) % n; if (!shown[i].disabled) break; }   // 비활성은 건너뜀
      setActive(i);
    };
    const run = (i) => {
      const it = shown[i];
      if (!it || it.disabled) return;
      const keep = it.handler?.call(inst, it) === false;
      inst.emit("select", { item: it });
      if (keep) return;
      close();
      const href = it.href && catuiSafeLink(it.href);
      if (href) location.assign(href);
    };
    const open = () => {
      if (dlg.open) return;
      input.value = "";
      draw();
      dlg.showModal();
      input.focus();
      inst.emit("open", {});
    };
    const close = () => { if (dlg.open) dlg.close(); };

    const onKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
      else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setActive(0); }
      else if (e.key === "Enter" && !imeBusy(e)) { e.preventDefault(); run(active); }
      else if (e.key === "Escape" && imeBusy(e)) e.preventDefault();   // 한글 조합 중 Esc는 팔레트를 닫지 않음
    };
    const onClick = (e) => {
      if (e.target === dlg) { close(); return; }   // 바깥(배경) 클릭
      const r = e.target.closest("[data-catui-cmd]");
      if (r) run(Number(r.dataset.catuiCmd));
      if (e.target.closest("summary")) e.preventDefault();   // 그룹 제목은 접히지 않음
    };
    const onHover = (e) => { const r = e.target.closest("[data-catui-cmd]"); if (r && Number(r.dataset.catuiCmd) !== active && r.getAttribute("aria-disabled") !== "true") setActive(Number(r.dataset.catuiCmd)); };
    // 단축키: 'mod+k'(Windows Ctrl, Mac ⌘) · '/' 같은 한 글자는 입력 중이 아닐 때만
    const keys = [].concat(c.hotkey || []).map((h) => String(h).toLowerCase().split("+"));
    const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
    const onHot = (e) => {
      if (dlg.open || e.defaultPrevented || imeBusy(e)) return;
      const typing = e.target.closest?.("input, textarea, select, [contenteditable=true]");
      for (const parts of keys) {
        const key = parts[parts.length - 1], mods = parts.slice(0, -1);
        const want = { ctrl: mods.includes("ctrl") || (mods.includes("mod") && !isMac), meta: mods.includes("meta") || (mods.includes("mod") && isMac), shift: mods.includes("shift"), alt: mods.includes("alt") };
        if (e.key.toLowerCase() !== key || e.ctrlKey !== want.ctrl || e.metaKey !== want.meta || e.altKey !== want.alt || (want.shift && !e.shiftKey)) continue;
        if (!mods.length && typing) continue;
        e.preventDefault();
        open();
        return;
      }
    };
    input.addEventListener("input", draw);
    input.addEventListener("keydown", onKey);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("mousemove", onHover);
    dlg.addEventListener("close", () => inst.emit("close", {}));
    if (keys.length) document.addEventListener("keydown", onHot);
    inst.open = open;
    inst.close = close;
    inst.dialog = dlg;
    inst.use(() => { document.removeEventListener("keydown", onHot); close(); dlg.remove(); });
  },
  open(id) { command.getThis(id)?.open(); },
  close(id) { command.getThis(id)?.close(); },
});
