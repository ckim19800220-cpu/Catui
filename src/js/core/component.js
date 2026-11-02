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
  const byElem = new WeakMap();   // id 없는 대상에 다시 렌더해도 이전 인스턴스를 찾아 정리하기 위함

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
      if ("elem" in options) {
        if (byElem.get(this.elem) === this) byElem.delete(this.elem);
        this.elem = el(this.config.elem);
        if (this.elem) byElem.set(this.elem, this);
      }
      def.render(this);
      return this;
    }
    teardown() {
      this.cleanups.splice(0).reverse().forEach((f) => { try { f(); } catch { /* 해제 실패 무시 */ } });
    }
    destroy() {
      this.teardown();
      def.destroy?.(this);
      if (instances.get(this.id) === this) instances.delete(this.id);
      if (this.elem && byElem.get(this.elem) === this) byElem.delete(this.elem);
    }
  }

  const api = {
    CONST: { MOD_NAME: name, ...(def.CONST || {}) },
    Class: Instance,
    render(options = {}) {
      const target = el(options.elem);
      const prev = instances.get(options.id || target?.id) || (target && byElem.get(target));
      if (prev) prev.destroy();              // 같은 대상에 다시 렌더하면 이전 인스턴스 정리
      const inst = new Instance(options);
      def.beforeRender?.(inst);
      try { def.render(inst); } catch (err) { inst.teardown(); throw err; }   // 그리다 실패하면 붙인 리스너 회수
      instances.set(inst.id, inst);
      if (inst.elem) byElem.set(inst.elem, inst);
      inst.config.done?.call(inst, inst);
      return inst;
    },
    reload(id, options) { const inst = instances.get(id); if (!inst) { hint.error(`${name}: id '${id}' 인스턴스가 없습니다`); return null; } return inst.reload(options); },
    getThis(id) { return instances.get(id) || null; },
    destroy(id) { instances.get(id)?.destroy(); },
    // 모든 인스턴스 정리 (catui.destroy · SPA 화면 전환용). DOM에서 빠진 대상만 정리하려면 destroyDetached()
    destroyAll() { [...instances.values()].forEach((i) => i.destroy()); },
    // keep: true로 렌더한 인스턴스는 잠시 떼었다 다시 붙이는 용도(탭 캐시 등)로 보고 남긴다
    destroyDetached() { [...instances.values()].forEach((i) => { if (i.elem && !i.elem.isConnected && !i.config.keep) i.destroy(); }); },
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
