// Catui 빌드 진입점: CSS → 아이콘 → (확장 CSS) → JS → (확장 JS) → 문서 → (확장 템플릿).  node scripts/build.mjs [--only=css,js,icons,docs]
//   확장: CatuiAdmin(build-admin.mjs) · CatuiCommunity(build-community.mjs) · CatuiShop(build-shop.mjs) · CatuiDocs(build-docskit.mjs) · CatuiBooking(build-booking.mjs)
import { buildCss } from "./build-css.mjs";
import { buildIcons } from "./build-icons.mjs";
import { buildJs } from "./build-js.mjs";
import { buildAdminCss, buildAdminJs, buildAdminTemplates } from "./build-admin.mjs";
import { buildCommunityCss, buildCommunityJs, buildCommunityTemplates } from "./build-community.mjs";
import { buildShopCss, buildShopJs, buildShopTemplates } from "./build-shop.mjs";
import { buildDocskitCss, buildDocskitJs, buildDocskitTemplates } from "./build-docskit.mjs";
import { buildBookingCss, buildBookingJs, buildBookingTemplates } from "./build-booking.mjs";
import { buildDramaCss, buildDramaJs, buildDramaTemplates } from "./build-drama.mjs";
import { bytes } from "./lib.mjs";

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const want = (k) => !only.length || only.includes(k);

const css = buildCss();                       // 클래스 목록은 JS·문서 검사에 필요하므로 항상 실행
const icons = await buildIcons();
const admin = buildAdminCss();                 // 확장 CSS 클래스도 검사 집합에 합친다(본체 + 확장)
const cm = buildCommunityCss();
const sh = buildShopCss();
const dk = buildDocskitCss();
const bk = buildBookingCss();
const dr = buildDramaCss();
const defined = new Set([...css.defined, ...admin.defined, ...cm.defined, ...sh.defined, ...dk.defined, ...bk.defined, ...dr.defined]);
const js = want("js") ? buildJs(css) : null;
if (want("js")) { buildAdminJs(defined); buildCommunityJs(defined); buildShopJs(defined); buildDocskitJs(defined); buildBookingJs(defined); buildDramaJs(defined); }
let docs = null, tpl = null, ctpl = null, stpl = null, dtpl = null, btpl = null, drtpl = null;
if (want("docs")) {
  const { buildDocs } = await import("./build-docs.mjs");
  docs = buildDocs({ css: { ...css, defined, exampleDefined: css.defined, adminByFile: { ...admin.byFile, ...cm.byFile, ...sh.byFile, ...dk.byFile, ...bk.byFile, ...dr.byFile } }, icons });
  tpl = buildAdminTemplates({ defined, icons: icons.names, adminByFile: admin.byFile });   // 문서 폴더를 새로 쓴 뒤에 넣는다
  ctpl = buildCommunityTemplates({ defined, icons: icons.names, communityByFile: cm.byFile });
  stpl = buildShopTemplates({ defined, icons: icons.names, shopByFile: sh.byFile });
  dtpl = buildDocskitTemplates({ defined, icons: icons.names, docskitByFile: dk.byFile });
  btpl = buildBookingTemplates({ defined, icons: icons.names, bookingByFile: bk.byFile });
  drtpl = buildDramaTemplates({ defined, icons: icons.names });
}

console.log(`build ok  css ${bytes(css.css)} (${css.files} files)  min ${bytes(css.min)}  icons ${icons.names.length}(line01 ${icons.line01.length} · own ${icons.own.length} · lucide ${icons.lucide.length})` +
  `${js ? `  js ${bytes(js.iife)}  min ${bytes(js.min)}` : ""}  admin css ${bytes(admin.css)}  community css ${bytes(cm.css)}  shop css ${bytes(sh.css)}  docs css ${bytes(dk.css)}  booking css ${bytes(bk.css)}${docs ? `  docs ${docs.pages} pages` : ""}${tpl ? `  admin ${tpl.pages} templates` : ""}${ctpl ? `  community ${ctpl.pages} templates` : ""}${stpl ? `  shop ${stpl.pages} templates` : ""}${dtpl ? `  docs kit ${dtpl.pages} templates` : ""}${btpl ? `  booking ${btpl.pages} templates` : ""}${drtpl ? `  drama ${drtpl.pages} templates` : ""}`);
