// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.admin.data('orders').then((rows) => …)       data/orders.json 을 한 번만 읽어 캐시
//   catui.admin.dataBase = '/api/'                      주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   선언형: <section data-catui-adm-src="dashboard-ops">  안에서
//     <b data-catui-adm-text="kpi.users.value" data-catui-adm-format="number|won|man|percent|delta">  값 채우기
//     <div data-catui-adm-chart="area" data-catui-adm-key="charts.network">                        차트 자료
//   점 경로(a.b.0.c)로 JSON 안을 가리킨다. 실패하면 칸은 그대로 두고 콘솔에 한 줄 안내.
admin.dataBase = "data/";
admin.derive = {};
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
    case "ms": return `${catui.util.number(n)}ms`;
    case "initial": return String(v).trim().slice(0, 1);   // 아바타 글자
    default: return String(v);
  }
};
admin.bind = function (scope = document) {
  const boxes = [...scope.querySelectorAll("[data-catui-adm-src]")];
  return Promise.all(boxes.map((box) => this.data(box.getAttribute("data-catui-adm-src")).then((raw) => {
    // 파생 값: catui.admin.derive['이름'] = (json) => ({ …json, 합계 }) — 비율·합계를 원자료에서 계산해 채운다
    const fn = this.derive[box.getAttribute("data-catui-adm-src")];
    const json = fn ? (fn(structuredClone(raw)) ?? raw) : raw;
    const own = (sel) => [...(box.matches(sel) ? [box] : []), ...box.querySelectorAll(sel)];   // 자기 자신에 붙인 바인딩도
    own("[data-catui-adm-text]").forEach((el) => {
      const v = this.pick(json, el.getAttribute("data-catui-adm-text"));
      if (v !== undefined) el.textContent = this.format(v, el.getAttribute("data-catui-adm-format"));
    });
    own("[data-catui-adm-chart][data-catui-adm-key]").forEach((el) => {
      const d = this.pick(json, el.getAttribute("data-catui-adm-key"));
      if (d) el.setAttribute("data-catui-adm-data", JSON.stringify(d));
    });
    // 행 바인딩: <tbody data-catui-adm-rows="topPages"><template><tr>…</tr></template></tbody>
    //   [data-catui-adm-field="name" data-catui-adm-format?]  글자 · [data-catui-adm-field-data="trend"] 차트 자료
    //   [data-catui-adm-class="Catui_pill-:tone"]  행 값으로 클래스 붙이기 (글자만 넣으므로 마크업 주입 없음)
    own("[data-catui-adm-rows]").forEach((list) => this._rows(list, json));
    box.setAttribute("data-catui-adm-bound", "");
    admin.emit("data", { name: box.getAttribute("data-catui-adm-src"), data: json, box });
    return json;
  }).catch(() => null)));
};
// 행 바인딩 (중첩 가능): <… data-catui-adm-rows="경로"><template>한 행</template></…>
admin._rows = function (list, json) {
  const tpl = list.querySelector("template"), rows = this.pick(json, list.getAttribute("data-catui-adm-rows"));
  if (!tpl || !Array.isArray(rows)) return;
  [...list.children].forEach((c) => { if (c !== tpl) c.remove(); });
  rows.forEach((row) => {
    const frag = tpl.content.cloneNode(true);
    frag.querySelectorAll("[data-catui-adm-field]").forEach((el) => { el.textContent = this.format(this.pick(row, el.getAttribute("data-catui-adm-field")), el.getAttribute("data-catui-adm-format")); });
    frag.querySelectorAll("[data-catui-adm-field-data]").forEach((el) => { el.setAttribute("data-catui-adm-data", JSON.stringify(this.pick(row, el.getAttribute("data-catui-adm-field-data")))); });
    frag.querySelectorAll("[data-catui-adm-class]").forEach((el) => { const [pre, key] = el.getAttribute("data-catui-adm-class").split(":"); const v = this.pick(row, key); if (v) el.classList.add(`${pre}${String(v).replace(/[^\w-]/g, "")}`); });
    // 속성 치환: data-catui-adm-attr="aria-label:{name} 메뉴;title:{email}"
    frag.querySelectorAll("[data-catui-adm-attr]").forEach((el) => {
      el.getAttribute("data-catui-adm-attr").split(";").forEach((pair) => { const i = pair.indexOf(":"); if (i > 0) el.setAttribute(pair.slice(0, i).trim(), pair.slice(i + 1).replace(/\{(\w+)\}/g, (_, k) => row[k] ?? "")); });
      el.removeAttribute("data-catui-adm-attr");
    });
    // 참·거짓 속성: data-catui-adm-bool="checked:done"
    frag.querySelectorAll("[data-catui-adm-bool]").forEach((el) => {
      el.getAttribute("data-catui-adm-bool").split(";").forEach((pair) => { const [a, k] = pair.split(":"); if (a && k) el.toggleAttribute(a.trim(), !!this.pick(row, k.trim())); });
      el.removeAttribute("data-catui-adm-bool");
    });
    frag.querySelectorAll("[data-catui-adm-label]").forEach((el) => { el.setAttribute("data-catui-adm-label", el.getAttribute("data-catui-adm-label").replace(/\{(\w+)\}/g, (_, k) => row[k] ?? "")); });
    frag.querySelectorAll("[data-catui-adm-rows]").forEach((sub) => this._rows(sub, row));   // 행 안의 하위 목록 (예: 요금제별 기능)
    list.appendChild(frag);
  });
};
