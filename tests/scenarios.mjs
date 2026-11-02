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
