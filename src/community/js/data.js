// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.community.data('orders').then((rows) => …)       data/orders.json 을 한 번만 읽어 캐시
//   catui.community.dataBase = '/api/'                      주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   선언형: <section data-catui-cm-src="dashboard-ops">  안에서
//     <b data-catui-cm-text="kpi.users.value" data-catui-cm-format="number|won|man|percent|delta">  값 채우기
//     <div data-catui-cm-chart="area" data-catui-cm-key="charts.network">                        차트 자료
//   점 경로(a.b.0.c)로 JSON 안을 가리킨다. 실패하면 칸은 그대로 두고 콘솔에 한 줄 안내.
community.dataBase = "data/";
community.derive = {};
community._dataCache = new Map();
community.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiCommunity: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
// 점 경로로 값 꺼내기
community.pick = (obj, path) => String(path || "").split(".").filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
// 표시 형식
community.format = function (v, kind) {
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
    case "compact": return n >= 1e4 ? `${(Math.floor(n / 1e3) / 10).toLocaleString("ko-KR")}만` : n >= 1e3 ? `${(Math.floor(n / 100) / 10)}천` : String(n);   // 1.2만 · 3.4천
    case "ago": return community.ago(v);   // 방금 · 3분 전 · 어제 · 10월 30일
    default: return String(v);
  }
};
community.bind = function (scope = document) {
  const boxes = [...scope.querySelectorAll("[data-catui-cm-src]")];
  return Promise.all(boxes.map((box) => this.data(box.getAttribute("data-catui-cm-src")).then((raw) => {
    // 파생 값: catui.community.derive['이름'] = (json) => ({ …json, 합계 }) — 비율·합계를 원자료에서 계산해 채운다
    const fn = this.derive[box.getAttribute("data-catui-cm-src")];
    const json = fn ? (fn(structuredClone(raw)) ?? raw) : raw;
    const own = (sel) => [...(box.matches(sel) ? [box] : []), ...box.querySelectorAll(sel)];   // 자기 자신에 붙인 바인딩도
    own("[data-catui-cm-text]").forEach((el) => {
      const v = this.pick(json, el.getAttribute("data-catui-cm-text"));
      if (v !== undefined) el.textContent = this.format(v, el.getAttribute("data-catui-cm-format"));
    });
    own("[data-catui-cm-chart][data-catui-cm-key]").forEach((el) => {
      const d = this.pick(json, el.getAttribute("data-catui-cm-key"));
      if (d) el.setAttribute("data-catui-cm-data", JSON.stringify(d));
    });
    // 행 바인딩: <tbody data-catui-cm-rows="topPages"><template><tr>…</tr></template></tbody>
    //   [data-catui-cm-field="name" data-catui-cm-format?]  글자 · [data-catui-cm-field-data="trend"] 차트 자료
    //   [data-catui-cm-class="Catui_pill-:tone"]  행 값으로 클래스 붙이기 (글자만 넣으므로 마크업 주입 없음)
    own("[data-catui-cm-rows]").forEach((list) => this._rows(list, json));
    box.setAttribute("data-catui-cm-bound", "");
    community.emit("data", { name: box.getAttribute("data-catui-cm-src"), data: json, box });
    return json;
  }).catch(() => null)));
};
// 행 바인딩 (중첩 가능): <… data-catui-cm-rows="경로"><template>한 행</template></…>
community._rows = function (list, json) {
  const tpl = list.querySelector("template"), rows = this.pick(json, list.getAttribute("data-catui-cm-rows"));
  if (!tpl || !Array.isArray(rows)) return;
  [...list.children].forEach((c) => { if (c !== tpl) c.remove(); });
  rows.forEach((row) => {
    const frag = tpl.content.cloneNode(true);
    frag.querySelectorAll("[data-catui-cm-field]").forEach((el) => { el.textContent = this.format(this.pick(row, el.getAttribute("data-catui-cm-field")), el.getAttribute("data-catui-cm-format")); });
    frag.querySelectorAll("[data-catui-cm-field-data]").forEach((el) => { el.setAttribute("data-catui-cm-data", JSON.stringify(this.pick(row, el.getAttribute("data-catui-cm-field-data")))); });
    frag.querySelectorAll("[data-catui-cm-class]").forEach((el) => { const [pre, key] = el.getAttribute("data-catui-cm-class").split(":"); const v = this.pick(row, key); if (v) el.classList.add(`${pre}${String(v).replace(/[^\w-]/g, "")}`); });
    // 속성 치환: data-catui-cm-attr="aria-label:{name} 메뉴;title:{email}"
    frag.querySelectorAll("[data-catui-cm-attr]").forEach((el) => {
      el.getAttribute("data-catui-cm-attr").split(";").forEach((pair) => { const i = pair.indexOf(":"); if (i > 0) el.setAttribute(pair.slice(0, i).trim(), pair.slice(i + 1).replace(/\{(\w+)\}/g, (_, k) => row[k] ?? "")); });
      el.removeAttribute("data-catui-cm-attr");
    });
    // 참·거짓 속성: data-catui-cm-bool="checked:done"
    frag.querySelectorAll("[data-catui-cm-bool]").forEach((el) => {
      el.getAttribute("data-catui-cm-bool").split(";").forEach((pair) => { const [a, k] = pair.split(":"); if (a && k) el.toggleAttribute(a.trim(), !!this.pick(row, k.trim())); });
      el.removeAttribute("data-catui-cm-bool");
    });
    frag.querySelectorAll("[data-catui-cm-label]").forEach((el) => { el.setAttribute("data-catui-cm-label", el.getAttribute("data-catui-cm-label").replace(/\{(\w+)\}/g, (_, k) => row[k] ?? "")); });
    frag.querySelectorAll("[data-catui-cm-rows]").forEach((sub) => this._rows(sub, row));   // 행 안의 하위 목록 (예: 요금제별 기능)
    list.appendChild(frag);
  });
};
// 상대 시간: 1분 미만 방금 · 시간 전 · 어제 · 이번 해는 월 일 · 그 전은 년.월.일 (기준 시각 community.now — 모의 데이터는 고정 시각)
community.now = () => (community.fixedNow ? new Date(community.fixedNow) : new Date());
community.ago = function (iso) {
  const t = new Date(iso), now = this.now(), s = Math.round((now - t) / 1000);
  if (Number.isNaN(s)) return String(iso);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400 && t.getDate() === now.getDate()) return `${Math.floor(s / 3600)}시간 전`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (t.toDateString() === y.toDateString()) return "어제";
  if (t.getFullYear() === now.getFullYear()) return `${t.getMonth() + 1}월 ${t.getDate()}일`;
  return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, "0")}.${String(t.getDate()).padStart(2, "0")}`;
};
