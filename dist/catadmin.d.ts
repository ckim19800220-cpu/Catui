// CatuiAdmin (catadmin.js) 타입 — 전역: window.catui.admin / ESM: import admin from "@imcat-ckim/catui/admin"
import type { Catui, Target, Off } from "./catui";

export type AdmEvent = "theme" | "collapse" | "drawer" | "notify" | "dirty" | "chat" | "kanban";
export interface AdmNotifyItem { id?: string; who?: string; text: string; time?: string; unread?: boolean; icon?: string; tone?: 2 | 3 | 5 }
export interface AdmChartData { type?: "area" | "line" | "bar" | "donut" | "spark"; label?: string; labels?: string[]; series?: Array<{ name?: string; data: number[] }>; data?: number[]; center?: string; caption?: string }

export interface CatuiAdmin {
  readonly version: string;
  root: HTMLElement | null;
  init(scope?: Element | Document): CatuiAdmin;
  destroy(): void;
  on(evt: AdmEvent, fn: (data: any) => void): Off;
  store: { get<T = unknown>(key: string, fallback?: T): T; set(key: string, value: unknown): void; clear(): void };
  shell: { collapse(on: boolean): void; open(): void; close(restore?: boolean): void };
  theme: { get(): "light" | "dark"; saved(): "light" | "dark" | "system"; set(v: "light" | "dark" | "system"): void };
  notify: { items: AdmNotifyItem[]; count(): number; add(item: AdmNotifyItem): void; markRead(id: string): void; markAll(): void };
  widgets: { chart(el: Target, data: AdmChartData): unknown; update(el: Target, data: AdmChartData): void };
  form: { saved(form: HTMLFormElement): void; isDirty(form: HTMLFormElement): boolean };
  list(opt: { table: string; form?: Target; data: any[]; match?: (row: any, values: Record<string, any>) => boolean; bulkbar?: Target; change?: (rows: any[], values: Record<string, any>) => void }): { apply(): any[]; values(): Record<string, any>; rows(): any[]; reset(): void };
  split(el: Target): { show(pane: "list" | "detail"): void } | null;
  chat(opt: { log: Target; form: Target; me?: string }): { add(text: string, who?: string): HTMLElement; scroll(): void } | null;
  kanban(el: Target): { add(col: Target, card: HTMLElement): void; sync(): void } | null;
  auth: { score(password: string): 0 | 1 | 2 | 3 | 4 };
  /** init()이 채우는 데이터 연결 완료 Promise. destroy() 뒤에는 undefined */
  ready?: Promise<CatuiAdmin>;
  /** 조사 붙이기: josa('주문','을') → '주문을', josa('진행','으로') → '진행으로' */
  josa(word: string, pair: "을" | "를" | "이" | "가" | "은" | "는" | "과" | "와" | "으로" | "로"): string;
  /** 모듈 이벤트 발사 — 핸들러가 false를 돌려주면 false */
  emit(evt: AdmEvent | string, payload?: any): boolean;
  /** JSON 모의 데이터 주소 앞부분 (기본 "data/") */
  dataBase: string;
  /** 파생 값: derive['이름'] = (json) => 가공한 값 */
  derive: Record<string, (json: any) => any>;
  /** 이름으로 JSON을 한 번 읽어 캐시. 실패하면 캐시에서 지우고 거부 */
  data<T = any>(name: string): Promise<T>;
  /** 점 경로("a.b.0.c")로 값 꺼내기 */
  pick(obj: any, path: string): any;
  format(v: unknown, kind?: "number" | "won" | "man" | "percent" | "delta" | "ms" | "initial"): string;
  /** scope 안 [data-catui-adm-src] 상자에 데이터를 채운다 */
  bind(scope?: Element | Document): Promise<unknown[]>;
  /** 상단 바 연결 — init()이 부른다 [내부 부품] */
  topbar: { init(root: HTMLElement): void };
}

export declare const admin: CatuiAdmin;
export default admin;

declare module "./catui" { interface Catui { admin: CatuiAdmin } }
