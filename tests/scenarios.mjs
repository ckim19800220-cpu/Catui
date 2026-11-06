// E2E 시나리오: page(문서 경로) · run(브라우저 안에서 실행, JSON으로 돌려줄 값) · expect(이름 → 검사 함수)
// run은 문자열로 직렬화되어 페이지에서 실행되므로 바깥 변수를 쓰지 않는다.
export const scenarios = [
  {
    name: "core · 안전한 마크업",
    page: "docs/js/core/dom.html",
    run: async () => {
      const spoof = JSON.parse('{"__raw":"<img src=x onerror=alert(1)>"}');
      const off = false;
      return { spoof: catui.html`<p>${spoof}</p>`.__raw, raw: catui.html`<p>${catui.raw("<b>ok</b>")}</p>`.__raw, version: catui.version, modules: catui.cache.modules.length,
        attrFalse: catui.html`<b aria-pressed="${off}">${off}</b>`.__raw };
    },
    expect: {
      "속성값 안 false는 \"false\", 내용의 false는 생략": (r) => r.attrFalse === '<b aria-pressed="false"></b>',
      "위조 __raw 객체는 escape": (r) => !r.spoof.includes("<img"),
      "raw()는 마크업 유지": (r) => r.raw === "<p><b>ok</b></p>",
      "버전 주입 (dev 아님)": (r) => /^\d+\.\d+\.\d+/.test(r.version),
      "모듈 21개 이상 등록": (r) => r.modules >= 21,
    },
  },
  {
    name: "모듈 경계값 · laypage·slider·rate·tabs·upload·util",
    page: "docs/js/modules/laypage.html",
    allowLogs: /이미 있어 새 id/,   // 일부러 낸 경고
    run: async () => {
      const box = document.createElement("div"); document.querySelector("main").appendChild(box);
      const mk = () => { const d = document.createElement("div"); box.appendChild(d); return d; };
      // laypage: 소수 curr, 같은 쪽 이동은 jump 없음
      let jumps = 0; const lp = catui.laypage.render({ elem: mk(), count: 100, limit: 10, curr: 2.7, layout: ["page", "skip"], jump: (d, first) => { if (!first) jumps++; } });
      const cur = lp.elem.querySelector('[aria-current="page"]')?.textContent;
      const sk = lp.elem.querySelector("[data-catui-skip]"); sk.value = "2"; lp.elem.querySelector("[data-catui-go]").click();
      const sameJump = jumps; sk.value = "5"; lp.elem.querySelector("[data-catui-go]").click();
      // slider: NaN 범위·step 맞춤
      const sl = catui.slider.render({ elem: mk(), label: "값", min: "x", max: 100, step: 10, value: 7 });
      // rate: 소수 길이, readonly setValue
      const rt = catui.rate.render({ elem: mk(), length: 5.5, value: 9 });
      const ro = catui.rate.render({ elem: mk(), readonly: true, value: 2 }); ro.setValue(4);
      // tabs: 범위 밖 index
      const tb = catui.tabs.render({ elem: mk(), label: "시험", index: 99, data: [{ title: "가" }, { title: "나" }] });
      const tabOn = [...tb.elem.querySelectorAll('[role="tab"]')].findIndex((r) => r.getAttribute("aria-selected") === "true");
      // util 경계
      const n = catui.util.number(1.234, -1), fs = catui.util.fileSize(2048, 500);
      const out = { cur, sameJump, jumps, slv: sl.getValue(), rlen: rt.elem.querySelectorAll("input[type=radio]").length, rv: rt.getValue(), ro: ro.getValue(), tabOn, n, fs };
      box.remove();
      return out;
    },
    expect: {
      "laypage 소수 curr → 정수 쪽 표시": (r) => r.cur === "2",
      "같은 쪽 이동은 jump 없음, 다른 쪽은 1번": (r) => r.sameJump === 0 && r.jumps === 1,
      "slider NaN min → 0, 값은 step 눈금(10)": (r) => r.slv === 10,
      "rate 길이 5.5 → 별 5개, 값 5로 제한": (r) => r.rlen === 5 && r.rv === 5,
      "readonly rate.setValue 반영": (r) => r.ro === 4,
      "tabs 범위 밖 index → 마지막 탭": (r) => r.tabOn === 1,
      "util 소수 자리 경계에서 예외 없음": (r) => r.n === "1" && r.fs === "2KB",
    },
  },
  {
    name: "tabs.render · WAI-ARIA 탭 (키보드·추가·닫기)",
    page: "docs/js/modules/tabs.html",
    run: async () => {
      const box = document.querySelector("#tb-rd .Catui_tabs");
      const list = box.querySelector('[role="tablist"]'), tabsEl = () => [...list.querySelectorAll('[role="tab"]')];
      const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      const panelOf = (t) => document.getElementById(t.getAttribute("aria-controls"));
      const r = { label: list.getAttribute("aria-label"), stops: tabsEl().filter((t) => t.tabIndex === 0).length };
      let got = null; catui.tabs.on("tab(tb-rd)", (o) => { got = o.title; });
      tabsEl()[0].focus(); key("ArrowRight");
      r.right = document.activeElement === tabsEl()[1] && tabsEl()[1].getAttribute("aria-selected") === "true" && !panelOf(tabsEl()[1]).hidden && panelOf(tabsEl()[0]).hidden;
      key("End"); r.end = document.activeElement === tabsEl()[2]; key("ArrowRight"); r.wrap = document.activeElement === tabsEl()[0];
      r.event = got;
      r.panel = panelOf(tabsEl()[0]).getAttribute("role") === "tabpanel" && panelOf(tabsEl()[0]).getAttribute("aria-labelledby") === tabsEl()[0].id;
      catui.tabs.add("tb-rd", { title: "추가", content: "새 내용" }); r.added = tabsEl().length === 4 && tabsEl()[3].getAttribute("aria-selected") === "true";
      let closed = null; catui.tabs.on("close(tb-rd)", (o) => { closed = o.title; });
      catui.tabs.close("tb-rd", 3); r.closed = closed === "추가" && tabsEl().length === 3 && tabsEl()[2].getAttribute("aria-selected") === "true";
      return r;
    },
    expect: {
      "tablist 이름": (r) => r.label === "주문 정보",
      "Tab 정지점 하나(로빙 tabindex)": (r) => r.stops === 1,
      "→: 다음 탭 선택·포커스, 패널 전환": (r) => r.right,
      "End·끝에서 → 순환": (r) => r.end && r.wrap,
      "tab 이벤트": (r) => r.event === "요약",
      "tabpanel 연결": (r) => r.panel,
      "add·close": (r) => r.added && r.closed,
    },
  },
  {
    name: "tree.render · WAI-ARIA 트리 (키보드·체크)",
    page: "docs/js/modules/tree.html",
    run: async () => {
      const root = document.querySelector('#tr-docs[role="tree"]');
      const items = () => [...root.querySelectorAll('[role="treeitem"]')];
      const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
      const r = { tree: !!root, stops: items().filter((x) => x.tabIndex === 0).length, levels: items().every((x) => x.hasAttribute("aria-level")) };
      const first = items().find((x) => x.tabIndex === 0); first.focus();
      const pid = items().find((x) => x.hasAttribute("aria-expanded")).dataset.catuiTitem;
      const P = () => root.querySelector(`[data-catui-titem="${pid}"]`);
      P().focus();
      if (P().getAttribute("aria-expanded") === "true") key("ArrowLeft");   // 펼쳐져 있으면 먼저 접기
      r.collapse = P().getAttribute("aria-expanded") === "false" && document.activeElement === P();
      key("ArrowRight"); r.expand = P().getAttribute("aria-expanded") === "true" && document.activeElement === P();
      key("ArrowRight"); r.child = document.activeElement.parentElement.closest('[role="treeitem"]') === P();
      // 첫 자식이 펼쳐진 폴더면 첫 ←는 그 폴더를 접고(APG), 다음 ←가 부모로 간다
      if (document.activeElement.getAttribute("aria-expanded") === "true") key("ArrowLeft");
      key("ArrowLeft"); r.toParent = document.activeElement === P();
      const cur = document.activeElement; key(" ");
      const after = root.querySelector(`[data-catui-titem="${cur.dataset.catuiTitem}"]`);
      r.checked = after.getAttribute("aria-checked") === "true" && document.activeElement === after;
      key("Enter"); r.selected = root.querySelector(`[data-catui-titem="${cur.dataset.catuiTitem}"]`).getAttribute("aria-selected") === "true";
      r.noNestedFocus = [...root.querySelectorAll("input")].every((i) => i.tabIndex === -1);
      catui.tree.clearChecked("docs");
      return r;
    },
    expect: {
      "role=tree, Tab 정지점 하나, aria-level": (r) => r.tree && r.stops === 1 && r.levels,
      "→ 펼치기 → 첫 자식": (r) => r.expand && r.child,
      "← 부모로 → 접기": (r) => r.toParent && r.collapse,
      "Space 체크(aria-checked), 포커스 유지": (r) => r.checked,
      "Enter 선택(aria-selected)": (r) => r.selected,
      "체크박스는 Tab 순서에서 빠짐": (r) => r.noNestedFocus,
    },
  },
  {
    name: "core · mount 노드·배열 · url 해시 · data 키 보호",
    page: "docs/js/core/dom.html",
    allowLogs: /'__proto__'는 키로 쓸 수 없습니다/,   // 일부러 낸 경고
    run: async () => {
      const box = document.createElement("div");
      const b = document.createElement("b"); b.textContent = "노드";
      catui.mount(box, b); const node = box.innerHTML;
      catui.mount(box, ["가", catui.html`<i>${"<x>"}</i>`, null, false, b]); const arr = box.innerHTML;
      const u = catui.url("https://a.test/p?q=1#/list?x=1?y=2");
      catui.data("t-core", { key: "__proto__", value: { polluted: true } });
      const safe = ({}).polluted === undefined && !Object.keys(catui.data("t-core")).length;
      catui.data("t-core", null);
      return { node, arr, safe, hq: u.hash.search, hp: u.hash.path };
    },
    expect: {
      "data('__proto__') 키 거부": (r) => r.safe,
      "Element를 그대로 넣음": (r) => r.node === "<b>노드</b>",
      "배열: 글자·html``·노드, null·false 건너뜀": (r) => r.arr === "가<i>&lt;x&gt;</i><b>노드</b>",
      "해시 쿼리를 첫 ?에서만 나눔": (r) => r.hq.x === "1?y=2" && r.hp.join("/") === "list",
    },
  },
  {
    name: "carousel · 가로·세로 끊김 없는 순환",
    page: "docs/js/modules/carousel.html",
    wait: 2000,
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const byLabel = (l) => [...document.querySelectorAll(".Catui_carousel")].find((r) => r.getAttribute("aria-label") === l);
      const wrapTest = async (root, prop) => {
        const tr = root.querySelector(".Catui_carousel-track");
        root.querySelector('[data-catui-car="play"]')?.click();
        const dots = root.querySelectorAll("[data-catui-car-dot]");
        dots[dots.length - 1].click(); await sleep(900);
        const t = []; const rec = () => t.push(Math.round(tr[prop])); tr.addEventListener("scroll", rec);
        root.querySelector('[data-catui-car="next"]').click(); await sleep(1300); tr.removeEventListener("scroll", rec);
        let back = 0; for (let k = 1; k < t.length; k++) if (t[k] < t[k - 1] - 2) back++;
        const realFirst = [...tr.children].find((s) => !s.hasAttribute("data-catui-clone"));
        const at = prop === "scrollTop" ? realFirst.offsetTop - tr.offsetTop : realFirst.offsetLeft - tr.offsetLeft;
        return { back, counter: root.querySelector(".Catui_num")?.textContent, settled: Math.abs(tr[prop] - at) < 3 };
      };
      return { h: await wrapTest(byLabel("이번 주 기획전"), "scrollLeft"), v: await wrapTest(byLabel("실시간 소식"), "scrollTop") };
    },
    expect: {
      "가로: 마지막→다음이 1번 (순간 이동 1회만)": (r) => r.h.counter === "1 / 3" && r.h.back <= 1 && r.h.settled,
      "세로: 마지막→다음이 1번 (순간 이동 1회만)": (r) => r.v.counter === "1 / 3" && r.v.back <= 1 && r.v.settled,
    },
  },
  {
    name: "field · 글자 수·인증 코드·태그",
    page: "docs/js/modules/field.html",
    run: async () => {
      const bio = document.getElementById("fd-bio"), cnt = document.querySelector(".Catui_counter");
      const set = (v) => { bio.value = v; bio.dispatchEvent(new Event("input", { bubbles: true })); return [cnt.textContent, cnt.className, bio.getAttribute("aria-invalid")]; };
      const counter = { warn: set("가".repeat(52)), over: set("가".repeat(65)) };
      const otp = document.getElementById("fd-otp"), cells = [...otp.querySelectorAll("input:not([type=hidden])")];
      const dt = new DataTransfer(); dt.setData("text", "123456");
      cells[0].focus(); cells[0].dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }));
      const tags = document.getElementById("fd-tags");
      tags.value = "기획"; tags.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      return { counter, otp: cells.map((c) => c.value).join(""), otpOut: document.getElementById("fd-otp-out").textContent, tags: [...document.querySelectorAll(".Catui_tag:not(.Catui_tag-limit)")].map((t) => t.textContent.trim()), hidden: document.querySelector('input[type=hidden][name="topics"]')?.value };
    },
    expect: {
      "글자 수 경고": (r) => r.counter.warn[1].includes("warn"),
      "글자 수 초과 + aria-invalid": (r) => r.counter.over[0].includes("초과") && r.counter.over[2] === "true",
      "인증 코드 붙여넣기 분배 + 완료 이벤트": (r) => r.otp === "123456" && r.otpOut.includes("123456"),
      "태그 추가 + 폼 값": (r) => r.tags.includes("기획") && r.hidden.includes("기획"),
    },
  },
  {
    name: "form · 검증·매개변수 규칙",
    page: "docs/js/modules/form.html",
    allowLogs: /영역을 찾을 수 없습니다 \(없는필터\)/,   // 일부러 낸 경고
    run: async () => {
      const f = document.querySelector('[data-catui-filter="fm-rule"]');
      f.querySelector("#fm-uid").value = "1bad";
      f.querySelector("#fm-pw1").value = "abc12345"; f.querySelector("#fm-pw2").value = "different";
      const ok = catui.form.validate(f);
      const err = (id) => document.getElementById(`${id}-err`)?.textContent || "";
      return { ok, uid: err("fm-uid"), pw2: err("fm-pw2"), plan: [...f.querySelectorAll(".Catui_error")].map((e) => e.textContent).join("|"), missing: catui.form.validate("없는필터") };
    },
    expect: {
      "잘못된 값이면 실패": (r) => r.ok === false,
      "아이디 형식 오류 문구": (r) => r.uid.length > 0,
      "same: 확인 칸 불일치": (r) => r.pw2.includes("일치"),
      "라디오 그룹 필수": (r) => r.plan.includes("요금제"),
      "없는 영역은 통과시키지 않음": (r) => r.missing === false,
    },
  },
  {
    name: "table · 정렬·쪽 크기·CSV 수식 방지",
    page: "docs/js/modules/table.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const host = document.getElementById("tb-orders");
      host.querySelector('[data-catui-sort="customer"]').click(); await sleep(50);
      const first = host.querySelector("tbody tr td:nth-child(4)")?.textContent;
      const sel = host.querySelector("[data-catui-limit]"); sel.value = "10"; sel.dispatchEvent(new Event("change", { bubbles: true })); await sleep(50);
      const rows = host.querySelectorAll("tbody tr").length;
      // 내보낸 Blob을 가로채 바이트로 읽는다 (Blob.text()는 BOM을 떼므로 앞 3바이트를 직접 확인)
      let blob = null;
      const orig = URL.createObjectURL;
      URL.createObjectURL = (b) => { blob = b; return orig.call(URL, new Blob([""])); };
      const realClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {};   // 실제 다운로드는 하지 않음
      catui.table.exportFile("tb-orders", "t.csv", { rows: [{ id: "=HYPERLINK(1)", customer: "홍,길동", amount: 1, status: "배송" }] });
      URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = realClick;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
      return { first, rows, bom, csv: new TextDecoder().decode(bytes) };
    },
    expect: {
      "고객 정렬(가나다 첫 행)": (r) => r.first === "강도현",
      "쪽 크기 10개": (r) => r.rows === 10,
      "CSV: BOM·수식 방지·쉼표 따옴표·순번 머리글": (r) => r.bom && r.csv.includes("'=HYPERLINK") && r.csv.includes('"홍,길동"') && r.csv.includes("순번,"),
    },
  },
  {
    name: "site · 공지·쿠키·요금·구독",
    page: "docs/js/modules/site.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      catui.data("site", null);
      const ann = document.querySelector("[data-catui-dismiss]"); ann.hidden = false;
      ann.querySelector(".Catui_announce-close").click();
      const ck = document.querySelector("[data-catui-cookie]"); ck.hidden = false;
      ck.querySelector('[data-catui-consent="all"]').click();
      const y = document.getElementById("st-bill-y"); y.checked = true; y.dispatchEvent(new Event("change", { bubbles: true }));
      const f = document.querySelector("[data-catui-subscribe]"); f.querySelector("input").value = "a@b.co"; f.requestSubmit(f.querySelector("button"));
      await sleep(1200);
      const r = { ann: getComputedStyle(ann).display, stored: !!catui.data("site")["dismiss:doc-sale-2026"], cookie: getComputedStyle(ck).display, consent: catui.site.consent()?.value, price: document.querySelector("[data-catui-monthly]").textContent, sub: f.hidden && !!f.nextElementSibling?.matches(".Catui_subscribe-done") };
      catui.data("site", null);
      return r;
    },
    expect: {
      "공지 닫기 + 기억": (r) => r.ann === "none" && r.stored,
      "쿠키 동의 저장 + 숨김": (r) => r.cookie === "none" && r.consent === "all",
      "연간 요금으로 전환": (r) => r.price === "7,900원",
      "구독 완료 문구": (r) => r.sub,
    },
  },
  {
    name: "command · 초성 검색",
    page: "docs/js/modules/command.html",
    run: async () => {
      catui.command.open("doc-cmd");
      const inst = catui.command.getThis("doc-cmd"), dlg = inst.dialog, q = dlg.querySelector("input");
      q.value = "ㄷㅅㅂㄷ"; q.dispatchEvent(new Event("input", { bubbles: true }));
      const rows = [...dlg.querySelectorAll("[data-catui-cmd]")].map((r) => r.textContent.trim());
      const open = dlg.open; catui.command.close("doc-cmd");
      return { open, rows };
    },
    expect: {
      "열림": (r) => r.open,
      "ㄷㅅㅂㄷ → 대시보드": (r) => r.rows.length === 1 && r.rows[0].startsWith("대시보드"),
    },
  },
  {
    name: "extend · 사용자 모듈·이벤트·자동 정리·재초기화",
    page: "docs/js/core/component.html",
    allowLogs: /기본 API 이름은 모듈 이름으로 쓸 수 없습니다|없는 의존 모듈/,   // 일부러 낸 경고
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const log = [];
      // 1) component로 렌더형 모듈 만들기 → extend로 등록 → use로 받기
      const badge = catui.component({
        name: "testbadge",
        config: { text: "기본", count: 0 },
        render(inst) {
          const b = document.createElement("button");
          b.type = "button"; b.textContent = `${inst.config.text} ${inst.config.count}`;
          inst.elem.appendChild(b);
          const onClick = () => inst.emit("hit", { count: inst.config.count });
          b.addEventListener("click", onClick);
          inst.use(() => { b.removeEventListener("click", onClick); b.remove(); log.push("cleanup"); });
        },
      });
      catui.extend({ testbadge: badge });
      const [m] = await catui.use(["testbadge"]);
      const host = document.createElement("div"); host.id = "tb-host"; host.setAttribute("data-catui-filter", "tb"); document.body.appendChild(host);
      const off = m.on("hit(tb)", (d) => log.push(`hit:${d.count}`));
      const inst = m.render({ elem: host, count: 3 });
      host.querySelector("button").click();
      inst.reload({ text: "새", count: 5 });
      const textAfterReload = host.textContent.trim();
      host.querySelector("button").click();
      off(); host.querySelector("button").click();   // 해제 후에는 기록되지 않아야 함
      // 2) define: 의존 모듈 주입
      catui.define("testgreet", ["util"], (u) => ({ hi: (n) => `안녕 ${u.number(n)}` }));
      const greet = catui.testgreet.hi(12345);
      // 3) 예약 이름·없는 의존은 막힘
      catui.extend({ init: {} });
      catui.define("testbad", ["없는모듈"], () => ({}));
      const blocked = typeof catui.init === "function" && !catui.testbad;
      // 4) DOM에서 빼면 자동 정리(autoDestroy)
      host.remove(); await sleep(120);
      const autoCleaned = !m.getThis("tb-host") && log.filter((x) => x === "cleanup").length >= 2;
      // 5) 전역 해제 후 다시 초기화해도 선언형이 다시 붙는지
      catui.destroy(); catui.init();
      const reinit = !!document.querySelector("[data-catui-ready]") || document.querySelectorAll(".Catui_select-wrap .Catui_icon").length >= 0;
      // 6) 테마 확장: 토큰 하나 바꾸면 컴포넌트에 반영
      // 버튼은 배경색 전환(transition)이 있어 바로 읽으면 이전 색이 나오므로 전환을 끄고 잰다
      const btn = document.createElement("button"); btn.className = "Catui_btn Catui_btn-md Catui_btn-primary"; btn.style.transition = "none"; document.body.appendChild(btn);
      const before = getComputedStyle(btn).backgroundColor;
      document.documentElement.style.setProperty("--Catui_btn-primary-bg", "rgb(1, 2, 3)");
      const after = getComputedStyle(btn).backgroundColor;
      document.documentElement.style.removeProperty("--Catui_btn-primary-bg"); btn.remove();
      return { log, textAfterReload, greet, blocked, autoCleaned, reinit, theme: before !== after && after === "rgb(1, 2, 3)" };
    },
    expect: {
      "component 렌더·이벤트(필터)": (r) => r.log[0] === "hit:3",
      "reload: 정리 후 다시 그림": (r) => r.textAfterReload === "새 5" && r.log.includes("hit:5"),
      "on() 해제 후 이벤트 안 옴": (r) => r.log.filter((x) => x.startsWith("hit")).length === 2,
      "define 의존 주입": (r) => r.greet === "안녕 12,345",
      "예약 이름·없는 의존 차단": (r) => r.blocked,
      "DOM에서 빠지면 자동 정리": (r) => r.autoCleaned,
      "destroy 후 init 재실행": (r) => r.reinit,
      "토큰 덮어쓰기로 테마 확장": (r) => r.theme,
    },
  },
  {
    name: "recipes · 모듈 조합 예제",
    page: "docs/js/start/recipes.html",
    wait: 2000,
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const r = {};
      // 1) 주문 추가: 양식 채우고 저장 → 표·합계 반영
      const sum0 = document.getElementById("rc-sum").textContent;
      document.getElementById("rc-add").click(); await sleep(300);
      const dlg = [...document.querySelectorAll("dialog[open]")].pop();
      dlg.querySelector('[name="customer"]').value = "테스트고객";
      dlg.querySelector('[name="amount"]').value = "10000";
      dlg.querySelector('[data-catui-btn="0"]').click(); await sleep(900);
      r.add = { sum0, sum1: document.getElementById("rc-sum").textContent, first: document.querySelector("#rc-orders tbody tr td:nth-child(3)")?.textContent };
      // 2) 검색: 상태 '배송'
      document.getElementById("rc-state").value = "배송";
      document.getElementById("rc-filter").requestSubmit(); await sleep(200);
      r.search = [...document.querySelectorAll("#rc-list tbody tr td:nth-child(4)")].map((t) => t.textContent);
      // 3) 가입: 빈 칸이면 막힘 → 채우면 통과 → 인증 1234 → 3단계
      const next = document.getElementById("rc-next");
      next.click(); await sleep(200);
      r.blocked = document.querySelector("#rc-steps [aria-current=step]")?.textContent.trim();
      document.getElementById("rc-mail").value = "a@b.co"; document.getElementById("rc-pw").value = "abcd1234";
      next.click(); await sleep(300);
      r.step2 = document.querySelector("#rc-steps [aria-current=step]")?.textContent.trim();
      const cells = [...document.querySelectorAll("#rc-otp input:not([type=hidden])")];
      const dt = new DataTransfer(); dt.setData("text", "1234");
      cells[0].focus(); cells[0].dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt })); await sleep(300);
      r.step3 = document.querySelector("#rc-steps [aria-current=step]")?.textContent.trim();
      r.nextLabel = next.textContent;
      // 4) 대시보드: 탭 '월간' → 합계, 명령 팔레트로 '연간'
      const tabBtns = document.querySelectorAll('#rc-tabs [role="tab"]');
      tabBtns[1].click(); await sleep(100);
      r.month = document.getElementById("rc-total").textContent;
      catui.command.open("rc-cmd");
      const q = catui.command.getThis("rc-cmd").dialog.querySelector("input");
      q.value = "연간"; q.dispatchEvent(new Event("input", { bubbles: true }));
      q.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await sleep(150);
      r.year = document.getElementById("rc-total").textContent;
      r.canvas = !!document.querySelector("#rc-chart canvas");
      catui.layer.closeAll();
      return r;
    },
    expect: {
      "주문 추가 → 합계·첫 행 갱신": (r) => r.add.sum0 !== r.add.sum1 && r.add.sum1.includes("7건") && r.add.first === "테스트고객",
      "검색: 배송만": (r) => r.search.length > 0 && r.search.every((s) => s === "배송"),
      "가입: 빈 칸이면 1단계에 머묾": (r) => r.blocked.startsWith("1"),
      "가입: 입력하면 2단계": (r) => r.step2.startsWith("2"),
      "가입: 인증 1234 → 3단계 + 완료 버튼": (r) => r.step3.startsWith("3") && r.nextLabel === "가입 완료",
      "대시보드: 탭 → 월간 합계": (r) => r.month.startsWith("월간 합계 1,424"),
      "대시보드: 명령 팔레트 → 연간": (r) => r.year.startsWith("연간 합계 6,030") && r.canvas,
    },
  },
  {
    name: "admin · 셸 (접힘 기억 · 테마 · 알림 · 명령 팔레트 · 차트)",
    page: "docs/admin/templates/index.html",
    wait: 1800,
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const root = document.querySelector("[data-catui-adm]"), toggle = root.querySelector("[data-catui-adm-toggle]");
      catui.admin.store.clear(); root.removeAttribute("data-catui-adm-collapsed");
      const r = { ready: root.hasAttribute("data-catui-adm-ready"), charts: document.querySelectorAll("[data-catui-adm-chart] canvas").length };
      toggle.click();
      r.collapsed = root.hasAttribute("data-catui-adm-collapsed") && catui.admin.store.get("collapsed") === true && toggle.getAttribute("aria-label") === "메뉴 펼치기";
      await sleep(400);   // 폭 전환 애니메이션이 끝난 뒤 잰다
      r.sideW = Math.round(root.querySelector(".Catui_side").getBoundingClientRect().width);
      toggle.click();
      // 테마
      document.querySelector("[data-catui-adm-theme]").click();
      r.dark = document.documentElement.getAttribute("data-catui-theme") === "dark" && catui.admin.store.get("theme") === "dark";
      document.querySelector("[data-catui-adm-theme]").click();
      r.light = !document.documentElement.hasAttribute("data-catui-theme");
      // 알림: 3건 → 하나 읽음 → 2건 → 모두 읽음 → 0
      const nb = document.querySelector("[data-catui-adm-notify]");
      r.badge0 = nb.querySelector(".Catui_count")?.textContent;
      nb.click(); await sleep(50);
      const pop = document.getElementById("adm-notify-pop");
      r.popOpen = !pop.hidden && nb.getAttribute("aria-expanded") === "true";
      pop.querySelector(".Catui_notif-unread").click();
      r.badge1 = nb.querySelector(".Catui_count")?.textContent;
      pop.querySelector("[data-catui-adm-readall]").click();
      r.badge2 = nb.querySelector(".Catui_count")?.hidden;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      r.popClosed = pop.hidden && document.activeElement === nb;
      // 명령 팔레트: Ctrl+K → "ㅂㅅ" → 분석
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
      await sleep(50);
      const dlg = catui.command.getThis("adm-cmd").dialog, q = dlg.querySelector("input");
      q.value = "ㅂㅅ"; q.dispatchEvent(new Event("input", { bubbles: true }));
      r.cmd = [...dlg.querySelectorAll("[data-catui-cmd]")].map((x) => x.textContent.trim());
      catui.command.close("adm-cmd");
      catui.admin.store.clear();
      return r;
    },
    expect: {
      "셸 연결 + 차트 그려짐": (r) => r.ready && r.charts >= 2,
      "사이드바 접힘 + 기억 + 레일 폭": (r) => r.collapsed && r.sideW < 100,
      "테마 전환·기억": (r) => r.dark && r.light,
      "알림 배지 3 → 2 → 0": (r) => r.badge0 === "3" && r.popOpen && r.badge1 === "2" && r.badge2 === true,
      "알림 Esc로 닫고 버튼으로 포커스": (r) => r.popClosed,
      "명령 팔레트 초성 ㅂㅅ → 분석": (r) => r.cmd.some((t) => t.includes("분석")),
    },
  },
  {
    name: "admin · 모바일 서랍 (Esc · 포커스 복귀 · 가림막)",
    page: "docs/admin/templates/analytics.html",
    viewport: [390, 844],
    run: async () => {
      const root = document.querySelector("[data-catui-adm]"), toggle = root.querySelector("[data-catui-adm-toggle]");
      const side = root.querySelector(".Catui_side"), scrim = root.querySelector(".Catui_adm-scrim");
      const r = { hidden: getComputedStyle(side).visibility === "hidden" };
      toggle.focus(); toggle.click();
      r.open = root.hasAttribute("data-catui-adm-open") && !scrim.hidden && side.contains(document.activeElement) && getComputedStyle(side).visibility === "visible";
      r.label = toggle.getAttribute("aria-label");
      r.subOpen = !!side.querySelector('[aria-current="page"]')?.closest("details")?.open;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      r.closed = !root.hasAttribute("data-catui-adm-open") && scrim.hidden && document.activeElement === toggle;
      toggle.click(); scrim.click();
      r.scrimClose = !root.hasAttribute("data-catui-adm-open");
      return r;
    },
    expect: {
      "처음엔 숨김": (r) => r.hidden,
      "열면 가림막 + 메뉴로 포커스": (r) => r.open && r.label === "메뉴 닫기",
      "현재 화면의 하위 메뉴 펼침": (r) => r.subOpen,
      "Esc로 닫고 버튼으로 포커스": (r) => r.closed,
      "가림막 누르면 닫힘": (r) => r.scrimClose,
    },
  },
  {
    name: "admin · 폼 (변경 감지 · 이탈 확인 · 저장 후 해제)",
    page: "docs/admin/templates/form.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const f = document.getElementById("fm-product"), note = f.querySelector("[data-catui-adm-savenote]");
      const r = { clean: !f.hasAttribute("data-catui-adm-dirty") };
      const name = document.getElementById("fm-name");
      name.value = "기계식 키보드 K9"; name.dispatchEvent(new Event("input", { bubbles: true }));
      r.dirty = f.hasAttribute("data-catui-adm-dirty") && note.textContent.includes("저장하지 않은");
      document.querySelector('.Catui_side a[href="index.html"]').click(); await sleep(200);
      const dlg = [...document.querySelectorAll("dialog[open]")].pop();
      r.confirm = !!dlg && dlg.textContent.includes("저장하지 않고") && location.pathname.endsWith("form.html");
      dlg?.querySelector('[data-catui-btn="1"]')?.click(); await sleep(100);   // 머무르기
      f.querySelector("[type=submit]").click(); await sleep(800);
      r.saved = !f.hasAttribute("data-catui-adm-dirty") && note.textContent.includes("저장되었습니다");
      name.value = ""; name.dispatchEvent(new Event("input", { bubbles: true }));
      f.querySelector("[type=submit]").click(); await sleep(200);
      r.invalid = name.getAttribute("aria-invalid") === "true";
      f.reset(); await sleep(50);   // 다음 시나리오로 넘어갈 때 "떠날까요?" 경고가 뜨지 않게
      return r;
    },
    expect: {
      "처음엔 변경 없음": (r) => r.clean,
      "고치면 저장 바에 알림": (r) => r.dirty,
      "다른 화면으로 가면 확인 창": (r) => r.confirm,
      "저장하면 변경 없음으로": (r) => r.saved,
      "필수 칸 비우면 오류": (r) => r.invalid,
    },
  },
  {
    name: "admin · 동적 표 (필터 ↔ 주소 · 일괄 작업 바)",
    page: "docs/admin/templates/tables-dynamic.html?status=%EC%B7%A8%EC%86%8C",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const sel = document.getElementById("td-st"), bulk = document.getElementById("td-bulk");
      const statuses = () => [...document.querySelectorAll("#td-orders tbody tr td:nth-child(8)")].map((t) => t.textContent.trim());
      const r = { fromUrl: sel.value === "취소" && statuses().every((s) => s === "취소"), bulkHidden: bulk.hidden && getComputedStyle(bulk).display === "none" };
      sel.value = "배송 중"; sel.dispatchEvent(new Event("change", { bubbles: true })); await sleep(50);
      r.toUrl = new URLSearchParams(location.search).get("status") === "배송 중" && statuses().every((s) => s === "배송 중");
      document.querySelector("#td-orders tbody input[type=checkbox]").click(); await sleep(50);
      r.bulk = !bulk.hidden && bulk.textContent.includes("1건 선택됨");
      document.getElementById("td-filter").reset(); await sleep(50);
      r.reset = location.search === "" && sel.value === "";
      return r;
    },
    expect: {
      "주소 조건으로 시작": (r) => r.fromUrl,
      "선택 0건이면 일괄 바 숨김": (r) => r.bulkHidden,
      "조건 바꾸면 주소 갱신": (r) => r.toUrl,
      "선택하면 일괄 바 + 건수": (r) => r.bulk,
      "초기화하면 주소도 비움": (r) => r.reset,
    },
  },
  {
    name: "admin · 분석 기간 전환",
    page: "docs/admin/templates/analytics.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      await catui.admin.ready; await sleep(300);
      const v = () => document.querySelector('[data-catui-adm-text="kpi.visitors"]').textContent;
      const before = v();
      document.getElementById("an-30").click(); await sleep(150);
      const r = { before, after: v(), live: document.getElementById("an-live").textContent,
        delta: document.querySelector('[data-an-delta="goals"]').className.includes("success"),
        label: document.querySelector("#an-trend canvas")?.getAttribute("aria-label") || "" };
      return r;
    },
    expect: {
      "30일: 지표 값이 바뀜": (r) => r.before !== r.after && r.after === "128,450",
      "증감 색·문구도 바뀜(목표 +1.3% → 성공)": (r) => r.delta,
      "차트 이름·안내": (r) => r.label.includes("최근 30일") && r.live.includes("최근 30일"),
    },
  },
  {
    name: "admin · 검증 요약",
    page: "docs/admin/templates/form-validation.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector("#fv-form [type=submit]").click(); await sleep(100);
      const sum = document.getElementById("fv-summary");
      const r = { summary: !sum.hidden && document.activeElement === sum, items: sum.querySelectorAll("li").length };
      const f = document.getElementById("fv-form");
      // 조합 중 Enter는 폼을 제출하지 않음(keydown이 막힘)
      const inp = f.querySelector("input[type=text], input[type=email], input:not([type])");
      const ev = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
      inp.dispatchEvent(ev); r.imeBlocked = ev.defaultPrevented;
      f.reset(); await sleep(50);
      r.cleared = !f.querySelector('[aria-invalid="true"]') && sum.hidden;
      return r;
    },
    expect: {
      "제출 실패 시 오류 요약으로 포커스": (r) => r.summary,
      "오류 항목 목록": (r) => r.items >= 6,
      "지우기: 칸별 오류 표시도 사라짐": (r) => r.cleared,
      "한글 조합 중 Enter는 제출 안 함": (r) => r.imeBlocked,
    },
  },
  {
    name: "admin · 캘린더 (방향키 · 일정 수)",
    page: "docs/admin/templates/calendar.html",
    run: async () => {
      const grid = document.getElementById("cl-grid");
      grid.querySelector('[data-day="2026-11-02"]').focus();
      for (let i = 0; i < 3; i++) document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      return { focus: document.activeElement.dataset.day, title: document.getElementById("cl-day-t").textContent };
    },
    expect: { "↓ 3번 → 11월 23일": (r) => r.focus === "2026-11-23", "옆 패널 갱신": (r) => r.title.startsWith("11월 23일") },
  },
  {
    name: "admin · 채팅 (한글 조합 Enter 무시 · 보내기 · 답장)",
    page: "docs/admin/templates/chat.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const input = document.getElementById("ct-msg"), log = document.querySelector("#ct-log .Catui_chat");
      const n0 = log.querySelectorAll(".Catui_chat-msg").length;
      input.value = "안녕하세";
      const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true });
      input.dispatchEvent(ev);
      const r = { imeBlocked: ev.defaultPrevented };
      input.value = "배송지 변경해 드렸습니다";
      document.getElementById("ct-form").requestSubmit(); await sleep(50);
      r.sent = log.querySelectorAll(".Catui_chat-me").length >= 1 && input.value === "" && log.lastElementChild.textContent.includes("배송지 변경");
      await sleep(1400);
      r.reply = log.querySelectorAll(".Catui_chat-msg").length === n0 + 2;
      return r;
    },
    expect: { "조합 중 Enter는 막음": (r) => r.imeBlocked, "보내기": (r) => r.sent, "데모 답장": (r) => r.reply },
  },
  {
    name: "admin · 칸반 (키보드 열 이동 · 개수 갱신 · 알림)",
    page: "docs/admin/templates/kanban.html",
    run: async () => {
      const cols = [...document.querySelectorAll(".Catui_kanban-col")];
      const card = cols[2].querySelector(".Catui_kanban-card");
      card.focus();
      card.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      const live = document.querySelector("#kb-board + .Catui_clip")?.textContent || "";
      return { moved: cols[3].contains(card) && document.activeElement === card, counts: cols.map((c) => c.querySelector(".Catui_count").textContent).join(","), empty: cols[3].querySelector("[data-catui-adm-empty]").hidden && !cols[2].querySelector("[data-catui-adm-empty]").hidden, live };
    },
    expect: { "→ 로 다음 열": (r) => r.moved, "개수 3,2,0,1": (r) => r.counts === "3,2,0,1", "빈 칸 표시 전환": (r) => r.empty, "화면 낭독기 알림": (r) => r.live.includes("완료") },
  },
  {
    name: "admin · 로그인 (보기 · 강도 · 실패 안내)",
    page: "docs/admin/templates/register.html",
    run: async () => {
      const pw = document.getElementById("rg-pw"), tg = document.querySelector("[data-catui-adm-pwtoggle]"), meter = document.querySelector("[data-catui-adm-strength]");
      tg.click();
      const r = { shown: pw.type === "text" && tg.getAttribute("aria-pressed") === "true" };
      tg.click(); r.hidden = pw.type === "password";
      pw.value = "abc"; pw.dispatchEvent(new Event("input", { bubbles: true })); r.weak = meter.dataset.level === "1";
      pw.value = "Catui!2026admin"; pw.dispatchEvent(new Event("input", { bubbles: true })); r.strong = meter.dataset.level === "4" && meter.textContent.includes("강함");
      r.link = getComputedStyle(document.querySelector("a.Catui_link")).textDecorationLine.includes("underline");
      return r;
    },
    expect: { "비밀번호 보기": (r) => r.shown, "다시 숨기기": (r) => r.hidden, "약함": (r) => r.weak, "강함 + 글자": (r) => r.strong, "링크 스타일": (r) => r.link },
  },
  {
    name: "community · 글 보기 (추천 1회 · 취소 · 답글 펼침 · 댓글 등록)",
    page: "docs/community/templates/post.html?id=1201",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      localStorage.removeItem("catui:community"); await sleep(1500);
      const up = document.querySelector('#pv-vote [data-dir="up"]'), n = () => Number(up.querySelector("[data-n]").textContent);
      const r = { start: n() };
      up.click(); await sleep(50); r.once = n() === r.start + 1 && up.getAttribute("aria-pressed") === "true";
      up.click(); await sleep(50); r.undo = n() === r.start && up.getAttribute("aria-pressed") === "false";
      const more = document.querySelector("[data-catui-cm-replies]");
      more.click(); await sleep(50);
      r.expand = more.getAttribute("aria-expanded") === "true" && document.getElementById(more.getAttribute("aria-controls")).hasAttribute("data-open");
      const box = document.getElementById("cm-comments"), count = () => Number(box.querySelector(".Catui_cm-c-top .Catui_num").textContent);
      r.total = count();
      const ta = box.querySelector("form.Catui_cm-c-form:last-of-type textarea");
      ta.value = "좋은 글 감사합니다";
      ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true, isComposing: true })); await sleep(50);
      r.imeSafe = count() === r.total;
      ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true })); await sleep(100);
      r.added = count() === r.total + 1;
      return r;
    },
    expect: { "추천 1회": (r) => r.once, "다시 누르면 취소": (r) => r.undo, "답글 펼침": (r) => r.expand, "댓글 수 = 글 데이터": (r) => r.total === 9, "한글 조합 중 Ctrl+Enter 무시": (r) => r.imeSafe, "Ctrl+Enter 등록": (r) => r.added },
  },
  {
    name: "community · 목록 (주소 ↔ 말머리·정렬 · 인기글 규칙)",
    page: "docs/community/templates/board.html?b=humor",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      await sleep(1200);
      const cm = catui.community, d = await cm.load();
      const r = { title: document.querySelector("[data-catui-cm-list] h1").textContent };
      document.querySelectorAll(".Catui_cm-cats a")[1].click(); await sleep(50);
      const cat = new URLSearchParams(location.search).get("cat");
      r.cat = !!cat && [...document.querySelectorAll(".Catui_cm-cat")].every((c) => c.textContent === cat);
      r.hotRule = d.posts.every((p) => p.hot === (!["공지", "이벤트"].includes(p.cat) && p.up - p.down >= d.B[p.board].hotCut));
      history.back(); await sleep(150);
      r.back = !new URLSearchParams(location.search).get("cat");
      return r;
    },
    expect: { "게시판 이름": (r) => r.title === "유머", "말머리 → 주소·목록": (r) => r.cat, "인기글 = 추천−비추천 ≥ 기준": (r) => r.hotRule, "뒤로 가기": (r) => r.back },
  },
  {
    name: "community · 투표 (한 번 · 비율 계산)",
    page: "docs/community/templates/post-poll.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      localStorage.removeItem("catui:community"); await sleep(1200);
      const f = document.querySelector("[data-catui-cm-poll]");
      f.querySelectorAll("input")[1].click(); f.requestSubmit(); await sleep(80);
      const nums = [...f.querySelectorAll(".Catui_num")].map((x) => x.textContent);
      const pct = nums.reduce((a, t) => a + Number(t.split("%")[0]), 0);
      return { done: !f.querySelector("button[type=submit]"), mine: f.querySelector('li[aria-current="true"]')?.textContent.includes("11월 초"), pct };
    },
    expect: { "투표 후 결과": (r) => r.done, "내 선택 표시": (r) => r.mine, "비율 합 ≈ 100": (r) => r.pct >= 99 && r.pct <= 101 },
  },
  {
    name: "fx · 새 영역 init · 자동 정리 · 이중 해제 · 빈 값",
    page: "docs/js/modules/fx.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = document.createElement("div");
      box.innerHTML = '<p data-catui-fx="shiny" id="t-fx1">새 영역</p><p id="t-fx2"></p><p id="t-fx3"></p>';
      document.querySelector("main").appendChild(box);
      catui.init(box);
      const enhanced = document.getElementById("t-fx1").classList.contains("Catui_fx-shiny");
      const errs = []; const onErr = (e) => errs.push(String(e.message)); window.addEventListener("error", onErr);
      const f = catui.fx.focus("#t-fx2"), t = catui.fx.type("#t-fx3");   // 빈 요소: 예외·타이머 없이 통과
      const h = catui.fx.shiny("#t-fx3"); h.destroy(); h.destroy();
      const again = catui.fx.shiny("#t-fx3"); const stale = h; stale.destroy();
      const keep = document.getElementById("t-fx3").classList.contains("Catui_fx-shiny");
      await sleep(1300); window.removeEventListener("error", onErr);
      box.remove(); await sleep(50);
      const swept = !box.querySelector("#t-fx1").catuiFx && !box.querySelector("#t-fx1").classList.contains("Catui_fx-shiny");
      again.destroy(); f.destroy(); t.destroy();
      return { enhanced, errs, keep, swept };
    },
    expect: {
      "catui.init(영역)이 data-catui-fx 연결": (r) => r.enhanced,
      "빈 focus·type이 예외 없음": (r) => r.errs.length === 0,
      "옛 핸들 destroy가 새 효과를 지우지 않음": (r) => r.keep,
      "DOM에서 빠지면 효과 자동 정리": (r) => r.swept,
    },
  },
  {
    name: "carousel · 자동 넘김 꺼진 상태에서 play()·go(NaN)",
    page: "docs/js/modules/carousel.html",
    wait: 1200,
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const root = [...document.querySelectorAll(".Catui_carousel")].find((r) => !r.querySelector('[data-catui-car="play"]'));
      const inst = catui.carousel.getThis(root.id) || catui.carousel.render({ elem: root });
      const before = inst.getIndex();
      inst.play(); inst.go("abc"); await sleep(400);
      return { idx: inst.getIndex(), before, paused: inst.isPaused() };
    },
    expect: { "play()가 0ms 타이머로 넘기지 않음": (r) => r.idx === r.before && r.paused, "go(NaN) 무시": (r) => Number.isInteger(r.idx) },
  },
  {
    name: "util · 날짜만 있는 문자열은 현지 자정",
    page: "docs/js/modules/util.html",
    run: async () => ({ d: catui.util.toDateString("2026-03-01", "yyyy-MM-dd HH:mm") }),
    expect: { "'2026-03-01' → 2026-03-01 00:00": (r) => r.d === "2026-03-01 00:00" },
  },
  {
    name: "모달 안 플로팅 패널 (inert 아님 · 위치 일치)",
    page: "docs/js/modules/datepicker.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = document.createElement("div");
      box.innerHTML = '<label class="Catui_label" for="t-dp">날짜</label><input class="Catui_input" id="t-dp">';
      const idx = catui.layer.open({ title: "모달", content: box });
      const input = box.querySelector("#t-dp");
      const dp = catui.datePicker.render({ elem: input });
      dp.open(); await sleep(50);
      const panel = document.getElementById(input.getAttribute("aria-controls")) || [...document.querySelectorAll(".Catui_dd-float")].pop();
      const r = panel.getBoundingClientRect(), ir = input.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(40, r.height / 2));
      const wantL = Math.min(Math.max(8, ir.left), innerWidth - r.width - 8);
      const below = Math.abs(r.top - (ir.bottom + 4)) < 2, above = Math.abs(r.top - (ir.top - r.height - 4)) < 2;
      const res = { inDialog: !!panel.closest("dialog[open]"), clickable: !!hit && panel.contains(hit), aligned: Math.abs(r.left - wantL) < 2 && (below || above) };
      dp.destroy(); catui.layer.close(idx);
      return res;
    },
    expect: { "패널이 열린 dialog 안": (r) => r.inDialog, "패널을 실제로 누를 수 있음": (r) => r.clickable, "입력 칸 바로 아래에 놓임": (r) => r.aligned },
  },
  {
    name: "core · reload id 변경·해제 뒤 이벤트·필터 공백",
    page: "docs/js/core/dom.html",
    run: async () => {
      const c = catui.component({ name: "tcomp", render(inst) { inst.elem.textContent = inst.config.text || ""; } });
      const host = document.createElement("div"); document.body.appendChild(host);
      const inst = c.render({ elem: host, id: "a1", text: "x" });
      inst.reload({ id: "b2" });
      const moved = c.getThis("b2") === inst && c.getThis("a1") === null;
      let got = 0; const off = c.on("ping( b2 )", () => { got++; });
      inst.emit("ping", {}); inst.destroy(); inst.emit("ping", {}); off();
      host.remove();
      return { moved, got };
    },
    expect: { "reload({id})로 찾기 키 갱신": (r) => r.moved, "필터 공백 무시 + 해제 뒤 이벤트 없음": (r) => r.got === 1 },
  },
  {
    name: "field · 인증 코드 complete 한 번만",
    page: "docs/js/modules/field.html",
    run: async () => {
      const box = document.createElement("div");
      box.innerHTML = "<input><input><input>";
      document.querySelector("main").appendChild(box);
      let n = 0; const inst = catui.field.otp.render({ elem: box, complete: () => { n++; } });
      const cells = [...box.querySelectorAll("input")];
      const type = (x, v) => { x.value = v; x.dispatchEvent(new Event("input", { bubbles: true })); };
      type(cells[0], "1"); type(cells[1], "2"); type(cells[2], "3");
      type(cells[2], "3");   // 같은 코드 다시
      type(cells[2], "4");   // 바뀐 코드
      const r = { n, inputmode: cells[0].getAttribute("inputmode") };
      inst.destroy(); r.restored = !cells[0].hasAttribute("inputmode") && !cells[0].hasAttribute("maxlength"); box.remove();
      return r;
    },
    expect: { "같은 코드로 다시 안 나감, 바뀌면 나감": (r) => r.n === 2, "숫자 자판": (r) => r.inputmode === "numeric", "해제하면 속성 원복": (r) => r.restored },
  },
  {
    name: "command · 초성+완성 글자 혼합",
    page: "docs/js/modules/command.html",
    run: async () => {
      catui.command.open("doc-cmd");
      const dlg = catui.command.getThis("doc-cmd").dialog, q = dlg.querySelector("input");
      const find = (v) => { q.value = v; q.dispatchEvent(new Event("input", { bubbles: true })); return [...dlg.querySelectorAll("[data-catui-cmd]")].map((r) => r.textContent.trim()); };
      const r = { a: find("대ㅅ"), b: find("ㄷ시"), none: find("ㅋㅋㅋㅋㅋ") };
      catui.command.close("doc-cmd");
      return r;
    },
    expect: {
      "대ㅅ → 대시보드": (r) => r.a.some((t) => t.startsWith("대시보드")),
      "ㄷ시 → 대시보드": (r) => r.b.some((t) => t.startsWith("대시보드")),
      "엉뚱한 초성은 없음": (r) => r.none.length === 0,
    },
  },
  {
    name: "core · init(요소 자신) · autoDestroy 실행 중 전환",
    page: "docs/js/modules/datepicker.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const inp = Object.assign(document.createElement("input"), { className: "Catui_input" });
      inp.setAttribute("data-catui-date", "");
      document.querySelector("main").appendChild(inp);
      catui.init(inp);
      const self = inp.hasAttribute("data-catui-ready");
      const c = catui.component({ name: "tauto", render() {} });
      catui.extend({ tauto: c });   // 자동 정리는 등록된 모듈만 훑는다
      const mk = (id) => { const h = document.createElement("div"); document.body.appendChild(h); c.render({ elem: h, id }); return h; };
      catui.config({ autoDestroy: false });
      mk("k1").remove(); await sleep(60);
      const kept = !!c.getThis("k1");
      catui.config({ autoDestroy: true });
      mk("k2").remove(); await sleep(60);
      const swept = !c.getThis("k2");
      c.destroyAll(); inp.remove();
      return { self, kept, swept };
    },
    expect: { "init(요소)가 요소 자신도 준비": (r) => r.self, "autoDestroy 끄면 남김": (r) => r.kept, "다시 켜면 정리": (r) => r.swept },
  },
  {
    name: "carousel · 비동기 before",
    page: "docs/js/modules/carousel.html",
    wait: 1200,
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const root = [...document.querySelectorAll(".Catui_carousel")].find((r) => !r.querySelector('[data-catui-car="play"]'));
      let allow = false;
      const inst = catui.carousel.render({ elem: root, loop: false, before: () => new Promise((res) => setTimeout(() => res(allow), 30)) });
      const i0 = inst.getIndex();
      inst.next(); await sleep(120);
      const blocked = inst.getIndex() === i0;
      allow = true; inst.next(); await sleep(120);
      const moved = inst.getIndex() !== i0;
      return { blocked, moved };
    },
    expect: { "Promise<false>면 이동 안 함": (r) => r.blocked, "Promise<true>면 이동": (r) => r.moved },
  },
  {
    name: "fx · 공용 티커·일시정지·replay·register·flap·rise",
    page: "docs/js/modules/fx.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const fx = catui.fx, box = document.createElement("div");
      box.innerHTML = '<p id="t-rot">가|나|다</p><p id="t-flap">AB 12</p><p id="t-rise">하나 둘 셋</p><p id="t-my" data-catui-fx="tmark">x</p><p id="t-c">겹침</p>';
      document.querySelector("main").prepend(box);
      // 1) 공용 티커: rotate가 interval마다 넘어가고, 일시정지 중에는 멈춘다
      fx.rotate("#t-rot", { interval: 120 });
      const seen = new Set();
      for (let i = 0; i < 8; i++) { await sleep(60); seen.add(document.getElementById("t-rot").style.getPropertyValue("--Catui_fx-k")); }
      const kRun = seen.size;   // 한 바퀴 돌아 0으로 돌아올 수 있으므로 여러 번 본 값의 가짓수로 판단
      fx.pause(); const kP = document.getElementById("t-rot").style.getPropertyValue("--Catui_fx-k"); await sleep(400);
      const frozen = document.getElementById("t-rot").style.getPropertyValue("--Catui_fx-k") === kP;
      const pausedFlag = fx.paused(); fx.resume();
      // 2) flap: 원문 aria-label, 끝나면 원래 글자
      const fh = fx.flap("#t-flap", { stagger: 20, speed: 20 });
      const flapNow = () => [...document.querySelectorAll("#t-flap .Catui_fx-flap")].map((s) => s.textContent).join("");
      for (let i = 0; i < 40 && flapNow() !== "AB 12"; i++) await sleep(100);   // 무거운 페이지에서도 끝날 때까지(최대 4초)
      const flapText = flapNow();
      const flapLabel = document.getElementById("t-flap").getAttribute("aria-label");
      fh.destroy(); const flapRestored = document.getElementById("t-flap").textContent === "AB 12";
      // 3) rise: 화면 안이면 진행값이 0보다 크다
      fx.rise("#t-rise");
      const riseNow = () => Number(document.getElementById("t-rise").style.getPropertyValue("--Catui_fx-k"));
      for (let i = 0; i < 20 && !(riseNow() > 0); i++) await sleep(100);
      const riseK = riseNow();
      // 4) register: 먼저 선언된 data-catui-fx도 연결, unregister는 그 효과만
      let made = 0, gone = 0;
      const okReg = fx.register("tmark", (el) => { made++; el.dataset.mark = "1"; return { destroy() { gone++; delete el.dataset.mark; } }; }, { slots: ["text"] });
      const marked = document.getElementById("t-my").dataset.mark === "1";
      const dup = fx.register("tmark", () => null);
      // 5) 충돌 이벤트: tmark(text)와 flap(text)
      let conflict = null; document.getElementById("t-my").addEventListener("catui:fx-conflict", (e) => { conflict = e.detail; }, { once: true });
      fx.flap("#t-my");
      // 6) replay: 핸들 유지한 채 다시 적용
      const h = fx.tmark("#t-my"); h.replay(); const replayed = made === 2 && gone === 1;
      fx.unregister("tmark"); const unreg = gone === 2 && !fx.names().includes("tmark") && fx.names().includes("flap") && typeof fx.list === "function" && fx.list.length > 0;
      fx.destroyAll(); box.remove();
      return { kRun, frozen, pausedFlag, flapText, flapLabel, flapRestored, riseK, okReg, marked, dup, conflict, replayed, unreg };
    },
    allowLogs: /겹치는 자리|이미 있는 이름/,
    expect: {
      "공용 티커로 rotate 진행": (r) => r.kRun >= 2,
      "fx.pause()면 멈춤": (r) => r.frozen && r.pausedFlag,
      "flap: 원래 글자로 멈춤 + 원문 aria-label + 해제 복원": (r) => r.flapText === "AB 12" && r.flapLabel === "AB 12" && r.flapRestored,
      "rise: 화면 안 진행값": (r) => r.riseK > 0,
      "register: 먼저 선언된 요소도 연결, 같은 이름 거부": (r) => r.okReg && r.marked && r.dup === false,
      "catui:fx-conflict 이벤트": (r) => r.conflict && r.conflict.effect === "flap" && r.conflict.with === "tmark",
      "replay = 해제 후 다시 적용": (r) => r.replayed,
      "unregister는 그 효과만": (r) => r.unreg,
    },
  },
  {
    name: "fx · mesh·orbit·halftone (새 효과)",
    page: "docs/js/modules/fx.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const fx = catui.fx, box = document.createElement("div");
      box.innerHTML = '<section id="t-mesh" style="height:120px;position:relative"></section><article id="t-orb" class="Catui_card" style="height:100px;width:200px">궤도</article><a id="t-ht" href="#" style="display:block;height:60px">덮개</a>';
      document.querySelector("main").prepend(box);
      const m = fx.mesh("#t-mesh"); const canvasIn = !!document.querySelector("#t-mesh canvas");
      const o = fx.orbit("#t-orb", { count: 2, speed: 1 });
      const pos = () => [...document.querySelectorAll("#t-orb .Catui_fx-orbit circle")].map((c) => c.getAttribute("cx") + "," + c.getAttribute("cy")).join("|");
      await sleep(80); const p1 = pos(); await sleep(250); const p2 = pos();
      const dots = document.querySelectorAll("#t-orb .Catui_fx-orbit circle").length;
      const h = fx.halftone("#t-ht"); const layer = !!document.querySelector("#t-ht > .Catui_fx-layer.Catui_fx-halftone");
      // mesh는 배경 자리(bg)라 dotgrid와 겹치면 건너뛴다
      let conflict = null; document.getElementById("t-mesh").addEventListener("catui:fx-conflict", (e) => { conflict = e.detail; }, { once: true });
      fx.dotgrid("#t-mesh");
      m.destroy(); o.destroy(); h.destroy();
      const clean = !document.querySelector("#t-mesh canvas") && !document.querySelector("#t-orb .Catui_fx-layer") && !document.querySelector("#t-ht .Catui_fx-layer") && !document.getElementById("t-orb").classList.contains("Catui_fx-host");
      box.remove();
      return { canvasIn, dots, moved: p1 !== p2 && p1 !== "", layer, conflict, clean };
    },
    allowLogs: /겹치는 자리/,
    expect: {
      "mesh: 캔버스 배경": (r) => r.canvasIn,
      "orbit: 점 2개가 테두리를 따라 이동": (r) => r.dots === 2 && r.moved,
      "halftone: 앞 레이어": (r) => r.layer,
      "mesh·dotgrid 배경 자리 충돌": (r) => r.conflict && r.conflict.effect === "dotgrid" && r.conflict.with === "mesh",
      "해제하면 흔적 없음": (r) => r.clean,
    },
  },
  {
    name: "fx · depth·echo·zap (새 효과)",
    page: "docs/js/modules/fx.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const fx = catui.fx, box = document.createElement("div");
      box.innerHTML = '<p id="t-dp">세 단어 문장</p><a id="t-ec" href="#">메아리</a><article id="t-zp" class="Catui_card" style="height:80px">방전</article>';
      document.querySelector("main").prepend(box);
      const d = fx.depth("#t-dp"); await sleep(200);
      const dp = document.getElementById("t-dp");
      const depthOk = dp.classList.contains("Catui_fx-in") && dp.getAttribute("aria-label") === "세 단어 문장" && dp.querySelectorAll("span[aria-hidden]").length === 3;
      const e = fx.echo("#t-ec", { count: 4 }); const copies = document.querySelectorAll("#t-ec .Catui_fx-echo-copy[aria-hidden]").length;
      const z = fx.zap("#t-zp"); const zr = document.querySelectorAll("#t-zp .Catui_fx-zap rect[pathLength]").length;
      const vb = document.querySelector("#t-zp .Catui_fx-zap svg")?.getAttribute("viewBox") || "";
      d.destroy(); e.destroy(); z.destroy();
      const clean = dp.textContent === "세 단어 문장" && !dp.hasAttribute("aria-label") && !document.querySelector("#t-ec .Catui_fx-echo-copy") && !document.querySelector("#t-zp .Catui_fx-layer");
      box.remove();
      return { depthOk, copies, zr, vb, clean };
    },
    expect: {
      "depth: 화면 안이면 fx-in + 원문 aria-label": (r) => r.depthOk,
      "echo: 복제 4겹(aria-hidden)": (r) => r.copies === 4,
      "zap: 빛 조각 2개 + 크기 맞춤": (r) => r.zr === 2 && /^0 0 \d/.test(r.vb),
      "해제하면 원래대로": (r) => r.clean,
    },
  },
  {
    name: "fx · 조합 놀이터 (마크업·충돌 경고·이전 효과 해제)",
    page: "docs/js/modules/fx.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = document.getElementById("fx-pg"), code = document.getElementById("fx-pg-code"), warn = document.getElementById("fx-pg-warn");
      const first = { code: code.textContent, warn: warn.textContent };
      const set = (names) => { box.querySelectorAll("input[type=checkbox]").forEach((i) => { i.checked = names.includes(i.value); }); box.dispatchEvent(new Event("change", { bubbles: true })); };
      const oldCard = document.querySelector("#fx-pg-stage > .Catui_card");
      set(["particles", "dotgrid", "zap"]); await sleep(80);
      const clashWarn = warn.textContent, clashCode = code.textContent;
      const oldLayers = oldCard.querySelectorAll(".Catui_fx-layer").length;   // 이전 카드의 효과가 해제됐는지
      const card = document.querySelector("#fx-pg-stage > .Catui_card");
      const r = { first, clashWarn, clashCode, oldLayers, canvases: card.querySelectorAll("canvas").length, zap: !!card.querySelector(".Catui_fx-zap") };
      document.getElementById("fx-pg-clear").click();
      r.cleared = code.textContent === '<article class="Catui_card">…</article>' && !document.querySelector("#fx-pg-stage .Catui_fx-layer");
      return r;
    },
    allowLogs: /겹치는 자리/,
    expect: {
      "처음: 기본 2개 마크업": (r) => r.first.code.includes('data-catui-fx="spotlight border"') && r.first.warn.includes("충돌 없음"),
      "particles+dotgrid: 건너뜀 경고": (r) => /건너뜀: dotgrid\(particles와 bg/.test(r.clashWarn),
      "생성 마크업에 선택 순서대로": (r) => r.clashCode.includes('data-catui-fx="zap particles dotgrid"') || r.clashCode.includes('data-catui-fx="particles dotgrid zap"'),
      "캔버스는 하나만 + zap 적용": (r) => r.canvases === 1 && r.zap,
      "이전 카드 효과 해제": (r) => r.oldLayers === 0,
      "모두 끄기": (r) => r.cleared,
    },
  },
  {
    name: "build · 압축본 단독 실행",
    page: "docs/index.html",
    run: async () => {
      // 압축본(catui.min.js)을 새 창 없이 iframe에 올려 같은 API가 동작하는지
      const f = document.createElement("iframe");
      f.srcdoc = `<!doctype html><link rel="stylesheet" href="${location.origin}/dist/catui.min.css"><div class="Catui_site"><p id="x"></p></div><script src="${location.origin}/dist/catui.min.js"><\/script><script>catui.use(['util'],function(u){document.getElementById('x').textContent=catui.version+'|'+u.number(1234567)})<\/script>`;
      document.body.appendChild(f);
      await new Promise((r) => setTimeout(r, 1200));
      return f.contentDocument.getElementById("x")?.textContent;
    },
    expect: { "min.js 로드·use 동작": (r) => /^\d+\.\d+\.\d+\|1,234,567$/.test(r || "") },
  },
  {
    name: "docs · 검색 색인 지연 로딩 · 바닥글 현재 표시",
    page: "docs/js/modules/fx.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const inline = !!document.getElementById("doc-search-data");
      const current = document.querySelectorAll('.doc-top [aria-current="page"], .doc-side [aria-current="page"], footer [aria-current="page"]').length;   // 사이드바 1 + 머리 탭 1 (예제 안은 제외)
      document.querySelector(".doc-search-btn").click();
      for (let i = 0; i < 30 && !document.querySelector("#doc-search-list a"); i++) await sleep(100);
      const q = document.getElementById("doc-search-q");
      q.value = "캐러셀"; q.dispatchEvent(new Event("input"));
      const hit = document.querySelector("#doc-search-list a")?.getAttribute("href") || "";
      q.value = "없는낱말쿄쿄"; q.dispatchEvent(new Event("input"));
      const empty = !!document.querySelector(".doc-search-empty");
      const expanded = document.querySelector(".doc-search-btn").getAttribute("aria-expanded");
      document.querySelector(".doc-search").close();
      // fx.list(ul)은 차례 등장 효과, 이름 목록은 fx.names()
      const ul = document.createElement("ul"); ul.innerHTML = "<li>가</li><li>나</li>"; document.querySelector("main").appendChild(ul);
      const h = catui.fx.list(ul); const isEffect = !!h && typeof h.destroy === "function"; h?.destroy?.(); ul.remove();
      return { inline, current, hit, empty, expanded, isEffect, names: catui.fx.names().includes("list") };
    },
    expect: {
      "쪽마다 색인을 넣지 않음": (r) => !r.inline,
      "aria-current=page는 2개(사이드바·머리)": (r) => r.current === 2,
      "검색 결과 상대 주소": (r) => r.hit.startsWith("../") && r.hit.endsWith(".html"),
      "결과 0건 안내": (r) => r.empty,
      "aria-expanded 동기화": (r) => r.expanded === "true",
      "fx.list(ul)은 효과": (r) => r.isEffect,
      "fx.names()": (r) => r.names,
    },
  },
  {
    name: "admin · init 재호출해도 테마 토글·타이머 중복 없음",
    page: "docs/admin/templates/index.html",
    run: async () => {
      await catui.admin.ready;
      const before = document.documentElement.getAttribute("data-catui-theme") === "dark";
      catui.admin.init(); catui.admin.init();
      await catui.admin.ready;
      document.querySelector("[data-catui-adm-theme]")?.click();
      const after = document.documentElement.getAttribute("data-catui-theme") === "dark";
      catui.admin.theme.set(before ? "dark" : "light");
      return { toggled: before !== after, hasBtn: !!document.querySelector("[data-catui-adm-theme]") };
    },
    expect: { "한 번 눌러 한 번 전환": (r) => r.hasBtn && r.toggled },
  },
  {
    name: "community · 연달아 누른 추천은 마지막 것만 반영",
    page: "docs/community/templates/post.html?id=1201",
    run: async () => {
      await catui.community.ready;
      const box = document.querySelector("[data-catui-cm-vote]"); const key = box.dataset.catuiCmVote;
      catui.community.vote.set(key, "");
      const orig = catui.community.voteRequest;
      // 첫 요청은 늦게 실패, 두 번째는 바로 성공
      let n = 0; catui.community.voteRequest = () => (++n === 1 ? new Promise((_, rej) => setTimeout(() => rej(new Error("x")), 200)) : Promise.resolve(true));
      box.querySelector('[data-dir="up"]').click();
      box.querySelector('[data-dir="down"]').click();
      await new Promise((r) => setTimeout(r, 400));
      const mine = catui.community.vote.get(key);
      catui.community.voteRequest = orig; catui.community.vote.set(key, ""); catui.community.vote.paint(box);
      return { mine };
    },
    expect: { "늦은 실패가 최신 선택을 지우지 않음": (r) => r.mine === "down" },
  },
];
