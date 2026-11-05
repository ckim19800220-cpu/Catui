import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, icon, uid } from "../core/dom.js";
import { emit } from "../core/events.js";

// rate — 별점. radio 그룹(화살표 키로 선택)을 만들고, 읽기 전용이면 role=img로 점수만 읽힌다.
//   rate.render({ elem: '#score', label: '만족도', length: 5, value: 4, text: true, choose(v) {} })
//   마크업의 <div class="Catui_rating" data-catui-filter="x">도 rate.on('choose(x)')를 낸다.
export const rate = component({
  name: "rate",
  config: { label: "", length: 5, value: 0, readonly: false, text: false, texts: ["별로예요", "아쉬워요", "보통이에요", "좋아요", "최고예요"], clearable: false, choose: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    const name = uid("catui-rate");
    // 별 개수는 1 이상 정수(5.5·NaN이면 별 수와 최대 점수가 어긋난다)
    c.length = Math.floor(Number(c.length)) >= 1 ? Math.floor(Number(c.length)) : 5;
    const word = (v) => (v ? `${v}점${c.texts[v - 1] ? ` · ${c.texts[v - 1]}` : ""}` : "선택 안 함");
    if (c.readonly) {
      // 3.6점처럼 소수면 별은 반올림(4개), 읽기 값은 소수 첫째 자리까지 그대로
      const v = Math.max(0, Math.min(c.length, Number(c.value) || 0)), shown = Math.round(v);
      inst.value = v;
      inst.getValue = () => v;
      inst.setValue = (nv) => { inst.reload({ value: nv }); };   // 읽기 전용도 값 바꾸기는 다시 그려서
      mount(inst.elem, html`<span class="Catui_rating" role="img" aria-label="${c.label ? `${c.label} ` : ""}${c.length}점 중 ${Math.round(v * 10) / 10}점">${Array.from({ length: c.length }, (_, i) => html`<span style="color:var(${i < shown ? "--Catui_rating-on" : "--Catui_rating-off"})">${icon("star", 16)}</span>`)}</span>`);
      return;
    }
    c.value = Math.max(0, Math.min(c.length, Math.round(Number(c.value) || 0)));   // setValue와 같은 범위(0~length)로
    mount(inst.elem, html`
<fieldset style="border:0;padding:0;margin:0">${c.label ? html`<legend class="Catui_label">${c.label}</legend>` : ""}
<div class="Catui_rating">${Array.from({ length: c.length }, (_, i) => html`<input class="Catui_clip" type="radio" name="${name}" id="${name}-${i + 1}" value="${i + 1}" ${i + 1 === c.value ? "checked" : ""}><label for="${name}-${i + 1}" aria-label="${word(i + 1)}">${icon("star", 16)}</label>`)}</div>
${c.text ? html`<p class="Catui_help" aria-live="polite" data-catui-word>${word(c.value)}</p>` : ""}
${c.clearable ? html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-catui-clear>지우기</button>` : ""}
</fieldset>`);
    const out = inst.elem.querySelector("[data-catui-word]");
    const set = (v, fire) => {
      inst.value = v;
      inst.elem.querySelectorAll("input").forEach((r) => { r.checked = Number(r.value) === v; });
      if (out) out.textContent = word(v);
      if (fire) { c.choose?.call(inst, v); inst.emit("choose", { value: v }); }
    };
    inst.value = c.value;
    const onChange = (e) => { if (e.target.name === name) set(Number(e.target.value), true); };
    const onClick = (e) => { if (e.target.closest("[data-catui-clear]")) set(0, true); };
    inst.elem.addEventListener("change", onChange);
    inst.elem.addEventListener("click", onClick);
    inst.setValue = (v) => set(Math.max(0, Math.min(c.length, Math.round(Number(v) || 0))), false);
    inst.getValue = () => inst.value;
    inst.use(() => { inst.elem.removeEventListener("change", onChange); inst.elem.removeEventListener("click", onClick); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  setValue(id, v) { rate.getThis(id)?.setValue?.(v); },
  getValue(id) { return rate.getThis(id)?.getValue?.() ?? 0; },
  bind() {
    const onChange = (e) => {
      const r = e.target;
      const box = r.closest?.(".Catui_rating[data-catui-filter]");
      if (!box || r.type !== "radio") return;
      emit("rate", "choose", box.getAttribute("data-catui-filter"), { value: Number(r.value), elem: box });
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  },
});
