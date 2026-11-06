// CatuiDocs (catdocs.js) 타입 — 전역: window.catui.docs / ESM: import docs from "@imcat-ckim/catui/docs"
import type { Off } from "./catui";

export type DkEvent = "theme" | "copy" | "feedback" | "search" | "filter" | "version" | "data";
/** 본문 블록 (data/pages.json · posts.json의 body) — 글자는 모두 이스케이프, p·list·note는 마크다운 일부 */
export type DkBlock =
  | { h2: string } | { h3: string } | { p: string } | { list: string[] }
  | { code: string; lang?: string } | { note: string; tone?: "tip" | "warn" };
export interface DkNavGroup { title: string; items: Array<{ title: string; href: string }> }
export interface DkPage { title: string; group?: string; desc?: string; updated: string; edit?: string; blocks: DkBlock[] }
export interface DkAuthor { id: string; name: string; role?: string; bio?: string; tone?: number; site?: string }
export interface DkTag { id: string; name: string; desc?: string }
export interface DkPost { id: string; title: string; summary?: string; author: string; date: string; tags?: string[]; tone?: number; icon?: string; body?: DkBlock[] }
export interface DkPostEx extends DkPost { authorObj: DkAuthor; tagObjs: DkTag[] }
export interface DkBlog { posts: DkPostEx[]; byId: Record<string, DkPostEx>; authors: DkAuthor[]; A: Record<string, DkAuthor>; tags: DkTag[]; T: Record<string, DkTag>; count: Record<string, number> }
export interface DkRelease { version: string; date: string; items: Array<{ type: "added" | "changed" | "fixed"; text: string }> }
/** 검색 색인 항목: t 제목 · u 주소 · s 분류 · x 요약 · k 키워드 */
export interface DkIndexItem { t: string; u: string; s?: string; x?: string; k?: string }
export interface DkReadTime { minutes: number; ko: number; words: number; label: string }
export interface DkTocItem { id: string; text: string; level: number; el: HTMLElement }

export interface CatuiDocs {
  readonly version: string;
  root: HTMLElement | null;
  ready?: Promise<CatuiDocs>;
  /** readKo 500(분당 한글 음절) · readWords 200(분당 단어) · perPage 6 · related 3 · recent 3 · searchLimit 30 · tocLevels "h2, h3" */
  rules: { readKo: number; readWords: number; perPage: number; related: number; recent: number; searchLimit: number; tocLevels: string };
  init(scope?: Element | Document): CatuiDocs;
  destroy(): void;
  on(evt: DkEvent, fn: (data: any) => void): Off;
  emit(evt: DkEvent | string, payload?: any): boolean;
  query(): URLSearchParams;
  store: { get<T = unknown>(key: string, fallback?: T): T; set(key: string, value: unknown): void; clear(): void };
  theme: { get(): "light" | "dark"; saved(): "light" | "dark" | "system"; set(v: "light" | "dark" | "system"): void; apply(v: string): void; init(): void };
  announce(msg: string): void;
  // 글자
  /** 한 줄 마크다운 → HTML 문자열: 이스케이프 후 **굵게** · `코드` · [글자](https://…)만 */
  mdInline(src: string): string;
  /** 여러 줄: 빈 줄로 문단, "- " 목록 */
  md(src: string): string;
  blocks(list: DkBlock[]): unknown;
  /** 분 = 올림(한글 음절 ÷ readKo + 단어 ÷ readWords), 최소 1 — 요소면 pre(코드)는 세지 않음 */
  readTime(src: string | Element): DkReadTime;
  slug(text: string, taken?: Set<string> | null): string;
  chosung(s: string): string;
  // 목차 · 앵커 · 코드
  toc(article: Element | string, box?: Element | string | null, opt?: { levels?: string; title?: string }): { items: DkTocItem[]; el: HTMLElement | null };
  tocSync(): void;
  anchor(id: string): Promise<boolean>;
  code(scope?: Element | Document | string): number;
  copyCode(btn: HTMLElement): Promise<boolean>;
  refresh(article: Element | string): void;
  readTimeFill(scope?: ParentNode): void;
  // 검색
  search: {
    match(text: string, q: string): boolean;
    score(it: DkIndexItem, q: string): number;
    find(index: DkIndexItem[], q: string, limit?: number): Array<DkIndexItem & { score: number }>;
    load(scope?: ParentNode): Promise<DkIndexItem[]>;
    highlight(text: string, q: string): unknown;
    render(box: HTMLElement, results: DkIndexItem[], q: string): void;
    init(root: HTMLElement): void;
    run?: () => DkIndexItem[];
    index?: DkIndexItem[];
    ready?: Promise<DkIndexItem[] | null>;
  };
  // 데이터
  dataBase: string;
  data<T = any>(name: string): Promise<T>;
  date(iso: string, fmt?: string): string;
  blog(): Promise<DkBlog>;
  postTime(p: DkPost): DkReadTime;
  // 마크업 (글자는 모두 이스케이프)
  card(p: DkPostEx): unknown;
  meta(p: DkPostEx): unknown;
  empty(title: string, text?: string): unknown;
  pager(page: number, pages: number): unknown;
  pageKey(href?: string): string;
  // 화면 부품 — init()이 부른다
  shell: { init(root: HTMLElement): void; drawPage(box: HTMLElement, pg: DkPage, id: string): void; ready?: Promise<unknown> };
  feedback: { get(key: string): "" | "yes" | "no"; set(key: string, value: "" | "yes" | "no"): void; keyOf(box: HTMLElement): string; paint(box: HTMLElement): void; init(root: HTMLElement): void };
  version: { go(href: string): void; init(root: HTMLElement): void };
  blogList: { read(qs?: URLSearchParams): { tag: string; page: number }; slice(posts: DkPostEx[], st?: { tag?: string; page?: number }): { rows: DkPostEx[]; total: number; pages: number; page: number }; go(st: { tag: string; page: number }, focusSel?: string): void; draw(focusSel?: string): void; init(root: HTMLElement): void; ready?: Promise<DkBlog | null> };
  post: { init(root: HTMLElement): void; ready?: Promise<DkPostEx | null> };
  tagPage: { init(root: HTMLElement): void; ready?: Promise<DkTag | null> };
  authorPage: { init(root: HTMLElement): void; ready?: Promise<DkAuthor | null> };
  recent: { init(root: HTMLElement): void; ready?: Promise<unknown> };
  changelog: { kinds: Record<string, [string, string]>; badge(kind: string): unknown; init(root: HTMLElement): void; ready?: Promise<DkRelease[] | null> };
}

export declare const docs: CatuiDocs;
export default docs;

declare module "./catui" { interface Catui { docs: CatuiDocs } }
