// 안전한 마크업 조립. html`...`의 ${값}은 자동 escape되고, raw()로 감싼 신뢰 마크업만 그대로 들어간다.
export function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function raw(markup) {
  return { __raw: String(markup ?? "") };
}

export function isRaw(value) {
  return !!value && typeof value === "object" && typeof value.__raw === "string";
}

export function html(strings, ...values) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i >= values.length) return;
    const v = values[i];
    if (v == null || v === false) return;
    if (Array.isArray(v)) out += v.map((x) => (isRaw(x) ? x.__raw : escape(x))).join("");
    else out += isRaw(v) ? v.__raw : escape(v);
  });
  return raw(out);
}
