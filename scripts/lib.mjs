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
