// 아이콘: src/icons/allow.json의 Lucide 이름 → dist/icons.svg (심볼 id = Catui_ic-이름)
import path from "node:path";
import { icons } from "lucide";
import { P, fail, readJson, write } from "./lib.mjs";

const pascal = (name) => name.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const attr = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
function node([tag, attrs = {}, children]) {
  const a = Object.entries(attrs).filter(([k, v]) => k !== "key" && v != null).map(([k, v]) => `${attr(k)}="${v}"`).join(" ");
  const inner = Array.isArray(children) ? children.map(node).join("") : "";
  return inner ? `<${tag} ${a}>${inner}</${tag}>` : `<${tag} ${a}/>`;
}

export function buildIcons() {
  const allow = readJson(path.join(P.icons, "allow.json"));
  const dup = allow.filter((n, i) => allow.indexOf(n) !== i);
  if (dup.length) fail(`allow.json에 중복 아이콘: ${dup.join(", ")}`);
  const symbols = allow.map((name) => {
    const icon = icons[pascal(name)];
    if (!icon) fail(`Lucide 아이콘이 없습니다: ${name}`);
    return `<symbol id="Catui_ic-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.map(node).join("")}</symbol>`;
  });
  write(path.join(P.dist, "icons.svg"), `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lucide (https://lucide.dev) is licensed under the ISC License. Stroke width is 1.5. -->
<svg xmlns="http://www.w3.org/2000/svg">
${symbols.join("\n")}
</svg>
`);
  return { names: allow };
}
