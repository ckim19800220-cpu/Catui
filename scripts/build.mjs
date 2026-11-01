// Catui 빌드 진입점: CSS → 아이콘 → JS → 문서.  node scripts/build.mjs [--only=css,js,icons,docs]
import { buildCss } from "./build-css.mjs";
import { buildIcons } from "./build-icons.mjs";
import { buildJs } from "./build-js.mjs";
import { bytes } from "./lib.mjs";

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const want = (k) => !only.length || only.includes(k);

const css = buildCss();                       // 클래스 목록은 JS·문서 검사에 필요하므로 항상 실행
const icons = buildIcons();
const js = want("js") ? buildJs(css) : null;
let docs = null;
if (want("docs")) {
  const { buildDocs } = await import("./build-docs.mjs");
  docs = buildDocs({ css, icons });
}

console.log(`build ok  css ${bytes(css.css)} (${css.files} files)  min ${bytes(css.min)}  icons ${icons.names.length}` +
  `${js ? `  js ${bytes(js.iife)}` : ""}${docs ? `  docs ${docs.pages} pages` : ""}`);
