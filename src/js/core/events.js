// 이벤트 허브 — layui와 같은 "이벤트(필터)" 문법.
// form.on('submit(login)', fn) / table.on('tool(orders)', fn) / tabs.on('tab', fn)(필터 없음 = 전체)
// on()은 해제 함수를 돌려준다(누수 방지).
import { hint } from "./base.js";

const catuiHandlers = new Map(); // "모듈:이벤트" → [{ filter, fn }]

function catuiParse(evt) {
  const m = /^([\w-]+)(?:\(([^)]*)\))?$/.exec(String(evt).trim());
  if (!m) throw new Error(`잘못된 이벤트 이름: ${evt}`);
  return { name: m[1], filter: m[2]?.trim() ?? null };   // 'submit( login )'도 'login'으로
}

export function onEvent(mod, evt, fn) {
  const { name, filter } = catuiParse(evt);
  // 함수가 아니면 등록하지 않는다 (emit 때마다 TypeError가 나는 것보다 등록 시점에 알리는 편이 찾기 쉽다)
  if (typeof fn !== "function") { hint.error(`${mod}.on('${evt}')에 함수가 아닌 값을 넘겼습니다`); return () => {}; }
  const key = `${mod}:${name}`;
  if (!catuiHandlers.has(key)) catuiHandlers.set(key, []);
  const entry = { filter, fn };
  catuiHandlers.get(key).push(entry);
  return () => {
    const list = catuiHandlers.get(key) || [];
    const i = list.indexOf(entry);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) catuiHandlers.delete(key);
  };
}

// off('submit') = 그 이벤트 전부, off('submit(login)') = 그 필터만
export function offEvent(mod, evt) {
  const { name, filter } = catuiParse(evt);
  const key = `${mod}:${name}`;
  if (filter == null) { catuiHandlers.delete(key); return; }
  const rest = (catuiHandlers.get(key) || []).filter((h) => h.filter !== filter);
  if (rest.length) catuiHandlers.set(key, rest); else catuiHandlers.delete(key);
}

// 필터가 같은 핸들러 + 필터 없는 핸들러를 호출. 하나라도 false를 돌려주면 false.
export function emit(mod, name, filter, payload, thisArg) {
  let result = true;
  for (const h of [...(catuiHandlers.get(`${mod}:${name}`) || [])]) {
    if (h.filter != null && h.filter !== filter) continue;
    try {
      if (h.fn.call(thisArg ?? payload?.elem ?? null, payload) === false) result = false;
    } catch (err) {
      hint.error(`${mod}.on('${name}${h.filter ? `(${h.filter})` : ""}') 처리 중 오류`, "error", err);
    }
  }
  return result;
}

export function hasHandlers(mod, name, filter) {
  return (catuiHandlers.get(`${mod}:${name}`) || []).some((h) => h.filter == null || h.filter === filter);
}
