import { BASE } from "./env.js";

// 전역 설정 + 기본 유틸 (layui의 config / data / url / device / hint에 해당)
const catuiSettings = {
  icons: `${BASE}icons.svg?v=2`, // 아이콘 스프라이트 경로
  autoInit: true,                // DOMContentLoaded에 data-catui-* 자동 초기화
  autoDestroy: true,             // DOM에서 빠진 요소의 컴포넌트 인스턴스 자동 정리
  debug: true,                   // 콘솔 출력: true 경고·오류 / false 오류만(운영) / "silent" 모두 끔
  csrf: { meta: "csrf-token", header: "X-CSRF-Token" },   // 같은 출처 쓰기 요청에 붙일 CSRF 토큰 (false = 끔)
};

export function getConfig() {
  return catuiSettings;
}

export function config(options) {
  if (options && typeof options === "object") Object.assign(catuiSettings, options);
  return catuiSettings;
}

// 콘솔 출력 단계는 config.debug로 조절한다. detail(오류 객체·요소)은 콘솔에서 펼쳐 볼 수 있게 함께 넘긴다.
const catuiHintSeen = new Set();
const catuiHintOn = (type) => {
  const d = catuiSettings.debug;
  if (d === "silent") return false;
  return type === "error" || d !== false;
};
export const hint = {
  error(msg, type = "warn", ...detail) {
    if (!catuiHintOn(type)) return;
    (type === "error" ? console.error : console.warn)(`[Catui ${type}]: ${msg}`, ...detail);
  },
  errorOnce(msg, type = "warn", ...detail) {
    if (!catuiHintOn(type) || catuiHintSeen.has(msg)) return;
    if (catuiHintSeen.size > 100) catuiHintSeen.clear();
    catuiHintSeen.add(msg);
    hint.error(msg, type, ...detail);
  },
};

// CSRF: <meta name="csrf-token" content="…">의 값을 헤더로. 토큰 유출을 막기 위해
// 같은 출처(origin)이면서 상태를 바꾸는 요청(GET·HEAD·OPTIONS 제외)에만 붙인다.
export function csrfHeaders(url, method = "GET") {
  const c = catuiSettings.csrf;
  if (!c || /^(GET|HEAD|OPTIONS)$/i.test(method)) return {};
  let same = false;
  try { same = new URL(url, location.href).origin === location.origin; } catch { same = false; }
  if (!same) return {};
  // CSS.escape가 없는 구형 WebView에서도 예외 없이 — meta 이름을 선택자 대신 직접 비교
  const want = c.meta || "csrf-token";
  const token = [...document.getElementsByTagName("meta")].find((m) => m.getAttribute("name") === want)?.getAttribute("content");
  return token ? { [c.header || "X-CSRF-Token"]: token } : {};
}

// localStorage / sessionStorage 래퍼. data('표') 읽기, data('표', {key, value}) 쓰기,
// data('표', {key, remove:true}) 삭제, data('표', null) 표 삭제.
// 저장소를 못 쓰는 환경(사파리 비공개 창·쿠키 차단·용량 초과)에서도 예외를 던지지 않는다.
function catuiStore(kind, table, settings) {
  if (!table) return {};
  let storage;
  try { storage = window[kind]; } catch { storage = null; }
  if (!storage) { hint.errorOnce(`${kind}를 쓸 수 없는 환경입니다`); return {}; }
  const key = `catui:${table}`;
  let all = {};
  try { all = JSON.parse(storage.getItem(key) || "{}") || {}; } catch { all = {}; }
  try {
    if (settings === null) { storage.removeItem(key); return {}; }
    if (settings && typeof settings === "object" && "key" in settings) {
      if (settings.key === "__proto__") { hint.error(`data('${table}'): '__proto__'는 키로 쓸 수 없습니다`); return all; }
      if (settings.remove) delete all[settings.key];
      else all[settings.key] = settings.value;
      storage.setItem(key, JSON.stringify(all));
    }
  } catch (err) {
    hint.error(`data('${table}') 저장 실패: ${err?.name || err}`);
    // 저장하지 못한 값을 돌려주면 호출자가 저장된 줄 안다 — 실제 저장된 상태를 다시 읽어 돌려준다
    try { return JSON.parse(storage.getItem(key) || "{}") || {}; } catch { return {}; }
  }
  return all;
}
export function data(table, settings) {
  return catuiStore("localStorage", table, settings);
}
export function sessionData(table, settings) {
  return catuiStore("sessionStorage", table, settings);
}

// URL 해석: pathname 배열, search 객체, hash의 path/search
export function url(href = location.href) {
  const u = new URL(href, location.href);
  const search = Object.fromEntries(u.searchParams);
  const h = u.hash.replace(/^#/, "");
  // 첫 '?'에서만 나눈다(#/p?x=1?y=2의 뒷부분을 버리지 않게). 같은 키가 여럿이면 마지막 값
  const qi = h.indexOf("?"), hPath = qi < 0 ? h : h.slice(0, qi), hQuery = qi < 0 ? "" : h.slice(qi + 1);
  return {
    pathname: u.pathname.split("/").filter(Boolean),
    search,
    hash: {
      path: hPath.split("/").filter(Boolean),
      search: Object.fromEntries(new URLSearchParams(hQuery)),
      href: h,
    },
  };
}

// 실행 환경 정보. device('MYAPP')처럼 UA 표식도 검사한다.
export function device(key) {
  const ua = navigator.userAgent;
  // iPhone UA에는 "like Mac OS X"가, iPadOS 13+는 "Macintosh"가 들어 있으므로 ios를 mac보다 먼저 본다
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const info = {
    os: /windows/i.test(ua) ? "windows" : android ? "android" : ios ? "ios" : /mac/i.test(ua) ? "mac" : /linux/i.test(ua) ? "linux" : "",
    android,
    ios,
    mobile: /mobile/i.test(ua) || android || ios,
  };
  if (key) info[key] = new RegExp(`${String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(ua);
  return info;
}
