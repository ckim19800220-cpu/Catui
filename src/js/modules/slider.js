import { component } from "../core/component.js";
import { html } from "../core/html.js";
import { mount, uid } from "../core/dom.js";
import { emit } from "../core/events.js";
import { hint } from "../core/base.js";

// slider — 슬라이더. 네이티브 <input type=range class=Catui_range>를 만들어 키보드·스크린리더 지원을 그대로 쓴다.
//   slider.render({ elem: '#vol', label: '음량', min: 0, max: 100, step: 10, value: 50, ticks: true,
//                   setTips: (v) => `${v}%`, change(v) {} })
//   마크업의 <input class="Catui_range" data-catui-filter="x">도 slider.on('change(x)')·'input(x)'를 낸다.
export const slider = component({
  name: "slider",
  config: { label: "", min: 0, max: 100, step: 1, value: 0, ticks: false, scale: true, tips: true, disabled: false, setTips: null, change: null, input: null },
  render(inst) {
    const c = inst.config;
    if (!inst.elem) return;
    const id = uid("catui-slider");
    const tip = (v) => (c.setTips ? c.setTips(Number(v)) : String(v));
    // step 0·음수·min>max면 눈금 계산이 Infinity·NaN이 되므로 바로잡는다
    const step = Number(c.step) > 0 ? Number(c.step) : 1;
    c.min = Number.isFinite(Number(c.min)) ? Number(c.min) : 0;
    c.max = Number.isFinite(Number(c.max)) ? Number(c.max) : 100;
    if (c.max < c.min) [c.min, c.max] = [c.max, c.min];
    // 범위 안으로 + step 눈금에 맞춤(브라우저 range가 값을 눈금으로 옮기므로 표시·aria도 같은 값이어야 한다)
    const clamp = (v) => {
      const x = Math.min(c.max, Math.max(c.min, Number(v) || 0));
      return Math.min(c.max, +(c.min + Math.round((x - c.min) / step) * step).toFixed(10));
    };
    c.value = clamp(c.value);
    if (!c.label) hint.error("slider: label이 없어 화면 낭독기가 슬라이더 이름을 읽지 못합니다", "warn", inst.elem);
    const count = Math.min(21, Math.floor((c.max - c.min) / step) + 1);
    mount(inst.elem, html`
<div class="Catui_field">
  <label class="Catui_label" for="${id}">${c.label}${c.tips ? html` <output for="${id}" class="Catui_num" data-catui-tip>${tip(c.value)}</output>` : ""}</label>
  <input class="Catui_range" id="${id}" type="range" min="${c.min}" max="${c.max}" step="${step}" value="${c.value}" aria-valuetext="${tip(c.value)}" ${c.disabled ? "disabled" : ""}>
  ${c.ticks && count > 1 ? html`<div class="Catui_range-ticks" aria-hidden="true">${Array.from({ length: count }, () => html`<i></i>`)}</div>` : ""}
  ${c.scale ? html`<div class="Catui_range-scale" aria-hidden="true"><span>${tip(c.min)}</span><span>${tip(c.max)}</span></div>` : ""}
</div>`);
    const input = inst.elem.querySelector("input");
    const out = inst.elem.querySelector("[data-catui-tip]");
    const sync = () => { const t = tip(input.value); if (out) out.textContent = t; input.setAttribute("aria-valuetext", t); };
    const onInput = () => { sync(); c.input?.call(inst, Number(input.value)); inst.emit("input", { value: Number(input.value) }); };
    const onChange = () => { c.change?.call(inst, Number(input.value)); inst.emit("change", { value: Number(input.value) }); };
    input.addEventListener("input", onInput);
    input.addEventListener("change", onChange);
    inst.input = input;
    inst.setValue = (v) => { input.value = String(clamp(v)); sync(); onChange(); };
    inst.getValue = () => Number(input.value);
    inst.setDisabled = (on) => { c.disabled = !!on; input.disabled = c.disabled; };
    inst.use(() => { input.removeEventListener("input", onInput); input.removeEventListener("change", onChange); });
  },
  destroy(inst) { if (inst.elem) inst.elem.textContent = ""; },
  setValue(id, v) { slider.getThis(id)?.setValue(v); },
  getValue(id) { return slider.getThis(id)?.getValue() ?? null; },
  // 마크업의 range에도 이벤트를 낸다
  bind() {
    const handler = (type) => (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.type !== "range" || !t.matches(".Catui_range[data-catui-filter]")) return;
      emit("slider", type, t.getAttribute("data-catui-filter"), { value: Number(t.value), elem: t });
    };
    const onInput = handler("input"), onChange = handler("change");
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    return () => { document.removeEventListener("input", onInput); document.removeEventListener("change", onChange); };
  },
});
