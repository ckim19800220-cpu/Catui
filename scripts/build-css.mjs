// CSS: src/css/index.json 순서대로 결합 → dist/catui.css, catui.min.css
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import { P, fail, read, readJson, write, walk, rel, pkg, bytes } from "./lib.mjs";

export function buildCss() {
  const order = readJson(path.join(P.css, "index.json"));
  const listed = new Set(order);
  for (const f of order) if (!fs.existsSync(path.join(P.css, f))) fail(`index.json의 CSS 파일이 없습니다: src/css/${f}`);
  const orphans = walk(P.css, ".css").map((f) => path.relative(P.css, f).replace(/\\/g, "/")).filter((f) => !listed.has(f));
  if (orphans.length) fail(`index.json에 없는 CSS 파일: ${orphans.join(", ")} — 결합 순서에 넣어 주세요`);

  let css = `/*! Catui UI ${pkg().version} | MIT License (c) imcatDevs | 토큰은 assets/spec/design_m.html 기준 | 아이콘 Line 01(CC0) */\n`;
  for (const f of order) css += read(path.join(P.css, f)) + "\n";

  const min = transform({ filename: "catui.css", code: Buffer.from(css), minify: true }).code.toString();
  const mix = (s) => (s.match(/color-mix\(/g) || []).length;
  if (mix(min) < mix(css)) fail("압축이 color-mix를 다른 색으로 바꿨습니다.");
  if (bytes(min) >= bytes(css)) fail("catui.min.css가 catui.css보다 작지 않습니다.");

  write(path.join(P.dist, "catui.css"), css);
  write(path.join(P.dist, "catui.min.css"), min);

  // 주석 속 클래스 이름(설명용)은 정의로 치지 않는다
  const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  const defined = new Set([...noComments(css).matchAll(/\.(Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  // 파일별 정의 클래스 (문서 자동 표에 사용)
  const byFile = Object.fromEntries(order.map((f) => {
    const src = noComments(read(path.join(P.css, f)));
    return [f, [...new Set([...src.matchAll(/\.(Catui_[A-Za-z0-9_-]+)/g)].map((m) => m[1]))]];
  }));
  return { css, min, defined, byFile, files: order.length, out: rel(path.join(P.dist, "catui.css")) };
}
