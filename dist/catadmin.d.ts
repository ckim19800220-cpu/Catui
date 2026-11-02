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
}

export declare const admin: CatuiAdmin;
export default admin;

declare module "./catui" { interface Catui { admin: CatuiAdmin } }
