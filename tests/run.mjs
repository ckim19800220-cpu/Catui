// Catui E2E 테스트 (의존성 없음): 개발 서버를 띄우고 시스템 Chrome을 헤드리스로 조작한다.
//   npm test                      전체
//   npm test -- carousel field    이름에 해당 글자가 든 시나리오만
//   CATUI_CHROME=경로 npm test     Chrome 위치 직접 지정
// 1) 문서 전체 페이지: 예외·console.error/warn 0건   2) 모듈별 시나리오: 실제 클릭·입력·스크롤 결과 확인
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "./scenarios.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filters = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROMES = [process.env.CATUI_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const chromePath = CHROMES.find((p) => fs.existsSync(p));
if (!chromePath) { console.error("✗ Chrome/Edge를 찾지 못했습니다. CATUI_CHROME 환경 변수로 경로를 지정하세요."); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, "docs/index.html"))) { console.error("✗ docs가 없습니다. 먼저 npm run build"); process.exit(1); }

const port = 8800 + Math.floor(Math.random() * 100), dbg = port + 1000;
const server = spawn(process.execPath, [path.join(ROOT, "scripts/serve.mjs"), String(port)], { stdio: "ignore" });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "catui-test-"));
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} };
process.on("exit", cleanup);

let target;
for (let i = 0; i < 75 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json()).find((t) => t.type === "page"); } catch { await sleep(200); } }
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/docs/`); break; } catch { await sleep(100); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map(); let logs = [];
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); return; }
  if (d.method === "Runtime.exceptionThrown") logs.push(`예외: ${d.params.exceptionDetails.exception?.description?.split("\n")[0] || d.params.exceptionDetails.text}`);
  if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200)}`);
  if (d.method === "Log.entryAdded" && d.params.entry.level === "error") logs.push(`로드 오류: ${d.params.entry.text.slice(0, 160)} ${d.params.entry.url || ""}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Page.enable"); await send("Log.enable");
const open = async (p, ms = 1300) => { logs = []; await send("Page.navigate", { url: `http://127.0.0.1:${port}/${p}` }); await sleep(ms); };
const evaluate = async (fn) => {
  const r = await send("Runtime.evaluate", { expression: `(${fn.toString()})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};

let pass = 0, fail = 0;
const report = (ok, name, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`); };
const want = (name) => !filters.length || filters.some((f) => name.includes(f));

// 1) 문서 전체
if (want("docs")) {
  console.log("문서 전체 페이지 (예외·콘솔 오류 0건)");
  const pages = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith(".html")) pages.push(path.relative(ROOT, f).replace(/\\/g, "/")); });
  walk(path.join(ROOT, "docs"));
  const bad = [];
  for (const p of pages) { await open(p, 900); if (logs.length) bad.push(`${p}: ${[...new Set(logs)].join(" | ")}`); }
  report(!bad.length, `docs ${pages.length}쪽`, bad.length ? `\n      ${bad.join("\n      ")}` : "");
}

// 2) 시나리오
for (const s of scenarios) {
  if (!want(s.name)) continue;
  console.log(s.name);
  try {
    // 화면 크기 지정 시나리오 (예: viewport: [390, 844] 모바일)
    if (s.viewport) await send("Emulation.setDeviceMetricsOverride", { width: s.viewport[0], height: s.viewport[1], deviceScaleFactor: 1, mobile: s.viewport[0] < 768 });
    else await send("Emulation.clearDeviceMetricsOverride");
    await open(s.page, s.wait || 1500);
    const got = await evaluate(s.run);
    for (const [label, check] of Object.entries(s.expect)) {
      let ok = false, detail = "";
      try { ok = !!check(got); } catch (e) { detail = e.message; }
      report(ok, label, ok ? "" : detail || JSON.stringify(got).slice(0, 300));
    }
    const unexpected = [...new Set(logs)].filter((l) => !(s.allowLogs && s.allowLogs.test(l)));   // 시나리오가 일부러 낸 경고는 제외
    if (unexpected.length) report(false, "콘솔 오류 없음", unexpected.join(" | "));
  } catch (e) { report(false, "실행", e.message.split("\n")[0]); }
}

console.log(`\n${fail ? "✗" : "✓"} 통과 ${pass} · 실패 ${fail}`);
ws.close();
cleanup();
process.exit(fail ? 1 : 0);
