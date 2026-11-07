import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "assets/photos");
const api = "https://commons.wikimedia.org/w/api.php";
const selections = [
  ["autumn", "Man in a sweater adjusting tie (Unsplash).jpg"],
  ["fresh", "Ambersweet oranges.jpg"],
  ["home", "Coffee tables in front of a comfy sofa (Unsplash).jpg"],
  ["workspace", "Woman typing at a computer (Unsplash).png"],
  ["reading", "Getting cozy with a book (Unsplash).jpg"],
  ["shirt", "Man in t-shirt posing (Unsplash).jpg"],
  ["denim", "Young woman in high-waisted jeans.jpg"],
  ["coat", "2017 Thom Browne man's coat, wool twill with multiple buttons, Fall-Winter 02.jpg"],
  ["sneakers", "Ash and orange sneakers.jpg"],
  ["beanie", "Beanie hat by Polo Ralph Lauren.jpg"],
  ["cream", "Cosmetic jar with light pink product displayed on a textured background.jpg"],
  ["sunscreen", "LRP sunscreen bottle.jpg"],
  ["lipstick", "Lipsticks.jpg"],
  ["cleanser", "Korean cosmetic products.jpg"],
  ["eggs", "Eggs in basket 2020 G1.jpg"],
  ["coffee", "Cold brew with whipped cream.jpg"],
  ["granola", "Granola Honey and Vanilla.jpg"],
  ["bedroom", "Hotel bedroom windows (Unsplash).jpg"],
  ["bathmat", "HK Disneyland Hotel Room Bathtub 浴缸防滑毯 Rubbermaid rubber carpet.JPG"],
  ["lamp", "Bedside Table Lamp.jpg"],
  ["earbuds", "ActiveSound wireless earbuds by Hykker (POJM200483).jpg"],
  ["charger", "Silicon vs GaN 30W USB-C chargers.jpg"],
  ["keyboard", "Beautiful Mechanical Keyboard.jpg"],
  ["plate", "Baby feeding - spoon and bowl.jpg"],
  ["yoga", "Yoga mat and water bottle in a living room.jpg"],
  ["socks", "Colorful Socks and Birkenstocks (21987849469).jpg"],
  ["scratcher", "Corrugated fiberboard scratch pad with cat.jpg"],
  ["dogfood", "Dog food in a bowl.jpg"],
  ["pottery", "Play with a wheel.jpg"],
  ["salon", "Hair salon - Arlington, MA.jpg"],
  ["theater", "Katowice Silesian Theatre auditorium 2022.jpg"],
  ["dining", "Hansik.jpg"],
  ["hanok", "Interior of a traditional Korean house.JPG"],
  ["hanok-room", "Seoul-A room in a Hanok near Chungmuro Station-01.jpg"],
  ["hanok-living", "Living room of a Hanok - panoramio.jpg"],
  ["sky", "Leaning trees over the grassy hillock of Nodong-ri tombs clouds and blue sky in Gyeongju South Korea.jpg"],
  ["cat", "Sleeping cat on her back.jpg"],
  ["leaves", "Path Covered with Autumn Leaves.jpg"],
  ["kimbap", "Vegetable gimbap.jpg"],
  ["sunset", "Durdle Door Dorset Sunset.jpg"],
  ["bridge", "The Bridge (August 2013).jpg"],
  ["cafe", "Cafe with view on a cathedral (Unsplash).jpg"],
  ["bakery", "A display of Scali bread at the Winter Hill Bakery.jpg"],
];
const curl = (url) => execFileSync("curl", ["--fail", "--silent", "--show-error", "--location", "--max-time", "90", "--retry", "3", "--retry-delay", "3", "--user-agent", "Catui-demo-assets/2.0", url], { maxBuffer: 12 * 1024 * 1024 });
const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const allowed = (license) => /^(CC0|Public domain|CC BY(?:-SA)? [234]\.[05])$/i.test(license);
if (process.argv[2] === "--search") {
  const u = new URL(api);
  u.search = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: process.argv.slice(3).join(" ") + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "4", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "960" });
  const data = JSON.parse(curl(u.href).toString());
  for (const p of Object.values(data.query?.pages || {})) {
    const info = p.imageinfo?.[0], license = plain(info?.extmetadata?.LicenseShortName?.value);
    if (info && allowed(license)) console.log(JSON.stringify({ title: p.title.slice(5), license, width: info.width, height: info.height }));
  }
  process.exit(0);
}
fs.mkdirSync(out, { recursive: true });
const manifest = path.join(out, "credits.json");
const credits = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : [];
for (const [id, title] of selections) {
  const cached = credits.find((c) => c.id === id && c.title === title);
  if (cached && fs.existsSync(path.join(out, cached.file))) continue;
  const u = new URL(api);
  u.search = new URLSearchParams({ action: "query", format: "json", titles: `File:${title}`, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "960" });
  const data = JSON.parse(curl(u.href).toString());
  const image = Object.values(data.query?.pages || {})[0]?.imageinfo?.[0];
  if (!image) throw new Error(`${id}: 이미지 메타데이터가 없습니다`);
  const meta = image.extmetadata || {}, license = plain(meta.LicenseShortName?.value);
  if (!allowed(license)) throw new Error(`${id}: 공개 사용 조건을 확인하세요 (${license})`);
  const url = new URL(image.thumburl || image.url);
  if (url.protocol !== "https:" || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname)) throw new Error(`${id}: 허용하지 않은 이미지 주소`);
  const bytes = curl(url.href), png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((!png && !jpeg) || bytes.length > 5 * 1024 * 1024) throw new Error(`${id}: 이미지 형식 또는 크기를 확인하세요`);
  const file = `${id}.${png ? "png" : "jpg"}`;
  const record = { id, file, title, author: plain(meta.Artist?.value), license, licenseUrl: meta.LicenseUrl?.value || "https://commons.wikimedia.org/wiki/Help:Public_domain", source: image.descriptionurl, api: u.href, width: image.thumbwidth || image.width, height: image.thumbheight || image.height, bytes: bytes.length, modifications: "960px 이하 썸네일 · 화면에 맞춰 object-fit: cover로 표시 · 원본 라이선스 유지" };
  fs.writeFileSync(path.join(out, file), bytes);
  const index = credits.findIndex((c) => c.id === id);
  if (index < 0) credits.push(record); else credits[index] = record;
  fs.writeFileSync(manifest, JSON.stringify(credits, null, 2) + "\n");
  console.log(`${id}: ${file} ${bytes.length} bytes · ${license}`);
  await new Promise((r) => setTimeout(r, 500));
}
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cards = credits.map((c) => `<article class="Catui_card Catui_span-4"><img src="${esc(c.file)}" alt="" loading="lazy" width="${c.width}" height="${c.height}" style="width:100%;height:auto;aspect-ratio:4/3;object-fit:cover"><div class="Catui_card-b"><h2 class="Catui_h3">${esc(c.title)}</h2><p>작가: ${esc(c.author || "원문 참조")}</p><p><a class="Catui_link" href="${esc(c.source)}">원본·출처</a> · <a class="Catui_link" href="${esc(c.licenseUrl)}">${esc(c.license)}</a></p><p>${esc(c.modifications)}</p></div></article>`).join("\n");
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catui 예시 사진 출처와 라이선스</title><link rel="stylesheet" href="../../dist/catui.min.css"></head><body class="Catui_site"><main style="max-width:calc(var(--Catui_space-10) * 20);margin-inline:auto;padding:var(--Catui_space-5)"><h1 class="Catui_h1">예시 사진 출처와 라이선스</h1><p>무료 Wikimedia Commons API로 받은 데모용 연출 사진입니다. 실제 판매 상품·공간·이용자의 촬영물을 나타내지 않습니다. 각 이미지에는 아래 원본 라이선스를 그대로 적용하며, CC BY·CC BY-SA 이미지를 재사용할 때는 작가·출처·라이선스와 변경 사항을 함께 표시해야 합니다. CC BY-SA 이미지의 변경본은 동일 라이선스로 배포하세요.</p><p><a class="Catui_link" href="credits.json">전체 이미지 메타데이터(JSON)</a></p><div class="Catui_grid">${cards}</div></main></body></html>\n`);
console.log(`사진 ${credits.length}장 · 출처 페이지 갱신 완료`);
