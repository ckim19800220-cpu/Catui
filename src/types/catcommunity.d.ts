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
  /** 모듈 이벤트 발사 — 핸들러가 false를 돌려주면 false */
  emit(evt: CmEvent | string, payload?: any): boolean;
  /** 현재 주소의 검색 매개변수 */
  query(): URLSearchParams;
  /** 모의 데이터 "지금" — <html data-catui-cm-now> 값 (없으면 undefined = 실제 시각) */
  fixedNow?: string;
  now(): Date;
  /** 점 경로("a.b.0.c")로 값 꺼내기 */
  pick(obj: any, path: string): any;
  /** 회원 색 톤 1~5 (아이디로 고정) */
  tone(id: string | number): number;
  avatar(u: { id?: string; nick: string }, size?: "sm" | "md" | "lg"): unknown;
  badge(u: CmUser): unknown;
  /** 3시간 이내 글이면 true */
  isNew(p: { time: string }): boolean;
  mini(p: any, opt?: { rank?: number }): unknown;
  tr(p: any): unknown;
  table(rows: any[]): unknown;
  /** 사진 주소: p.thumb이 없으면 토큰 색 SVG 자리표시 */
  thumb(p: { id: string | number; thumb?: string; tone?: number }): string;
  vote: { get(key: string): "up" | "down" | ""; set(key: string, dir: "up" | "down" | ""): void; paint(box: HTMLElement): void; paintAll(scope: ParentNode): void; init(root: HTMLElement): void };
  /** 아래는 init()이 부르는 부품 — mount(box)로 새로 넣은 상자를 직접 연결할 수 있다 */
  shell: { init(root: HTMLElement): void; aside(root: HTMLElement): void };
  list: { init(root: HTMLElement): void; mount(box: HTMLElement): void; qnaRow(p: any): unknown };
  comments: { init(root: HTMLElement): void; mount(box: HTMLElement): void; form(label: string, parent?: string): HTMLFormElement; item(c: any, users: Record<string, CmUser>, opt?: { best?: boolean }): unknown; draw(box: HTMLElement, state: any): void };
  widgets: { tick(scope?: Element | Document): void; init(root: HTMLElement): void; poll(f: HTMLFormElement): void };
  editor: { init(root: HTMLElement): void };
}

export declare const community: CatuiCommunity;
export default community;

declare module "./catui" { interface Catui { community: CatuiCommunity } }
