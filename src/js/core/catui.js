import { config, getConfig, hint, data, sessionData, url, device } from "./base.js";
import { html, raw, escape } from "./html.js";
import { $, el, mount, icon } from "./dom.js";
import { onEvent, emit } from "./events.js";
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

// 전역 catui 객체 (layui에 해당).
//   <script src="ui/dist/catui.js"></script>
//   catui.use(['layer', 'form'], function (layer, form) { layer.msg('안녕하세요'); });
const catuiModules = { layer, form, laypage, table, tabs, dropdown, util, datePicker, upload, slider, rate, tree, collapse, canvas, fx };
let catuiReady = false;
let catuiOffs = [];

export const catui = {
  version: "1.0.0",
  config,
  get cache() { return { config: getConfig(), modules: Object.keys(catuiModules) }; },
  $, el, html, raw, escape, mount, icon, hint, data, sessionData, url, device, component,
  ...catuiModules,

  // 모듈 불러오기. 모두 한 파일에 들어 있으므로 즉시(문서 준비 후) 콜백한다. Promise도 돌려준다.
  use(mods, callback) {
    if (typeof mods === "function") { callback = mods; mods = []; }
    const list = [].concat(mods || []);
    const missing = list.filter((m) => !catuiModules[m]);
    if (missing.length) hint.error(`없는 모듈: ${missing.join(", ")} (catui.extend로 추가할 수 있습니다)`, "error");
    const args = list.map((m) => catuiModules[m]);
    return new Promise((resolve) => {
      const run = () => { callback?.apply(catui, args); resolve(args); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
    });
  },

  // 사용자 모듈 추가: catui.extend({ chart: myChart }) → catui.use('chart', fn) / catui.chart
  extend(obj) {
    for (const [name, mod] of Object.entries(obj || {})) {
      if (catuiModules[name]) { hint.error(`이미 있는 모듈 이름입니다: ${name}`); continue; }
      catuiModules[name] = mod;
      catui[name] = mod;
    }
    return catui;
  },
  // 정의형: catui.define('chart', ['layer'], (layer) => ({ ... }))
  define(name, deps, factory) {
    if (typeof deps === "function") { factory = deps; deps = []; }
    return catui.extend({ [name]: factory(...deps.map((d) => catuiModules[d])) });
  },

  // 어느 모듈이든 이벤트: catui.onevent('form', 'submit(login)', fn) / catui.event('form', 'submit', 'login', data)
  onevent: onEvent,
  event: emit,

  // data-catui-* 선언형 마크업 연결. 자동 1회 실행되며, 새로 그린 영역은 catui.init(영역)으로 다시 준비한다.
  init(scope = document) {
    if (!catuiReady) {
      catuiReady = true;
      catuiOffs = [form.bind(), tabs.bind(), table.bindStatic(), dropdown.bindDetails(), slider.bind(), rate.bind(), collapse.bind(), fx.bind()];
      const overlays = bindToggleOverlays();
      catuiOffs.push(overlays.off);
      catui._prepareOverlays = overlays.prepare;
    } else catui._prepareOverlays?.(scope);
    form.render(scope);
    table.enhance(scope);
    datePicker.enhance(scope);
    return catui;
  },
  // 전역 연결 해제 (테스트·SPA 정리용)
  destroy() {
    catuiOffs.forEach((f) => f());
    catuiOffs = [];
    catuiReady = false;
    layer.closeAll();
  },
};

// 자동 초기화: catui.config({ autoInit: false })로 끌 수 있다(스크립트 직후 호출)
const catuiAuto = () => { if (getConfig().autoInit && !catuiReady) catui.init(); };
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", catuiAuto, { once: true });
  else queueMicrotask(catuiAuto);
}
