import { emit, onEvent, offEvent } from "../core/events.js";
import { el, icon } from "../core/dom.js";
import { hint } from "../core/base.js";

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
    url: [/^https?:\/\/[^\s/$.?#].[^\s]*$/i, "주소 형식이 아닙니다. 예: https://example.com"],
    number: (v) => (v === "" || Number.isFinite(Number(v)) ? "" : "숫자만 입력해 주세요."),
    date: [/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "날짜 형식이 아닙니다. 예: 2026-10-31"],
  };

  // 사용자 규칙 추가: form.verify({ name: [정규식, '메시지'] | (value, elem) => '오류 메시지' | '' })
  function verify(more) { Object.assign(rules, more || {}); return rules; }

  const fieldValue = (f) => (f.type === "checkbox" || f.type === "radio" ? (f.checked ? f.value : "") : f.value);

  function check(field) {
    const spec = field.getAttribute("data-catui-verify");
    if (!spec) return "";
    const value = fieldValue(field);
    for (const name of spec.split("|").map((s) => s.trim()).filter(Boolean)) {
      if (name !== "required" && value === "") continue;       // 빈 값은 required만 검사
      const rule = rules[name];
      if (!rule) { hint.errorOnce(`form: '${name}' 검증 규칙이 없습니다`); continue; }
      let msg = "";
      if (typeof rule === "function") msg = rule(value, field) || "";
      else if (!rule[0].test(value)) msg = rule[1];
      if (msg) {
        if (name === "required" && field.getAttribute("data-catui-reqtext")) return field.getAttribute("data-catui-reqtext");
        return msg;
      }
    }
    return "";
  }

  // 오류 표시: aria-invalid + 에러 문장(.Catui_error, 없으면 생성) + aria-describedby 연결
  function showError(field, msg) {
    if (!field.id) field.id = `catui-f-${Math.random().toString(36).slice(2, 8)}`;
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

  function validate(scope) {
    const root = el(scope);
    if (!root) return true;
    let first = null;
    for (const f of root.querySelectorAll("[data-catui-verify]")) {
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
    const root = document.querySelector(`[data-catui-filter="${CSS.escape(filter)}"]`);
    if (!root) { hint.error(`form.val: data-catui-filter="${filter}" 요소가 없습니다`); return {}; }
    if (values) {
      for (const [name, v] of Object.entries(values)) {
        root.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((f) => {
          if (f.type === "checkbox") f.checked = Array.isArray(v) ? v.includes(f.value) : !!v && (v === true || v === f.value || v === "on");
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
      if (e.submitter && f.querySelector("[data-catui-submit]") && !e.submitter.matches("[data-catui-submit]")) return;
      if (!validate(f)) { e.preventDefault(); return; }
      const filter = e.submitter?.getAttribute("data-catui-filter") || f.getAttribute("data-catui-filter");
      const ok = emit(MOD, "submit", filter, { elem: e.submitter || null, form: f, field: collect(f) }, e.submitter || f);
      if (!ok) e.preventDefault();
    };
    document.addEventListener("submit", onSubmit);
    offs.push(() => document.removeEventListener("submit", onSubmit));

    // 한 번 틀린 칸은 입력할 때마다 다시 검사 (고치면 즉시 오류 해제)
    const onInput = (e) => {
      const t = e.target;
      if (t.matches?.("[data-catui-verify][aria-invalid=true]")) showError(t, check(t));
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
      const filter = t.getAttribute("data-catui-filter") || t.closest("[data-catui-filter]")?.getAttribute("data-catui-filter");
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
    verify, validate, val, render, bind, check,
    on: (evt, fn) => onEvent(MOD, evt, fn),
    off: (evt) => offEvent(MOD, evt),
    // 프로그램 제출: form.submit('login', cb?) → 검증 후 submit 이벤트 발생
    submit(filter, cb) {
      const f = document.querySelector(`[data-catui-filter="${CSS.escape(filter)}"]`);
      if (!f || !validate(f)) return false;
      const data = { elem: null, form: f, field: collect(f) };
      if (cb) cb(data); else emit(MOD, "submit", filter, data);
      return true;
    },
    setError: showError,
  };
})();
