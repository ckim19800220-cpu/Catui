/*! CatuiAdmin JS 2.0.0 | MIT License (c) imcatDevs | catui 위에 로드 */
import catui from "./catui.esm.js";

// ── admin.js ──
// CatuiAdmin — catui.js 위에 얹는 관리자 확장 (catui.admin)
//   전역: <script src="catui.js"></script><script src="catadmin.js"></script> → catui.admin
//   ESM : import admin from "@imcat-ckim/catui/admin"
// 화면 루트: <div class="Catui_app Catui_adm" data-catui-adm> — 문서 준비 시 자동으로 연결된다(catui config autoInit).
// 상태(사이드바 접힘·하위 메뉴·테마)는 catui.data('admin')(localStorage "catui:admin")에 기억한다.

const ADM_STORE = "admin";
const admGet = (k, d) => { const v = catui.data(ADM_STORE)[k]; return v === undefined ? d : v; };
const admSet = (k, v) => catui.data(ADM_STORE, { key: k, value: v });
const admJson = (id) => {
  const n = document.getElementById(id);
  if (!n) return null;
  try { return JSON.parse(n.textContent); } catch (err) { catui.hint.error(`CatuiAdmin: #${id}의 JSON을 읽지 못했습니다`, "error", err); return null; }
};
// 보이는 포커스 대상 (서랍 Tab 가두기)
const admFocusables = (box) => [...box.querySelectorAll('a[href],button:not([disabled]),summary,input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])')]
  .filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");

// 받침 판단: 한글은 종성, 숫자는 읽는 소리(영·일·삼·육·칠·팔·십), 영문은 l·m·n·r 끝을 받침으로 본다
const admBatchim = (word) => {
  const s = String(word).replace(/[\s)"'\]」』.,!?…]+$/, "");
  const ch = s.slice(-1);
  if (!ch) return { has: false, rieul: false };
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; return { has: jong > 0, rieul: jong === 8 }; }
  if (/\d/.test(ch)) return { has: "0136780".includes(ch), rieul: "178".includes(ch) };
  if (/[a-z]/i.test(ch)) return { has: /[lmnr]/i.test(ch), rieul: /[lr]/i.test(ch) };
  return { has: false, rieul: false };
};

const admin = {
  version: catui.version,
  /** 조사 붙이기: josa('주문', '을') → '주문을', josa('파일', '로') → '파일로', josa('진행', '으로') → '진행으로' */
  josa(word, pair) {
    const b = admBatchim(word);
    const P = { 을: ["을", "를"], 를: ["을", "를"], 이: ["이", "가"], 가: ["이", "가"], 은: ["은", "는"], 는: ["은", "는"], 과: ["과", "와"], 와: ["과", "와"], 으로: ["으로", "로"], 로: ["으로", "로"] }[pair];
    if (!P) return `${word}${pair}`;
    if (P[0] === "으로") return `${word}${b.has && !b.rieul ? "으로" : "로"}`;
    return `${word}${b.has ? P[0] : P[1]}`;
  },
  root: null,
  /** 저장된 상태 읽기/쓰기 */
  store: { get: admGet, set: admSet, clear: () => catui.data(ADM_STORE, null) },
  /** 이벤트: admin.on('theme', ({ value })) · 'collapse' · 'drawer' · 'notify' */
  on: (evt, fn) => catui.onevent("admin", evt, fn),
  emit: (evt, payload) => catui.event("admin", evt, null, payload),
  _offs: [],
  _on(target, type, fn, opt) { if (!target) return; target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); },
};

// ── data.js ──
// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.admin.data('orders').then((rows) => …)       data/orders.json 을 한 번만 읽어 캐시
//   catui.admin.dataBase = '/api/'                      주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   선언형: <section data-catui-adm-src="dashboard-ops">  안에서
//     <b data-catui-adm-text="kpi.users.value" data-catui-adm-format="number|won|man|percent|delta">  값 채우기
//     <div data-catui-adm-chart="area" data-catui-adm-key="charts.network">                        차트 자료
//   점 경로(a.b.0.c)로 JSON 안을 가리킨다. 실패하면 칸은 그대로 두고 콘솔에 한 줄 안내.
admin.dataBase = "data/";
admin._dataCache = new Map();
admin.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiAdmin: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
// 점 경로로 값 꺼내기
admin.pick = (obj, path) => String(path || "").split(".").filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
// 표시 형식
admin.format = function (v, kind) {
  if (v == null || v === "") return "";
  const n = Number(v);
  switch (kind) {
    case "number": return catui.util.number(n);
    case "won": return `${catui.util.number(n)}원`;
    case "man": return `${catui.util.number(Math.round(n / 10000))}만원`;
    case "percent": return `${n}%`;
    case "delta": return `${n > 0 ? "▲" : n < 0 ? "▼" : ""} ${Math.abs(n)}%`.trim();
    default: return String(v);
  }
};
admin.bind = function (scope = document) {
  const boxes = [...scope.querySelectorAll("[data-catui-adm-src]")];
  return Promise.all(boxes.map((box) => this.data(box.getAttribute("data-catui-adm-src")).then((json) => {
    box.querySelectorAll("[data-catui-adm-text]").forEach((el) => {
      const v = this.pick(json, el.getAttribute("data-catui-adm-text"));
      if (v !== undefined) el.textContent = this.format(v, el.getAttribute("data-catui-adm-format"));
    });
    box.querySelectorAll("[data-catui-adm-chart][data-catui-adm-key]").forEach((el) => {
      const d = this.pick(json, el.getAttribute("data-catui-adm-key"));
      if (d) el.setAttribute("data-catui-adm-data", JSON.stringify(d));
    });
    box.setAttribute("data-catui-adm-bound", "");
    admin.emit("data", { name: box.getAttribute("data-catui-adm-src"), data: json, box });
    return json;
  }).catch(() => null)));
};

// ── shell.js ──
// shell — 사이드바 접기(992px 이상, 기억) · 991px 이하 서랍(가림막·Esc·Tab 가두기·포커스 복귀) · 하위 메뉴 펼침 기억
admin.shell = {
  init(root) {
    const side = root.querySelector(".Catui_side");
    if (!side) return;
    const toggle = root.querySelector("[data-catui-adm-toggle]");
    const scrim = root.querySelector(".Catui_adm-scrim");
    const narrow = matchMedia("(max-width: 991px)");
    const isOpen = () => root.hasAttribute("data-catui-adm-open");
    const collapsed = () => root.hasAttribute("data-catui-adm-collapsed");
    const label = (a) => a.querySelector(".Catui_item-label")?.textContent.trim() || "";
    let last = null;

    const sync = () => {
      const rail = narrow.matches ? !isOpen() : collapsed();
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(narrow.matches ? isOpen() : !collapsed()));
        toggle.setAttribute("aria-label", narrow.matches ? (isOpen() ? "메뉴 닫기" : "메뉴 열기") : (collapsed() ? "메뉴 펼치기" : "메뉴 접기"));
      }
      // 아이콘만 보일 때는 마우스를 올리면 이름이 보이게
      side.querySelectorAll(".Catui_item").forEach((a) => { if (rail) a.title = label(a); else a.removeAttribute("title"); });
    };
    const open = () => {
      last = document.activeElement;
      root.setAttribute("data-catui-adm-open", "");
      if (scrim) scrim.hidden = false;
      sync();
      (side.querySelector('[aria-current="page"]') || side.querySelector(".Catui_item"))?.focus();
      admin.emit("drawer", { open: true });
    };
    const close = (restore = true) => {
      if (!isOpen()) return;
      root.removeAttribute("data-catui-adm-open");
      if (scrim) scrim.hidden = true;
      sync();
      if (restore) (last && last.isConnected ? last : toggle)?.focus();
      admin.emit("drawer", { open: false });
    };
    const setCollapsed = (on) => { root.toggleAttribute("data-catui-adm-collapsed", on); admSet("collapsed", on); sync(); admin.emit("collapse", { collapsed: on }); };

    if (admGet("collapsed", false)) root.setAttribute("data-catui-adm-collapsed", "");
    // 하위 메뉴: 현재 화면이 든 메뉴는 항상 펼침, 나머지는 기억한 대로
    const nest = admGet("nest", {});
    side.querySelectorAll("[data-catui-adm-key]").forEach((d) => {
      const k = d.dataset.catuiAdmKey;
      if (!d.querySelector('[aria-current="page"]') && k in nest) d.open = !!nest[k];
    });
    admin._on(side, "toggle", (e) => {
      const d = e.target;
      if (d.matches?.("[data-catui-adm-key]")) admSet("nest", { ...admGet("nest", {}), [d.dataset.catuiAdmKey]: d.open });
    }, true);
    admin._on(side, "click", (e) => {
      const s = e.target.closest("summary");
      // 아이콘만 보이는 상태에서 하위 메뉴 머리를 누르면 메뉴를 펼쳐 하위 항목을 보여 준다
      if (s && (narrow.matches ? !isOpen() : collapsed())) {
        e.preventDefault();
        s.parentElement.open = true;
        if (narrow.matches) open(); else setCollapsed(false);
        return;
      }
      if (narrow.matches && e.target.closest("a[href]")) close(false);
    });
    admin._on(toggle, "click", () => { if (narrow.matches) { if (isOpen()) close(); else open(); } else setCollapsed(!collapsed()); });
    admin._on(scrim, "click", () => close());
    admin._on(document, "keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape" && !e.isComposing) { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const f = admFocusables(side);
      if (!f.length) return;
      const first = f[0], end = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !side.contains(document.activeElement))) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && (document.activeElement === end || !side.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
    admin._on(narrow, "change", () => { close(false); sync(); });
    sync();
    this.open = open; this.close = close; this.collapse = setCollapsed;
  },
  open() {}, close() {}, collapse() {},
};

// ── theme.js ──
// theme — 라이트/다크 전환. 저장한 값이 없으면 시스템 설정(prefers-color-scheme)을 따른다.
//   <button data-catui-adm-theme>  · admin.theme.set('dark' | 'light' | 'system')
admin.theme = {
  get: () => (document.documentElement.getAttribute("data-catui-theme") === "dark" ? "dark" : "light"),
  saved: () => admGet("theme", "system"),
  apply(v) {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.setAttribute("data-catui-theme", "dark");
    else document.documentElement.removeAttribute("data-catui-theme");
    document.querySelectorAll("[data-catui-adm-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "밝은 화면으로" : "어두운 화면으로");
      catui.mount(b, catui.icon(dark ? "sun" : "moon", 18));
    });
  },
  set(v) {
    admSet("theme", v);
    this.apply(v);
    admin.emit("theme", { value: this.get(), saved: v });
  },
  init() {
    this.apply(this.saved());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    admin._on(mq, "change", () => { if (this.saved() === "system") this.apply("system"); });
    admin._on(document, "click", (e) => { if (e.target.closest("[data-catui-adm-theme]")) this.set(this.get() === "dark" ? "light" : "dark"); });
  },
};

// ── notify.js ──
// notify — 상단 바 알림 버튼 + 패널(.Catui_notifs). 데이터: <script type="application/json" id="adm-notify-data">[…]</script>
//   <button data-catui-adm-notify="notifications.html"> — 값은 "전체 알림 보기" 주소
//   항목: { id, who?, text, time(ISO 또는 글자), unread, icon?, href? }
//   admin.notify.add({ text, who }) · markRead(id) · markAll() · count()  · 이벤트 admin.on('notify', { unread })
admin.notify = {
  items: [],
  count() { return this.items.filter((x) => x.unread).length; },
  init(root) {
    const btn = root.querySelector("[data-catui-adm-notify]");
    if (!btn) return;
    this.btn = btn;
    this.more = btn.getAttribute("data-catui-adm-notify") || "";   // "전체 알림 보기" 주소 (비우면 링크 없음)
    const take = (list) => { this.items = (list || []).map((x, i) => ({ id: x.id ?? `n${i}`, ...x })); this.badge(); if (this.pop && !this.pop.hidden) this.render(); };
    // 화면 안 JSON(#adm-notify-data)이 없으면 data/notifications.json 모의 데이터를 읽는다
    const inline = admJson("adm-notify-data");
    this.items = [];
    if (inline) take(inline); else admin.data("notifications").then(take).catch(() => {});
    const pop = document.createElement("section");
    pop.className = "Catui_notifs Catui_adm-pop";
    pop.id = "adm-notify-pop";
    pop.hidden = true;
    pop.setAttribute("aria-labelledby", "adm-notify-t");
    pop.tabIndex = -1;
    root.appendChild(pop);   // 셸 루트 안에 둬야 Catui 기본 글꼴·크기·목록 리셋이 적용된다 (body에 두면 브라우저 기본 16px)
    this.pop = pop;
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-controls", pop.id);
    btn.setAttribute("aria-expanded", "false");
    const place = () => {
      const r = btn.getBoundingClientRect();
      pop.style.top = `${Math.round(r.bottom + 8)}px`;
      pop.style.right = `${Math.max(12, Math.round(innerWidth - r.right))}px`;
    };
    const close = (restore) => { if (pop.hidden) return; pop.hidden = true; btn.setAttribute("aria-expanded", "false"); if (restore) btn.focus(); };
    const openPop = () => { this.render(); place(); pop.hidden = false; btn.setAttribute("aria-expanded", "true"); pop.focus(); };
    admin._on(btn, "click", () => (pop.hidden ? openPop() : close(false)));
    // 패널 안 버튼을 눌러 목록을 다시 그리면 눌린 요소가 DOM에서 빠진다 — 그건 바깥 클릭이 아니다
    admin._on(document, "click", (e) => { if (!pop.hidden && e.target.isConnected && !pop.contains(e.target) && !btn.contains(e.target)) close(false); });
    admin._on(document, "keydown", (e) => { if (e.key === "Escape" && !e.isComposing && !pop.hidden) { e.preventDefault(); close(true); } });
    admin._on(window, "resize", () => { if (!pop.hidden) place(); });
    admin._on(pop, "click", (e) => {
      if (e.target.closest("[data-catui-adm-readall]")) { this.markAll(); return; }
      const li = e.target.closest("[data-catui-adm-nid]");
      if (li) this.markRead(li.dataset.catuiAdmNid);
    });
    admin._offs.push(() => pop.remove());
    this.badge();
  },
  // 알림 시각: ISO면 상대 시간("5분 전"), 글자면 그대로
  when(t) { const d = new Date(t); return t && !Number.isNaN(d.getTime()) && /\d{4}-\d{2}/.test(String(t)) ? catui.util.timeAgo(d) : String(t || ""); },
  render() {
    if (!this.pop) return;
    const n = this.count();
    catui.mount(this.pop, catui.html`<div class="Catui_notifs-h"><span id="adm-notify-t">알림</span>${n ? catui.html`<span class="Catui_count" aria-label="읽지 않음 ${n}건">${n}</span>` : ""}<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-adm-readall ${n ? "" : catui.raw("disabled")}>모두 읽음</button></div>
      ${this.items.length ? catui.html`<ul class="Catui_notifs-list">${this.items.map((x) => catui.html`<li class="Catui_notif${x.unread ? " Catui_notif-unread" : ""}" data-catui-adm-nid="${x.id}">${x.who ? catui.html`<span class="Catui_av Catui_av-sm" aria-hidden="true">${String(x.who).slice(0, 1)}</span>` : catui.html`<span class="Catui_file-ico${[2, 3, 5].includes(x.tone) ? ` Catui_file-ico-${x.tone}` : ""}" aria-hidden="true">${catui.icon(x.icon || "bell", 16)}</span>`}<div class="Catui_notif-body"><p>${x.who ? catui.html`<b>${x.who}</b>님이 ` : ""}${x.text}${x.unread ? catui.html`<span class="Catui_clip"> (읽지 않음)</span>` : ""}</p><span class="Catui_notif-time">${this.when(x.time)}</span></div></li>`)}</ul>` : catui.html`<p class="Catui_adm-empty">새 알림이 없습니다.</p>`}
      ${this.more ? catui.html`<a class="Catui_notifs-f" href="${this.more}">전체 알림 보기</a>` : ""}`);
  },
  badge() {
    if (!this.btn) return;
    const n = this.count();
    let c = this.btn.querySelector(".Catui_count");
    if (n && !c) { c = document.createElement("span"); c.className = "Catui_count"; c.setAttribute("aria-hidden", "true"); this.btn.appendChild(c); }
    if (c) { c.textContent = String(n); c.hidden = !n; }
    this.btn.setAttribute("aria-label", n ? `알림 (읽지 않음 ${n}건)` : "알림");
    admin.emit("notify", { unread: n });
  },
  add(item) { this.items.unshift({ id: `n${Date.now()}`, unread: true, time: new Date().toISOString(), ...item }); this.badge(); if (!this.pop?.hidden) this.render(); },
  markRead(id) { const x = this.items.find((i) => String(i.id) === String(id)); if (x && x.unread) { x.unread = false; this.badge(); this.render(); } },
  markAll() { this.items.forEach((x) => { x.unread = false; }); this.badge(); this.render(); this.pop?.focus(); },
};

// ── topbar.js ──
// topbar — 명령 팔레트(Ctrl/⌘+K, 화면 이동) · 사용자 메뉴
//   <button data-catui-adm-cmd> + <script type="application/json" id="adm-cmd-data">[{ group, title, href, icon }]</script>
//   <button data-catui-adm-user> + <script type="application/json" id="adm-user-data">[{ title, href, icon } | { type:'-' }]</script>
admin.topbar = {
  init(root) {
    const cmdBtn = root.querySelector("[data-catui-adm-cmd]");
    const pages = admJson("adm-cmd-data") || [];
    if (cmdBtn || pages.length) {
      const extra = [
        { group: "작업", title: "어두운/밝은 화면 전환", icon: "moon", keywords: "theme dark 다크 테마", handler: () => admin.theme.set(admin.theme.get() === "dark" ? "light" : "dark") },
        { group: "작업", title: "사이드바 접기/펼치기", icon: "panel-left", keywords: "sidebar menu 메뉴", handler: () => admin.shell.collapse(!root.hasAttribute("data-catui-adm-collapsed")) },
      ];
      catui.command.render({ id: "adm-cmd", hotkey: "mod+k", placeholder: "화면 이름이나 명령 검색 (초성 가능)", data: [...pages, ...extra] });
      admin._on(cmdBtn, "click", () => catui.command.open("adm-cmd"));
      admin._offs.push(() => catui.command.destroy("adm-cmd"));
    }
    const userBtn = root.querySelector("[data-catui-adm-user]");
    const menu = admJson("adm-user-data");
    if (userBtn && menu) {
      const id = "adm-user";
      catui.dropdown.render({ elem: userBtn, id, align: "right", data: menu.map((m, i) => (m.type ? m : { id: `u${i}`, ...m })) });
      admin._offs.push(() => catui.dropdown.destroy(id));
    }
  },
};

// ── widgets.js ──
// widgets — 대시보드 위젯 (선언형)
//   <b data-catui-adm-count>12,480</b>          보이면 0부터 그 값까지 세어 올라감(형식 유지: 쉼표·소수·접두/접미)
//   <div class="Catui_adm-chart" data-catui-adm-chart="area|line|bar|donut|spark" data-catui-adm-label="설명"
//        data-catui-adm-data='{"labels":["1월",…],"series":[{"name":"방문","data":[…]}]}'>  (donut: {"labels":[…],"data":[…]})
//   <time data-catui-adm-ago="2026-11-02T09:00:00+09:00">            "5분 전" 형식, 1분마다 갱신
//   <input type="checkbox" data-catui-adm-pref="키">                   켬/끔을 기억
//   admin.widgets.chart(elem, { type, labels, series }) · admin.widgets.update(elem, data)
const admSeries = (s, i) => s.token(`--Catui_chart-series-${(i % 5) + 1}`) || s.token("--Catui_color-brand-fill");
// 축 최대값: 4등분 눈금이 깔끔한 수(1·1.2·1.5·2·2.5·3·4·5·6·8·10 × 10ⁿ) 중 v 이상인 가장 작은 값
const admNice = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s >= n) || 10) * p; };
const admShort = (n) => (Math.abs(n) >= 1e8 ? `${+(n / 1e8).toFixed(1)}억` : Math.abs(n) >= 1e4 ? `${+(n / 1e4).toFixed(1)}만` : catui.util.number(n));

function admDrawAxes(ctx, s, labels, max, box) {
  ctx.font = s.font(11);
  ctx.fillStyle = s.token("--Catui_chart-axis") || s.token("--Catui_color-text-secondary");
  ctx.strokeStyle = s.token("--Catui_chart-grid") || s.token("--Catui_color-border");
  ctx.lineWidth = 1;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const y = box.t + (box.h * i) / 4;
    ctx.beginPath(); ctx.moveTo(box.l, Math.round(y) + 0.5); ctx.lineTo(box.l + box.w, Math.round(y) + 0.5); ctx.stroke();
    ctx.fillText(admShort(max - (max * i) / 4), box.l - 6, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(box.w / 56))));
  labels.forEach((t, i) => { if (i % every === 0) ctx.fillText(String(t), box.l + (labels.length === 1 ? box.w / 2 : (box.w * (i + 0.5)) / labels.length), box.t + box.h + 6); });
}

function admDraw(type, d) {
  return function (ctx, s) {
    const W = s.width, H = s.height;
    if (type === "donut") {
      const vals = d.data || [], sum = vals.reduce((a, b) => a + b, 0) || 1;
      const r = Math.min(W, H) / 2 - 4, cx = W / 2, cy = H / 2, th = Math.max(10, r * 0.28);
      let a = -Math.PI / 2;
      ctx.lineWidth = th;
      vals.forEach((v, i) => { const e = a + (Math.PI * 2 * v) / sum; ctx.strokeStyle = admSeries(s, i); ctx.beginPath(); ctx.arc(cx, cy, r - th / 2, a, e); ctx.stroke(); a = e; });
      ctx.fillStyle = s.token("--Catui_color-text-primary"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // 가운데: center를 주면 그 값, 없으면 가장 큰 조각의 비율과 이름
      const top = vals.indexOf(Math.max(...vals));
      const big = d.center ?? `${Math.round((vals[top] / sum) * 100)}%`, small = d.center ? d.caption : d.labels?.[top];
      ctx.font = s.font(Math.round(r * 0.3), 700); ctx.fillText(big, cx, cy - (small ? r * 0.1 : 0));
      if (small) { ctx.font = s.font(11); ctx.fillStyle = s.token("--Catui_color-text-secondary"); ctx.fillText(small, cx, cy + r * 0.22); }
      return;
    }
    const labels = d.labels || [], series = d.series || [];
    const all = series.flatMap((x) => x.data);
    const spark = type === "spark";
    const max = spark ? Math.max(...all, 1) : admNice(Math.max(...all, 1) * 1.05);
    const min = spark ? Math.min(...all, 0) : 0;
    const box = spark ? { l: 2, t: 2, w: W - 4, h: H - 4 } : { l: 44, t: 8, w: W - 52, h: H - 32 };
    if (!spark) admDrawAxes(ctx, s, labels, max, box);
    const n = Math.max(1, labels.length || series[0]?.data.length || 1);
    const X = (i) => box.l + (n === 1 ? box.w / 2 : (box.w * (i + 0.5)) / n);
    const Y = (v) => box.t + box.h - ((v - min) / (max - min || 1)) * box.h;
    if (type === "bar") {
      const slot = box.w / n, bw = Math.max(2, (slot * 0.64) / series.length);
      series.forEach((sr, si) => { ctx.fillStyle = admSeries(s, si); sr.data.forEach((v, i) => { const x = box.l + slot * i + slot * 0.18 + bw * si, y = Y(v); ctx.fillRect(x, y, bw - 1, box.t + box.h - y); }); });
      return;
    }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = parseFloat(s.token("--Catui_chart-line-w")) || 2;
    series.forEach((sr, si) => {
      const col = admSeries(s, si);
      ctx.beginPath();
      sr.data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      ctx.strokeStyle = col; ctx.stroke();
      if (type === "area" || spark) {
        ctx.lineTo(X(sr.data.length - 1), box.t + box.h); ctx.lineTo(X(0), box.t + box.h); ctx.closePath();
        ctx.globalAlpha = si ? 0.08 : 0.16; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
      }
    });
  };
}
// 차트 설명(화면 낭독기): 계열별 최소·최대·마지막 값
const admDescribe = (type, d, label) => {
  if (type === "donut") { const sum = d.data.reduce((a, b) => a + b, 0) || 1; return `${label}: ${d.labels.map((l, i) => `${l} ${Math.round((d.data[i] / sum) * 100)}%`).join(", ")}`; }
  return `${label}: ${(d.series || []).map((sr) => `${sr.name || "값"} ${d.labels?.[0] ?? ""}~${d.labels?.at(-1) ?? ""}, 최저 ${catui.util.number(Math.min(...sr.data))}, 최고 ${catui.util.number(Math.max(...sr.data))}, 마지막 ${catui.util.number(sr.data.at(-1))}`).join(" / ")}`;
};

admin.widgets = {
  charts: new Map(),
  chart(elem, opt) {
    const el = catui.el(elem);
    if (!el) return null;
    const type = opt.type || "line", label = opt.label || el.getAttribute("data-catui-adm-label") || "차트";
    this.charts.get(el)?.destroy();
    const inst = catui.canvas.render({ elem: el, ratio: "", label: admDescribe(type, opt, label), draw: admDraw(type, opt) });
    inst.admType = type; inst.admLabel = label;
    this.charts.set(el, inst);
    return inst;
  },
  update(elem, data) {
    const el = catui.el(elem), inst = this.charts.get(el);
    if (!inst) return;
    inst.config.draw = admDraw(inst.admType, data);
    inst.redraw();
    el.querySelector("canvas")?.setAttribute("aria-label", admDescribe(inst.admType, data, inst.admLabel));
  },
  count(el) {
    const text = el.textContent.trim();
    const m = /-?[\d,]*\.?\d+/.exec(text);
    if (!m || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = parseFloat(m[0].replace(/,/g, "")), dec = (m[0].split(".")[1] || "").length, comma = m[0].includes(",");
    const pre = text.slice(0, m.index), post = text.slice(m.index + m[0].length);
    const fmt = (v) => `${pre}${comma ? catui.util.number(v, dec) : v.toFixed(dec)}${post}`;
    el.setAttribute("aria-label", text);   // 세는 동안 바뀌는 숫자를 읽지 않게
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - (1 - p) ** 3; el.textContent = fmt(target * e); if (p < 1) requestAnimationFrame(step); else { el.textContent = text; el.removeAttribute("aria-label"); } };
    el.textContent = fmt(0);
    requestAnimationFrame(step);
  },
  init(root = document) {
    root.querySelectorAll("[data-catui-adm-chart]:not([data-catui-adm-ready])").forEach((el) => {
      el.setAttribute("data-catui-adm-ready", "");
      let d = {};
      try { d = JSON.parse(el.getAttribute("data-catui-adm-data") || "{}"); } catch (err) { catui.hint.error("CatuiAdmin: 차트 data JSON 오류", "error", err, el); return; }
      this.chart(el, { type: el.getAttribute("data-catui-adm-chart"), ...d });
    });
    const counts = [...root.querySelectorAll("[data-catui-adm-count]:not([data-catui-adm-ready])")];
    counts.forEach((el) => el.setAttribute("data-catui-adm-ready", ""));
    if (counts.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((ents) => ents.forEach((x) => { if (x.isIntersecting) { io.unobserve(x.target); this.count(x.target); } }), { threshold: 0.4 });
      counts.forEach((el) => io.observe(el));
      admin._offs.push(() => io.disconnect());
    }
    const ago = () => root.querySelectorAll("[data-catui-adm-ago]").forEach((el) => { const d = new Date(el.getAttribute("data-catui-adm-ago")); if (!Number.isNaN(d.getTime())) { el.textContent = catui.util.timeAgo(d); if (!el.getAttribute("datetime")) el.setAttribute("datetime", d.toISOString()); } });
    ago();
    const timer = setInterval(ago, 60000);
    admin._offs.push(() => clearInterval(timer));
    const prefs = admGet("prefs", {});
    root.querySelectorAll("input[data-catui-adm-pref]").forEach((el) => { const k = el.getAttribute("data-catui-adm-pref"); if (k in prefs) el.checked = !!prefs[k]; });
    admin._on(root, "change", (e) => {
      const el = e.target.closest?.("input[data-catui-adm-pref]");
      if (!el) return;
      admSet("prefs", { ...admGet("prefs", {}), [el.getAttribute("data-catui-adm-pref")]: el.checked });
      catui.layer.msg(`${el.closest(".Catui_setting")?.querySelector(".Catui_setting-title")?.textContent.trim() || "설정"} ${el.checked ? "켬" : "끔"}`, { time: 1200 });
    });
  },
  destroy() { this.charts.forEach((c) => c.destroy()); this.charts.clear(); },
};

// ── formpage.js ──
// formpage — 편집 화면: 변경 감지 · 고정 저장 바 · 떠날 때 경고 · 저장 중 잠금
//   <form data-catui-adm-form data-catui-form …> … <div class="Catui_adm-savebar" data-catui-adm-savebar>…</div></form>
//   저장(submit) 성공 = form 모듈 'done' 이벤트 또는 admin.form.saved(form) 호출 → 변경 없음으로 되돌림
//   이벤트: admin.on('dirty', { form, dirty })
admin.form = {
  forms: new Map(),
  snapshot(f) { return new URLSearchParams(new FormData(f)).toString(); },
  isDirty(f) { const s = this.forms.get(f); return !!s && this.snapshot(f) !== s.base; },
  saved(f) { const s = this.forms.get(f); if (!s) return; s.base = this.snapshot(f); this.sync(f); },
  sync(f) {
    const s = this.forms.get(f), dirty = this.isDirty(f);
    if (s.dirty === dirty) return;
    s.dirty = dirty;
    f.toggleAttribute("data-catui-adm-dirty", dirty);
    const bar = f.querySelector("[data-catui-adm-savebar]");
    const note = bar?.querySelector("[data-catui-adm-savenote]");
    if (note) note.textContent = dirty ? "저장하지 않은 변경 사항이 있습니다" : "모든 변경 사항이 저장되었습니다";
    admin.emit("dirty", { form: f, dirty });
  },
  init(root = document) {
    root.querySelectorAll("form[data-catui-adm-form]").forEach((f) => {
      if (this.forms.has(f)) return;
      this.forms.set(f, { base: this.snapshot(f), dirty: false });
      const check = () => this.sync(f);
      admin._on(f, "input", check);
      admin._on(f, "change", check);
      admin._on(f, "reset", () => setTimeout(() => this.saved(f), 0));
    });
    if (!this.forms.size) return;
    const anyDirty = () => [...this.forms.keys()].some((f) => f.isConnected && this.isDirty(f));
    // 새로 고침·창 닫기: 브라우저 기본 확인 창
    admin._on(window, "beforeunload", (e) => { if (anyDirty()) { e.preventDefault(); e.returnValue = ""; } });
    // 화면 안 링크: Catui 확인 창
    admin._on(document, "click", (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || e.defaultPrevented || a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || a.getAttribute("href").startsWith("#") || !anyDirty()) return;
      e.preventDefault();
      catui.layer.confirm("저장하지 않은 변경 사항이 있습니다. 저장하지 않고 이동할까요?", { title: "페이지 나가기", okText: "나가기", cancelText: "머무르기", danger: true }, (i) => {
        catui.layer.close(i);
        this.forms.forEach((s, f) => { s.base = this.snapshot(f); });
        location.assign(a.href);
      });
    }, true);
    // form 모듈 Ajax 저장 성공 → 기준점 갱신
    admin._offs.push(catui.form.on("done", (d) => { if (this.forms.has(d?.form)) { this.saved(d.form); catui.layer.msg("저장했습니다", { icon: "success" }); } }));
  },
  destroy() { this.forms.clear(); },
};

// ── listpage.js ──
// listpage — 목록 화면: 필터 폼 ↔ 주소(?q=…) 동기화 · 로컬 거르기 · 일괄 작업 바
//   admin.list({ table: 'orders', form: '#orders-filter', data: rows, match(row, v) { return … }, bulkbar: '#orders-bulk' })
//   · 새로 고침·뒤로 가기·주소 공유 시 같은 조건으로 다시 걸러진다 (history.replaceState / popstate)
//   · 표 선택 수에 맞춰 일괄 작업 바(.Catui_bulkbar)를 보이고 "N건 선택됨"을 알린다
//   반환: { apply(), values(), reset(), rows() }
admin.list = function (opt) {
  const f = catui.el(opt.form), id = opt.table;
  const bar = opt.bulkbar ? catui.el(opt.bulkbar) : null;
  const keys = () => [...new Set([...(f?.elements || [])].map((x) => x.name).filter(Boolean))];
  const values = () => (f ? catui.form.val(f.getAttribute("data-catui-filter") || f.id) : {});
  const fromUrl = () => {
    if (!f) return;
    const q = new URLSearchParams(location.search);
    keys().forEach((k) => {
      const els = [...f.elements].filter((x) => x.name === k);
      const v = q.getAll(k);
      // 주소에 값이 없으면 처음 마크업의 기본값으로 (select는 defaultSelected 옵션)
      const initial = (x) => (x.tagName === "SELECT" ? ([...x.options].find((o) => o.defaultSelected) || x.options[0])?.value ?? "" : x.defaultValue);
      els.forEach((x) => { if (x.type === "checkbox" || x.type === "radio") x.checked = v.length ? v.includes(x.value) : x.defaultChecked; else x.value = v[0] ?? initial(x); });
    });
  };
  const toUrl = (v) => {
    const q = new URLSearchParams(location.search);
    keys().forEach((k) => q.delete(k));
    Object.entries(v).forEach(([k, val]) => [].concat(val).filter((x) => x !== "" && x != null).forEach((x) => q.append(k, x)));
    const s = q.toString();
    history.replaceState(null, "", `${location.pathname}${s ? `?${s}` : ""}${location.hash}`);
  };
  let shown = opt.data || [];
  const apply = (push = true) => {
    const v = values();
    shown = (opt.data || []).filter((r) => (opt.match ? opt.match(r, v) : true));
    catui.table.reload(id, { data: shown });
    if (push) toUrl(v);
    syncBar();
    opt.change?.(shown, v);
    return shown;
  };
  const syncBar = () => {
    if (!bar) return;
    const n = catui.table.checkStatus(id)?.data?.length || 0;
    bar.hidden = !n;
    const c = bar.querySelector("[data-catui-adm-count-sel]");
    if (c) c.textContent = `${n}건 선택됨`;
  };
  if (f) {
    admin._on(f, "submit", (e) => { e.preventDefault(); apply(); });
    admin._on(f, "reset", () => setTimeout(() => apply(), 0));
    // 고르는 칸(select·checkbox·radio)은 바로 반영
    admin._on(f, "change", (e) => { if (e.target.matches("select, input[type=checkbox], input[type=radio]")) apply(); });
  }
  admin._on(window, "popstate", () => { fromUrl(); apply(false); });
  admin._offs.push(catui.table.on(`checkbox(${id})`, () => setTimeout(syncBar, 0)));
  if (bar) {
    admin._on(bar, "click", (e) => { if (e.target.closest("[data-catui-adm-clear-sel]")) { catui.table.clearChecked(id); syncBar(); } });
  }
  fromUrl();
  apply(false);
  return { apply, values, rows: () => shown, reset: () => f?.reset() };
};

// ── apps.js ──
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
  admin._on(input, "keydown", (e) => { if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) e.preventDefault(); });
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

// ── auth.js ──
// auth — 로그인·가입 보조 (선언형)
//   <div class="Catui_adm-pw"><input type="password" …><button data-catui-adm-pwtoggle>…</button></div>   비밀번호 보기/숨기기
//   <p class="Catui_adm-caps" data-catui-adm-caps="#pw" hidden>                                         Caps Lock 켜짐 알림
//   <div class="Catui_adm-strength" data-catui-adm-strength="#pw"><i></i><i></i><i></i><i></i><span></span></div>  강도
admin.auth = {
  // 0~4: 길이 8·12, 대소문자, 숫자, 특수문자
  score(v) {
    if (!v) return 0;
    let s = 0;
    if (v.length >= 8) s++;
    if (v.length >= 12) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
    return Math.max(1, Math.min(4, s));
  },
  init(root = document) {
    root.querySelectorAll("[data-catui-adm-pwtoggle]").forEach((b) => {
      const input = b.closest(".Catui_adm-pw")?.querySelector("input");
      if (!input) return;
      const sync = () => { const shown = input.type === "text"; b.setAttribute("aria-pressed", String(shown)); b.setAttribute("aria-label", shown ? "비밀번호 숨기기" : "비밀번호 보기"); catui.mount(b, catui.icon(shown ? "eye-off" : "eye", 16)); };
      admin._on(b, "click", () => { input.type = input.type === "password" ? "text" : "password"; sync(); input.focus(); });
      sync();
    });
    root.querySelectorAll("[data-catui-adm-caps]").forEach((note) => {
      const input = catui.el(note.getAttribute("data-catui-adm-caps"));
      if (!input) return;
      const check = (e) => { if (typeof e.getModifierState === "function") note.hidden = !e.getModifierState("CapsLock"); };
      admin._on(input, "keydown", check);
      admin._on(input, "keyup", check);
      admin._on(input, "blur", () => { note.hidden = true; });
    });
    const NAMES = ["", "약함", "보통", "좋음", "강함"];
    root.querySelectorAll("[data-catui-adm-strength]").forEach((meter) => {
      const input = catui.el(meter.getAttribute("data-catui-adm-strength"));
      if (!input) return;
      const out = meter.querySelector("span");
      meter.setAttribute("role", "img");
      const sync = () => { const n = this.score(input.value); meter.dataset.level = String(n); if (out) out.textContent = NAMES[n] || ""; meter.setAttribute("aria-label", n ? `비밀번호 강도: ${NAMES[n]}` : "비밀번호 강도: 입력 전"); };
      admin._on(input, "input", sync);
      sync();
    });
  },
};

// ── init.js ──
// 초기화 — 테마는 어느 화면(로그인 등 셸 없는 화면 포함)에서나, 셸 기능은 [data-catui-adm] 루트가 있을 때만
admin.init = function (scope = document) {
  this.theme.init();
  const root = scope.matches?.("[data-catui-adm]") ? scope : scope.querySelector?.("[data-catui-adm]");
  if (root && !root.hasAttribute("data-catui-adm-ready")) {
    root.setAttribute("data-catui-adm-ready", "");
    this.root = root;
    for (const part of ["shell", "notify", "topbar"]) {
      try { this[part].init(root); } catch (err) { catui.hint.error(`CatuiAdmin: ${part} 연결 실패`, "error", err); }
    }
  }
  // JSON 모의 데이터([data-catui-adm-src])를 먼저 채운 뒤 위젯(차트·카운트업)을 연결한다
  const scope2 = root || document;
  this.ready = this.bind(scope2).then(() => {
    for (const part of ["widgets", "form", "auth"]) {
      try { this[part].init(scope2); } catch (err) { catui.hint.error(`CatuiAdmin: ${part} 연결 실패`, "error", err); }
    }
    return this;
  });
  return this;
};
// 모든 리스너·차트·팝업 정리 (SPA에서 화면을 바꿀 때)
admin.destroy = function () {
  this._offs.splice(0).forEach((off) => { try { off(); } catch {} });
  this.widgets.destroy();
  this.form.destroy();
  this.root?.removeAttribute("data-catui-adm-ready");
  document.querySelectorAll("[data-catui-adm-ready]").forEach((n) => n.removeAttribute("data-catui-adm-ready"));
  this.root = null;
};

catui.extend({ admin });
catui.use(() => { if (catui.config().autoInit !== false) admin.init(); });

export { admin };
export default admin;
