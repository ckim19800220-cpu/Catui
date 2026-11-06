// data — JSON 모의 데이터 연동 (실서비스는 같은 모양의 API로 바꾸면 된다)
//   catui.booking.data('slots').then((v) => …)   data/slots.json 을 한 번만 읽어 캐시
//   catui.booking.dataBase = '/api/'             주소 앞부분 바꾸기 (기본: 화면 옆 data/)
//   catui.booking.load()                         services·branches·slots·seats·rooms·reservations·staff·schedule·waitlist 를 합쳐 한 번만
//     · 남은 자리 = 정원 − (slots.json 예약 현황 + 이 브라우저에서 저장한 예약), 금액 = 서비스 원자료로 계산(저장하지 않음)
booking.dataBase = "data/";
booking._dataCache = new Map();
booking.data = function (name) {
  const url = /^(https?:)?\//.test(name) || name.endsWith(".json") ? name : `${this.dataBase}${name}.json`;
  if (!this._dataCache.has(url)) {
    this._dataCache.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch((err) => { this._dataCache.delete(url); catui.hint.error(`CatuiBooking: 데이터를 읽지 못했습니다 (${url})`, "error", err); throw err; }));
  }
  return this._dataCache.get(url);
};
const bkById = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));
booking.load = function () {
  if (this._loaded) return this._loaded;
  const names = ["services", "branches", "slots", "seats", "rooms", "reservations", "staff", "schedule", "waitlist"];
  this._loaded = Promise.all(names.map((n) => this.data(n))).then(([services, branches, slots, seats, rooms, reservations, staff, schedule, waitlist]) => {
    const d = {
      services, S: bkById(services), branches, B: bkById(branches), slots, maps: seats,
      rooms: rooms.rooms || [], R: bkById(rooms.rooms), holidays: rooms.holidays || [],
      reservations, staff, T: bkById(staff), schedule, waitlist,
    };
    this.emit("data", { data: d });
    return d;
  });
  this._loaded.catch(() => { this._loaded = null; });
  return this._loaded;
};

// ── 진행 중인 예약(단계 사이에서 기억) ──
booking.draft = {
  get: () => ({ adult: 1, child: 0, options: [], seats: [], ...bkGet("draft", {}) }),
  set(patch) { const v = { ...this.get(), ...patch }; bkSet("draft", v); return v; },
  clear: () => bkSet("draft", {}),
  /** 주소의 ?svc=&branch=&date= 를 진행 중 예약에 합친다(서비스·지점이 바뀌면 나머지는 비움) */
  fromQuery(q = bkQuery()) {
    const cur = this.get(), svc = q.get("svc"), branch = q.get("branch"), date = q.get("date");
    if (svc && svc !== cur.svc) return this.set({ svc, branch: branch || "", date: date || "", time: "", seats: [], room: "", options: [], change: "", adult: 1, child: 0 });
    const patch = {};
    if (branch && branch !== cur.branch) Object.assign(patch, { branch, time: "", seats: [] });
    if (date && date !== cur.date) Object.assign(patch, { date, time: "", seats: [] });
    return Object.keys(patch).length ? this.set(patch) : cur;
  },
};

// ── 이미 찬 자리 ──
const bkSavedLive = () => bkGet("saved", []).filter((r) => !bkGet("cancelled", {})[r.no]);
/** 시간마다 찬 인원 { "10:00": n } — slots.json + 이 브라우저에서 저장한 예약 (except: 변경 중인 예약 번호) */
booking.bookedAt = function (d, svc, branch, date, { except = "" } = {}) {
  const out = {};
  for (const x of d.slots.people || []) if (x.svc === svc && x.branch === branch && x.date === date) out[x.time] = (out[x.time] || 0) + Number(x.n || 0);
  for (const r of bkSavedLive()) if (r.no !== except && r.svc === svc && r.branch === branch && r.date === date) out[r.time] = (out[r.time] || 0) + (r.adult || 0) + (r.child || 0);
  return out;
};
/** 그 회차에 이미 예약된 좌석 id 목록 */
booking.seatsTaken = function (d, svc, date, time, { except = "" } = {}) {
  const set = new Set();
  for (const x of d.slots.seats || []) if (x.svc === svc && x.date === date && x.time === time) x.seats.forEach((s) => set.add(s));
  for (const r of bkSavedLive()) if (r.no !== except && r.svc === svc && r.date === date && r.time === time) (r.seats || []).forEach((s) => set.add(s));
  return [...set];
};
/** 좌석 회차의 시간마다 찬 좌석 수 { "14:00": n } — 시간 칸 계산에 쓴다 */
booking.seatBooked = function (d, svc, date, opt) {
  const out = {};
  for (const t of d.S[svc]?.times || []) out[t] = booking.seatsTaken(d, svc, date, t, opt).length;
  return out;
};
/** 기간 동안 남은 객실 수 = 객실 수 − (밤마다 겹친 예약 수의 최댓값) */
booking.roomLeft = function (d, roomId, checkin, checkout, { except = "" } = {}) {
  const room = d.R[roomId];
  if (!room) return 0;
  const list = [...(d.slots.rooms || []).filter((x) => x.room === roomId).map((x) => ({ from: x.from, to: x.to, n: x.n || 1 })),
    ...bkSavedLive().filter((r) => r.no !== except && r.room === roomId).map((r) => ({ from: r.date, to: r.checkout, n: 1 }))];
  let worst = 0;
  for (let i = 0, n = booking.nights(checkin, checkout); i < n; i++) {
    const night = booking.addDays(checkin, i);
    worst = Math.max(worst, list.filter((x) => x.from <= night && night < x.to).reduce((a, x) => a + x.n, 0));
  }
  return Math.max(0, room.count - worst);
};
/** 좌석 수(배치도의 좌석 칸 수) */
booking.seatCount = (map) => booking.cells(map).filter((c) => c.kind === "seat").length;

// ── 금액 (예약 한 건) ──
booking.amountOf = function (d, r) {
  const svc = d.S[r.svc];
  if (!svc) return { total: 0, price: { lines: [], total: 0 } };
  if (svc.kind === "room") {
    const st = booking.stay(d.R[r.room], r.date, r.checkout, { adult: r.adult, child: r.child, holidays: d.holidays });
    const p = booking.price(svc, { adult: r.adult, child: r.child, options: r.options || [], nights: st.nights });
    return { stay: st, price: p, total: st.total + p.total };
  }
  const p = booking.price(svc, { adult: r.adult, child: r.child, options: r.options || [], seats: r.seats || [], map: svc.map ? d.maps[svc.map] : null });
  return { price: p, total: p.total };
};

// ── 내 예약 ──
/** reservations.json + 이 브라우저에서 저장·변경한 예약 + 취소 기록. phase: upcoming · past · cancelled */
booking.mine = function (d) {
  const all = new Map(d.reservations.map((r) => [r.no, { ...r }]));
  for (const r of bkGet("saved", [])) all.set(r.no, { ...r, saved: true });
  const cancel = bkGet("cancelled", {}), now = booking.now();
  return [...all.values()].map((r0) => {
    const r = cancel[r0.no] ? { ...r0, status: "cancelled", cancel: cancel[r0.no] } : r0;
    const svc = d.S[r.svc] || {}, a = booking.amountOf(d, r);
    const phase = r.status === "cancelled" ? "cancelled" : now >= booking.at(r.date, r.time || "00:00") ? "past" : "upcoming";
    return { ...r, phase, svcObj: svc, branchObj: d.B[r.branch] || {}, amount: a.total, calc: a };
  }).sort((x, y) => (x.phase === "upcoming" && y.phase === "upcoming" ? `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`) : `${y.date}${y.time}`.localeCompare(`${x.date}${x.time}`)));
};
booking.find = (d, no) => booking.mine(d).find((r) => r.no === no) || null;

/** 저장 전에 확인 — 문제 글자 목록 (빈 배열이면 저장 가능) */
booking.check = function (d, v) {
  const out = [], svc = d.S[v.svc], branch = d.B[v.branch];
  if (!svc || !branch) return ["서비스와 지점을 골라 주세요"];
  const people = (v.adult || 0) + (v.child || 0);
  if (!(v.adult >= 1)) out.push("어른 1명 이상이어야 합니다");
  if (svc.kind === "room") {
    const st = booking.stay(d.R[v.room], v.date, v.checkout, { adult: v.adult, child: v.child, holidays: d.holidays });
    if (st.error) out.push(st.error);
    else if (booking.roomLeft(d, v.room, v.date, v.checkout, { except: v.change }) <= 0) out.push("그 기간에 남은 객실이 없습니다");
    if (v.date && v.date < booking.today()) out.push("지난 날짜입니다");
  } else {
    if (!v.date || !v.time) out.push("날짜와 시간을 골라 주세요");
    else {
      const s = booking.slotsFor(d, v).find((x) => x.time === v.time);
      if (!s || s.state !== "open") out.push(`${v.time}은(는) 예약할 수 없는 시간입니다 (${s ? booking.slotText(s) : "없음"})`);
      else if (svc.kind === "slot" && s.left < people) out.push(`남은 자리(${s.left})보다 인원이 많습니다`);
    }
    if (svc.kind === "seat") {
      const map = d.maps[svc.map], need = map.grades ? people : 1;
      if ((v.seats || []).length !== need) out.push(`좌석 ${need}개를 골라 주세요`);
      const taken = booking.seatsTaken(d, v.svc, v.date, v.time, { except: v.change });
      if ((v.seats || []).some((s) => taken.includes(s))) out.push("그 사이 다른 사람이 고른 좌석이 있습니다 — 다시 골라 주세요");
    }
  }
  if (people > (svc.maxPeople || 99)) out.push(`한 번에 ${svc.maxPeople}명까지 예약할 수 있습니다`);
  if (!v.name || !v.phone) out.push("예약자 이름과 연락처를 넣어 주세요");
  return out;
};
/** 진행 중 예약(서비스·지점·날짜)의 시간 칸 */
booking.slotsFor = function (d, v, date = v.date) {
  const svc = d.S[v.svc], br = d.B[v.branch];
  if (!svc || !br || !date) return [];
  if (svc.kind === "seat") {
    // 좌석·테이블 회차: 정원 = 배치도의 좌석(테이블) 수, 찬 자리 = 그 회차에 예약된 좌석 수
    return booking.slots({ date, times: svc.times, duration: svc.duration, closed: br.closed, capacity: booking.seatCount(d.maps[svc.map]), booked: booking.seatBooked(d, v.svc, date, { except: v.change }) });
  }
  return booking.slots({ date, open: br.open, close: br.close, step: svc.step, duration: svc.duration, breaks: br.breaks, closed: br.closed, capacity: svc.capacity, booked: booking.bookedAt(d, v.svc, v.branch, date, { except: v.change }) });
};

/** 예약 저장 — 번호 BK-YYMMDD-NNNN(한국 날짜 + 이 브라우저 일련번호). 변경(v.change)이면 같은 번호를 덮어쓴다 */
booking.save = function (v) {
  const k = booking.kst(), seq = bkGet("seq", 0) + 1;
  const no = v.change || `BK-${String(k.y).slice(2)}${bkPad(k.m)}${bkPad(k.d)}-${String(seq).padStart(4, "0")}`;
  if (!v.change) bkSet("seq", seq);
  const r = {
    no, svc: v.svc, branch: v.branch, date: v.date, time: v.time || "", adult: v.adult || 0, child: v.child || 0,
    options: v.options || [], seats: v.seats || [], room: v.room || "", checkout: v.checkout || "",
    name: v.name || "", phone: v.phone || "", email: v.email || "", request: v.request || "",
    status: "booked", created: booking.now().toISOString(),
  };
  bkSet("saved", [...bkGet("saved", []).filter((x) => x.no !== no), r]);
  if (v.change) { const c = { ...bkGet("cancelled", {}) }; delete c[no]; bkSet("cancelled", c); }
  bkSet("last", no);
  this.emit("save", { reservation: r });
  return r;
};
/** 취소 — 환불 규정으로 계산해 기록. 반환 booking.refund 결과(ok false면 취소하지 않음) */
booking.cancel = function (d, no) {
  const r = booking.find(d, no);
  if (!r || r.phase !== "upcoming") return { ok: false, label: "취소할 수 있는 예약이 아닙니다", refund: 0, fee: 0, rate: 0, days: 0, rule: null };
  const ref = booking.refund(r.amount, r.date, r.time || "00:00");
  if (!ref.ok) return ref;
  bkSet("cancelled", { ...bkGet("cancelled", {}), [no]: { at: booking.now().toISOString(), rate: ref.rate, refund: ref.refund } });
  this.emit("cancel", { no, refund: ref });
  return ref;
};

// ── 대기 명단 ──
booking.wait = {
  /** waitlist.json + 이 브라우저에서 넣은 대기 + 상태 바꿈. 같은 회차 안 신청 순서로 rank(대기·호출만) */
  list(d) {
    const st = bkGet("waitState", {});
    const all = [...d.waitlist, ...bkGet("wait", [])].map((w) => ({ ...w, status: st[w.id] || w.status })).filter((w) => w.status !== "removed");
    all.sort((a, b) => `${a.date}${a.time}${a.created}`.localeCompare(`${b.date}${b.time}${b.created}`));
    const n = {};
    return all.map((w) => { const key = `${w.svc}|${w.branch}|${w.date}|${w.time}`; n[key] = (n[key] || 0) + 1; return { ...w, rank: n[key], key }; });
  },
  add(entry) {
    const w = { id: `w${Date.now().toString(36)}`, status: "waiting", created: booking.now().toISOString(), ...entry };
    bkSet("wait", [...bkGet("wait", []), w]);
    booking.emit("wait", { entry: w });
    return w;
  },
  set(id, status) { bkSet("waitState", { ...bkGet("waitState", {}), [id]: status }); },
};
/** 이름 가리기: 김고양 → 김*양 · 이도 → 이* */
booking.mask = (name) => { const s = [...String(name || "")]; return s.length <= 1 ? s.join("") : s.length === 2 ? `${s[0]}*` : `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`; };
