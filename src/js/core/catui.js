import { config, getConfig, hint, data, sessionData, url, device, csrfHeaders } from "./base.js";
import { VERSION } from "./env.js";
import { html, raw, escape } from "./html.js";
import { $, el, mount, icon, scopeOf, imeBusy } from "./dom.js";
import { onEvent, offEvent, emit } from "./events.js";
import { component } from "./component.js";
import { bindToggleOverlays } from "./init.js";
import { layer } from "../modules/layer.js";
import { form } from "../modules/form.js";
import { laypage } from "../modules/laypage.js";
import { table } from "../modules/table.js";
import { tabs } from "../modules/tabs.js";
import { dropdown } from "../modules/dropdown.js";
import { util } from "../modules/util.js";
import { datePicker } from "../modules/datePicker.js";
import { upload } from "../modules/upload.js";
import { slider } from "../modules/slider.js";
import { rate } from "../modules/rate.js";
import { tree } from "../modules/tree.js";
import { collapse } from "../modules/collapse.js";
import { canvas } from "../modules/canvas.js";
import { fx } from "../modules/fx.js";
import { carousel } from "../modules/carousel.js";
import { field } from "../modules/field.js";
import { autocomplete } from "../modules/autocomplete.js";
import { command } from "../modules/command.js";
import { page } from "../modules/page.js";
import { site } from "../modules/site.js";

// 전역 catui 객체 (layui에 해당).
//   <script src="ui/dist/catui.js"></script>
//   catui.use(['layer', 'form'], function (layer, form) { layer.msg('안녕하세요'); });
const catuiModules = { layer, form, laypage, table, tabs, dropdown, util, datePicker, upload, slider, rate, tree, collapse, canvas, fx, carousel, field, autocomplete, command, page, site };
let catuiReady = false;
let catuiOffs = [];
let catuiPrepareOverlays = null;
let catuiWatchOff = null;
// autoDestroy 설정과 감시 상태를 맞춘다 — init 뒤에 catui.config({ autoDestroy })로 바꿔도 켜고 끌 수 있게
function catuiSyncWatch() {
  const want = !!getConfig().autoDestroy && catuiReady;
  if (want && !catuiWatchOff) catuiWatchOff = catuiWatchDetached();
  else if (!want && catuiWatchOff) { catuiWatchOff(); catuiWatchOff = null; }
}

// 자동 정리: DOM에서 노드가 빠지면 다음 틱에 모든 모듈의 destroyDetached() 실행.
// 다음 틱까지 미루므로 같은 작업 안에서 떼었다 다시 붙인(이동한) 요소는 정리되지 않는다.
function catuiWatchDetached() {
  if (typeof MutationObserver === "undefined" || !document.body) return null;
  let timer = 0;
  const sweep = () => {
    timer = 0;
    Object.values(catuiModules).forEach((m) => { try { m?.destroyDetached?.(); } catch (err) { hint.error("자동 정리 중 오류", "error", err); } });
  };
  const mo = new MutationObserver((records) => {
    if (timer || !records.some((r) => r.removedNodes.length)) return;
    timer = setTimeout(sweep, 0);
  });
  mo.observe(document.body, { childList: true, subtree: true });
  return () => { mo.disconnect(); clearTimeout(timer); };
}

export const catui = {
  version: VERSION,
  config(options) { const r = config(options); if (options && "autoDestroy" in options) catuiSyncWatch(); return r; },
  get cache() { return { config: getConfig(), modules: Object.keys(catuiModules) }; },
  $, el, html, raw, escape, mount, icon, hint, data, sessionData, url, device, component, csrfHeaders,
  imeBusy,   // 한글 조합 중(확정 직후 150ms 포함)인 키 입력인지 — 확장(admin·community)도 같은 기준을 쓰게
  ...catuiModules,

  // 모듈 불러오기. 모두 한 파일에 들어 있으므로 즉시(문서 준비 후) 콜백한다. Promise도 돌려준다.
  use(mods, callback) {
    if (typeof mods === "function") { callback = mods; mods = []; }
    const list = [].concat(mods || []);
    const missing = list.filter((m) => !catuiModules[m]);
    if (missing.length) hint.error(`없는 모듈: ${missing.join(", ")} (catui.extend로 추가할 수 있습니다)`, "error");
    const args = list.map((m) => catuiModules[m]);
    return new Promise((resolve, reject) => {
      // 콜백 오류는 Promise를 거부한다(DOMContentLoaded 뒤 실행돼도 대기 상태로 남지 않게)
      const run = () => { try { callback?.apply(catui, args); resolve(args); } catch (err) { reject(err); } };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
    });
  },

  // 사용자 모듈 추가: catui.extend({ chart: myChart }) → catui.use('chart', fn) / catui.chart
  extend(obj) {
    for (const [name, mod] of Object.entries(obj || {})) {
      if (catuiModules[name]) { hint.error(`이미 있는 모듈 이름입니다: ${name}`); continue; }
      if (name in catui) { hint.error(`catui의 기본 API 이름은 모듈 이름으로 쓸 수 없습니다: ${name}`, "error"); continue; }
      catuiModules[name] = mod;
      catui[name] = mod;
    }
    return catui;
  },
  // 정의형: catui.define('chart', ['layer'], (layer) => ({ ... }))
  define(name, deps, factory) {
    if (typeof deps === "function") { factory = deps; deps = []; }
    const missing = deps.filter((d) => !catuiModules[d]);
    if (missing.length) { hint.error(`define('${name}'): 없는 의존 모듈 ${missing.join(", ")} — 먼저 정의해 주세요`, "error"); return catui; }
    return catui.extend({ [name]: factory(...deps.map((d) => catuiModules[d])) });
  },

  // 어느 모듈이든 이벤트: catui.onevent('form', 'submit(login)', fn) / catui.event('form', 'submit', 'login', data)
  onevent: onEvent,
  offevent: offEvent,
  event: emit,

  // data-catui-* 선언형 마크업 연결. 자동 1회 실행되며, 새로 그린 영역은 catui.init(영역)으로 다시 준비한다.
  init(scope = document) {
    const root = scopeOf(scope);   // 선택자 문자열·요소·document 모두 허용
    if (!root) { hint.error(`catui.init: 영역을 찾을 수 없습니다 (${scope})`); return catui; }
    if (!catuiReady) {
      catuiReady = true;
      catuiOffs = [form.bind(), tabs.bind(), table.bind(), dropdown.bind(), slider.bind(), rate.bind(), collapse.bind(), page.bind(), site.bind()].filter((f) => typeof f === "function");
      const overlays = bindToggleOverlays();
      catuiOffs.push(overlays.off);
      catuiPrepareOverlays = overlays.prepare;
      catuiSyncWatch();
    }
    // 한 모듈의 준비가 실패해도 나머지 모듈은 계속 준비한다 (오류는 콘솔에)
    const steps = [["overlays", () => catuiPrepareOverlays?.(root)], ["fx", () => fx.enhance(root)], ["form", () => form.render(root)], ["table", () => table.enhance(root)], ["datePicker", () => datePicker.enhance(root)],
      ["carousel", () => carousel.enhance(root)], ["field", () => field.enhance(root)], ["page", () => page.enhance(root)], ["site", () => site.enhance(root)]];
    for (const [name, run] of steps) { try { run(); } catch (err) { hint.error(`catui.init: ${name} 준비 중 오류`, "error", err); } }
    return catui;
  },
  // 전역 연결 해제 + 렌더한 인스턴스·열린 레이어 정리 (테스트·SPA 정리용)
  destroy() {
    catuiOffs.forEach((f) => { try { f(); } catch { /* 해제 실패 무시 */ } });
    catuiOffs = [];
    catuiPrepareOverlays = null;
    catuiReady = false;
    catuiSyncWatch();   // 감시도 끈다
    Object.values(catuiModules).forEach((m) => { try { m?.destroyAll?.(); } catch { /* 사용자 모듈 오류 무시 */ } });
    layer.closeAll();
  },
};

// 자동 초기화: catui.config({ autoInit: false })로 끌 수 있다(스크립트 직후 호출)
const catuiAuto = () => { if (getConfig().autoInit && !catuiReady) catui.init(); };
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", catuiAuto, { once: true });
  else queueMicrotask(catuiAuto);
}
