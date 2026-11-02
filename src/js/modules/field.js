import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon, uid, el, imeBusy } from "../core/dom.js";
import { hint } from "../core/base.js";

// field — 입력 보강 묶음. 각각 render/reload/destroy/on을 갖는 컴포넌트다.
//   field.tags.render({ elem: 'input', max: 5, value: ['디자인'], change(list) {} })      · 마크업 <input data-catui-tags data-catui-max="5">
//   field.stepper.render({ elem, min: 1, max: 9, step: 1, value: 1, name: 'qty' })     · 마크업 <div class="Catui_stepper" data-catui-stepper data-catui-min="1">
//   field.counter.render({ elem: 'textarea', max: 240 })                               · 마크업 <textarea maxlength="240" data-catui-counter>
//   field.otp.render({ elem: 'fieldset.Catui_otp', complete(code) {} })                · 마크업 <fieldset class="Catui_otp" data-catui-otp>
// 폼으로 보낼 값은 숨은 input(name)에 담아 form.val·FormData로 그대로 읽힌다.

const catuiNum = (v, d) => (v === "" || v == null || Number.isNaN(Number(v)) ? d : Number(v));
// 스크린리더에 짧게 알리는 숨은 영역 (컴포넌트 옆에 하나)
const catuiLive = (host) => {
  const p = document.createElement("p");
  p.className = "Catui_clip";
  p.setAttribute("aria-live", "polite");
  host.insertAdjacentElement("afterend", p);
  return p;
};

// ── 태그 입력 ──
const catuiFieldTags = component({
  name: "tags",
  config: { max: 0, value: [], duplicate: false, maxLength: 30, separator: ",", name: "", label: "", change: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!(input instanceof HTMLInputElement)) return;
    const list = (inst.list = [...new Set([].concat(c.value || []).map((t) => String(t).trim()).filter(Boolean))]);
    // 폼 값: 원래 name은 숨은 input으로 옮기고(쉼표로 이은 값) 입력 칸은 이름 없이 둔다
    const name = c.name || input.name;
    const hidden = name ? Object.assign(document.createElement("input"), { type: "hidden", name }) : null;
    if (name) input.removeAttribute("name");
    const box = document.createElement("div");
    box.className = "Catui_tags";
    box.setAttribute("role", "list");
    box.setAttribute("aria-label", c.label || `${input.labels?.[0]?.textContent.trim() || "태그"} 목록`);
    input.insertAdjacentElement("beforebegin", box);
    if (hidden) box.insertAdjacentElement("afterend", hidden);
    const live = catuiLive(input);
    const limitText = () => (c.max ? `${list.length}/${c.max}개` : "");
    const draw = () => {
      mount(box, html`${list.map((t, i) => html`<span class="Catui_tag" role="listitem">${t} <button type="button" data-catui-tag-del="${i}" aria-label="${t} 태그 제거">${icon("x", 12)}</button></span>`)}${c.max ? html`<span class="Catui_tag Catui_tag-limit" role="listitem">${limitText()}</span>` : ""}`);
      if (hidden) hidden.value = list.join(c.separator);
      input.placeholder = c.max && list.length >= c.max ? `최대 ${c.max}개` : (inst.placeholder ?? (inst.placeholder = input.placeholder));
    };
    const changed = (msg) => { draw(); live.textContent = msg; c.change?.call(inst, [...list]); inst.emit("change", { value: [...list], elem: input }); };
    const add = (raw) => {
      const words = String(raw).split(c.separator).map((t) => t.trim().slice(0, c.maxLength)).filter(Boolean);
      const added = [], refused = [];
      for (const w of words) {
        if (c.max && list.length >= c.max) { refused.push(`최대 ${c.max}개까지 넣을 수 있습니다`); break; }
        if (!c.duplicate && list.some((t) => t.toLowerCase() === w.toLowerCase())) { refused.push(`'${w}'은(는) 이미 있습니다`); continue; }
        list.push(w); added.push(w);
      }
      if (added.length) changed(`${added.join(", ")} 추가됨. ${limitText()}`);
      else if (refused.length) live.textContent = refused[0];
      return added.length > 0;
    };
    const remove = (i, focusNext) => {
      const [t] = list.splice(i, 1);
      if (t == null) return;
      changed(`${t} 제거됨. ${limitText()}`);
      // 지운 자리 다음 태그의 제거 버튼(없으면 입력 칸)으로 포커스
      (focusNext && box.querySelector(`[data-catui-tag-del="${Math.min(i, list.length - 1)}"]`) || input).focus();
    };
    const onKey = (e) => {
      if (imeBusy(e)) return;   // 한글 조합 중 Enter는 글자 확정
      if (e.key === "Enter" || (e.key === c.separator && c.separator.length === 1)) {
        if (!input.value.trim()) { if (e.key === "Enter" && input.form) return; e.preventDefault(); return; }   // 빈 칸 Enter는 폼 제출 허용
        e.preventDefault();
        if (add(input.value)) input.value = "";
      } else if (e.key === "Backspace" && !input.value && list.length) {
        e.preventDefault();
        remove(list.length - 1, false);
      }
    };
    const onPaste = (e) => {
      const text = e.clipboardData?.getData("text") || "";
      if (!text.includes(c.separator) && !text.includes("\n")) return;
      e.preventDefault();
      add(text.replace(/\r?\n/g, c.separator));
    };
    const onBlur = () => { if (input.value.trim() && add(input.value)) input.value = ""; };   // 칸을 벗어나면 남은 글자도 태그로
    const onBox = (e) => { const b = e.target.closest("[data-catui-tag-del]"); if (b) remove(Number(b.dataset.catuiTagDel), true); };
    input.addEventListener("keydown", onKey);
    input.addEventListener("paste", onPaste);
    input.addEventListener("blur", onBlur);
    box.addEventListener("click", onBox);
    draw();
    inst.add = (t) => add(t);
    inst.remove = (t) => { const i = typeof t === "number" ? t : list.indexOf(String(t)); if (i >= 0) remove(i, false); };
    inst.getValue = () => [...list];
    inst.setValue = (v) => { list.splice(0, list.length, ...new Set([].concat(v || []).map(String).filter(Boolean))); draw(); };
    inst.use(() => {
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("paste", onPaste);
      input.removeEventListener("blur", onBlur);
      box.remove(); live.remove(); hidden?.remove();
      if (name) input.name = name;
      if (inst.placeholder != null) input.placeholder = inst.placeholder;
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 수량 증감 ──
const catuiFieldStepper = component({
  name: "stepper",
  config: { min: 0, max: Infinity, step: 1, value: null, name: "", label: "", unit: "", change: null },
  render(inst) {
    const c = inst.config;
    const host = inst.elem;
    if (!host) return;
    host.classList.add("Catui_stepper");
    host.setAttribute("role", "group");
    if (c.label && !host.hasAttribute("aria-labelledby")) host.setAttribute("aria-label", c.label);
    let dec = host.querySelector("button:first-child"), out = host.querySelector("output"), inc = host.querySelector("button:last-child");
    const made = !(dec && out && inc && dec !== inc);
    if (made) {
      mount(host, html`<button type="button" aria-label="감소">${icon("minus", 16)}</button><output aria-live="polite"></output><button type="button" aria-label="증가">${icon("plus", 16)}</button>`);
      [dec, out, inc] = [host.firstElementChild, host.querySelector("output"), host.lastElementChild];
    }
    out.setAttribute("aria-live", "polite");
    const min = catuiNum(c.min, 0), max = catuiNum(c.max, Infinity), step = catuiNum(c.step, 1) > 0 ? catuiNum(c.step, 1) : 1;
    // 소수 단계(0.1)에서 0.30000000000000004 같은 값이 나오지 않게 단계의 소수 자릿수로 반올림
    const digits = (String(step).split(".")[1] || "").length;
    const fix = (v) => Number(Math.min(max, Math.max(min, v)).toFixed(digits));
    let value = fix(catuiNum(c.value, catuiNum(out.textContent.trim(), min)));
    const hidden = c.name ? Object.assign(document.createElement("input"), { type: "hidden", name: c.name }) : null;
    if (hidden) host.appendChild(hidden);
    const draw = () => {
      out.textContent = `${value}${c.unit}`;
      dec.disabled = value <= min;
      inc.disabled = value >= max;
      if (hidden) hidden.value = String(value);
    };
    const set = (v, fire = true) => {
      const next = fix(v);
      if (next === value) { draw(); return; }
      value = next; draw();
      if (fire) { c.change?.call(inst, value); inst.emit("change", { value, elem: host }); }
    };
    // 길게 누르면 반복 (0.4초 뒤부터 0.08초 간격)
    let hold = 0, rep = 0;
    const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = 0; };
    const onDown = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled || e.button) return;
      const d = b === inc ? step : -step;
      hold = setTimeout(() => { rep = setInterval(() => { set(value + d); if ((d > 0 && value >= max) || (d < 0 && value <= min)) stop(); }, 80); }, 400);
    };
    const onClick = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (rep) { stop(); return; }   // 길게 눌러 반복했으면 마지막 click은 무시
      stop();
      set(value + (b === inc ? step : -step));
      if (b.disabled) (b === inc ? dec : inc).focus();   // 경계에 닿아 버튼이 잠기면 반대 버튼으로 포커스
    };
    const onKey = (e) => {
      const d = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key];
      if (d != null) { e.preventDefault(); set(value + d); }
      else if (e.key === "Home" && Number.isFinite(min)) { e.preventDefault(); set(min); }
      else if (e.key === "End" && Number.isFinite(max)) { e.preventDefault(); set(max); }
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerup", stop);
    host.addEventListener("pointerleave", stop);
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);
    draw();
    inst.getValue = () => value;
    inst.setValue = (v) => set(Number(v), false);
    inst.use(() => {
      stop();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", stop);
      host.removeEventListener("pointerleave", stop);
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
      hidden?.remove();
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 글자 수 ──
const catuiFieldCounter = component({
  name: "counter",
  config: { max: 0, warn: 0.85, target: null },
  render(inst) {
    const c = inst.config;
    const input = inst.elem;
    if (!input || !("value" in input)) return;
    const max = catuiNum(c.max, 0) || catuiNum(input.getAttribute("maxlength"), 0);
    if (!max) return;
    // 표시 요소: 지정 → aria-describedby 안의 .Catui_counter → 새로 만들기
    // 빈 id("")는 거른다 — "".classList가 undefined라 contains에서 오류가 났었다
    let out = el(c.target) || (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).find((n) => n?.classList.contains("Catui_counter"));
    const made = !out;
    if (made) {
      out = Object.assign(document.createElement("p"), { className: "Catui_counter", id: uid("catui-cnt") });
      input.insertAdjacentElement("afterend", out);
      input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), out.id].filter(Boolean).join(" "));
    }
    out.setAttribute("aria-live", "polite");
    let lastBand = "";
    const draw = () => {
      const n = input.value.length, over = n - max;
      out.classList.toggle("Catui_counter-warn", over <= 0 && n >= max * c.warn);
      out.classList.toggle("Catui_counter-over", over > 0);
      out.textContent = over > 0 ? `${n}/${max} — ${over}자 초과` : `${n}/${max}`;
      if (over > 0) input.setAttribute("aria-invalid", "true"); else if (input.getAttribute("aria-invalid") === "true" && lastBand === "over") input.removeAttribute("aria-invalid");
      // 매 글자마다 읽지 않도록, 경고·초과 구간에 들어설 때만 읽힌다
      const band = over > 0 ? "over" : n >= max * c.warn ? "warn" : "ok";
      out.setAttribute("aria-live", band !== lastBand && band !== "ok" ? "polite" : "off");
      lastBand = band;
    };
    input.addEventListener("input", draw);
    draw();
    inst.refresh = draw;
    inst.use(() => { input.removeEventListener("input", draw); if (made) { out.remove(); input.setAttribute("aria-describedby", (input.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== out.id).join(" ")); } });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

// ── 인증 코드 칸 ──
const catuiFieldOtp = component({
  name: "otp",
  config: { pattern: "\\d", name: "", complete: null },
  render(inst) {
    const c = inst.config;
    const box = inst.elem;
    if (!box) return;
    const cells = [...box.querySelectorAll("input")];
    if (!cells.length) return;
    const ok = new RegExp(`^${c.pattern}$`);
    cells.forEach((x, i) => {
      x.maxLength = 1;
      x.autocomplete = i === 0 ? "one-time-code" : "off";
      if (!x.getAttribute("aria-label")) x.setAttribute("aria-label", `${i + 1}번째 글자`);
    });
    const hidden = c.name ? Object.assign(document.createElement("input"), { type: "hidden", name: c.name }) : null;
    if (hidden) box.appendChild(hidden);
    const code = () => cells.map((x) => x.value).join("");
    const sync = () => {
      if (hidden) hidden.value = code();
      if (code().length === cells.length) { c.complete?.call(inst, code()); inst.emit("complete", { value: code(), elem: box }); }
    };
    // 여러 글자(붙여넣기·휴대폰 코드 자동 채움)를 지금 칸부터 나눠 담는다
    const spread = (from, text) => {
      const chars = [...text].filter((ch) => ok.test(ch));
      if (!chars.length) return false;
      chars.slice(0, cells.length - from).forEach((ch, k) => { cells[from + k].value = ch; });
      cells[Math.min(cells.length - 1, from + chars.length)]?.focus();
      sync();
      return true;
    };
    const onInput = (e) => {
      const x = e.target, i = cells.indexOf(x);
      if (i < 0) return;
      if (x.value.length > 1) { const v = x.value; x.value = ""; spread(i, v); return; }
      if (x.value && !ok.test(x.value)) { x.value = ""; return; }
      if (x.value) { cells[i + 1]?.focus(); cells[i + 1]?.select?.(); sync(); }
      else if (hidden) hidden.value = code();
    };
    const onKey = (e) => {
      const i = cells.indexOf(e.target);
      if (i < 0) return;
      if (e.key === "Backspace" && !e.target.value && i > 0) { e.preventDefault(); cells[i - 1].value = ""; cells[i - 1].focus(); if (hidden) hidden.value = code(); }
      else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); cells[i - 1].focus(); }
      else if (e.key === "ArrowRight" && i < cells.length - 1) { e.preventDefault(); cells[i + 1].focus(); }
    };
    const onPaste = (e) => { const i = cells.indexOf(e.target); if (i >= 0 && spread(i, e.clipboardData?.getData("text") || "")) e.preventDefault(); };
    const onFocus = (e) => { if (cells.includes(e.target)) e.target.select?.(); };
    box.addEventListener("input", onInput);
    box.addEventListener("keydown", onKey);
    box.addEventListener("paste", onPaste);
    box.addEventListener("focusin", onFocus);
    inst.getValue = code;
    inst.clear = () => { cells.forEach((x) => { x.value = ""; x.removeAttribute("aria-invalid"); }); cells[0].focus(); if (hidden) hidden.value = ""; };
    // 서버에서 틀렸다고 하면: 칸을 오류로 표시하고 첫 칸부터 다시
    inst.setError = (on = true) => { cells.forEach((x) => (on ? x.setAttribute("aria-invalid", "true") : x.removeAttribute("aria-invalid"))); if (on) cells[0].focus(); };
    inst.use(() => {
      box.removeEventListener("input", onInput);
      box.removeEventListener("keydown", onKey);
      box.removeEventListener("paste", onPaste);
      box.removeEventListener("focusin", onFocus);
      hidden?.remove();
    });
  },
  destroy(inst) { if (inst.config.auto) inst.elem?.removeAttribute("data-catui-ready"); },
});

const catuiFieldParts = [catuiFieldTags, catuiFieldStepper, catuiFieldCounter, catuiFieldOtp];
export const field = {
  tags: catuiFieldTags,
  stepper: catuiFieldStepper,
  counter: catuiFieldCounter,
  otp: catuiFieldOtp,
  // 선언형 마크업 준비 (catui.init에서 호출)
  enhance(scope = document) {
    // 한 요소가 실패해도 나머지(다른 칸·다른 종류)는 계속 연결한다
    const each = (sel, fn) => scope.querySelectorAll(`${sel}:not([data-catui-ready])`).forEach((n) => {
      n.setAttribute("data-catui-ready", "");
      try { fn(n); } catch (err) { n.removeAttribute("data-catui-ready"); hint.error(`field: ${sel} 연결 실패`, "error", err, n); }
    });
    const a = (n, k) => n.getAttribute(`data-catui-${k}`);
    each("input[data-catui-tags]", (n) => catuiFieldTags.render({ elem: n, auto: true, max: catuiNum(a(n, "max"), 0), value: (a(n, "tags") || n.value || "").split(",").filter(Boolean) }));
    each("[data-catui-stepper]", (n) => catuiFieldStepper.render({ elem: n, auto: true, min: catuiNum(a(n, "min"), 0), max: catuiNum(a(n, "max"), Infinity), step: catuiNum(a(n, "step"), 1), value: a(n, "value"), name: a(n, "name") || "", unit: a(n, "unit") || "" }));
    each("[data-catui-counter]", (n) => catuiFieldCounter.render({ elem: n, auto: true, max: catuiNum(a(n, "counter"), 0) }));
    each("[data-catui-otp]", (n) => catuiFieldOtp.render({ elem: n, auto: true, name: a(n, "name") || "", pattern: a(n, "otp") === "alnum" ? "[A-Za-z0-9]" : "\\d" }));
  },
  destroyAll() { catuiFieldParts.forEach((p) => p.destroyAll()); },
  destroyDetached() { catuiFieldParts.forEach((p) => p.destroyDetached()); },
};
