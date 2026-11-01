// 이벤트 허브 — layui와 같은 "이벤트(필터)" 문법.
// form.on('submit(login)', fn) / table.on('tool(orders)', fn) / tabs.on('tab', fn)(필터 없음 = 전체)
// on()은 해제 함수를 돌려준다(누수 방지).
const catuiHandlers = new Map(); // "모듈:이벤트" → [{ filter, fn }]

function catuiParse(evt) {
  const m = /^([\w-]+)(?:\(([^)]*)\))?$/.exec(String(evt).trim());
  if (!m) throw new Error(`잘못된 이벤트 이름: ${evt}`);
  return { name: m[1], filter: m[2] ?? null };
}

export function onEvent(mod, evt, fn) {
  const { name, filter } = catuiParse(evt);
  const key = `${mod}:${name}`;
  if (!catuiHandlers.has(key)) catuiHandlers.set(key, []);
  const entry = { filter, fn };
  catuiHandlers.get(key).push(entry);
  return () => {
    const list = catuiHandlers.get(key) || [];
    const i = list.indexOf(entry);
    if (i >= 0) list.splice(i, 1);
  };
}

export function offEvent(mod, evt) {
  const { name, filter } = catuiParse(evt);
  const key = `${mod}:${name}`;
  if (filter == null) catuiHandlers.delete(key);
  else catuiHandlers.set(key, (catuiHandlers.get(key) || []).filter((h) => h.filter !== filter));
}

// 필터가 같은 핸들러 + 필터 없는 핸들러를 호출. 하나라도 false를 돌려주면 false.
export function emit(mod, name, filter, payload, thisArg) {
  let result = true;
  for (const h of [...(catuiHandlers.get(`${mod}:${name}`) || [])]) {
    if (h.filter != null && h.filter !== filter) continue;
    try {
      if (h.fn.call(thisArg ?? payload?.elem ?? null, payload) === false) result = false;
    } catch (err) {
      console.error(`[Catui error]: ${mod}.on('${name}${h.filter ? `(${h.filter})` : ""}') 처리 중 오류`, err);
    }
  }
  return result;
}

export function hasHandlers(mod, name, filter) {
  return (catuiHandlers.get(`${mod}:${name}`) || []).some((h) => h.filter == null || h.filter === filter);
}
