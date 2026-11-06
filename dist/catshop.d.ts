// CatuiShop (catshop.js) 타입 — 전역: window.catui.shop / ESM: import shop from "@imcat-ckim/catui/shop"
import type { Off } from "./catui";

export type ShEvent = "theme" | "cart" | "wish" | "recent" | "order" | "review" | "data";
export interface ShOptionItem { id: string; name?: string; swatch?: string; extra?: number }
export interface ShProduct {
  id: string; name: string; brand: string; cat: string; price: number; rate: number; tone?: number; sold?: number; created: string;
  ship?: "free" | "today"; summary?: string; thumb?: string; images?: string[];
  options?: { color?: { label?: string; items: ShOptionItem[] }; size?: { label?: string; items: ShOptionItem[] } };
  /** 숫자(옵션 없음) 또는 { "색상/사이즈": 수량 } — 없는 조합은 0(품절) */
  stock: number | Record<string, number>;
}
export interface ShProductEx extends ShProduct {
  catName: string; sale: number; rateShown: number; save: number; couponPrice: number; coupon: ShCoupon | null;
  stockTotal: number; soldOut: boolean; isNew: boolean; best: boolean; bestRank: number; reviewCount: number; rating: number; ratingDist: number[];
}
export interface ShCoupon { id: string; name: string; type: "rate" | "amount" | "ship"; value: number; max?: number; min?: number; cats?: string[]; expires?: string; used?: boolean; expired?: boolean }
export interface ShCartLine { key: string; id: string; color: string; size: string; qty: number; on: boolean }
export interface ShCartRow extends ShCartLine { product?: ShProductEx; opt?: string; unit?: number; unitList?: number; rate?: number; stock: number; soldOut: boolean; over?: boolean; missing?: boolean; amount: number; listAmount: number }
export interface ShCartSummary { lines: ShCartRow[]; selected: ShCartRow[]; count: number; qty: number; listTotal: number; subtotal: number; discount: number; ship: number; freeLeft: number; total: number }
export interface ShOrderCalc { listTotal: number; subtotal: number; discount: number; coupon: number; couponOk: boolean; couponReason: string; shipBase: number; ship: number; points: number; maxPoints: number; pointNote: string; total: number; earn: number }
export interface ShPrice { list: number; sale: number; rate: number; save: number; coupon: ShCoupon | null; couponPrice: number }
export interface ShLoaded {
  products: ShProductEx[]; byId: Record<string, ShProductEx>; categories: Array<{ id: string; name: string; icon: string; desc?: string }>; C: Record<string, { id: string; name: string; icon: string }>;
  reviews: any[]; R: Record<string, any[]>; coupons: ShCoupon[]; usable: ShCoupon[]; user: any & { points: number }; promos: any[];
}
export interface ShPicker {
  el: HTMLElement; product: ShProduct;
  lines(): Array<{ key: string; color: string; size: string; qty: number; opt: string; unit: number; amount: number; stock: number }>;
  qty(): number; total(): number; ready(): boolean; clear(): void; focus(): void;
}
export interface ShListQuery { c: string; q: string; sort: "best" | "new" | "low" | "high" | "review" | "rate"; price: string; free: boolean; today: boolean; instock: boolean; brands: string[]; page: number }

export interface CatuiShop {
  readonly version: string;
  root: HTMLElement | null;
  ready?: Promise<CatuiShop>;
  /** 금액·재고 규칙 — shipFee 3000 · freeOver 30000 · pointRate 1(%) · pointMin 1000 · pointUnit 10 · lowStock 5 · newDays 14 · maxQty 99 */
  rules: { shipFee: number; freeOver: number; pointRate: number; pointMin: number; pointUnit: number; lowStock: number; newDays: number; maxQty: number };
  init(scope?: Element | Document): CatuiShop;
  destroy(): void;
  on(evt: ShEvent, fn: (data: any) => void): Off;
  emit(evt: ShEvent | string, payload?: any): boolean;
  query(): URLSearchParams;
  store: { get<T = unknown>(key: string, fallback?: T): T; set(key: string, value: unknown): void; clear(): void };
  theme: { get(): "light" | "dark"; saved(): "light" | "dark" | "system"; set(v: "light" | "dark" | "system"): void; apply(v: string): void; init(): void };
  // 금액
  /** 12900 → "12,900원" */
  won(n: number | string): string;
  /** 정가 × (100 − 할인율)% 를 10원 단위로 내림 */
  saleOf(price: number, rate?: number): number;
  price(p: ShProduct, opt?: { extra?: number; coupons?: ShCoupon[] | null }): ShPrice;
  priceHtml(p: ShProduct, opt?: { extra?: number; size?: "" | "lg" }): unknown;
  // 재고 · 옵션
  optKey(color?: string, size?: string): string;
  stock(p: ShProduct, color?: string, size?: string): number;
  stockTotal(p: ShProduct): number;
  extra(p: ShProduct, size?: string): number;
  optLabel(p: ShProduct, color?: string, size?: string): string;
  optionState(p: ShProduct, color?: string): { colors: Array<ShOptionItem & { stock: number; soldOut: boolean }>; sizes: Array<ShOptionItem & { stock: number; soldOut: boolean; low: boolean }> };
  optReady(p: ShProduct, color?: string, size?: string): boolean;
  picker(box: HTMLElement, p: ShProduct, opt?: { onChange?: (pk: ShPicker) => void }): ShPicker;
  // 데이터
  dataBase: string;
  data<T = any>(name: string): Promise<T>;
  load(): Promise<ShLoaded>;
  /** 원자료 → 화면 값 (판매가·품절·별점·베스트·신상품·쓸 수 있는 쿠폰·적립금 잔액) */
  enrich(raw: { products: ShProduct[]; categories?: any[]; reviews?: any[]; coupons?: ShCoupon[]; user?: any; promos?: any[] }): ShLoaded;
  fixedNow?: string;
  now(): Date;
  date(iso: string, fmt?: string): string;
  thumb(p: { id: string | number; tone?: number; thumb?: string; images?: string[] }, n?: number): string;
  stars(rating: number, opt?: { size?: 12 | 16 | 18 | 20 | 24 }): unknown;
  // 장바구니 · 찜 · 최근 본 상품
  cart: {
    list(): ShCartLine[]; save(lines: ShCartLine[], opt?: { quiet?: boolean }): ShCartLine[];
    add(id: string, opt?: { color?: string; size?: string; qty?: number; max?: number }): ShCartLine | undefined;
    setQty(key: string, qty: number, max?: number): ShCartLine | null;
    remove(keys: string | string[]): ShCartLine[]; select(key: string | null, on: boolean): ShCartLine[]; selectAll(on: boolean): ShCartLine[];
    clear(): ShCartLine[]; count(): number; summary(byId: Record<string, ShProductEx>): ShCartSummary;
  };
  wish: { list(): string[]; has(id: string): boolean; toggle(id: string, on?: boolean): boolean };
  recent: { max: number; list(): string[]; add(id: string): void; remove(id: string): void; clear(): void };
  coupon: {
    apply(c: ShCoupon | null, ctx: { items: Array<{ cat?: string; amount: number }>; ship?: number; now?: Date }): { ok: boolean; amount: number; reason: string };
    label(c: ShCoupon): string;
    best(coupons: ShCoupon[], ctx: { items: Array<{ cat?: string; amount: number }>; ship?: number }): ShCoupon | null;
  };
  calc: {
    ship(subtotal: number, items?: Array<{ product?: ShProduct }>): number;
    cart(lines: ShCartLine[], byId: Record<string, ShProductEx>): ShCartSummary;
    order(o: { cart: ShCartSummary; coupon?: ShCoupon | null; points?: number | string; have?: number }): ShOrderCalc;
  };
  orderTotal(o: { items: Array<{ price: number; qty: number }>; ship?: number; coupon?: number; points?: number }): number;
  orders(): Promise<any[]>;
  status: Record<"paid" | "ready" | "shipping" | "done" | "cancel", { label: string; step: number; pill: string }>;
  statusPill(s: string): unknown;
  steps(status: string): unknown;
  // 마크업 (글자는 모두 이스케이프)
  card(p: ShProductEx, opt?: { rank?: number; remove?: boolean }): unknown;
  tags(p: ShProductEx): unknown;
  empty(title: string, text?: string, action?: unknown): unknown;
  pick(d: ShLoaded, spec: string): ShProductEx[];
  wishPaint(scope?: ParentNode): void;
  // 화면 부품 — init()이 부르고, mount(box)로 새로 넣은 상자를 직접 연결할 수 있다
  shell: { init(root: HTMLElement): void; count(scope?: ParentNode): void; tick(scope?: ParentNode): void; addCart(btn: HTMLElement): Promise<ShCartLine | null> };
  cards: { init(root: HTMLElement): void; fill(box: HTMLElement, d: ShLoaded): void };
  list: { sorts: Record<string, string>; prices: Array<[string, string]>; init(root: HTMLElement): void; read(qs?: URLSearchParams): ShListQuery; filter(products: ShProductEx[], o: Partial<ShListQuery>): ShProductEx[]; mount(box: HTMLElement): void };
  product: { init(root: HTMLElement): void; mount(box: HTMLElement): void; eta(p: { ship?: string }, now?: Date): string; reviews(box: HTMLElement, p: ShProductEx, list: any[]): void; qna(box: HTMLElement, p: ShProductEx, list: any[]): void };
  cartView: { init(root: HTMLElement): void; mount(box: HTMLElement): void };
  checkout: { init(root: HTMLElement): void; source(): { from: "now" | "cart"; lines: ShCartLine[] }; mount(f: HTMLFormElement): void };
  complete: { init(root: HTMLElement): void; mount(box: HTMLElement): void };
  my: Record<string, (box: HTMLElement, ...rest: any[]) => any> & { init(root: HTMLElement): void };
}

export declare const shop: CatuiShop;
export default shop;

declare module "./catui" { interface Catui { shop: CatuiShop } }
