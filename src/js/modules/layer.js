import { html, raw, isRaw } from "../core/html.js";
import { layerRoot, icon, mount, FOCUSABLE, imeBusy } from "../core/dom.js";

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
    let timer = 0, gone = false;
    // 한 번만 닫힌다 — 마우스·포커스 재개 타이머가 겹쳐도 end 콜백이 두 번 불리지 않게
    const done = () => { if (gone) return; gone = true; clearTimeout(timer); node.remove(); opened.delete(index); end?.(); };
    opened.set(index, { type: "msg", node, close: done });
    node.querySelector(".Catui_toast-action")?.addEventListener("click", () => { options.action.onClick?.(index); done(); });
    if (time > 0) {
      timer = setTimeout(done, time);
      // 마우스를 올리거나 키보드 포커스가 들어오면 멈춤 (읽을 시간 확보)
      const pause = () => clearTimeout(timer), resume = () => { clearTimeout(timer); timer = setTimeout(done, 1500); };
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
      if (imeBusy()) return;               // 한글 조합 중(·직후) Esc는 조합만 끝내고 레이어는 유지
      tryCancel();
    });
    // cancel 이전 단계에서도 막는다: Esc keydown의 기본 동작을 취소하면 브라우저가 cancel/close를 보내지 않는다
    // (Chrome close-watcher는 cancel만 막으면 반복 Esc에서 강제로 닫을 수 있음)
    dlg.addEventListener("keydown", (e) => { if (e.key === "Escape" && imeBusy(e)) e.preventDefault(); }, true);
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
    const reach = `:is(${FOCUSABLE}):not([tabindex="-1"]):not([readonly])`;
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
          // 한글 조합 중 Enter는 글자 확정일 뿐 — 제출하지 않는다
          if (e.key === "Enter" && !imeBusy(e) && options.formType !== "textarea") { e.preventDefault(); dlg.querySelector('[data-catui-btn="0"]').click(); }
        });
        options.success?.(dlg, index);
      },
      yes(index, dlg) {
        const input = dlg.querySelector(`#${fid}`), value = input.value;
        const bad = options.required !== false && !value.trim();
        input.setAttribute("aria-invalid", String(bad));
        if (bad) input.setAttribute("aria-describedby", `${fid}-err`); else input.removeAttribute("aria-describedby");
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
    const key = (e) => { if (e.key === "Escape" && !imeBusy(e) && !e.defaultPrevented) { e.preventDefault(); done(); } };   // 캡처 단계: 팁만 닫고 아래 모달은 유지
    const outside = (e) => { if (!tip.contains(e.target) && !el.contains(e.target)) done(); };
    const done = () => {
      clearTimeout(timer); tip.remove(); opened.delete(index);
      if (prev) el.setAttribute("aria-describedby", prev); else el.removeAttribute("aria-describedby");
      document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", outside, true);
      removeEventListener("resize", place); removeEventListener("scroll", place, true);
      options.end?.(index);
    };
    document.addEventListener("keydown", key, true); document.addEventListener("pointerdown", outside, true);
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
          else if (e.key === "Home") { e.preventDefault(); k = 0; show(); } else if (e.key === "End") { e.preventDefault(); k = items.length - 1; show(); }
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
    list.className = vertical ? "Catui_layer-tabs Catui_layer-tabs-v" : options.card ? "Catui_layer-tabs Catui_layer-tabs-card" : "Catui_layer-tabs";
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

  // 양식 대화상자: fields로 입력 칸을 만들고 검사한 뒤 값 객체를 돌려줌(Promise, 취소는 null).
  //   submit(values, index)가 false를 돌려주거나 오류를 던지면 열린 채 유지(저장 중에는 버튼이 바쁨 상태)
  //   type: text·email·password·number·tel·url·date·time·textarea·select·radio·checkbox(options 있으면 여러 개)·switch
  //   field: { name, label, type, required, placeholder, value, options, help, min, max, minlength, maxlength, pattern, autocomplete, cols(1~12), rows, validate(v, values) → 오류 문구, messages }
  // 내용을 바꾸지 않고 뒤에 덧붙임 (mount는 교체)
  const append = (node, markup) => { if (isRaw(markup)) node.insertAdjacentHTML("beforeend", markup.__raw); else node.append(String(markup ?? "")); return node; };
  const FORM_MSG = { valueMissing: "필수 항목입니다.", typeMismatch: "형식이 올바르지 않습니다.", patternMismatch: "형식이 올바르지 않습니다.", tooShort: "너무 짧습니다.", tooLong: "너무 깁니다.", rangeUnderflow: "값이 너무 작습니다.", rangeOverflow: "값이 너무 큽니다.", badInput: "숫자를 입력해 주세요." };
  function form(options = {}) {
    return new Promise((resolve) => {
      const fid = `catui-form-${seq + 1}`, fields = options.fields || [];
      const opts = (fl) => (fl.options || []).map((o) => (typeof o === "object" ? o : { value: o, label: o }));
      const kindOf = (fl) => {
        const t = fl.type || "text";
        return t === "radio" || (t === "checkbox" && fl.options) ? "group" : t === "checkbox" || t === "switch" ? "single" : t;
      };
      const reqMark = () => html` <span class="Catui_req" aria-hidden="true">*</span>`;
      const control = (fl, id) => {
        const t = fl.type || "text", k = kindOf(fl), req = !!fl.required;
        const a = (el) => {
          const attrs = { id, name: fl.name, placeholder: fl.placeholder, min: fl.min, max: fl.max, minlength: fl.minlength, maxlength: fl.maxlength, pattern: fl.pattern, autocomplete: fl.autocomplete };
          Object.entries(attrs).forEach(([n, v]) => { if (v != null && v !== "") el.setAttribute(n, v); });
          if (req) el.required = true;
          if (fl.readonly) el.readOnly = true;
          if (fl.disabled) el.disabled = true;
          return el;
        };
        if (t === "textarea") { const x = a(document.createElement("textarea")); x.className = "Catui_input"; x.rows = fl.rows || 4; x.value = fl.value ?? ""; return x; }
        if (t === "select") {
          const w = document.createElement("div"); w.className = "Catui_select-wrap";
          const x = a(document.createElement("select")); x.className = "Catui_input Catui_select";
          if (fl.placeholder) x.add(new Option(fl.placeholder, ""));
          opts(fl).forEach((o) => x.add(new Option(o.label, o.value)));
          x.value = fl.value != null ? String(fl.value) : "";
          w.appendChild(x); append(w, icon("chevron-down", 16)); return w;
        }
        if (k === "group") {
          const fs = document.createElement("fieldset"); fs.className = "Catui_choices";
          const lg = document.createElement("legend"); lg.className = "Catui_label"; lg.textContent = fl.label;
          if (req) append(lg, reqMark());
          fs.appendChild(lg);
          const val = [].concat(fl.value ?? []).map(String);
          opts(fl).forEach((o, n) => {
            const iid = `${id}-${n}`;
            append(fs, html`<span class="Catui_choice"><input class="Catui_clip" type="${t}" id="${iid}" name="${fl.name}" value="${o.value}"><label class="${t === "radio" ? "Catui_radio" : "Catui_cbx"}" for="${iid}">${t === "radio" ? "" : icon("check", 12)}</label><label for="${iid}">${o.label}</label></span>`);
            fs.querySelector(`#${iid}`).checked = val.includes(String(o.value));
          });
          return fs;
        }
        if (k === "single") {
          const w = document.createElement("span"); w.className = "Catui_choice";
          append(w, html`<input class="Catui_clip" type="checkbox" id="${id}" name="${fl.name}"><label class="${t === "switch" ? "Catui_tgl" : "Catui_cbx"}" for="${id}">${t === "switch" ? "" : icon("check", 12)}</label><label for="${id}">${fl.label}</label>`);
          const x = w.querySelector("input"); x.checked = !!fl.value; x.required = req;
          if (t === "switch") x.setAttribute("role", "switch");
          if (req) append(w.lastElementChild, reqMark());
          return w;
        }
        const x = a(document.createElement("input")); x.className = "Catui_input"; x.type = t; if (fl.value != null) x.value = fl.value; return x;
      };

      const horizontal = options.layout === "horizontal";
      const el = document.createElement("form");
      el.className = horizontal ? "Catui_layer-form Catui_layer-form-h" : "Catui_layer-form"; el.noValidate = true; el.id = fid;
      if (options.labelWidth) el.style.setProperty("--Catui_form-label-w", typeof options.labelWidth === "number" ? `${options.labelWidth}px` : options.labelWidth);
      const sum = document.createElement("div");
      sum.className = "Catui_banner Catui_banner-danger"; sum.setAttribute("role", "alert"); sum.tabIndex = -1; sum.hidden = true;
      el.appendChild(sum);
      fields.forEach((fl, i) => {
        const id = `${fid}-${fl.name || i}`, k = kindOf(fl);
        const box = document.createElement("div");
        box.className = "Catui_field"; box.style.setProperty("--Catui_span", String(Math.min(12, Math.max(1, fl.cols || 12)))); box.dataset.name = fl.name;
        const top = fl.type === "textarea" ? " Catui_label-top" : "";
        if (k !== "group" && k !== "single") append(box, html`<label class="Catui_label${top}" for="${id}">${fl.label}${fl.required ? reqMark() : ""}</label>`);
        // 가로 배치의 묶음 칸: 보이는 라벨은 왼쪽 열에, legend는 화면 리더용으로
        if (horizontal && k === "group") append(box, html`<span class="Catui_label Catui_label-top" aria-hidden="true">${fl.label}${fl.required ? reqMark() : ""}</span>`);
        let ctl = control(fl, id);
        if (horizontal && k === "group") ctl.querySelector("legend").className = "Catui_clip";
        // 입력 옆 아이콘 버튼 (예: 비밀번호 새로 만들기). onClick(입력 요소, 현재 값들)
        if (fl.addon && k !== "group" && k !== "single") {
          const g = document.createElement("div"); g.className = "Catui_igroup";
          g.appendChild(ctl);
          append(g, html`<button class="Catui_btn Catui_btn-md Catui_btn-secondary Catui_btn-icon" type="button" aria-label="${fl.addon.label || "실행"}" title="${fl.addon.label || ""}">${icon(fl.addon.icon || "refresh-cw", 16)}</button>`);
          const input = ctl.matches?.("input,select,textarea") ? ctl : ctl.querySelector("input,select,textarea");
          g.lastElementChild.addEventListener("click", () => { fl.addon.onClick?.(input, read()); input.dispatchEvent(new Event("input", { bubbles: true })); });
          ctl = g;
        }
        box.appendChild(ctl);
        if (fl.help) append(box, html`<p class="Catui_help" id="${id}-h">${fl.help}</p>`);
        append(box, html`<p class="Catui_error" id="${id}-e" hidden></p>`);
        el.appendChild(box);
      });

      const read = () => Object.fromEntries(fields.filter((fl) => fl.name).map((fl) => {
        const t = fl.type || "text", ins = [...el.querySelectorAll(`[name="${CSS.escape(fl.name)}"]`)];
        if (t === "checkbox" && fl.options) return [fl.name, ins.filter((x) => x.checked).map((x) => x.value)];
        if (t === "checkbox" || t === "switch") return [fl.name, !!ins[0]?.checked];
        if (t === "radio") return [fl.name, ins.find((x) => x.checked)?.value ?? ""];
        if (t === "number") return [fl.name, ins[0].value === "" ? null : Number(ins[0].value)];
        return [fl.name, ins[0]?.value ?? ""];
      }));
      const check = () => {
        const values = read(), bad = [];
        fields.forEach((fl) => {
          const box = el.querySelector(`[data-name="${CSS.escape(String(fl.name))}"]`);
          if (!box) return;
          const ins = [...box.querySelectorAll("input,select,textarea")], err = box.querySelector(".Catui_error"), k = kindOf(fl);
          let m = "";
          if (fl.required && k === "group" && !(fl.type === "radio" ? values[fl.name] : values[fl.name].length)) m = fl.type === "radio" ? "하나를 고르세요." : "하나 이상 고르세요.";
          else if (k !== "group") {
            const inv = ins.find((x) => !x.checkValidity());
            if (inv) { const key = Object.keys(FORM_MSG).find((n) => inv.validity[n]); m = fl.messages?.[key] || FORM_MSG[key] || "값을 확인해 주세요."; }
            // 브라우저는 스크립트·자동 완성으로 채운 값에는 tooShort를 표시하지 않으므로 길이는 직접 검사
            const len = String(values[fl.name] ?? "").length;
            if (!m && len && fl.minlength && len < fl.minlength) m = fl.messages?.tooShort || `${fl.minlength}자 이상 입력해 주세요.`;
            if (!m && fl.maxlength && len > fl.maxlength) m = fl.messages?.tooLong || `${fl.maxlength}자 이하로 입력해 주세요.`;
          }
          if (!m && fl.validate) m = fl.validate(values[fl.name], values) || "";
          err.textContent = m; err.hidden = !m;
          ins.forEach((x) => x.setAttribute("aria-invalid", String(!!m)));
          const target = k === "group" ? box.querySelector("fieldset") : ins[0];
          const desc = [fl.help ? err.id.replace(/-e$/, "-h") : "", m ? err.id : ""].filter(Boolean).join(" ");
          if (desc) target.setAttribute("aria-describedby", desc); else target.removeAttribute("aria-describedby");
          if (m) bad.push({ label: fl.label, focus: k === "group" ? target.querySelector("input") : ins[0] });
        });
        sum.hidden = !bad.length;
        sum.textContent = bad.length ? `입력을 확인해 주세요 (${bad.length}건): ${bad.map((b) => b.label).join(", ")}` : "";
        bad[0]?.focus.focus();
        return bad.length ? null : values;
      };
      // 처음 값이 있는 칸에서도 help만 설명으로 연결
      fields.forEach((fl, i) => {
        if (!fl.help) return;
        const id = `${fid}-${fl.name || i}`, box = el.querySelector(`[data-name="${CSS.escape(String(fl.name))}"]`);
        (kindOf(fl) === "group" ? box.querySelector("fieldset") : box.querySelector("input,select,textarea"))?.setAttribute("aria-describedby", `${id}-h`);
      });

      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
      const index = open({
        title: options.title || "입력", area: options.area || "md", btn: [options.okText || "확인", options.cancelText || "취소"], ...options,
        content: el, kind: "form",
        end(i, reason) { finish(null); options.end?.(i, reason); },
        yes() { el.requestSubmit(); return false; },
      });
      const ok = getNode(index).querySelector('[data-catui-btn="0"]');
      // 제출 버튼이 폼 밖(꼬리)에 있으므로 한 줄 입력 칸의 Enter는 직접 제출
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !imeBusy(e) && e.target.matches("input:not([type=checkbox]):not([type=radio])")) { e.preventDefault(); el.requestSubmit(); }
      });
      el.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (ok.disabled) return;
        const values = check();
        if (!values) return;
        if (options.submit) {
          const label = ok.textContent;
          ok.disabled = true; ok.setAttribute("aria-busy", "true");
          ok.textContent = ""; mount(ok, html`<span class="Catui_spin" aria-hidden="true"></span>${label}`);
          let r;
          try { r = await options.submit(values, index); }
          catch (err) { r = false; sum.hidden = false; sum.textContent = err?.message || "저장하지 못했습니다. 다시 시도해 주세요."; sum.focus(); }
          ok.disabled = false; ok.removeAttribute("aria-busy"); ok.textContent = label;
          if (r === false) return;
        }
        finish(values); close(index);
      });
    });
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

  return { msg, open, alert, confirm, prompt, load, progress, tips, photos, tab, form, ask, input, close, closeAll, closeLast, title, getNode, setContent, style, full, restore, list, get count() { return opened.size; } };
})();
