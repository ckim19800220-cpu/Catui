import { html, raw, isRaw } from "../core/html.js";
import { layerRoot, icon, mount, FOCUSABLE } from "../core/dom.js";

// layer — 팝업 레이어. 모든 함수는 레이어 index(숫자)를 돌려주고 layer.close(index)로 닫는다.
//   layer.msg('저장했습니다', { icon: 'success' })
//   layer.confirm('삭제할까요?', { danger: true }, (index) => { ...; layer.close(index); })
//   layer.open({ title, content, area: 'md', btn: ['저장', '취소'], yes(index, el) {} })
export const layer = (() => {
  let seq = 0;
  const opened = new Map(); // index → { type, node, close(reason) }
  const ICON = { success: "check", info: "info", warn: "alert-triangle", danger: "alert-circle" };
  const TOAST_KIND = { success: "", info: " Catui_toast-info", warn: " Catui_toast-warn", danger: " Catui_toast-danger" };

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

  function toastBox() {
    const root = layerRoot();
    let box = root.querySelector(":scope > .Catui_toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "Catui_toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      root.appendChild(box);
    }
    return box;
  }

  // 토스트 메시지. options: { icon, body, time(ms, 0=수동), max } / end 콜백
  function msg(content, options = {}, end) {
    if (typeof options === "function") { end = options; options = {}; }
    const kind = ICON[options.icon] ? options.icon : "info";
    const index = ++seq;
    const box = toastBox();
    const node = document.createElement("div");
    node.className = `Catui_toast${TOAST_KIND[kind]}`;
    mount(node, html`${icon(ICON[kind], 18)}<div><p class="Catui_toast-title">${content}</p>${options.body ? html`<p class="Catui_toast-body">${options.body}</p>` : ""}</div>`);
    box.appendChild(node);
    const max = options.max ?? 3;
    while (box.children.length > max) {
      const oldest = [...opened.entries()].find(([, v]) => v.type === "msg");
      if (!oldest) { box.firstElementChild.remove(); break; }
      close(oldest[0]);
    }
    let timer = 0;
    const done = () => { clearTimeout(timer); node.remove(); opened.delete(index); end?.(); };
    opened.set(index, { type: "msg", node, close: done });
    const time = options.time ?? 3000;
    if (time > 0) {
      timer = setTimeout(done, time);
      // 마우스를 올리면 멈춤 (읽을 시간 확보)
      node.addEventListener("mouseenter", () => clearTimeout(timer));
      node.addEventListener("mouseleave", () => { timer = setTimeout(done, 1500); });
    }
    return index;
  }

  // 범용 레이어. type: 'dialog'(기본) | 'drawer'
  function open(options = {}) {
    const o = { type: "dialog", title: "", area: "md", btn: [], closeBtn: true, shadeClose: true, ...options };
    const index = ++seq;
    const titleId = `catui-layer-${index}-t`;
    const dlg = document.createElement("dialog");
    const isDrawer = o.type === "drawer";
    dlg.className = isDrawer ? "Catui_drawer" : `Catui_modal Catui_modal-${["sm", "md", "lg"].includes(o.area) ? o.area : "md"}`;
    if (o.title) dlg.setAttribute("aria-labelledby", titleId); else dlg.setAttribute("aria-label", o.label || "대화상자");
    if (o.id) dlg.id = o.id;
    const H = isDrawer ? "Catui_drawer-h" : "Catui_modal-h", B = isDrawer ? "Catui_drawer-b" : "Catui_modal-b";
    mount(dlg, html`
${o.title || o.closeBtn ? html`<header class="${H}"><span id="${titleId}">${o.title}</span>${o.closeBtn ? html`<button class="Catui_close" type="button" data-catui-layer="close" aria-label="닫기">${icon("x", 16)}</button>` : ""}</header>` : ""}
<div class="${B}" data-catui-layer="body"></div>
${o.btn.length ? html`<footer class="Catui_modal-f">${[...o.btn].reverse().map((label, ri) => {
  const i = o.btn.length - 1 - ri;
  const kind = i === 0 ? (o.danger ? "Catui_btn-danger" : "Catui_btn-primary") : "Catui_btn-secondary";
  return html`<button class="Catui_btn Catui_btn-md ${kind}" type="button" data-catui-btn="${i}">${label}</button>`;
})}</footer>` : ""}`);
    fill(dlg.querySelector('[data-catui-layer="body"]'), o.content);
    layerRoot().appendChild(dlg);

    let closed = false;
    const close = (reason) => {
      if (closed) return;
      closed = true;
      if (dlg.open) dlg.close(reason);
      dlg.remove();                         // 열기 전 포커스 요소로의 복귀는 dialog가 처리
      opened.delete(index);
      o.end?.(index);
    };
    opened.set(index, { type: isDrawer ? "drawer" : o.loading ? "load" : "dialog", node: dlg, close });

    const tryCancel = () => { if (o.cancel?.(index, dlg) !== false) close("cancel"); };
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) { if (o.shadeClose) tryCancel(); return; }  // 스크림(바깥) 클릭
      const b = e.target.closest("[data-catui-btn], [data-catui-layer=close]");
      if (!b) return;
      if (b.dataset.catuiLayer === "close") { tryCancel(); return; }
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

    dlg.showModal();
    const first = dlg.querySelector(`[data-catui-layer="body"] :is(${FOCUSABLE})`) || dlg.querySelector('[data-catui-btn="0"]') || dlg.querySelector(FOCUSABLE);
    first?.focus();
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

  function load(text = "불러오는 중…", options = {}) {
    return open({ area: "sm", closeBtn: false, shadeClose: false, loading: true, label: text, ...options,
      content: raw(`<div class="Catui_layer-load" role="status"><span class="Catui_spin" aria-hidden="true"></span><span></span></div>`),
      success(dlg) { dlg.querySelector(".Catui_layer-load span:last-child").textContent = text; dlg.querySelector(".Catui_modal-b").style.padding = "0"; },
    });
  }

  function close(index) { opened.get(index)?.close("close"); }
  function closeAll(type) { [...opened.entries()].forEach(([i, v]) => { if (!type || v.type === type) close(i); }); }
  function closeLast(type) { const last = [...opened.entries()].reverse().find(([, v]) => !type || v.type === type); if (last) close(last[0]); }
  function title(index, text) { const n = opened.get(index)?.node.querySelector("header span"); if (n) n.textContent = text; }
  function getNode(index) { return opened.get(index)?.node || null; }

  return { msg, open, alert, confirm, prompt, load, close, closeAll, closeLast, title, getNode, get count() { return opened.size; } };
})();
