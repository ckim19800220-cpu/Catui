// listpage — 목록 화면: 필터 폼 ↔ 주소(?q=…) 동기화 · 로컬 거르기 · 일괄 작업 바
//   admin.list({ table: 'orders', form: '#orders-filter', data: rows, match(row, v) { return … }, bulkbar: '#orders-bulk' })
//   · 새로 고침·뒤로 가기·주소 공유 시 같은 조건으로 다시 걸러진다 (history.replaceState / popstate)
//   · 표 선택 수에 맞춰 일괄 작업 바(.Catui_bulkbar)를 보이고 "N건 선택됨"을 알린다
//   반환: { apply(), values(), reset(), rows() }
admin.list = function (opt) {
  const f = catui.el(opt.form), id = opt.table;
  const bar = opt.bulkbar ? catui.el(opt.bulkbar) : null;
  const keys = () => [...new Set([...(f?.elements || [])].map((x) => x.name).filter(Boolean))];
  const values = () => (f ? catui.form.val(f.getAttribute("data-catui-filter") || f.id) : {});
  const fromUrl = () => {
    if (!f) return;
    const q = new URLSearchParams(location.search);
    keys().forEach((k) => {
      const els = [...f.elements].filter((x) => x.name === k);
      const v = q.getAll(k);
      // 주소에 값이 없으면 처음 마크업의 기본값으로 (select는 defaultSelected 옵션)
      const initial = (x) => (x.tagName === "SELECT" ? ([...x.options].find((o) => o.defaultSelected) || x.options[0])?.value ?? "" : x.defaultValue);
      els.forEach((x) => { if (x.type === "checkbox" || x.type === "radio") x.checked = v.length ? v.includes(x.value) : x.defaultChecked; else x.value = v[0] ?? initial(x); });
    });
  };
  const toUrl = (v) => {
    const q = new URLSearchParams(location.search);
    keys().forEach((k) => q.delete(k));
    Object.entries(v).forEach(([k, val]) => [].concat(val).filter((x) => x !== "" && x != null).forEach((x) => q.append(k, x)));
    const s = q.toString();
    history.replaceState(null, "", `${location.pathname}${s ? `?${s}` : ""}${location.hash}`);
  };
  let shown = opt.data || [];
  const apply = (push = true) => {
    const v = values();
    shown = (opt.data || []).filter((r) => (opt.match ? opt.match(r, v) : true));
    catui.table.reload(id, { data: shown });
    if (push) toUrl(v);
    syncBar();
    opt.change?.(shown, v);
    return shown;
  };
  const syncBar = () => {
    if (!bar) return;
    const n = catui.table.checkStatus(id)?.data?.length || 0;
    bar.hidden = !n;
    const c = bar.querySelector("[data-catui-adm-count-sel]");
    if (c) c.textContent = `${n}건 선택됨`;
  };
  if (f) {
    admin._on(f, "submit", (e) => { e.preventDefault(); apply(); });
    admin._on(f, "reset", () => setTimeout(() => apply(), 0));
    // 고르는 칸(select·checkbox·radio)은 바로 반영
    admin._on(f, "change", (e) => { if (e.target.matches("select, input[type=checkbox], input[type=radio]")) apply(); });
  }
  admin._on(window, "popstate", () => { fromUrl(); apply(false); });
  admin._offs.push(catui.table.on(`checkbox(${id})`, () => setTimeout(syncBar, 0)));
  if (bar) {
    admin._on(bar, "click", (e) => { if (e.target.closest("[data-catui-adm-clear-sel]")) { catui.table.clearChecked(id); syncBar(); } });
  }
  fromUrl();
  apply(false);
  return { apply, values, rows: () => shown, reset: () => f?.reset() };
};
