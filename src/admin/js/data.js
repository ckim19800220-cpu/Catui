// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.admin.data('orders').then((rows) => …)       data/orders.json 을 한 번만 읽어 캐시
//   catui.admin.dataBase = '/api/'                      주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   선언형: <section data-catui-adm-src="dashboard-ops">  안에서
//     <b data-catui-adm-text="kpi.users.value" data-catui-adm-format="number|won|man|percent|delta">  값 채우기
//     <div data-catui-adm-chart="area" data-catui-adm-key="charts.network">                        차트 자료
//   점 경로(a.b.0.c)로 JSON 안을 가리킨다. 실패하면 칸은 그대로 두고 콘솔에 한 줄 안내.
admin.dataBase = "data/";
admin._dataCache = new Map();
admin.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiAdmin: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
// 점 경로로 값 꺼내기
admin.pick = (obj, path) => String(path || "").split(".").filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
// 표시 형식
admin.format = function (v, kind) {
  if (v == null || v === "") return "";
  const n = Number(v);
  switch (kind) {
    case "number": return catui.util.number(n);
    case "won": return `${catui.util.number(n)}원`;
    case "man": return `${catui.util.number(Math.round(n / 10000))}만원`;
    case "percent": return `${n}%`;
    case "delta": return `${n > 0 ? "▲" : n < 0 ? "▼" : ""} ${Math.abs(n)}%`.trim();
    default: return String(v);
  }
};
admin.bind = function (scope = document) {
  const boxes = [...scope.querySelectorAll("[data-catui-adm-src]")];
  return Promise.all(boxes.map((box) => this.data(box.getAttribute("data-catui-adm-src")).then((json) => {
    box.querySelectorAll("[data-catui-adm-text]").forEach((el) => {
      const v = this.pick(json, el.getAttribute("data-catui-adm-text"));
      if (v !== undefined) el.textContent = this.format(v, el.getAttribute("data-catui-adm-format"));
    });
    box.querySelectorAll("[data-catui-adm-chart][data-catui-adm-key]").forEach((el) => {
      const d = this.pick(json, el.getAttribute("data-catui-adm-key"));
      if (d) el.setAttribute("data-catui-adm-data", JSON.stringify(d));
    });
    box.setAttribute("data-catui-adm-bound", "");
    admin.emit("data", { name: box.getAttribute("data-catui-adm-src"), data: json, box });
    return json;
  }).catch(() => null)));
};
