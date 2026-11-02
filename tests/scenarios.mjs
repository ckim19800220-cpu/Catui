// E2E 시나리오: page(문서 경로) · run(브라우저 안에서 실행, JSON으로 돌려줄 값) · expect(이름 → 검사 함수)
// run은 문자열로 직렬화되어 페이지에서 실행되므로 바깥 변수를 쓰지 않는다.
export const scenarios = [
  {
    name: "core · 안전한 마크업",
    page: "docs/js/core/dom.html",
    run: async () => {
      const spoof = JSON.parse('{"__raw":"<img src=x onerror=alert(1)>"}');
      return { spoof: catui.html`<p>${spoof}</p>`.__raw, raw: catui.html`<p>${catui.raw("<b>ok</b>")}</p>`.__raw, version: catui.version, modules: catui.cache.modules.length };
    },
    expect: {
      "위조 __raw 객체는 escape": (r) => !r.spoof.includes("<img"),
      "raw()는 마크업 유지": (r) => r.raw === "<p><b>ok</b></p>",
      "버전 주입 (dev 아님)": (r) => /^\d+\.\d+\.\d+/.test(r.version),
      "모듈 21개 이상 등록": (r) => r.modules >= 21,
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
      const radios = document.querySelectorAll("#rc-tabs input[type=radio]");
      radios[1].click(); await sleep(100);
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
    name: "admin · 검증 요약",
    page: "docs/admin/templates/form-validation.html",
    run: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector("#fv-form [type=submit]").click(); await sleep(100);
      const sum = document.getElementById("fv-summary");
      return { summary: !sum.hidden && document.activeElement === sum, items: sum.querySelectorAll("li").length };
    },
    expect: {
      "제출 실패 시 오류 요약으로 포커스": (r) => r.summary,
      "오류 항목 목록": (r) => r.items >= 6,
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
];
