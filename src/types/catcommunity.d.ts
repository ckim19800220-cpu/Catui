// CatuiCommunity (catcommunity.js) 타입 — 전역: window.catui.community / ESM: import community from "@imcat-ckim/catui/community"
import type { Off } from "./catui";

export type CmEvent = "theme" | "vote" | "comment" | "draft" | "poll" | "data";
export interface CmBoard { id: string; name: string; desc: string; cats: string[]; hotCut: number; type: "list" | "card" | "gallery" | "deal" | "qna" | "notice"; write?: boolean; count?: number; today?: number }
export interface CmUser { id: string; nick: string; joined: string; posts: number; comments: number; likes: number; bio?: string; score?: number; level?: number }
export interface CmPost { id: string; board: string; cat: string; title: string; user: string; time: string; up: number; down: number; views: number; comments: number; photo?: boolean; summary?: string; price?: number; shop?: string; ship?: string; until?: string; solved?: boolean }
export interface CmLoaded { boards: CmBoard[]; B: Record<string, CmBoard>; posts: Array<CmPost & { boardName: string; score: number; hot: boolean; author: CmUser }>; users: CmUser[]; U: Record<string, CmUser>; byId: Record<string, CmPost> }

export interface CatuiCommunity {
  readonly version: string;
  root: HTMLElement | null;
  ready?: Promise<CatuiCommunity>;
  init(scope?: Element | Document): CatuiCommunity;
  destroy(): void;
  on(evt: CmEvent, fn: (data: any) => void): Off;
  josa(word: string, pair: "을" | "를" | "이" | "가" | "은" | "는" | "과" | "와" | "으로" | "로"): string;
  store: { get<T = unknown>(key: string, fallback?: T): T; set(key: string, value: unknown): void; clear(): void };
  theme: { get(): "light" | "dark"; saved(): "light" | "dark" | "system"; set(v: "light" | "dark" | "system"): void };
  load(): Promise<CmLoaded>;
  level(score: number): number;
  row(post: any, opt?: { board?: boolean; rank?: number }): unknown;
  empty(text: string): unknown;
  fav: { list(): string[]; has(id: string): boolean; toggle(id: string): boolean };
  read: { has(id: string): boolean; add(id: string): void };
  voteRequest: (key: string, dir: "up" | "down" | "") => Promise<boolean>;
  md(text: string): string;
  dataBase: string;
  derive: Record<string, (json: any) => any>;
  data<T = any>(name: string): Promise<T>;
  bind(scope?: Element | Document): Promise<unknown[]>;
  format(v: unknown, kind?: "number" | "won" | "man" | "percent" | "delta" | "ms" | "initial" | "compact" | "ago"): string;
  ago(iso: string): string;
}

export declare const community: CatuiCommunity;
export default community;

declare module "./catui" { interface Catui { community: CatuiCommunity } }
