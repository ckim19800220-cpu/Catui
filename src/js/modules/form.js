import { emit, onEvent, offEvent } from "../core/events.js";
import { el, icon, uid, scopeOf } from "../core/dom.js";
import { hint, csrfHeaders } from "../core/base.js";

// form — 선언형 폼 검증·제출 이벤트. 마크업만으로 동작한다:
//   <form data-catui-form data-catui-filter="login">
//     <input class="Catui_input" name="email" data-catui-verify="required|email">
//     <button class="Catui_btn ..." data-catui-submit>로그인</button>
//   form.on('submit(login)', (data) => { data.field; return false; })   // false = 기본 제출 막기
// 선택 컨트롤: form.on('checkbox(f)') / 'switch(f)' / 'radio(f)' / 'select(f)' — 필터는 요소의 data-catui-filter
export const form = (() => {
  const MOD = "form";
  const rules = {
    required: [/[\S]+/, "필수 항목입니다."],
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "이메일 형식이 아닙니다. 예: name@company.com"],
    phone: [/^01[016789]-?\d{3,4}-?\d{4}$/, "휴대전화 번호 형식이 아닙니다. 예: 010-1234-5678"],
    tel: [/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "전화번호 형식이 아닙니다. 예: 02-123-4567"],
    zip: [/^\d{5}$/, "우편번호는 숫자 5자리입니다."],
    url: [/^https?:\/\/[^\s/$.?#].[^\s]*$/i, "주소 형식이 아닙니다. 예: https://example.com"],
    number: (v) => (v === "" || Number.isFinite(Number(v)) ? "" : "숫자만 입력해 주세요."),
    int: [/^-?\d+$/, "정수만 입력해 주세요."],
    date: [/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "날짜 형식이 아닙니다. 예: 2026-10-31"],
    id: [/^[a-zA-Z][a-zA-Z0-9_]{3,15}$/, "영문으로 시작하는 4~16자 영문·숫자·밑줄입니다."],
    password: (v) => (/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v) ? "" : "영문과 숫자를 포함해 8자 이상 입력해 주세요."),
    hangul: [/^[가-힣\s]+$/, "한글만 입력해 주세요."],
    alpha: [/^[A-Za-z]+$/, "영문만 입력해 주세요."],
    alnum: [/^[A-Za-z0-9]+$/, "영문과 숫자만 입력해 주세요."],
    // 매개변수 규칙 — "이름:값"으로 쓴다. fn(value, field, arg, root)
    // 기준값을 빠뜨리면("min") 항상 실패하며 "undefined 이상"이 나오므로, 알리고 통과시킨다
    min: (v, f, n) => (n == null || n === "" ? (hint.errorOnce('form: "min:값"처럼 기준값이 필요합니다'), "") : v !== "" && Number.isFinite(Number(v)) && Number(v) >= Number(n) ? "" : `${n} 이상의 숫자를 입력해 주세요.`),
    max: (v, f, n) => (n == null || n === "" ? (hint.errorOnce('form: "max:값"처럼 기준값이 필요합니다'), "") : v !== "" && Number.isFinite(Number(v)) && Number(v) <= Number(n) ? "" : `${n} 이하의 숫자를 입력해 주세요.`),
    minlen: (v, f, n) => (v.length >= Number(n) ? "" : `${n}자 이상 입력해 주세요.`),
    maxlen: (v, f, n) => (v.length <= Number(n) ? "" : `${n}자 이하로 입력해 주세요.`),
    len: (v, f, n) => (v.length === Number(n) ? "" : `${n}자로 입력해 주세요.`),
    same: (v, f, name, root) => {
      const other = name ? (root || document).querySelector(`[name="${CSS.escape(name)}"]`) : null;
      if (!other) return "";
      return v === other.value ? "" : "값이 서로 다릅니다.";
    },
  };

  // 사용자 규칙 추가: form.verify({ name: [정규식, '메시지'] | (value, elem, arg, root) => '오류 메시지' | '' })
  function verify(more) { Object.assign(rules, more || {}); return rules; }

  const fieldValue = (f) => (f.type === "checkbox" || f.type === "radio" ? (f.checked ? f.value : "") : f.value);
  const formRoot = (f) => f.closest("[data-catui-form], [data-catui-filter]") || f.form || document;

  function check(field) {
    const spec = field.getAttribute("data-catui-verify");
    if (!spec) return "";
    const root = formRoot(field);
    let value = fieldValue(field);
    // 같은 name이 여러 개면 그룹 — required는 하나 이상 선택으로 본다
    if ((field.type === "checkbox" || field.type === "radio") && field.name) {
      const group = root.querySelectorAll(`[name="${CSS.escape(field.name)}"]`);
      if (group.length > 1) value = [...group].some((g) => g.checked) ? field.value || "on" : "";
    }
    for (const token of spec.split("|").map((s) => s.trim()).filter(Boolean)) {
      const [name, arg] = token.split(/:(.+)/).map((s) => s.trim());   // "min:5" → min + "5"
      if (name !== "required" && value === "") continue;       // 빈 값은 required만 검사
      const rule = rules[name];
      if (!rule) { hint.errorOnce(`form: '${name}' 검증 규칙이 없습니다`); continue; }
      let msg = "";
      if (typeof rule === "function") msg = rule(value, field, arg, root) || "";
      else if (!rule[0].test(value)) msg = rule[1];
      if (msg) {
        if (name === "required" && field.getAttribute("data-catui-reqtext")) return field.getAttribute("data-catui-reqtext");
        return field.getAttribute("data-catui-errtext") || msg;
      }
    }
    return "";
  }

  // 오류 표시: aria-invalid + 에러 문장(.Catui_error, 없으면 생성) + aria-describedby 연결
  function showError(field, msg) {
    if (!field.id) field.id = uid("catui-f");
    const errId = `${field.id}-err`;
    let err = document.getElementById(errId);
    if (!err && msg) {
      err = document.createElement("p");
      err.className = "Catui_error";
      err.id = errId;
      const host = field.closest(".Catui_field");
      if (host) host.appendChild(err); else field.insertAdjacentElement("afterend", err);
    }
    const described = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== errId);
    if (msg) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", [...described, errId].join(" "));
      err.textContent = msg;
      err.hidden = false;
    } else {
      field.removeAttribute("aria-invalid");
      if (described.length) field.setAttribute("aria-describedby", described.join(" ")); else field.removeAttribute("aria-describedby");
      if (err) err.hidden = true;
    }
  }

  // 필터 이름으로 폼 찾기 — 같은 필터를 쓰는 컨트롤(select 등)보다 폼·영역을 먼저
  function findRoot(filter) {
    const q = `[data-catui-filter="${CSS.escape(String(filter))}"]`;
    return document.querySelector(`form${q}, [data-catui-form]${q}`) || document.querySelector(q);
  }

  // 영역: 요소·선택자·document 또는 필터 이름. 대상을 못 찾으면 통과시키지 않는다.
  function validate(scope) {
    let root = null;
    try { root = scopeOf(scope); } catch { /* 선택자가 아닌 필터 이름 */ }
    if (!root && typeof scope === "string") root = findRoot(scope);
    if (!root) { hint.error(`form.validate: 영역을 찾을 수 없습니다 (${scope})`); return false; }
    let first = null;
    const fields = [...root.querySelectorAll("[data-catui-verify]")];
    if (root.matches?.("[data-catui-verify]")) fields.unshift(root);   // 칸 하나를 넘겨도 검사
    for (const f of fields) {
      if (f.disabled) continue;
      const msg = check(f);
      showError(f, msg);
      if (msg && !first) first = f;
    }
    if (first) first.focus();
    return !first;
  }

  // 값 읽기/쓰기. form.val('login') → { name: value }, form.val('login', { name: 'x' })
  function val(filter, values) {
    const root = findRoot(filter);
    if (!root) { hint.error(`form.val: data-catui-filter="${filter}" 요소가 없습니다`); return {}; }
    if (values) {
      for (const [name, v] of Object.entries(values)) {
        root.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((f) => {
          if (f.type === "file") return;              // 파일 입력은 보안상 값을 넣을 수 없다(InvalidStateError)
          if (f.multiple && f.tagName === "SELECT") [...f.options].forEach((o) => { o.selected = [].concat(v).map(String).includes(o.value); });
          else if (f.type === "checkbox") f.checked = Array.isArray(v) ? v.includes(f.value) : !!v && (v === true || v === f.value || v === "on");
          else if (f.type === "radio") f.checked = f.value === String(v);
          else f.value = v ?? "";
        });
      }
    }
    return collect(root);
  }

  // 같은 name이 여러 개(체크박스 묶음)면 배열로. 파일 입력은 제외.
  function collect(root) {
    const out = {};
    const add = (k, v) => { if (k in out) out[k] = [].concat(out[k], v); else out[k] = v; };
    if (root instanceof HTMLFormElement) {
      for (const [k, v] of new FormData(root).entries()) if (!(v instanceof File)) add(k, v);
      return out;
    }
    root.querySelectorAll("[name]").forEach((f) => {
      if (f.disabled || f.type === "file" || ((f.type === "checkbox" || f.type === "radio") && !f.checked)) return;
      add(f.name, f.value);
    });
    return out;
  }

  // form.reset('login') — 기본값으로 돌리고 남은 오류 표시를 지운다
  function reset(filter) {
    const root = findRoot(filter);
    if (!root) { hint.error(`form.reset: data-catui-filter="${filter}" 요소가 없습니다`); return; }
    // name="reset"인 칸이 form.reset을 가리는 DOM clobbering을 피해 원형 메서드로 호출
    if (root instanceof HTMLFormElement) HTMLFormElement.prototype.reset.call(root);
    else root.querySelectorAll("[name]").forEach((f) => {
      if (f.type === "checkbox" || f.type === "radio") f.checked = f.defaultChecked;
      else if (f.tagName === "SELECT") [...f.options].forEach((o) => { o.selected = o.defaultSelected; });
      else if (f.type !== "file") f.value = f.defaultValue ?? "";
    });
    root.querySelectorAll("[data-catui-verify]").forEach((f) => showError(f, ""));
  }

  // form.serialize('login') → "a=1&b=2" (같은 name은 반복 키)
  function serialize(filter) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(val(filter))) for (const x of [].concat(v)) q.append(k, x);
    return q.toString();
  }

  // data-catui-ajax[=url] 폼: 검증·submit 이벤트 통과 뒤 fetch로 보내고 done/fail 이벤트
  const sending = new WeakSet();   // 보내는 중인 폼 — Enter 연타·버튼 없는 제출도 막는다
  async function send(f, filter, submitter) {
    if (sending.has(f)) return;
    sending.add(f);
    // f.action은 name="action"인 칸이 가릴 수 있어(DOM clobbering) 속성으로 읽는다
    const url = f.getAttribute("data-catui-ajax") || f.getAttribute("action") || location.href;
    const method = (f.getAttribute("method") || "post").toUpperCase();
    const wasDisabled = !!submitter?.disabled;   // 원래 잠겨 있던 버튼은 끝나도 잠근 채로
    if (submitter) { submitter.disabled = true; submitter.setAttribute("aria-busy", "true"); }
    f.setAttribute("aria-busy", "true");
    let data;
    try { data = submitter?.name ? new FormData(f, submitter) : new FormData(f); } catch { data = new FormData(f); }   // 누른 버튼의 name=value 포함
    const base = { elem: submitter || null, form: f, field: collect(f) };
    // 응답이 오지 않으면 버튼이 영영 잠기지 않도록 시간 제한 (data-catui-timeout, ms, 기본 30초, 0 = 없음)
    const ms = Number(f.getAttribute("data-catui-timeout") ?? 30000);
    const ctrl = new AbortController();
    const timer = ms > 0 ? setTimeout(() => ctrl.abort(), ms) : 0;
    try {
      let target = url, body = data;
      if (method === "GET") { target += (target.includes("?") ? "&" : "?") + new URLSearchParams(data); body = null; }
      const res = await fetch(target, { method, body, signal: ctrl.signal, headers: { Accept: "application/json, text/plain", ...csrfHeaders(target, method) } });
      const text = await res.text();
      let parsed = text;
      if ((res.headers.get("content-type") || "").includes("json") && text) { try { parsed = JSON.parse(text); } catch { /* 글자로 둔다 */ } }
      if (!res.ok) throw Object.assign(new Error(`요청 실패 (HTTP ${res.status})`), { status: res.status, data: parsed });
      emit(MOD, "done", filter, { ...base, res: parsed, status: res.status }, submitter || f);
    } catch (err) {
      const error = err?.name === "AbortError" ? Object.assign(new Error(`응답 시간이 초과되었습니다 (${ms / 1000}초)`), { timeout: true }) : err;
      emit(MOD, "fail", filter, { ...base, error }, submitter || f);
    } finally {
      clearTimeout(timer);
      sending.delete(f);
      f.removeAttribute("aria-busy");
      if (submitter) { submitter.disabled = wasDisabled; submitter.removeAttribute("aria-busy"); }
    }
  }

  // select.Catui_select에 화살표 아이콘이 없으면 붙인다 (견본 규칙)
  function render(scope = document) {
    const root = el(scope) || document;
    root.querySelectorAll(".Catui_select-wrap").forEach((w) => {
      if (!w.querySelector(".Catui_icon")) w.insertAdjacentHTML("beforeend", icon("chevron-down", 16).__raw);
    });
  }

  // 전역 위임 (catui.init에서 1회 연결)
  function bind() {
    const offs = [];
    const onSubmit = (e) => {
      const f = e.target;
      if (!(f instanceof HTMLFormElement) || !f.matches("[data-catui-form]")) return;
      if (sending.has(f)) { e.preventDefault(); return; }   // Ajax 응답 대기 중 재제출 무시
      if (e.submitter && f.querySelector("[data-catui-submit]") && !e.submitter.matches("[data-catui-submit]")) return;
      if (!validate(f)) { e.preventDefault(); return; }
      const filter = e.submitter?.getAttribute("data-catui-filter") || f.getAttribute("data-catui-filter");
      const ok = emit(MOD, "submit", filter, { elem: e.submitter || null, form: f, field: collect(f) }, e.submitter || f);
      if (!ok) { e.preventDefault(); return; }
      if (f.hasAttribute("data-catui-ajax")) { e.preventDefault(); send(f, filter, e.submitter || f.querySelector("[data-catui-submit]")); }
    };
    document.addEventListener("submit", onSubmit);
    offs.push(() => document.removeEventListener("submit", onSubmit));

    // 한 번 틀린 칸은 입력할 때마다 다시 검사 (고치면 즉시 오류 해제)
    const onInput = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches("[data-catui-verify][aria-invalid=true]")) showError(t, check(t));
      // same:이름 으로 이 칸을 참조하는 확인 칸도 다시 검사
      if (t.name) formRoot(t).querySelectorAll(`[data-catui-verify*="same:${CSS.escape(t.name)}"][aria-invalid=true]`).forEach((c) => showError(c, check(c)));
      if (t.matches("input:not([type=checkbox]):not([type=radio]), textarea") && t.closest("[data-catui-form], [data-catui-filter]")) {
        const filter = t.getAttribute("data-catui-filter") || t.closest("[data-catui-filter]")?.getAttribute("data-catui-filter");
        emit(MOD, "input", filter, { elem: t, value: t.value, name: t.name });
      }
    };
    const onBlur = (e) => {
      const t = e.target;
      if (t.matches?.("[data-catui-verify]") && t.closest("[data-catui-form]") && t.value !== "") showError(t, check(t));
    };
    document.addEventListener("input", onInput);
    document.addEventListener("focusout", onBlur);
    offs.push(() => document.removeEventListener("input", onInput), () => document.removeEventListener("focusout", onBlur));

    const onChange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement) || !t.closest("[data-catui-form], [data-catui-filter]")) return;
      if (t.matches(".Catui_modal-toggle, .Catui_drawer-toggle")) return;   // 폼 안 모달 열기 체크박스는 폼 값이 아니다
      const filter = t.getAttribute("data-catui-filter") || t.closest("[data-catui-filter]")?.getAttribute("data-catui-filter");
      // 그룹 선택이 바뀌면 같은 name 중 오류 표시된 칸을 다시 검사
      if ((t.type === "checkbox" || t.type === "radio") && t.name) formRoot(t).querySelectorAll(`[name="${CSS.escape(t.name)}"][data-catui-verify][aria-invalid=true]`).forEach((c) => showError(c, check(c)));
      const base = { elem: t, value: t.value, othis: t };
      if (t.type === "checkbox") emit(MOD, t.getAttribute("role") === "switch" || t.nextElementSibling?.classList.contains("Catui_tgl") ? "switch" : "checkbox", filter, { ...base, checked: t.checked });
      else if (t.type === "radio") emit(MOD, "radio", filter, base);
      else if (t.tagName === "SELECT") emit(MOD, "select", filter, base);
    };
    document.addEventListener("change", onChange);
    offs.push(() => document.removeEventListener("change", onChange));
    return () => offs.forEach((f) => f());
  }

  return {
    verify, validate, val, render, bind, check, reset, serialize,
    on: (evt, fn) => onEvent(MOD, evt, fn),
    off: (evt) => offEvent(MOD, evt),
    // 프로그램 제출: form.submit('login', cb?) → 검증 후 submit 이벤트 발생 (data-catui-ajax 폼은 이어서 전송)
    submit(filter, cb) {
      const f = findRoot(filter);
      if (!f) { hint.error(`form.submit: data-catui-filter="${filter}" 요소가 없습니다`); return false; }
      if (sending.has(f) || !validate(f)) return false;
      const data = { elem: null, form: f, field: collect(f) };
      if (cb) { cb(data); return true; }
      if (emit(MOD, "submit", filter, data, f) && f instanceof HTMLFormElement && f.hasAttribute("data-catui-ajax")) send(f, filter, f.querySelector("[data-catui-submit]"));
      return true;
    },
    setError: (field, msg) => { const t = el(field); if (t) showError(t, msg); },
    clearError: (field) => { const t = el(field); if (t) showError(t, ""); },
  };
})();
