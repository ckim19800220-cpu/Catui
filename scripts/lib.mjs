// 빌드 공통: 경로·실패 처리·읽기/쓰기
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const P = {
  css: path.join(ROOT, "src/css"),
  js: path.join(ROOT, "src/js"),
  icons: path.join(ROOT, "src/icons"),
  dist: path.join(ROOT, "dist"),
  docsSrc: path.join(ROOT, "docs-src"),
  docs: path.join(ROOT, "docs"),
};

export function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

export const read = (file) => fs.readFileSync(file, "utf8");
export const readJson = (file) => JSON.parse(read(file));
export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
export const rel = (file) => path.relative(ROOT, file).replace(/\\/g, "/");

export function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, ext) : !ext || e.name.endsWith(ext) ? [full] : [];
  });
}

export const pkg = () => readJson(path.join(ROOT, "package.json"));
export const bytes = (s) => Buffer.byteLength(s);

// 시각 원칙 검사 (tokens.css 머리 주석 · 문서 css/foundation/visual 참고) — 본체·확장·문서 CSS 공통
//  1) 테두리 2px 이상 금지: 포커스 링·활성 표시줄·상태 표식처럼 꼭 필요한 곳은 같은 줄에 /* 굵은선 허용: 이유 */ 주석
//     (굵기를 토큰 var(--Catui_tab-indicator-w)·var(--Catui_accent-w) 등으로 쓰면 이유가 이름에 드러나므로 통과)
//  2) border-radius에 토큰이 아닌 길이 금지 (0 · 50% · inherit 허용)
//  3) backdrop-filter를 쓰면 같은 파일에 @supports not (backdrop-filter) 폴백과 prefers-reduced-transparency 처리 필수
export function visualErrors(src, file) {
  const errs = [];
  const lines = src.split(/\r?\n/);
  const clean = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  lines.forEach((line, i) => {
    const code = clean(line);
    if (/border(-(top|right|bottom|left|inline|block)(-(start|end))?)?(-width)?\s*:\s*[2-9](\.\d+)?px/.test(code) && !/굵은선 허용:/.test(line))
      errs.push(`${file}:${i + 1} 테두리는 1px — 2px 이상은 포커스·활성 표시줄만(같은 줄에 /* 굵은선 허용: 이유 */)`);
    for (const m of code.matchAll(/(?:^|[;{\s])((?:border(?:-[a-z]+)*-radius)|--Catui_[\w-]*radius[\w-]*)\s*:\s*([^;}]+)/g)) {
      if (/foundation\/tokens\.css$/.test(file) && m[1].startsWith("--")) continue;
      const rest = m[2].replace(/var\(--Catui_[\w-]+\)/g, "").replace(/calc\([^;]*\)/g, "");
      if (/(^|[^\w.-])(?:[1-9]\d*(?:\.\d+)?|0?\.\d+)(px|rem|em)\b/.test(rest))
        errs.push(`${file}:${i + 1} 모서리는 토큰만 — ${m[1]}:${m[2].trim()} → var(--Catui_radius-*)`);
    }
  });
  const body = clean(src);
  if (/(?:^|[;{\s])(?:-webkit-)?backdrop-filter\s*:\s*(?!none)/.test(body)) {
    if (!/@supports\s+not\s*\(\s*\(?\s*backdrop-filter/.test(body)) errs.push(`${file} backdrop-filter를 쓰면 @supports not (backdrop-filter:…) 불투명 폴백이 같은 파일에 있어야 합니다`);
    if (!/prefers-reduced-transparency/.test(body)) errs.push(`${file} backdrop-filter를 쓰면 @media (prefers-reduced-transparency:reduce) 처리가 같은 파일에 있어야 합니다`);
  }
  return errs;
}
