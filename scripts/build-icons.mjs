// 아이콘: src/icons/allow.json의 이름 → dist/icons.svg (심볼 id = Catui_ic-이름)
// 출처 우선순위 (모두 저작권 표시 의무 없음):
//   1) src/icons/svg/<이름>.svg     Catui 원본 (직접 그림)
//   2) src/icons/line01/<파일>.svg  Line 01 — iconsforfree.com, CC0 1.0 (이름이 다르면 src/icons/map.json)
//   3) Lucide (ISC, 고지 필요) — 1·2에 없을 때만, 설치돼 있을 때만. 쓰면 THIRD_PARTY_NOTICES.txt 생성
// 선 굵기는 명세대로 1.5로 통일한다(원본 Line 01은 1.75).
import fs from "node:fs";
import path from "node:path";
import { P, ROOT, fail, read, readJson, write } from "./lib.mjs";

const pascal = (name) => name.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const attr = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
function node([tag, attrs = {}, children]) {
  const a = Object.entries(attrs).filter(([k, v]) => k !== "key" && v != null).map(([k, v]) => `${attr(k)}="${v}"`).join(" ");
  const inner = Array.isArray(children) ? children.map(node).join("") : "";
  return inner ? `<${tag} ${a}>${inner}</${tag}>` : `<${tag} ${a}/>`;
}

// SVG 파일 → 안쪽 도형. 24×24 viewBox만, 스크립트·이벤트 속성·외부 참조는 스프라이트에 넣지 않는다(공급망 안전)
function svgInner(name, file) {
  const src = read(file);
  const vb = /viewBox="([^"]+)"/.exec(src)?.[1];
  if (vb && vb.trim().split(/\s+/).join(" ") !== "0 0 24 24") fail(`아이콘 ${name}: viewBox는 "0 0 24 24"여야 합니다 (${vb}) — ${path.relative(ROOT, file)}`);
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(src)?.[1]?.trim();
  if (!inner) fail(`아이콘 ${name}: <svg> 안에 도형이 없습니다 — ${path.relative(ROOT, file)}`);
  if (/<script|\son\w+=|href=["'](?!#)|<foreignObject/i.test(inner)) fail(`아이콘 ${name}: 스크립트·이벤트·외부 참조는 쓸 수 없습니다 — ${path.relative(ROOT, file)}`);
  return inner.replace(/<!--[\s\S]*?-->/g, "").replace(/\s*\n\s*/g, "");
}

let lucideIcons;   // 필요할 때만 불러온다 (Lucide를 지워도 빌드되게)
async function lucide() {
  if (lucideIcons === undefined) { try { lucideIcons = (await import("lucide")).icons; } catch { lucideIcons = null; } }
  return lucideIcons;
}

export async function buildIcons() {
  const allow = readJson(path.join(P.icons, "allow.json"));
  const dup = allow.filter((n, i) => allow.indexOf(n) !== i);
  if (dup.length) fail(`allow.json에 중복 아이콘: ${dup.join(", ")}`);
  const mapFile = path.join(P.icons, "map.json");
  const map = fs.existsSync(mapFile) ? readJson(mapFile) : {};
  const own = path.join(P.icons, "svg"), line01 = path.join(P.icons, "line01");
  const src = { own: [], line01: [], lucide: [] };
  const symbols = [];
  for (const name of allow) {
    let inner;
    const ownFile = path.join(own, `${name}.svg`), lineFile = path.join(line01, `${map[name] || name}.svg`);
    if (fs.existsSync(ownFile)) { inner = svgInner(name, ownFile); src.own.push(name); }
    else if (fs.existsSync(lineFile)) { inner = svgInner(name, lineFile); src.line01.push(name); }
    else {
      const icon = (await lucide())?.[pascal(name)];
      if (!icon) fail(`아이콘이 없습니다: ${name} — src/icons/svg/${name}.svg를 그리거나 src/icons/map.json에 Line 01 파일을 대응시키세요`);
      inner = icon.map(node).join("");
      src.lucide.push(name);
    }
    symbols.push(`<symbol id="Catui_ic-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`);
  }
  const head = `<!-- Catui icons: ${src.line01.length} Line 01 (iconsforfree.com, CC0 1.0) · ${src.own.length} Catui originals${src.lucide.length ? ` · ${src.lucide.length} Lucide (ISC, see THIRD_PARTY_NOTICES.txt)` : ""}. Stroke width 1.5. -->`;
  write(path.join(P.dist, "icons.svg"), `<?xml version="1.0" encoding="UTF-8"?>\n${head}\n<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join("\n")}\n</svg>\n`);
  // 제3자 고지: 고지 의무가 있는 Lucide를 쓰는 동안만 만든다
  const notice = path.join(P.dist, "THIRD_PARTY_NOTICES.txt");
  if (src.lucide.length) {
    const lic = path.join(ROOT, "node_modules/lucide/LICENSE");
    write(notice, `THIRD-PARTY NOTICES — Catui\n${"=".repeat(40)}\n\nLucide icons (https://lucide.dev)\n\n${fs.existsSync(lic) ? read(lic).trim() : "ISC License — Copyright (c) Lucide Contributors"}\n\nIcons: ${src.lucide.join(", ")}\n`);
  } else if (fs.existsSync(notice)) fs.unlinkSync(notice);
  return { names: allow, ...src };
}
