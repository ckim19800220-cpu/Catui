export interface DramaSeries { id: string; title: string; genre: "로맨스" | "스릴러" | "판타지" | "일상"; format: "실사" | "애니" | "AI"; episodes: number; minutes: number; status: "완결" | "연재 중"; date: string; photo: string; desc: string; }
export interface DramaState { q: string; g: string; t: string; sort: "new" | "title" | "short"; page: number; }
export interface CatuiDrama { version: string; root: HTMLElement | null; dataBase: string; photoBase: string; items: DramaSeries[]; ready: Promise<CatuiDrama>; load(): Promise<DramaSeries[]>; state(): DramaState; filtered(state?: DramaState): DramaSeries[]; init(scope?: Document | Element): CatuiDrama; destroy(): void; refresh(focus?: boolean): Promise<CatuiDrama>; render(): void; applyTheme(dark: boolean): void; }
export declare const drama: CatuiDrama;
export default drama;
declare module "./catui" { interface Catui { drama: CatuiDrama; } }
