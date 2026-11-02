// 안전한 마크업 조립. html`...`의 ${값}은 자동 escape되고, raw()로 감싼 신뢰 마크업만 그대로 들어간다.
export function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 신뢰 마크업 표식은 raw()가 만든 객체에만 붙는다. 서버 JSON의 { "__raw": "..." } 같은 위조 객체는 글자로 escape된다.
const catuiRawMarks = new WeakSet();

export function raw(markup) {
  const out = Object.freeze({ __raw: String(markup ?? "") });
  catuiRawMarks.add(out);
  return out;
}

export function isRaw(value) {
  return !!value && typeof value === "object" && catuiRawMarks.has(value);
}

export function html(strings, ...values) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i >= values.length) return;
    const v = values[i];
    if (v == null || v === false) return;
    if (Array.isArray(v)) out += v.flat(Infinity).map((x) => (x == null || x === false ? "" : isRaw(x) ? x.__raw : escape(x))).join("");
    else out += isRaw(v) ? v.__raw : escape(v);
  });
  return raw(out);
}
