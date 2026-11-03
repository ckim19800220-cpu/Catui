// 일회용: 템플릿 안 배열을 data/<name>.json으로 빼고 catui.admin.data()로 읽게 바꾼다
// node scripts/tmp-extract.mjs <page> <varName> <dataName>
import fs from "node:fs";
const [page, v, name] = process.argv.slice(2);
const f = `templates/admin/pages/${page}.html`;
let s = fs.readFileSync(f, "utf8");
const a = s.indexOf(`  var ${v} = [`);
if (a < 0) throw new Error("not found");
// 배열(및 이어지는 .map(...))이 끝나는 ';' 찾기: 괄호 깊이로
let i = s.indexOf("[", a), depth = 0;
for (; i < s.length; i++) { const c = s[i]; if ("([{".includes(c)) depth++; else if (")]}".includes(c)) depth--; else if (c === ";" && depth === 0) break; }
const code = s.slice(a, i + 1).replace(`var ${v} =`, "return");
const data = new Function(code)();
fs.writeFileSync(`templates/admin/data/${name}.json`, JSON.stringify(data, null, 1) + "\n");
s = s.slice(0, a) + `  // 모의 데이터: data/${name}.json\n  catui.admin.data('${name}').then(function (${v}) {\n  ${v} = ${v}.slice();\n` + s.slice(i + 2);
s = s.replace(/\n\}\);\n<\/script>\s*$/, "\n  });\n});\n</script>\n");
fs.writeFileSync(f, s);
console.log(page, name, data.length);
