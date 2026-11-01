import { onEvent, offEvent, emit } from "./events.js";
import { el, uid } from "./dom.js";
import { hint } from "./base.js";

// 컴포넌트 빌더 (layui.component에 해당). 모든 렌더형 컴포넌트가 같은 인터페이스를 갖는다:
//   comp.render(options) → 인스턴스 { id, config, reload(opts), destroy() }
//   comp.reload(id, opts) / comp.getThis(id) / comp.destroy(id) / comp.on(evt, fn) / comp.set(defaults)
// 정의: component({ name, config, render(inst), destroy?(inst), ...extra })
export function component(def) {
  const name = def.name;
  const defaults = { ...(def.config || {}) };
  const instances = new Map();

  class Instance {
    constructor(options) {
      this.config = { ...defaults, ...options };
      this.elem = el(this.config.elem);
      if (this.config.elem && !this.elem) hint.error(`${name}: elem을 찾을 수 없습니다 (${this.config.elem})`);
      this.id = this.config.id || this.elem?.id || uid(name);
      this.filter = this.config.filter || this.elem?.getAttribute("data-catui-filter") || this.id;
      this.cleanups = [];
    }
    use(fn) { if (typeof fn === "function") this.cleanups.push(fn); return fn; }
    emit(evt, payload) { return emit(name, evt, this.filter, { ...payload, config: this.config }, this.elem); }
    reload(options = {}) {
      this.teardown();
      this.config = { ...this.config, ...options };
      def.render(this);
      return this;
    }
    teardown() {
      this.cleanups.splice(0).reverse().forEach((f) => { try { f(); } catch { /* 해제 실패 무시 */ } });
    }
    destroy() {
      this.teardown();
      def.destroy?.(this);
      instances.delete(this.id);
    }
  }

  const api = {
    CONST: { MOD_NAME: name, ...(def.CONST || {}) },
    Class: Instance,
    render(options = {}) {
      const prev = instances.get(options.id || el(options.elem)?.id);
      if (prev) prev.destroy();              // 같은 대상에 다시 렌더하면 이전 인스턴스 정리
      const inst = new Instance(options);
      def.beforeRender?.(inst);
      def.render(inst);
      instances.set(inst.id, inst);
      inst.config.done?.call(inst, inst);
      return inst;
    },
    reload(id, options) { const inst = instances.get(id); if (!inst) { hint.error(`${name}: id '${id}' 인스턴스가 없습니다`); return null; } return inst.reload(options); },
    getThis(id) { return instances.get(id) || null; },
    destroy(id) { instances.get(id)?.destroy(); },
    on(evt, fn) { return onEvent(name, evt, fn); },
    off(evt) { offEvent(name, evt); },
    set(options) { Object.assign(defaults, options); return api; },
    get config() { return { ...defaults }; },
  };
  for (const [k, v] of Object.entries(def)) {
    if (!["name", "config", "render", "destroy", "beforeRender", "CONST"].includes(k)) api[k] = v;
  }
  return api;
}
