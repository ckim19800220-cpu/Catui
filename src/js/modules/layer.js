import { html, raw, isRaw } from "../core/html.js";
import { layerRoot, icon, mount, FOCUSABLE } from "../core/dom.js";

// layer — 팝업 레이어. 모든 함수는 레이어 index(숫자)를 돌려주고 layer.close(index)로 닫는다.
//   layer.msg('저장했습니다', { icon: 'success', position: 'tr', action: { text: '되돌리기', onClick } })
//   layer.confirm('삭제할까요?', { danger: true }, (index) => { ...; layer.close(index); })
//   layer.open({ title, content, area: 'md'|'xl'|'full'|['600px','400px'], btn: ['저장', '취소'], maxmin, move, resize, time, yes(index, el) {} })
//   layer.open({ type: 'drawer', offset: 'l'|'r'|'b' }) · layer.open({ type: 'iframe', content: '/page.html' })
//   layer.tips('설명', '#btn', { side: 'top' }) · layer.photos({ items: [{ src, alt, caption }], start }) · layer.tab({ tabs: [{ title, content }] })
//   await layer.ask('삭제할까요?') → true/false · await layer.input({ title }) → 값 | null
//   layer.setContent(i, c) · layer.style(i, { width, height }) · layer.full(i) · layer.restore(i) · layer.progress(i, 0~100)
export const layer = (() => {
  let seq = 0;
  const opened = new Map(); // index → { type, node, close(reason) }
  const ICON = { success: "check", info: "info", warn: "alert-triangle", danger: "alert-circle" };
  const TOAST_KIND = { success: "", info: " Catui_toast-info", warn: " Catui_toast-warn", danger: " Catui_toast-danger" };
  const POS = { br: "", tr: " Catui_toasts-tr", tc: " Catui_toasts-tc", bc: " Catui_toasts-bc" };
  const AREA = ["sm", "md", "lg", "xl", "full"];

  // content: 일반 문자열은 글자로, html``·raw()는 마크업으로, Element는 그대로 옮긴다
  const fill = (node, content) => {
    if (content instanceof Element) node.appendChild(content);
    else if (isRaw(content)) mount(node, content);
    else {
      const p = document.createElement("p");
      p.textContent = String(content ?? "");
      node.appendChild(p);
    }
  };
  // iframe 주소는 같은 사이트 상대 경로 또는 http·https만 허용 (javascript:·data: 차단)
  const safeUrl = (u) => {
    try { const url = new URL(String(u), location.href); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
  };

  function toastBox(pos = "br") {
    const root = layerRoot();
    const key = POS[pos] != null ? pos : "br";
    let box = root.querySelector(`:scope > .Catui_toasts[data-pos="${key}"]`);
    if (!box) {
      box = document.createElement("div");
      box.className = `Catui_toasts${POS[key]}`;
      box.dataset.pos = key;
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      root.appendChild(box);
    }
    return box;
  }

  // 토스트 메시지. options: { icon, body, time(ms, 0=수동), max, position:'br'|'tr'|'tc'|'bc', action:{ text, onClick }, progress } / end 콜백
  function msg(content, options = {}, end) {
    if (typeof options === "function") { end = options; options = {}; }
    const kind = ICON[options.icon] ? options.icon : "info";
    const index = ++seq;
    const box = toastBox(options.position);
    const node = document.createElement("div");
    node.className = `Catui_toast${TOAST_KIND[kind]}`;
    const time = options.time ?? (options.action ? 5000 : 3000);
    mount(node, html`${icon(ICON[kind], 18)}<div><p class="Catui_toast-title">${content}</p>${options.body ? html`<p class="Catui_toast-body">${options.body}</p>` : ""}</div>${options.action ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost Catui_toast-action" type="button">${options.action.text}</button>` : ""}${options.progress && time > 0 ? html`<span class="Catui_toast-bar" aria-hidden="true" style="--Catui_toast-time:${time}ms"></span>` : ""}`);
    box.appendChild(node);
    const max = options.max ?? 3;
    while (box.children.length > max) {
      const oldest = [...opened.entries()].find(([, v]) => v.type === "msg" && v.node.parentNode === box);
      if (!oldest) { box.firstElementChild.remove(); break; }
      close(oldest[0]);
    }
    let timer = 0;
    const done = () => { clearTimeout(timer); node.remove(); opened.delete(index); end?.(); };
    opened.set(index, { type: "msg", node, close: done });
    node.querySelector(".Catui_toast-action")?.addEventListener("click", () => { options.action.onClick?.(index); done(); });
    if (time > 0) {
      timer = setTimeout(done, time);
      // 마우스를 올리거나 키보드 포커스가 들어오면 멈춤 (읽을 시간 확보)
      const pause = () => clearTimeout(timer), resume = () => { timer = setTimeout(done, 1500); };
      node.addEventListener("mouseenter", pause); node.addEventListener("mouseleave", resume);
      node.addEventListener("focusin", pause); node.addEventListener("focusout", resume);
    }
    return index;
  }

  // 범용 레이어. type: 'dialog'(기본) | 'drawer' | 'iframe'
  function open(options = {}) {
    const o = { type: "dialog", title: "", area: "md", btn: [], closeBtn: true, shadeClose: true, offset: "r", ...options };
    const index = ++seq;
    const titleId = `catui-layer-${index}-t`;
    const dlg = document.createElement("dialog");
    const isDrawer = o.type === "drawer", isFrame = o.type === "iframe";
    const size = Array.isArray(o.area) ? "md" : AREA.includes(o.area) ? o.area : "md";
    dlg.className = isDrawer
      ? `Catui_drawer${o.offset === "l" ? " Catui_drawer-left" : o.offset === "b" ? " Catui_drawer-bottom" : ""}`
      : `Catui_modal Catui_modal-${size}${o.move ? " Catui_layer-move" : ""}${o.resize ? " Catui_layer-resize" : ""}`;
    if (o.skin) dlg.classList.add(...String(o.skin).split(/\s+/).filter(Boolean));
    if (Array.isArray(o.area) && !isDrawer) { dlg.style.width = `min(${o.area[0]}, calc(100% - 32px))`; if (o.area[1]) dlg.style.height = o.area[1]; }
    if (o.title) dlg.setAttribute("aria-labelledby", titleId); else dlg.setAttribute("aria-label", o.label || "대화상자");
    if (o.id) dlg.id = o.id;
    const H = isDrawer ? "Catui_drawer-h" : "Catui_modal-h", B = isDrawer ? "Catui_drawer-b" : "Catui_modal-b";
    const tools = o.maxmin && !isDrawer;
    mount(dlg, html`
${o.title || o.closeBtn || tools ? html`<header class="${H}"><span id="${titleId}">${o.title}</span><span class="Catui_layer-tools">${tools ? html`<button class="Catui_close" type="button" data-catui-layer="max" aria-pressed="false" aria-label="최대화">${icon("maximize-2", 16)}</button>` : ""}${o.closeBtn ? html`<button class="Catui_close" type="button" data-catui-layer="close" aria-label="닫기">${icon("x", 16)}</button>` : ""}</span></header>` : ""}
<div class="${B}" data-catui-layer="body"></div>
${o.btn.length ? html`<footer class="Catui_modal-f">${[...o.btn].reverse().map((label, ri) => {
  const i = o.btn.length - 1 - ri;
  const kind = i === 0 ? (o.danger ? "Catui_btn-danger" : "Catui_btn-primary") : "Catui_btn-secondary";
  return html`<button class="Catui_btn Catui_btn-md ${kind}" type="button" data-catui-btn="${i}">${label}</button>`;
})}</footer>` : ""}`);
    const body = dlg.querySelector('[data-catui-layer="body"]');
    if (isFrame) {
      const src = safeUrl(o.content);
      body.style.padding = "0";
      if (src) { const f = document.createElement("iframe"); f.className = "Catui_layer-frame"; f.src = src; f.title = o.title || o.label || "삽입된 페이지"; f.loading = "lazy"; body.appendChild(f); }
      else fill(body, "열 수 없는 주소입니다.");
    } else fill(body, o.content);
    layerRoot().appendChild(dlg);

    let closed = false, timer = 0;
    const offs = [];
    const close = (reason) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      offs.forEach((f) => f());
      if (dlg.open) dlg.close(reason);
      dlg.remove();                         // 열기 전 포커스 요소로의 복귀는 dialog가 처리
      opened.delete(index);
      o.end?.(index, reason);
    };
    opened.set(index, { type: isDrawer ? "drawer" : o.loading ? "load" : isFrame ? "iframe" : o.kind || "dialog", node: dlg, close });

    const tryCancel = () => { if (o.cancel?.(index, dlg) !== false) close("cancel"); };
    const maxBtn = dlg.querySelector('[data-catui-layer="max"]');
    const setMax = (on) => {
      dlg.classList.toggle("Catui_layer-max", on);
      if (on) { dlg.dataset.catuiPos = dlg.style.cssText; dlg.style.left = dlg.style.top = ""; dlg.style.transform = ""; }
      else if (dlg.dataset.catuiPos != null) { dlg.style.cssText = dlg.dataset.catuiPos; delete dlg.dataset.catuiPos; }
      if (maxBtn) { maxBtn.setAttribute("aria-pressed", String(on)); maxBtn.setAttribute("aria-label", on ? "원래 크기" : "최대화"); }
      o.full?.(index, on);
    };
    opened.get(index).setMax = setMax;
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) { if (o.shadeClose) tryCancel(); return; }  // 스크림(바깥) 클릭
      const b = e.target.closest("[data-catui-btn], [data-catui-layer=close], [data-catui-layer=max]");
      if (!b) return;
      if (b.dataset.catuiLayer === "close") { tryCancel(); return; }
      if (b.dataset.catuiLayer === "max") { setMax(!dlg.classList.contains("Catui_layer-max")); return; }
      const i = Number(b.dataset.catuiBtn);
      const cb = i === 0 ? o.yes : o[`btn${i + 1}`] ?? (i === 1 ? o.cancel : null);
      // 콜백이 false를 돌려주면 열린 채 유지(검증 실패 등). 첫 버튼에 콜백이 없으면 닫는다.
      const keep = cb ? cb(index, dlg) === false : false;
      if (!keep && !(i === 0 && o.yes)) close(i === 0 ? "yes" : "cancel");
    });
    // Esc: dialog 기본 동작(cancel 이벤트)을 가로채 cancel 콜백 존중
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (o.loading) return;               // 로딩 레이어는 Esc로 닫지 않음
      tryCancel();
    });
    // 머리를 끌어 옮기기 (최대화 중에는 안 함). 화면 밖으로 나가지 않게 제한
    if (o.move && !isDrawer) {
      const head = dlg.querySelector(".Catui_modal-h");
      let sx = 0, sy = 0, bx = 0, by = 0, drag = false;
      const down = (e) => {
        if (e.button || e.target.closest("button") || dlg.classList.contains("Catui_layer-max")) return;
        const r = dlg.getBoundingClientRect();
        drag = true; sx = e.clientX; sy = e.clientY; bx = r.left; by = r.top;
        dlg.style.transform = "none"; dlg.style.left = `${bx}px`; dlg.style.top = `${by}px`;
        head.setPointerCapture?.(e.pointerId);
      };
      const move = (e) => {
        if (!drag) return;
        const r = dlg.getBoundingClientRect();
        dlg.style.left = `${Math.min(innerWidth - 40, Math.max(40 - r.width, bx + e.clientX - sx))}px`;
        dlg.style.top = `${Math.min(innerHeight - 40, Math.max(0, by + e.clientY - sy))}px`;
      };
      const up = () => { drag = false; };
      head?.addEventListener("pointerdown", down); head?.addEventListener("pointermove", move);
      head?.addEventListener("pointerup", up); head?.addEventListener("pointercancel", up);
      offs.push(() => { head?.removeEventListener("pointerdown", down); head?.removeEventListener("pointermove", move); head?.removeEventListener("pointerup", up); head?.removeEventListener("pointercancel", up); });
    }

    dlg.showModal();
    if (size === "full") setMax(false);
    // 첫 포커스: Tab으로 갈 수 있는 요소만 (탭 목록의 비선택 탭처럼 tabindex="-1"인 것은 제외)
    const reach = `:is(${FOCUSABLE}):not([tabindex="-1"])`;
    const first = dlg.querySelector(`[data-catui-layer="body"] ${reach}`) || dlg.querySelector('[data-catui-btn="0"]') || dlg.querySelector(reach);
    first?.focus();
    if (o.time > 0) timer = setTimeout(() => close("time"), o.time);
    o.success?.(dlg, index);
    return index;
  }

  function alert(content, options = {}, yes) {
    if (typeof options === "function") { yes = options; options = {}; }
    return open({ title: "알림", area: "sm", btn: ["확인"], ...options, content, yes: yes ? (i, d) => yes(i, d) : undefined });
  }

  function confirm(content, options = {}, yes, cancel) {
    if (typeof options === "function") { cancel = yes; yes = options; options = {}; }
    return open({ title: "확인", area: "sm", btn: [options.okText || "확인", options.cancelText || "취소"], ...options, content, yes, cancel });
  }

  // 입력 받기. options: { title, formType: 'text'|'password'|'textarea', value, maxlength, placeholder, required }
  function prompt(options = {}, yes) {
    if (typeof options === "function") { yes = options; options = {}; }
    const fid = `catui-prompt-${seq + 1}`;
    const field = options.formType === "textarea"
      ? html`<textarea class="Catui_input" id="${fid}" rows="4" maxlength="${options.maxlength || 500}" placeholder="${options.placeholder || ""}">${options.value || ""}</textarea>`
      : html`<input class="Catui_input" id="${fid}" type="${options.formType === "password" ? "password" : "text"}" maxlength="${options.maxlength || 200}" value="${options.value || ""}" placeholder="${options.placeholder || ""}" autocomplete="off">`;
    return open({
      title: options.title || "입력",
      area: "sm",
      btn: ["확인", "취소"],
      ...options,
      content: html`<div class="Catui_field"><label class="Catui_label" for="${fid}">${options.label || options.title || "값"}</label>${field}<p class="Catui_error" id="${fid}-err" hidden>값을 입력해 주세요.</p></div>`,
      success(dlg, index) {
        dlg.querySelector(`#${fid}`).addEventListener("keydown", (e) => {
          if (e.key === "Enter" && options.formType !== "textarea") { e.preventDefault(); dlg.querySelector('[data-catui-btn="0"]').click(); }
        });
        options.success?.(dlg, index);
      },
      yes(index, dlg) {
        const input = dlg.querySelector(`#${fid}`), value = input.value;
        const bad = options.required !== false && !value.trim();
        input.setAttribute("aria-invalid", String(bad));
        input.setAttribute("aria-describedby", bad ? `${fid}-err` : "");
        dlg.querySelector(`#${fid}-err`).hidden = !bad;
        if (bad) { input.focus(); return false; }
        if (yes) return yes(value, index, dlg);
        close(index);
      },
    });
  }

  // 로딩. options.progress: true면 진행률 막대(layer.progress(index, 0~100)로 갱신)
  function load(text = "불러오는 중…", options = {}) {
    if (typeof text === "object") { options = text; text = options.text || "불러오는 중…"; }
    const bar = options.progress ? `<div class="Catui_prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${""}"><i class="Catui_pc1" style="width:0%"></i></div>` : "";
    return open({ area: "sm", closeBtn: false, shadeClose: false, loading: true, label: text, ...options,
      content: raw(`<div class="Catui_layer-load" role="status"><span class="Catui_spin" aria-hidden="true"></span><span></span></div>${bar ? `<div style="padding:0 var(--Catui_modal-pad) var(--Catui_modal-pad)">${bar}</div>` : ""}`),
      success(dlg, index) {
        dlg.querySelector(".Catui_layer-load span:last-child").textContent = text;
        dlg.querySelector(".Catui_modal-b").style.padding = "0";
        dlg.querySelector('[role="progressbar"]')?.setAttribute("aria-label", text);
        options.success?.(dlg, index);
      },
    });
  }
  function progress(index, pct) {
    const n = opened.get(index)?.node, p = n?.querySelector('[role="progressbar"]');
    if (!p) return;
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    p.setAttribute("aria-valuenow", String(v));
    p.querySelector("i").style.width = `${v}%`;
    const label = n.querySelector(".Catui_layer-load span:last-child");
    if (label) label.textContent = `${n.getAttribute("aria-label")} ${v}%`;
  }

  // 말풍선: 대상 옆에 잠깐 띄움. options: { side:'top'|'bottom'|'left'|'right', time(ms, 0=수동) }
  function tips(content, target, options = {}) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return 0;
    const index = ++seq;
    const tip = document.createElement("div");
    tip.className = "Catui_layer-tip";
    tip.id = `catui-tip-${index}`;
    tip.setAttribute("role", "tooltip");
    fill(tip, content);
    layerRoot().appendChild(tip);
    const place = () => {
      const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), g = 8;
      let side = options.side || "top";
      const fits = { top: r.top - t.height - g > 0, bottom: r.bottom + t.height + g < innerHeight, left: r.left - t.width - g > 0, right: r.right + t.width + g < innerWidth };
      if (!fits[side]) side = { top: "bottom", bottom: "top", left: "right", right: "left" }[side];
      const pos = {
        top: [r.left + r.width / 2 - t.width / 2, r.top - t.height - g], bottom: [r.left + r.width / 2 - t.width / 2, r.bottom + g],
        left: [r.left - t.width - g, r.top + r.height / 2 - t.height / 2], right: [r.right + g, r.top + r.height / 2 - t.height / 2],
      }[side];
      tip.dataset.side = side;
      tip.style.left = `${Math.round(Math.min(innerWidth - t.width - 8, Math.max(8, pos[0])))}px`;
      tip.style.top = `${Math.round(Math.max(8, pos[1]))}px`;
    };
    place();
    const prev = el.getAttribute("aria-describedby");
    el.setAttribute("aria-describedby", [prev, tip.id].filter(Boolean).join(" "));
    let timer = 0;
    const key = (e) => { if (e.key === "Escape") done(); };
    const outside = (e) => { if (!tip.contains(e.target) && !el.contains(e.target)) done(); };
    const done = () => {
      clearTimeout(timer); tip.remove(); opened.delete(index);
      if (prev) el.setAttribute("aria-describedby", prev); else el.removeAttribute("aria-describedby");
      document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside, true);
      removeEventListener("resize", place); removeEventListener("scroll", place, true);
      options.end?.(index);
    };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside, true);
    addEventListener("resize", place); addEventListener("scroll", place, true);
    const time = options.time ?? 3000;
    if (time > 0) timer = setTimeout(done, time);
    opened.set(index, { type: "tips", node: tip, close: done });
    return index;
  }

  // 사진 보기: items [{ src, alt, caption }], start. ←→ 키·버튼으로 이동
  function photos(options = {}) {
    const items = (options.items || []).filter((p) => safeUrl(p.src) || /^data:image\//.test(p.src || ""));
    if (!items.length) return 0;
    let k = Math.max(0, Math.min(items.length - 1, options.start || 0));
    const fig = document.createElement("figure");
    fig.className = "Catui_layer-photo";
    mount(fig, html`<img alt=""><figcaption><span></span><span aria-live="polite"></span></figcaption><button class="Catui_layer-nav" type="button" data-dir="prev" aria-label="이전 사진">${icon("chevron-right", 20)}</button><button class="Catui_layer-nav" type="button" data-dir="next" aria-label="다음 사진">${icon("chevron-right", 20)}</button>`);
    const img = fig.querySelector("img"), [cap, num] = fig.querySelectorAll("figcaption span");
    const prevB = fig.querySelector('[data-dir="prev"]'), nextB = fig.querySelector('[data-dir="next"]');
    const show = () => {
      const p = items[k];
      img.src = p.src; img.alt = p.alt || p.caption || `사진 ${k + 1}`;
      cap.textContent = p.caption || p.alt || ""; num.textContent = `${k + 1} / ${items.length}`;
      prevB.disabled = k === 0; nextB.disabled = k === items.length - 1;
      if (items.length < 2) prevB.hidden = nextB.hidden = true;
      options.change?.(k);
    };
    const go = (d) => { const n = k + d; if (n >= 0 && n < items.length) { k = n; show(); } };
    fig.addEventListener("click", (e) => { const b = e.target.closest(".Catui_layer-nav"); if (b) go(b.dataset.dir === "next" ? 1 : -1); });
    show();
    return open({
      title: options.title || "사진", area: "full", skin: "Catui_layer-photos", ...options, content: fig, kind: "photos",
      success(dlg, index) {
        dlg.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          else if (e.key === "Home") { k = 0; show(); } else if (e.key === "End") { k = items.length - 1; show(); }
        });
        (items.length > 1 ? nextB : dlg.querySelector('[data-catui-layer="close"]'))?.focus();
        options.success?.(dlg, index);
      },
    });
  }

  // 탭 대화상자: tabs [{ title, content }]. ←→·Home·End로 탭 이동
  function tab(options = {}) {
    const tabs = options.tabs || [];
    const id = `catui-ltab-${seq + 1}`;
    const wrap = document.createElement("div");
    const list = document.createElement("div");
    const vertical = !!options.vertical;
    list.className = vertical ? "Catui_layer-tabs Catui_layer-tabs-v" : "Catui_layer-tabs";
    list.setAttribute("role", "tablist"); list.setAttribute("aria-label", options.title || "탭");
    if (vertical) { list.setAttribute("aria-orientation", "vertical"); wrap.className = "Catui_layer-vtabs"; }
    wrap.appendChild(list);
    const stage = vertical ? document.createElement("div") : wrap;
    if (vertical) { stage.className = "Catui_layer-vtabs-panels"; wrap.appendChild(stage); }
    const panels = tabs.map((t, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = `${id}-t${i}`; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", `${id}-p${i}`);
      b.textContent = t.title; list.appendChild(b);
      const p = document.createElement("div");
      p.id = `${id}-p${i}`; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", b.id); p.tabIndex = 0;
      fill(p, t.content); stage.appendChild(p);
      return p;
    });
    const sel = (i, focus) => {
      [...list.children].forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; });
      if (focus) list.children[i].focus();
      options.change?.(i);
    };
    list.addEventListener("click", (e) => { const b = e.target.closest('[role="tab"]'); if (b) sel([...list.children].indexOf(b)); });
    list.addEventListener("keydown", (e) => {
      const n = list.children.length, i = [...list.children].indexOf(document.activeElement);
      const next = vertical ? "ArrowDown" : "ArrowRight", prev = vertical ? "ArrowUp" : "ArrowLeft";
      const to = { [next]: (i + 1) % n, [prev]: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to != null) { e.preventDefault(); sel(to, true); }
    });
    sel(options.start || 0);
    return open({ area: "lg", ...options, content: wrap, kind: "tab" });
  }

  // Promise로 받기
  const ask = (content, options = {}) => new Promise((resolve) => {
    let answered = false;
    confirm(content, { ...options, end: () => { if (!answered) resolve(false); options.end?.(); } },
      (index) => { answered = true; resolve(true); close(index); },
      () => { answered = true; resolve(false); });
  });
  const input = (options = {}) => new Promise((resolve) => {
    let answered = false;
    prompt({ ...options, end: () => { if (!answered) resolve(null); options.end?.(); } }, (value, index) => { answered = true; resolve(value); close(index); });
  });

  function close(index) { opened.get(index)?.close("close"); }
  function closeAll(type) { [...opened.entries()].forEach(([i, v]) => { if (!type || v.type === type) close(i); }); }
  function closeLast(type) { const last = [...opened.entries()].reverse().find(([, v]) => !type || v.type === type); if (last) close(last[0]); }
  function title(index, text) { const n = opened.get(index)?.node.querySelector("header > span:first-child"); if (n) n.textContent = text; }
  function getNode(index) { return opened.get(index)?.node || null; }
  function setContent(index, content) {
    const b = opened.get(index)?.node.querySelector('[data-catui-layer="body"]');
    if (!b) return;
    b.textContent = ""; fill(b, content);
  }
  function style(index, css = {}) {
    const n = opened.get(index)?.node;
    if (!n) return;
    Object.entries(css).forEach(([k, v]) => { n.style[k] = typeof v === "number" ? `${v}px` : v; });
  }
  const full = (index) => opened.get(index)?.setMax?.(true);
  const restore = (index) => opened.get(index)?.setMax?.(false);
  // 열린 레이어 목록 (type 별)
  const list = (type) => [...opened.entries()].filter(([, v]) => !type || v.type === type).map(([i, v]) => ({ index: i, type: v.type, node: v.node }));

  return { msg, open, alert, confirm, prompt, load, progress, tips, photos, tab, ask, input, close, closeAll, closeLast, title, getNode, setContent, style, full, restore, list, get count() { return opened.size; } };
})();
