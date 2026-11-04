import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, el, icon, uid } from "../core/dom.js";
import { csrfHeaders } from "../core/base.js";

// upload — 파일 올리기. 끌어 놓기·선택, 형식·용량·개수 검사(오류는 문장으로), 진행률, 목록, 취소.
//   upload.render({ elem: '#zone', url: '/api/upload', accept: '.pdf,image/*', size: 10240, number: 5,
//                   list: '#files', done(res, file) {}, error(msg, file) {} })
//   url을 빼면 서버로 보내지 않고 고른 파일만 관리한다(choose 이벤트로 받아 직접 처리).
//   이벤트: upload.on('choose(f)'), 'progress(f)', 'done(f)', 'error(f)', 'remove(f)'
export const upload = component({
  name: "upload",
  ownDone: true,   // done(res, file)은 업로드 완료 콜백 — 렌더 완료로 부르지 않음
  config: {
    url: "", method: "POST", field: "file", data: {}, headers: {}, accept: "", size: 0, number: 0,
    multiple: true, auto: true, list: null, withCredentials: false, disabled: false,
    guard: true,   // 영역 밖에 파일을 잘못 놓았을 때 브라우저가 그 파일을 열며 페이지를 떠나는 것을 막음
  },
  render(inst) {
    const c = inst.config;
    const zone = inst.elem;
    if (!zone) return;
    // 입력 찾기 또는 만들기 (zone이 label.Catui_upz면 안의 input 사용)
    let input = zone.querySelector('input[type="file"]');
    if (!input) {
      input = Object.assign(document.createElement("input"), { type: "file", className: "Catui_clip" });
      zone.appendChild(input);
    }
    if (c.accept) input.accept = c.accept;
    input.multiple = !!c.multiple;
    if (!input.id) input.id = uid("catui-up");
    const listEl = el(c.list);
    const errId = `${input.id}-err`;
    let err = document.getElementById(errId);
    if (!err) {
      err = Object.assign(document.createElement("p"), { className: "Catui_error", id: errId, hidden: true });
      err.setAttribute("role", "alert");
      zone.insertAdjacentElement("afterend", err);
      inst.use(() => err.remove());
    }
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), errId].filter(Boolean).join(" "));

    const items = (inst.files = []);          // { id, file, status: 'ready'|'uploading'|'done'|'error', percent, xhr, res }
    const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(/\.0$/, "")}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);
    const acceptOk = (f) => {
      if (!c.accept) return true;
      return c.accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((a) => (a.startsWith(".")
        ? f.name.toLowerCase().endsWith(a)
        : a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a));
    };
    const statusText = (it) => ({ ready: "대기", uploading: `올리는 중 ${it.percent}%`, done: "완료", error: it.msg || "실패" }[it.status]);
    const drawList = () => {
      if (!listEl) return;
      // 다시 그려도 목록 안 포커스(빼기·다시 버튼)를 같은 파일의 같은 버튼으로 되돌린다
      const act = listEl.contains(document.activeElement) ? document.activeElement : null;
      const keep = act && (act.hasAttribute("data-catui-remove") ? `[data-catui-remove="${act.getAttribute("data-catui-remove")}"]` : act.hasAttribute("data-catui-retry") ? `[data-catui-retry="${act.getAttribute("data-catui-retry")}"]` : null);
      listEl.classList.add("Catui_files");
      mount(listEl, html`${items.map((it) => html`
<div class="Catui_file" data-catui-file="${it.id}">
  <span class="Catui_file-ico${it.status === "error" ? " Catui_file-ico-5" : ""}">${icon(it.status === "error" ? "alert-circle" : "file-text", 16)}</span>
  <span class="Catui_file-main"><span class="Catui_file-name">${it.file.name}</span>
    <span class="Catui_file-meta">${size(it.file.size)} · <span data-catui-st>${statusText(it)}</span>
    ${it.status === "uploading" ? html`<span class="Catui_prog Catui_prog-sm" role="progressbar" aria-label="${it.file.name} 올리는 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${it.percent}"><i class="Catui_pc2" style="width:${it.percent}%"></i></span>` : ""}</span></span>
  <span class="Catui_file-acts">
    ${it.status === "error" && c.url ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-retry="${it.id}">다시</button>` : ""}
    <button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-remove="${it.id}" aria-label="${it.file.name} ${it.status === "uploading" ? "올리기 취소" : "빼기"}">${icon("x", 16)}</button>
  </span>
</div>`)}`);
      if (act) (keep && listEl.querySelector(keep) || zone).focus?.({ preventScroll: true });
    };
    // 진행률은 그 줄만 고친다(전체를 다시 그리면 스크린리더·포커스가 매번 흔들림)
    const drawProgress = (it) => {
      const row = listEl?.querySelector(`[data-catui-file="${it.id}"]`);
      const bar = row?.querySelector('[role="progressbar"]');
      if (!bar) { drawList(); return; }
      bar.setAttribute("aria-valuenow", String(it.percent));
      bar.firstElementChild.style.width = `${it.percent}%`;
      row.querySelector("[data-catui-st]").textContent = statusText(it);
    };
    const showErr = (msgs) => { err.textContent = msgs.join(" / "); err.hidden = !msgs.length; };

    const send = (it) => {
      if (!c.url) return;
      const fd = new FormData();
      for (const [k, v] of Object.entries(c.data || {})) fd.append(k, typeof v === "function" ? v() : v);
      fd.append(c.field, it.file);
      const xhr = (it.xhr = new XMLHttpRequest());
      xhr.open(c.method, c.url);
      xhr.withCredentials = !!c.withCredentials;
      for (const [k, v] of Object.entries({ ...csrfHeaders(c.url, c.method), ...(c.headers || {}) })) xhr.setRequestHeader(k, v);
      it.status = "uploading"; it.percent = 0; drawList();
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        it.percent = Math.round((e.loaded / e.total) * 100);
        drawProgress(it);
        c.progress?.call(inst, it.percent, it.file);
        inst.emit("progress", { percent: it.percent, file: it.file });
      };
      const fail = (msg) => {
        it.status = "error"; it.msg = msg; it.xhr = null; drawList();
        c.error?.call(inst, msg, it.file);
        inst.emit("error", { msg, file: it.file });
      };
      xhr.onload = () => {
        it.xhr = null;
        if (xhr.status < 200 || xhr.status >= 300) { fail(`HTTP ${xhr.status}`); return; }
        let res = xhr.responseText;
        try { res = JSON.parse(res); } catch { /* 텍스트 응답 */ }
        it.status = "done"; it.res = res; it.percent = 100; drawList();
        c.done?.call(inst, res, it.file);
        inst.emit("done", { res, file: it.file });
      };
      xhr.onerror = () => fail("네트워크 오류");
      xhr.onabort = () => { it.xhr = null; };
      xhr.send(fd);
    };

    const add = (fileList) => {
      if (c.disabled) return;
      const bad = [], ok = [];
      // 한 파일만 받는 영역에 여러 개를 끌어 놓으면 첫 파일만
      const list = c.multiple ? [...fileList] : [...fileList].slice(0, 1);
      for (const f of list) {
        if (!acceptOk(f)) bad.push({ file: f, msg: `${f.name}: 허용하지 않는 형식입니다` });
        else if (c.size && f.size > c.size * 1024) bad.push({ file: f, msg: `${f.name}: ${size(f.size)} — ${size(c.size * 1024)}를 넘습니다` });
        else if (c.number && items.length + ok.length >= c.number) bad.push({ file: f, msg: `${f.name}: 최대 ${c.number}개까지 올릴 수 있습니다` });
        else if (c.before?.call(inst, f) === false) continue;
        else ok.push(f);
      }
      showErr(bad.map((b) => b.msg));
      // 전송 실패와 같은 계약: error(msg, file) 콜백 + error 이벤트 { msg, file }
      bad.forEach(({ file, msg }) => { c.error?.call(inst, msg, file); inst.emit("error", { msg, file }); });
      if (!ok.length) return;
      if (!c.multiple) items.splice(0).forEach((it) => it.xhr?.abort());
      const added = ok.map((file) => ({ id: uid("f"), file, status: "ready", percent: 0, xhr: null }));
      items.push(...added);
      drawList();
      c.choose?.call(inst, ok);
      inst.emit("choose", { files: ok });
      if (c.auto) added.forEach(send);
    };

    const hi = (on) => { zone.style.borderColor = on ? "var(--Catui_upload-border-active)" : ""; zone.style.background = on ? "var(--Catui_upload-bg-hover)" : ""; };
    const onChange = () => { add(input.files); input.value = ""; };
    // 자식 요소를 지날 때마다 dragleave가 와서 깜빡이므로, 들어온 횟수를 세어 완전히 나갔을 때만 해제
    let depth = 0;
    const onEnter = (e) => { e.preventDefault(); if (!c.disabled) { depth += 1; hi(true); } };
    const onOver = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = c.disabled ? "none" : "copy"; };
    const onLeave = () => { depth = Math.max(0, depth - 1); if (!depth) hi(false); };
    const onDrop = (e) => { e.preventDefault(); depth = 0; hi(false); add(e.dataTransfer.files); };
    const onKey = (e) => { if (!c.disabled && zone.tagName !== "LABEL" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.click(); } };
    const onZoneClick = (e) => { if (!c.disabled && zone.tagName !== "LABEL" && e.target !== input) input.click(); };
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    const onWinDrag = (e) => { if (hasFiles(e) && !zone.contains(e.target) && !e.target.closest?.('input[type="file"]')) e.preventDefault(); };
    const setDisabled = (on) => {
      c.disabled = !!on;
      input.disabled = c.disabled;
      zone.setAttribute("aria-disabled", String(c.disabled));
      zone.style.background = c.disabled ? "var(--Catui_input-disabled-bg)" : "";
      zone.style.color = c.disabled ? "var(--Catui_color-text-secondary)" : "";
      zone.style.cursor = c.disabled ? "not-allowed" : "";
    };
    setDisabled(c.disabled);
    const onList = (e) => {
      const rm = e.target.closest("[data-catui-remove]");
      const rt = e.target.closest("[data-catui-retry]");
      const it = items.find((x) => x.id === (rm || rt)?.getAttribute(rm ? "data-catui-remove" : "data-catui-retry"));
      if (!it) return;
      if (rt) { send(it); return; }
      it.xhr?.abort();
      items.splice(items.indexOf(it), 1);
      drawList();
      inst.emit("remove", { file: it.file });
      zone.focus?.();
    };
    if (zone.tagName !== "LABEL" && !zone.hasAttribute("tabindex")) { zone.tabIndex = 0; zone.setAttribute("role", "button"); }
    input.addEventListener("change", onChange);
    zone.addEventListener("dragenter", onEnter);
    zone.addEventListener("dragover", onOver);
    zone.addEventListener("dragleave", onLeave);
    zone.addEventListener("drop", onDrop);
    zone.addEventListener("keydown", onKey);
    zone.addEventListener("click", onZoneClick);
    listEl?.addEventListener("click", onList);
    if (c.guard) { addEventListener("dragover", onWinDrag); addEventListener("drop", onWinDrag); }
    inst.upload = () => items.filter((it) => it.status === "ready" || it.status === "error").forEach(send);
    inst.clear = () => { items.splice(0).forEach((it) => it.xhr?.abort()); drawList(); showErr([]); };
    inst.setDisabled = setDisabled;
    inst.use(() => {
      items.forEach((it) => it.xhr?.abort());
      input.removeEventListener("change", onChange);
      zone.removeEventListener("dragenter", onEnter);
      zone.removeEventListener("dragover", onOver);
      zone.removeEventListener("dragleave", onLeave);
      zone.removeEventListener("drop", onDrop);
      zone.removeEventListener("keydown", onKey);
      zone.removeEventListener("click", onZoneClick);
      listEl?.removeEventListener("click", onList);
      removeEventListener("dragover", onWinDrag);
      removeEventListener("drop", onWinDrag);
      hi(false);
      ["aria-disabled"].forEach((a) => zone.removeAttribute(a));
      zone.style.color = zone.style.cursor = zone.style.background = zone.style.borderColor = "";   // setDisabled가 바꾼 배경까지
    });
  },
});
