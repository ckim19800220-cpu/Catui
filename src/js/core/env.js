// 소스(ESM) 실행 시 dist 위치. 빌드는 이 파일을 포맷별 헤더로 대체한다
// (전역: document.currentScript 기준, ESM: import.meta.url 기준 — 둘 다 catui.js와 같은 폴더).
export const BASE = new URL("../../../dist/", import.meta.url).href;
