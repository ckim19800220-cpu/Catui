// Catui (catui.js) 타입 선언 — dist/catui.d.ts로 복사된다.
// 전역: <script src="catui.js"> → window.catui   /   ESM: import catui, { layer, form } from "@imcat-ckim/catui"

export interface Raw { readonly __raw: string }
export type Markup = string | number | Raw | Element | null | undefined;
export type Target = string | Element | ArrayLike<Element> | null | undefined;
export type Off = () => void;
export type Handler<T = any> = (this: Element | null, data: T) => boolean | void;

/** 이벤트 이름: '이벤트' 또는 '이벤트(필터)' */
export type EventName = string;

// ── 코어 ─────────────────────────────────────────────
export interface CatuiConfig {
  /** 아이콘 스프라이트 경로 (기본: catui.js 옆 icons.svg) */
  icons: string;
  /** 문서 준비 시 data-catui-* 자동 연결 */
  autoInit: boolean;
  /** DOM에서 빠진 요소의 인스턴스 자동 정리 */
  autoDestroy: boolean;
  /** true 경고·오류 / false 오류만 / "silent" 모두 끔 */
  debug: boolean | "silent";
  /** 같은 출처 쓰기 요청의 CSRF 헤더 (false = 끔) */
  csrf: false | { meta?: string; header?: string };
  [key: string]: unknown;
}

/** 배열처럼 쓰는 요소 묶음. find는 배열의 find가 아니라 하위 요소 찾기다 */
export interface CatuiQuery extends Omit<Array<Element>, "find"> {
  find(selector: string): CatuiQuery;
  each(fn: (this: Element, el: Element, i: number) => void): this;
  attr(name: string): string | null;
  attr(name: string, value: string | null): this;
  addClass(c: string): this;
  removeClass(c: string): this;
  toggleClass(c: string, force?: boolean): this;
  hasClass(c: string): boolean;
  text(): string;
  text(v: string | number | null): this;
  html(): string;
  html(v: Markup): this;
  on(type: string, fn: (this: Element, e: Event, el: Element) => void): Off;
  on(type: string, selector: string, fn: (this: Element, e: Event, el: Element) => void): Off;
}

/** component()으로 만든 인스턴스 */
export interface Instance<C = Record<string, any>> {
  id: string;
  elem: Element | null;
  config: C;
  filter: string;
  use(fn: () => void): () => void;
  emit(evt: string, payload?: object): boolean;
  reload(options?: Partial<C>): this;
  destroy(): void;
  [extra: string]: any;
}

/** 모든 렌더형 모듈의 공통 인터페이스 */
export interface ComponentApi<C = Record<string, any>, I extends Instance<C> = Instance<C>> {
  render(options: Partial<C> & { elem?: Target; id?: string; filter?: string; done?: (this: I, inst: I) => void }): I;
  reload(id: string, options?: Partial<C>): I | null;
  getThis(id: string): I | null;
  destroy(id: string): void;
  destroyAll(): void;
  destroyDetached(): void;
  on(evt: EventName, fn: Handler): Off;
  off(evt: EventName): void;
  set(defaults: Partial<C>): this;
  readonly config: C;
}

// ── 모듈 ─────────────────────────────────────────────
export interface LayerOpenOptions {
  type?: "dialog" | "drawer" | "iframe";
  title?: string; content?: Markup; area?: "sm" | "md" | "lg" | "xl" | "full" | [string, string?];
  btn?: string[]; closeBtn?: boolean; shadeClose?: boolean; offset?: "l" | "r" | "b";
  maxmin?: boolean; move?: boolean; resize?: boolean; time?: number; danger?: boolean; id?: string; skin?: string; label?: string;
  yes?: (index: number, dlg: HTMLDialogElement) => boolean | void;
  cancel?: (index: number, dlg: HTMLDialogElement) => boolean | void;
  success?: (dlg: HTMLDialogElement, index: number) => void;
  end?: (index: number, reason?: string) => void;
  [btnN: string]: unknown;
}
export interface LayerFormField {
  name: string; label: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "date" | "time" | "textarea" | "select" | "radio" | "checkbox" | "switch";
  required?: boolean; placeholder?: string; value?: unknown; options?: Array<string | { value: string; label: string }>;
  help?: string; min?: number; max?: number; minlength?: number; maxlength?: number; pattern?: string; cols?: number; rows?: number;
  readonly?: boolean; disabled?: boolean; autocomplete?: string;
  addon?: { icon?: string; label?: string; onClick?: (input: HTMLInputElement, value: unknown) => void };
  messages?: Partial<Record<"valueMissing" | "typeMismatch" | "patternMismatch" | "rangeUnderflow" | "rangeOverflow" | "stepMismatch" | "tooShort" | "tooLong" | "badInput", string>>;
  validate?: (value: unknown, values: Record<string, unknown>) => string | void;
}
export interface Layer {
  msg(content: Markup, options?: { icon?: "success" | "info" | "warn" | "danger"; body?: Markup; time?: number; max?: number; position?: "br" | "tr" | "tc" | "bc"; action?: { text: string; onClick?: (index: number) => void }; progress?: boolean } | (() => void), end?: () => void): number;
  open(options: LayerOpenOptions): number;
  alert(content: Markup, options?: LayerOpenOptions | ((index: number) => void), yes?: (index: number) => void): number;
  confirm(content: Markup, options?: LayerOpenOptions & { okText?: string; cancelText?: string } | ((index: number) => void), yes?: (index: number) => void, cancel?: (index: number) => void): number;
  prompt(options?: LayerOpenOptions & { formType?: "text" | "password" | "textarea"; value?: string; maxlength?: number; placeholder?: string; required?: boolean }, yes?: (value: string, index: number) => boolean | void): number;
  load(text?: string | { text?: string; progress?: boolean }, options?: { progress?: boolean }): number;
  progress(index: number, percent: number): void;
  tips(content: Markup, target: Target, options?: { side?: "top" | "bottom" | "left" | "right"; time?: number; end?: (index: number) => void }): number;
  photos(options: { items: Array<{ src: string; alt?: string; caption?: string }>; start?: number; title?: string; change?: (i: number) => void }): number;
  tab(options: LayerOpenOptions & { tabs: Array<{ title: string; content: Markup }>; vertical?: boolean; card?: boolean; start?: number }): number;
  form(options: LayerOpenOptions & { fields: LayerFormField[]; layout?: "vertical" | "horizontal"; okText?: string; submit?: (values: Record<string, unknown>, index: number) => unknown }): Promise<Record<string, unknown> | null>;
  ask(content: Markup, options?: LayerOpenOptions): Promise<boolean>;
  input(options?: LayerOpenOptions & { formType?: "text" | "password" | "textarea"; value?: string; maxlength?: number; placeholder?: string; required?: boolean }): Promise<string | null>;
  close(index: number): void; closeAll(type?: string): void; closeLast(type?: string): void;
  title(index: number, text: string): void; getNode(index: number): HTMLElement | null; setContent(index: number, content: Markup): void;
  style(index: number, css: Record<string, string | number>): void; full(index: number): void; restore(index: number): void;
  list(type?: string): Array<{ index: number; type: string; node: HTMLElement }>;
  readonly count: number;
}

export interface Form {
  verify(rules: Record<string, [RegExp, string] | ((value: string, el: Element, arg?: string, root?: Element | Document) => string | void)>): object;
  validate(scope?: Target | Document): boolean;
  val(filter: string, values?: Record<string, unknown>): Record<string, string | string[]>;
  serialize(filter: string): string;
  reset(filter: string): void;
  submit(filter: string, cb?: (data: { form: Element; field: Record<string, unknown>; elem: null }) => void): boolean;
  check(field: Element): string;
  render(scope?: Target | Document): void;
  setError(field: Target, msg: string): void;
  clearError(field: Target): void;
  on(evt: EventName, fn: Handler): Off;
  off(evt: EventName): void;
}

export interface Util {
  toDateString(time?: number | string | Date, format?: string): string;
  timeAgo(time: number | string | Date, onlyDate?: boolean): string;
  countdown(o: { date: number | string | Date; now?: number | string | Date; ready?: (t: { d: number; h: number; m: number; s: number; left: number }) => void; clear?: () => void }): { clear(): void };
  debounce<T extends (...a: any[]) => any>(fn: T, wait?: number): T & { cancel(): void };
  throttle<T extends (...a: any[]) => any>(fn: T, wait?: number): T & { cancel(): void };
  copy(text: string): Promise<boolean>;
  number(n: number | string, decimals?: number): string;
  fileSize(bytes: number, decimals?: number): string;
  escape(v: unknown): string; html(s: TemplateStringsArray, ...v: unknown[]): Raw; raw(m: string): Raw;
}

export interface CarouselOptions {
  direction: "horizontal" | "vertical"; effect: "slide" | "fade"; loop: boolean; rewind: boolean; index: number;
  perView: number | string | Record<number, number> | null; step: number; gap: number | string | null; align: "start" | "center";
  height: number | string | null; autoHeight: boolean;
  autoplay: number; pauseOnHover: boolean; reverse: boolean; stopOnInteraction: boolean;
  arrows: boolean; dots: boolean; thumbs: boolean; counter: boolean; progress: boolean; drag: boolean; wheel: boolean; keyboard: boolean;
  label: string; slideLabel: string; before: ((from: number, to: number) => boolean | void) | null; change: ((index: number) => void) | null;
}
export interface CarouselInstance extends Instance<CarouselOptions> {
  go(i: number, smooth?: boolean): void; next(): void; prev(): void; pause(): void; play(): void;
  isPaused(): boolean; getIndex(): number; getTotal(): number; update(): void;
}

export type GenericComponent = ComponentApi<Record<string, any>> & Record<string, any>;

// 모듈별 인스턴스 메서드 (옵션은 문서 표 참고 — 여기서는 느슨하게 둔다)
type Opts = Record<string, any>;
export interface DropdownInstance extends Instance<Opts> { open(at?: { x: number; y: number }): void; close(): void }
export interface DatePickerInstance extends Instance<Opts> { open(): void; close(): void }
export interface UploadFile { id: string; file: File; status: "ready" | "uploading" | "done" | "error"; percent: number; res?: unknown; msg?: string }
export interface UploadInstance extends Instance<Opts> { files: UploadFile[]; upload(): void; clear(): void; setDisabled(on: boolean): void }
export interface SliderInstance extends Instance<Opts> { input: HTMLInputElement; getValue(): number; setValue(v: number): void; setDisabled(on: boolean): void }
export interface RateInstance extends Instance<Opts> { value: number; getValue(): number; setValue?(v: number): void }
export interface TreeInstance extends Instance<Opts> {
  getChecked(): any[]; setChecked(ids: string | number | Array<string | number>): void; getSelected(): any | null;
  clearChecked(): void; expandAll(open?: boolean): void; search(keyword: string): void;
}
export interface CanvasInstance extends Instance<Opts> { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; redraw(): void; toBlob(cb: BlobCallback, type?: string): void }
export interface AutocompleteInstance extends Instance<Opts> { search(q?: string): void; close(): void }
export interface CommandInstance extends Instance<Opts> { dialog: HTMLDialogElement; open(): void; close(): void }
type Bindable = { bind(): Off };

export interface Field {
  tags: GenericComponent; stepper: GenericComponent; counter: GenericComponent; otp: GenericComponent;
  enhance(scope?: Element | Document): void; destroyAll(): void; destroyDetached(): void;
}
export interface Page {
  steps: GenericComponent; flow: GenericComponent;
  lazy(scope?: Element | Document): void; totop(options?: { offset?: number; target?: string; label?: string }): HTMLElement;
  copy(text: string): Promise<boolean>; tip: { show(t: Target): void; hide(): void };
  enhance(scope?: Element | Document): void; bind(): Off; destroyAll(): void; destroyDetached(): void;
}
export interface Site {
  countdown: GenericComponent; marquee: GenericComponent;
  consent(): { value: string; at: number } | null; resetConsent(): void;
  share(btn: Element): Promise<void>; billing(box: Target, value: string): void;
  on(evt: EventName, fn: Handler): Off;
  enhance(scope?: Element | Document): void; bind(): Off; destroyAll(): void; destroyDetached(): void;
}

export interface Catui {
  readonly version: string;
  config(options?: Partial<CatuiConfig>): CatuiConfig;
  readonly cache: { config: CatuiConfig; modules: string[] };
  use(mods: string | string[], callback?: (...modules: any[]) => void): Promise<any[]>;
  use(callback: () => void): Promise<any[]>;
  extend(mods: Record<string, unknown>): Catui;
  define(name: string, deps: string[] | ((...m: any[]) => unknown), factory?: (...m: any[]) => unknown): Catui;
  init(scope?: Target | Document): Catui;
  destroy(): void;
  onevent(mod: string, evt: EventName, fn: Handler): Off;
  offevent(mod: string, evt: EventName): void;
  event(mod: string, name: string, filter: string | null, payload?: object, thisArg?: unknown): boolean;
  $(target: Target | Document | Window, ctx?: ParentNode): CatuiQuery;
  el(target: Target, ctx?: ParentNode): Element | null;
  html(strings: TemplateStringsArray, ...values: unknown[]): Raw;
  raw(markup: string): Raw;
  escape(value: unknown): string;
  mount(node: Element, markup: Markup): Element;
  icon(name: string, size?: 12 | 16 | 18 | 20 | 24, cls?: string): Raw;
  hint: { error(msg: string, type?: "warn" | "error", ...detail: unknown[]): void; errorOnce(msg: string, type?: "warn" | "error", ...detail: unknown[]): void };
  data(table: string, settings?: { key: string; value?: unknown; remove?: boolean } | null): Record<string, any>;
  sessionData(table: string, settings?: { key: string; value?: unknown; remove?: boolean } | null): Record<string, any>;
  url(href?: string): { pathname: string[]; search: Record<string, string>; hash: { path: string[]; search: Record<string, string>; href: string } };
  device(key?: string): { os: string; android: boolean; ios: boolean; mobile: boolean; [k: string]: unknown };
  csrfHeaders(url: string, method?: string): Record<string, string>;
  component<C = Record<string, any>>(def: { name: string; config?: C; ownDone?: boolean; render(inst: Instance<C>): void; destroy?(inst: Instance<C>): void; beforeRender?(inst: Instance<C>): void; [k: string]: unknown }): ComponentApi<C> & Record<string, any>;

  layer: Layer; form: Form; util: Util;
  laypage: GenericComponent;
  table: GenericComponent & Bindable & { checkStatus(id: string): { data: any[]; isAll: boolean }; getData(id: string): any[]; clearChecked(id: string): void; exportFile(id: string, filename?: string, opts?: { checked?: boolean; rows?: any[] }): boolean; enhance(scope?: Element | Document): void };
  tabs: ComponentApi<Opts> & Bindable & { change(filter: string, index: number): void; add(filter: string, item?: { title?: string; content?: Markup; id?: string; change?: boolean }): number; close(filter: string, index: number): void };
  dropdown: ComponentApi<Opts, DropdownInstance> & Bindable & { close(id: string): void };
  datePicker: ComponentApi<Opts, DatePickerInstance> & { enhance(scope?: Element | Document): void };
  upload: ComponentApi<Opts, UploadInstance>;
  slider: ComponentApi<Opts, SliderInstance> & Bindable & { setValue(id: string, v: number): void; getValue(id: string): number | null };
  rate: ComponentApi<Opts, RateInstance> & Bindable & { setValue(id: string, v: number): void; getValue(id: string): number };
  tree: ComponentApi<Opts, TreeInstance> & { getChecked(id: string): any[]; setChecked(id: string, ids: string | number | Array<string | number>): void; getSelected(id: string): any | null; clearChecked(id: string): void; expandAll(id: string, open?: boolean): void; search(id: string, keyword: string): void };
  collapse: ComponentApi<Opts> & Bindable & { open(filter: string, index?: number): void; close(filter: string, index?: number): void; toggle(filter: string, index: number): void };
  canvas: ComponentApi<Opts, CanvasInstance> & { redraw(id: string): void };
  fx: Record<string, any> & { bind(scope?: Target | Document): () => void; enhance(scope?: Target | Document): void; destroyDetached(): void; destroyAll(): void };
  carousel: ComponentApi<CarouselOptions, CarouselInstance> & { go(id: string, i: number): void; enhance(scope?: Element | Document): void };
  autocomplete: ComponentApi<Opts, AutocompleteInstance>; command: ComponentApi<Opts, CommandInstance> & { open(id: string): void; close(id: string): void };
  field: Field; page: Page; site: Site;
  [module: string]: any;
}

export declare const catui: Catui;
export declare const layer: Layer;
export declare const form: Form;
export declare const util: Util;
export declare const laypage: Catui["laypage"];
export declare const table: Catui["table"];
export declare const tabs: Catui["tabs"];
export declare const dropdown: Catui["dropdown"];
export declare const datePicker: Catui["datePicker"];
export declare const upload: Catui["upload"];
export declare const slider: Catui["slider"];
export declare const rate: Catui["rate"];
export declare const tree: Catui["tree"];
export declare const collapse: Catui["collapse"];
export declare const canvas: Catui["canvas"];
export declare const fx: Catui["fx"];
export declare const carousel: Catui["carousel"];
export declare const field: Field;
export declare const autocomplete: Catui["autocomplete"];
export declare const command: Catui["command"];
export declare const page: Page;
export declare const site: Site;
export declare const html: Catui["html"];
export declare const raw: Catui["raw"];
export declare const escape: Catui["escape"];
export declare const component: Catui["component"];
export declare const $: Catui["$"];
export default catui;

declare global {
  interface Window { catui: Catui }
}
