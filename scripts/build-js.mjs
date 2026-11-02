// JS: src/js 소스(ESM)를 bundle.json 순서로 이어 붙여 전역(catui.js)·ESM(catui.esm.js) 두 형식 생성.
// 규칙: import는 한 줄, 모듈 내부 도우미는 IIFE 안에 두거나 catui 접두사로 이름 충돌을 피한다.
import fs from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";
import { P, fail, read, readJson, write, walk, pkg } from "./lib.mjs";

export function buildJs({ defined }) {
  const { order, exports } = readJson(path.join(P.js, "bundle.json"));
  const listed = new Set([...order, "core/env.js", "index.js"]);
  const orphans = walk(P.js, ".js").map((f) => path.relative(P.js, f).replace(/\\/g, "/")).filter((f) => !listed.has(f));
  if (orphans.length) fail(`bundle.json에 없는 JS 파일: ${orphans.join(", ")}`);

  let body = "";
  for (const f of order) {
    const full = path.join(P.js, f);
    if (!fs.existsSync(full)) fail(`JS 소스가 없습니다: src/js/${f}`);
    const src = read(full)
      .replace(/^import\s.+?\sfrom\s+"[^"]+";[ \t]*\r?\n/gm, "")
      .replace(/^export\s+(const|let|function|class|async function)\s/gm, "$1 ");
    const left = src.match(/^\s*(import|export)\s.*$/m);
    if (left) fail(`번들에 남은 import/export (src/js/${f}): ${left[0].trim()}`);
    body += `\n// ── ${f} ──\n${src}`;
  }
  const version = pkg().version;
  const banner = `/*! Catui UI framework ${version} | MIT License (c) imcatDevs | 아이콘 Line 01(CC0) */`;
  const VERSION = `const VERSION = ${JSON.stringify(version)};`;   // core/env.js의 VERSION 대체
  const iife = `${banner}
(function (global) {
"use strict";
if (global.catui) console.warn("[Catui warn]: catui가 이미 있습니다. 덮어씁니다.");
const BASE = (() => { const s = document.currentScript; return s && s.src ? new URL(".", s.src).href : ""; })();
${VERSION}
${body}
global.catui = catui;
})(typeof window !== "undefined" ? window : globalThis);
`;
  const esm = `${banner}
const BASE = new URL(".", import.meta.url).href;
${VERSION}
${body}
export { ${exports.join(", ")} };
export default catui;
`;
  write(path.join(P.dist, "catui.js"), iife);
  write(path.join(P.dist, "catui.esm.js"), esm);
  // 압축본 + 소스맵 (소스맵은 압축 전 dist 파일을 가리킨다). 머리 주석(/*! … */)은 라이선스 표시로 남긴다
  const minify = (code, file, format) => {
    const out = transformSync(code, { minify: true, sourcemap: "external", sourcefile: file, target: "es2020", format: format === "esm" ? "esm" : undefined, legalComments: "inline", charset: "utf8" });
    const name = file.replace(/\.js$/, ".min.js");
    write(path.join(P.dist, name), `${out.code}//# sourceMappingURL=${name}.map\n`);
    const map = JSON.parse(out.map); map.file = name; map.sources = [file];
    write(path.join(P.dist, `${name}.map`), JSON.stringify(map));
    return out.code;
  };
  // 타입 선언 (src/types/catui.d.ts → dist/catui.d.ts)
  const dts = path.join(P.js, "..", "types", "catui.d.ts");
  if (fs.existsSync(dts)) write(path.join(P.dist, "catui.d.ts"), read(dts));
  const min = minify(iife, "catui.js", "iife");
  minify(esm, "catui.esm.js", "esm");

  // JS가 만드는 Catui_ 클래스도 CSS에 있어야 한다 (CSS 변수·템플릿 조각·아이콘 id 제외)
  const missing = new Set();
  for (const m of body.matchAll(/Catui_[A-Za-z0-9_-]*[A-Za-z0-9_]/g)) {
    const next = body[m.index + m[0].length];
    if (body.slice(m.index - 2, m.index) === "--" || next === "$" || next === "-" || m[0].startsWith("Catui_ic-")) continue;
    if (!defined.has(m[0])) missing.add(m[0]);
  }
  if (missing.size) fail(`JS가 쓰는데 CSS에 없는 클래스: ${[...missing].join(" ")}`);
  return { iife, esm, min };
}
