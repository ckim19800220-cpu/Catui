import { BASE } from "./env.js";

// 전역 설정 + 기본 유틸 (layui의 config / data / url / device / hint에 해당)
const catuiSettings = {
  icons: `${BASE}icons.svg?v=2`, // 아이콘 스프라이트 경로
  autoInit: true,                // DOMContentLoaded에 data-catui-* 자동 초기화
  debug: false,
};

export function getConfig() {
  return catuiSettings;
}

export function config(options) {
  if (options && typeof options === "object") Object.assign(catuiSettings, options);
  return catuiSettings;
}

const catuiHintSeen = new Set();
export const hint = {
  error(msg, type = "warn") {
    (type === "error" ? console.error : console.warn)(`[Catui ${type}]: ${msg}`);
  },
  errorOnce(msg, type = "warn") {
    if (catuiHintSeen.has(msg)) return;
    if (catuiHintSeen.size > 100) catuiHintSeen.clear();
    catuiHintSeen.add(msg);
    hint.error(msg, type);
  },
};

// localStorage / sessionStorage 래퍼. data('표') 읽기, data('표', {key, value}) 쓰기,
// data('표', {key, remove:true}) 삭제, data('표', null) 표 삭제.
function catuiStore(storage, table, settings) {
  if (!table) return {};
  const key = `catui:${table}`;
  let all = {};
  try { all = JSON.parse(storage.getItem(key) || "{}") || {}; } catch { all = {}; }
  if (settings === null) { storage.removeItem(key); return {}; }
  if (settings && typeof settings === "object" && "key" in settings) {
    if (settings.remove) delete all[settings.key];
    else all[settings.key] = settings.value;
    storage.setItem(key, JSON.stringify(all));
  }
  return all;
}
export function data(table, settings) {
  return catuiStore(window.localStorage, table, settings);
}
export function sessionData(table, settings) {
  return catuiStore(window.sessionStorage, table, settings);
}

// URL 해석: pathname 배열, search 객체, hash의 path/search
export function url(href = location.href) {
  const u = new URL(href, location.href);
  const search = Object.fromEntries(u.searchParams);
  const h = u.hash.replace(/^#/, "");
  const [hPath, hQuery = ""] = h.split("?");
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
  const info = {
    os: /windows/i.test(ua) ? "windows" : /mac/i.test(ua) ? "mac" : /android/i.test(ua) ? "android" : /iphone|ipad|ios/i.test(ua) ? "ios" : /linux/i.test(ua) ? "linux" : "",
    android: /android/i.test(ua),
    ios: /iphone|ipad|ipod/i.test(ua),
    mobile: /mobile|android|iphone|ipad/i.test(ua),
  };
  if (key) info[key] = new RegExp(`${String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(ua);
  return info;
}
