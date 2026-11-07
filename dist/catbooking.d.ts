// CatuiBooking (catbooking.js) 타입 — 전역: window.catui.booking / ESM: import booking from "@imcat-ckim/catui/booking"
import type { Off } from "./catui";

export type BkEvent = "theme" | "date" | "slot" | "people" | "seats" | "stay" | "save" | "cancel" | "wait" | "data";
/** "YYYY-MM-DD" (한국 날짜) */
export type BkDate = string;
/** "HH:MM" (한국 시각) */
export type BkTime = string;
export type BkSlotState = "open" | "full" | "past" | "break" | "closed";
export type BkDayState = "open" | "few" | "full" | "closed" | "past" | "beyond";

export interface BkOption { id: string; name: string; price: number; per: "person" | "person-night" | "once" }
export interface BkService {
  id: string; kind: "slot" | "seat" | "room"; name: string; icon?: string; tone?: number; desc?: string;
  price?: number; childPrice?: number; childOff?: number; duration: number; step?: number; capacity?: number; maxPeople?: number;
  map?: string; times?: BkTime[]; adjacent?: boolean; branches: string[]; options?: BkOption[];
}
export interface BkBranch { id: string; name: string; addr?: string; phone?: string; open: BkTime; close: BkTime; breaks: Array<[BkTime, BkTime]>; closed: number[] }
export interface BkSeatMap { title: string; stage?: string; unit?: string; rows: Array<{ id: string; cells: string }>; grades?: Array<{ id: string; price: number; rows: string[] }>; cap?: Record<string, number> }
export interface BkCell { id: string; row: string; r: number; col: number; n?: number; kind: "seat" | "void"; access?: boolean; grade?: string; price?: number; cap?: number }
export interface BkRoom { id: string; name: string; icon?: string; tone?: number; size: number; beds: string; base: number; max: number; price: number; extraPerson: number; count: number; amen: string[] }
export interface BkSlot { time: BkTime; end: BkTime; state: BkSlotState; left: number; capacity: number; few: boolean }
export interface BkLine { label: string; unit: number; qty: number; amount: number; option?: string }
export interface BkPrice { lines: BkLine[]; people: number; total: number }
export interface BkStay { nights: number; weekday: number; weekend: number; lines: Array<{ date: BkDate; weekend: boolean; holiday: boolean; rate: number; extra: number; amount: number }>; room: number; extra: number; total: number; over: boolean; error: string }
export interface BkRefund { ok: boolean; days: number; rate: number; refund: number; fee: number; rule: { days: number; rate: number } | null; label: string }
export interface BkBlock { start: BkTime; end: BkTime; [k: string]: any }
export interface BkDraft { svc?: string; branch?: string; date?: BkDate; time?: BkTime; checkout?: BkDate; room?: string; adult: number; child: number; options: string[]; seats: string[]; name?: string; phone?: string; email?: string; request?: string; change?: string }
export interface BkReservation extends BkDraft { no: string; status: "booked" | "cancelled"; created: string; cancel?: { at: string; rate: number; refund?: number } }
export interface BkMine extends BkReservation { phase: "upcoming" | "past" | "cancelled"; svcObj: BkService; branchObj: BkBranch; amount: number; calc: { total: number; price: BkPrice; stay?: BkStay } }
export interface BkWait { id: string; svc: string; branch: string; date: BkDate; time: BkTime; name: string; phone: string; people: number; created: string; status: "waiting" | "called" | "removed"; rank?: number }
export interface BkData {
  services: BkService[]; S: Record<string, BkService>; branches: BkBranch[]; B: Record<string, BkBranch>;
  slots: { people: Array<{ svc: string; branch: string; date: BkDate; time: BkTime; n: number }>; seats: Array<{ svc: string; date: BkDate; time: BkTime; seats: string[] }>; rooms: Array<{ room: string; from: BkDate; to: BkDate; n?: number }> };
  maps: Record<string, BkSeatMap>; rooms: BkRoom[]; R: Record<string, BkRoom>; holidays: BkDate[];
  reservations: BkReservation[]; staff: Array<{ id: string; name: string; role: string; branch: string; tone?: number }>; T: Record<string, any>;
  schedule: { from: BkTime; to: BkTime; items: Array<BkBlock & { id: string; staff: string; date: BkDate; customer: string; svc: string; status: string; memo?: string }> };
  waitlist: BkWait[];
}
export interface BkSeatCtrl { el: HTMLElement; selected(): string[]; set(opt: { max?: number; mode?: "single" | "adjacent"; people?: number; taken?: string[]; selected?: string[] }): string[]; focus(id?: string): void }
interface BkPart<T = unknown> { init(root: HTMLElement): void; ready?: Promise<T | null> }

export interface CatuiBooking {
  readonly version: string;
  root: HTMLElement | null;
  ready?: Promise<CatuiBooking>;
  /** lead 30(분) · fewLeft 2 · maxDays 60 · weekendDays [5,6] · weekendRate 30(%) · priceUnit 100 · refund [{days:7,rate:100},{days:3,rate:70},{days:1,rate:50},{days:0,rate:0}] · refundUnit 10 */
  rules: { lead: number; fewLeft: number; maxDays: number; weekendDays: number[]; weekendRate: number; priceUnit: number; refund: Array<{ days: number; rate: number }>; refundUnit: number };
  init(scope?: Element | Document): CatuiBooking;
  destroy(): void;
  on(evt: BkEvent, fn: (data: any) => void): Off;
  emit(evt: BkEvent | string, payload?: any): boolean;
  query(): URLSearchParams;
  store: { get<T = unknown>(key: string, fallback?: T): T; set(key: string, value: unknown): void; clear(): void };
  theme: { get(): "light" | "dark"; saved(): "light" | "dark" | "system"; set(v: "light" | "dark" | "system"): void; apply(v: string): void; init(): void };
  announce(msg: string): void;
  go(url: string): void;
  // 한국 시간
  fixedNow?: string;
  now(): Date;
  kst(when?: Date | string | number): { key: BkDate; y: number; m: number; d: number; h: number; mi: number; min: number; dow: number };
  today(): BkDate;
  addDays(key: BkDate, n: number): BkDate;
  dow(key: BkDate): number;
  dowName(i: number): string;
  diffDays(a: BkDate, b: BkDate): number;
  nights(checkin: BkDate, checkout: BkDate): number;
  toMin(t: BkTime): number;
  fromMin(n: number): BkTime;
  at(key: BkDate, time?: BkTime): Date;
  dateLabel(key: BkDate, opt?: { long?: boolean; year?: boolean }): string;
  date(iso: string, fmt?: string): string;
  won(n: number | string): string;
  mask(name: string): string;
  // 계산 (순수)
  left(capacity: number, booked?: number | Array<{ n?: number; people?: number }>): number;
  slots(opt: { date: BkDate; open?: BkTime; close?: BkTime; step?: number; duration?: number; breaks?: Array<[BkTime, BkTime]>; closed?: number[]; capacity?: number; booked?: Record<BkTime, number>; times?: BkTime[] | null; now?: Date; lead?: number }): BkSlot[];
  slotText(s: BkSlot): string;
  dayState(date: BkDate, opt?: Record<string, any> & { list?: (date: BkDate) => BkSlot[]; now?: Date; maxDays?: number; closed?: number[] }): BkDayState;
  dayText(st: BkDayState): string;
  cells(map: BkSeatMap): BkCell[];
  price(svc: BkService, opt?: { adult?: number; child?: number; options?: string[]; seats?: string[]; map?: BkSeatMap | null; nights?: number }): BkPrice;
  stay(room: BkRoom | undefined, checkin: BkDate, checkout: BkDate, opt?: { adult?: number; child?: number; holidays?: BkDate[] }): BkStay;
  refund(amount: number, date: BkDate, time?: BkTime, opt?: { now?: Date; rules?: Array<{ days: number; rate: number }> }): BkRefund;
  refundTable(rules?: Array<{ days: number; rate: number }>): Array<{ days: number; rate: number; text: string }>;
  layout<T extends BkBlock>(blocks: T[]): Array<T & { lane: number; lanes: number }>;
  place(b: BkBlock, range?: { from?: BkTime; to?: BkTime }): { top: number; height: number };
  // 부품
  seats: {
    name(map: BkSeatMap, cell: BkCell): string;
    pick(state: { map: BkSeatMap; selected?: string[]; taken?: string[]; max?: number; mode?: "single" | "adjacent"; people?: number }, id: string): { ok: boolean; selected: string[]; reason: string };
    mount(box: Element | string, opt: { map: BkSeatMap; taken?: string[]; selected?: string[]; max?: number; mode?: "single" | "adjacent"; people?: number; label?: string; onChange?: (e: { selected: string[]; reason: string; ok: boolean }) => void }): BkSeatCtrl | null;
  };
  calendar: {
    short: Record<string, string>;
    mount(box: Element | string, opt?: { month?: string; selected?: BkDate; stateOf?: (date: BkDate) => BkDayState; onSelect?: (date: BkDate) => void; label?: string }): { go(month: string): void; select(date: BkDate): void; month(): string; redraw(): void } | null;
  };
  // 데이터
  dataBase: string;
  data<T = any>(name: string): Promise<T>;
  load(): Promise<BkData>;
  draft: { get(): BkDraft; set(patch: Partial<BkDraft>): BkDraft; clear(): void; fromQuery(q?: URLSearchParams): BkDraft };
  bookedAt(d: BkData, svc: string, branch: string, date: BkDate, opt?: { except?: string }): Record<BkTime, number>;
  seatsTaken(d: BkData, svc: string, date: BkDate, time: BkTime, opt?: { except?: string }): string[];
  seatBooked(d: BkData, svc: string, date: BkDate, opt?: { except?: string }): Record<BkTime, number>;
  seatCount(map: BkSeatMap): number;
  roomLeft(d: BkData, roomId: string, checkin: BkDate, checkout: BkDate, opt?: { except?: string }): number;
  slotsFor(d: BkData, v: Partial<BkDraft>, date?: BkDate): BkSlot[];
  amountOf(d: BkData, r: Partial<BkDraft>): { total: number; price: BkPrice; stay?: BkStay };
  mine(d: BkData): BkMine[];
  find(d: BkData, no: string): BkMine | null;
  check(d: BkData, v: Partial<BkDraft>): string[];
  save(v: Partial<BkDraft>): BkReservation;
  cancel(d: BkData, no: string): BkRefund;
  cancelAsk(d: BkData, no: string): Promise<BkRefund | null>;
  changeStart(d: BkData, no: string): boolean;
  wait: { list(d: BkData): BkWait[]; add(entry: Partial<BkWait>): BkWait; set(id: string, status: BkWait["status"]): void };
  // 마크업 (글자는 모두 이스케이프)
  flow: { steps: Record<string, Array<[string, string]>>; next(kind: string, step: string): string; prev(kind: string, step: string): string; lines(lines: BkLine[], total: number, opt?: { label?: string }): unknown; summary(box: Element, d: BkData, v: BkDraft): void; need(box: Element, d: BkData, v: BkDraft, opt?: { kind?: string | string[] }): boolean; frame(root: Element, d: BkData, v: BkDraft, step: string): void; steps_(box: Element, kind: string, cur: string): void };
  view: { when(d: BkData, r: Partial<BkDraft>): string; dl(d: BkData, r: Partial<BkDraft>): unknown; amount(d: BkData, r: Partial<BkDraft>, opt?: { label?: string }): unknown; refund(at?: { date: BkDate; time?: BkTime } | null): unknown; qr(no: string): unknown };
  warn(msgBox: Element | null, text: string, focusEl?: HTMLElement | null): void;
  // 화면 부품 — init()이 부른다
  shell: { init(root: HTMLElement): void };
  home: BkPart<BkData> & { from(d: BkData, svc: BkService): string };
  datePage: BkPart<BkData> & { stateOf(d: BkData, v: BkDraft, date: BkDate): BkDayState; times(box: Element, d: BkData, v: BkDraft): void };
  peoplePage: BkPart<BkData> & { limit(d: BkData, v: BkDraft): number; draw(box: Element, d: BkData, v: BkDraft): BkPrice };
  seatPage: BkPart<BkData> & { ctrl?: BkSeatCtrl | null };
  roomPage: BkPart<BkData> & { draw(box: Element, d: BkData, v: BkDraft): BkStay };
  infoPage: BkPart<BkData>;
  confirmPage: BkPart<BkData>;
  completePage: BkPart<BkData>;
  minePage: BkPart<BkData> & { tabs: Array<[string, string]>; card(d: BkData, r: BkMine): unknown };
  detailPage: BkPart<BkData>;
  waitPage: BkPart<BkData> & { status: Record<string, [string, string]> };
  adminPage: BkPart<BkData> & { status: Record<string, string> };
}

export declare const booking: CatuiBooking;
export default booking;

declare module "./catui" { interface Catui { booking: CatuiBooking } }
