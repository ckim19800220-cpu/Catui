---
name: catui-design
description: Catui UI 키트(CSS)와 catui.js 프레임워크의 디자인·구조·품질 기준. assets/spec/design_m.html 토큰 명세가 원본이며, CSS만으로 동작·Catui_ 네임스페이스·Line 01(CC0) 아이콘 스프라이트·빌드 생성 문서(docs-src→docs)가 특징. 새 컴포넌트/모듈/문서 페이지, 토큰 추가, 디자인 리뷰, 시각 QA 시 사용.
---

# Catui 디자인 시스템

## 1. 원본과 파일 지도

| 역할 | 경로 | 비고 |
|------|------|------|
| 디자인 원본 | `assets/spec/design_m.html` | 토큰 명세서 v1.2 (618개 토큰) |
| 토큰 | `src/css/foundation/tokens.css` | 명세 `--*` → `--Catui_*` 1:1 미러 |
| CSS 소스 | `src/css/{foundation,layout,components,forms,views,charts}/` | 컴포넌트당 1파일(61개). 결합 순서 `src/css/index.json` |
| JS 소스 | `src/js/{core,modules}/` + `index.js` | catui.js(ESM). 번들 순서·exports `src/js/bundle.json` |
| 아이콘 | `src/icons/allow.json` · `map.json` · `line01/` · `svg/` | 241개 → `dist/icons.svg`. 원본 우선순위: `svg/`(Catui 원본) → `line01/`(iconsforfree.com CC0, 이름이 다르면 map.json). Lucide는 제거됨(쓰면 고지 필요) |
| 결과물 | `dist/` | `catui.css · catui.min.css · catui.js · catui.esm.js · icons.svg` (직접 수정 금지) |
| 문서 원본 | `docs-src/` | `nav.json`(큰 분류 CSS/catui.js → 작은 분류 → 페이지) · `layout.html` · `css/**`·`js/**` 조각 · `assets/docs.css·docs.js` |
| 문서 사이트 | `docs/` | 빌드 결과 86쪽 (직접 수정 금지) |
| 빌드 | `scripts/build.mjs` → `build-css/icons/js/docs.mjs`, `serve.mjs` | `npm run build` / `build:css` / `build:docs` / `dev`(:8766) |

CSS 분류: **foundation** tokens·reset·utilities·typography / **layout** grid·app-shell·site / **components** button·split-button·form·choice·badge·avatar·card·stat·progress·table·tabs·segment·pager·breadcrumb·feedback·modal·drawer·dropdown·toast·tooltip·mega·wizard·command·faq·spinner / **forms** upload·range·rating·tags·stepper·datepicker·counter·search / **views** tree·calendar·gantt·kanban·files·thread·heatmap·timeline·task·meter·feed / **charts** line·legend·donut·bars·stack·gauge·funnel·sparkline·radar·prose.

JS 모듈: layer(msg·open·alert·confirm·prompt·load·progress·tips·photos·tab(vertical)·form(fields 검사·Promise)·ask·input, area xl/full/배열·maxmin·move·resize·time·drawer offset·iframe 안전 주소)·form·laypage·table·tabs·dropdown·util·datePicker·upload·slider·rate·tree·collapse·canvas·fx·carousel·field(tags·stepper·counter·otp)·autocomplete·command(Ctrl+K)·page(copy·tip·lazy·flow·steps·totop)·site(header·spy·announce·cookie·countdown·billing·lightbox·subscribe·marquee·readbar·share) (+ core: catui·component·events·dom·html·base·init). 여러 컴포넌트를 묶은 모듈(field·page)은 `destroyAll`/`destroyDetached`를 하위로 전달해야 자동 정리(autoDestroy)가 닿는다. 선언형 준비는 `모듈.enhance(scope)`를 catui.init에, 전역 위임은 `모듈.bind()`를 catuiOffs에 등록. 한글 IME가 걸리는 Esc·Enter 처리는 반드시 `imeBusy(e)`로 거른다. `display:flex|grid`인 컴포넌트를 `hidden`으로 숨기려면 CSS에 `.클래스[hidden]{display:none}`을 함께 둔다. 컴포넌트 config의 `done`은 렌더 완료 콜백이므로, 다른 의미로 쓰면 정의에 `ownDone: true`. 실제 동작 검증은 `npm test`(tests/run.mjs, 헤드리스 Chrome으로 문서 전체 콘솔 오류 0건 + tests/scenarios.mjs 시나리오). 새 모듈·버그 수정에는 시나리오를 추가한다. 빌드는 catui.min.js·.map(esbuild)·catui.d.ts(src/types)·THIRD_PARTY_NOTICES.txt(Lucide를 쓸 때만, 현재 0개라 생성 안 됨)를 만든다. fx는 텍스트·스크롤·커서·화면 기능·배경 효과 38종(`data-catui-fx`)이며 외부 라이브러리 코드를 옮기지 않고 직접 구현한다(React Bits 등은 MIT+Commons Clause로 포팅 재배포 금지). 조합 규칙: 덧칠 효과(spotlight·aurora·border·glare·edge·noise)는 JS가 전용 레이어(`.Catui_fx-layer`)에 그리고, 움직임은 `transform`(tilt)·`translate`(magnet·reveal·버튼 눌림)·`scale`(press·dock·pop)을 나눠 쓴다. 글자·채움·애니메이션·배경·클릭 자리가 겹치는 효과는 `SLOTS`로 막고 경고한다. 새 효과를 넣으면 SLOTS에 자리를 등록할 것.

## 2. 네임스페이스 규칙 (필수)

- 공개 클래스·CSS 변수·아이콘 id는 전부 `Catui_` 접두사.
- 리셋은 `.Catui_app`(관리 셸)/`.Catui_site`(공개 홈)/`.Catui_layer`(catui.js 오버레이 루트) 안에서만. 루트 밖 DOM 불개입.
- 변수 3층: **L1** 팔레트/타이포/간격/반경/그림자 → **L2** 파생(`brand-ghost`, `focus-ring`) → **L3** 컴포넌트 토큰. L3는 L1/L2 `var()` 참조만(순수 치수 제외).

## 3. 토큰 핵심값

| 항목 | 값 |
|------|-----|
| brand / hover / soft | `#26B99A` / `#1FA188` / `#E6F7F3` (장식·배경 전용) |
| brand-strong / stronger (AA 텍스트·primary) | `#0E7A63` / `#0B6B57` |
| text 1·2·3 | `#2C3E50` / `#66727E` / `#9AA5B1` |
| surface | `#FFFFFF`, muted `#FAFBFC`, page `#F7F8FA` |
| border / divider | `#E6E9ED` / `#EEF1F4` |
| navy 사이드바 | 800 `#2A3F54`, 활성 900, 호버 700 |
| 컨트롤 높이 | sm 28 / md 34 / lg 40 |
| 간격 | `--Catui_space-1~10` = 4~64px (4px 배수) |
| 반경 | xs 4 / sm 6 / md 8 / lg 12 / pill 999 |
| 그림자 | xs·sm·md·lg (`rgba(16,24,40,.04~.12)`) |
| 타이포 | display 30 / h1 24 / h2 18 / h3 15 / body 13·1.55 / label 11 / caption 12 / metric 28·22 / micro 10 |
| 아이콘 | Line 01 stroke 1.5(원본 1.75를 통일), `Catui_i12/16/18/20` (기본 24) |
| 레이아웃 | sidebar 200 / rail 56 / topbar 56 / grid-gap 20 / content-pad 24 / grid 12열 |

## 4. 브레이크포인트와 z-index

- `1199px` 그리드 12→8열, span-8+ 전폭 / `991px` 그리드→4열, 사이드바→레일, 메가→2열 / `767px` 그리드→1열, 탑바 줄바꿈, 메가→1열
- z-index: skip 70 > toasts 60 > modal·drawer 50 > scrim 40 > topbar·site-header 30 > dd·splitbtn 20

## 5. HTML 규칙

- CSS 문서 예제(docs-src/css)는 JavaScript 없이 동작해야 한다. 모달/드로어 = `input.Catui_modal-toggle`(`.Catui_clip` 숨김) 체크박스 + `.Catui_scrim` label. Escape·포커스트랩은 선택 계층 `catui.js`가 같은 마크업에 자동으로 붙인다.
- `catui.js` 규칙: 소스는 `src/js/`(ESM, import는 한 줄, 새 파일은 `bundle.json`에 등록), 빌드가 파일을 이어 붙이므로 모듈 내부 도우미는 IIFE 안에 두거나 `catui` 접두사로 이름 충돌을 피한다. 선언형 속성은 `data-catui-*`만. JS가 만드는 `Catui_` 클래스도 CSS에 있어야 한다(빌드 검사). 오버레이는 `body > .Catui_layer`(리셋 스코프)에 붙인다. 사용자 문자열은 `html```로만 마크업이 되고 일반 문자열은 글자로 넣는다.
- 드롭다운·메가메뉴·트리 = `<details>/<summary>` + `summary::-webkit-details-marker{display:none}`.
- 모든 `<button>`에 `type`, 아이콘 svg에 `aria-hidden="true"`, 현재 메뉴에 `aria-current="page"`, `role="search"`/`role="img"`+`aria-label` 적절히.
- 아이콘: `<svg class="Catui_icon Catui_i16"><use href="icons.svg?v=2#Catui_ic-이름"></use></svg>`. `file://`는 스프라이트 안 나옴 → 정적 서버(`npm run dev`) 필수.
- 문서 조각에서 dist 경로는 `{{dist}}`, 문서 간 링크는 `href="doc:css/components/button"`으로 쓴다(빌드가 상대 경로로 바꿈).
- 파일 내 `id` 중복 금지, `label for`↔`id` 대응 필수 (빌드 검사).
- 숫자 컬럼·카운터는 `font-variant-numeric:tabular-nums` (`.Catui_num` 유틸 있음).
- **문서 페이지 패턴(1페이지 1주제)**: 조각에는 h1을 쓰지 않는다(빌드가 nav.json의 title·desc·rules로 머리를 만듦). 본문은 `<section>` + `<h2 id>`(목차·앵커용), 예제는 `<catui-example title>` 2~4개, 그 아래 사용법·옵션 표. nav.json 페이지의 `css: [소스 파일]`이 있으면 "클래스" 표를 자동 생성. 토큰 표 `<catui-tokens match>`, 아이콘 목록 `<catui-icons>`.
- 예제 안의 제목은 h2 이하로, 문서 전용 레이아웃 클래스는 `doc-` 접두사(`docs-src/assets/docs.css`, 라이브러리 밖).

## 6. 빌드 검증 (자동)

`npm run build` 실패 조건: index.json/bundle.json/nav.json에 없거나 빠진 소스·조각 / 문서·JS의 `Catui_` 클래스 미정의 / CSS에 정의됐지만 어떤 `<catui-example>`에도 안 쓰인 클래스(루트 스코프 제외) / 문서 링크·앵커 깨짐 / 파일 내 `id` 중복 / `label for` 불일치 / h1 개수·id 없는 h2 / 없는 아이콘 · 위험한 SVG(스크립트·이벤트·외부 참조) · viewBox≠24 / min ≥ css / `color-mix` 변질 / 번들에 남은 import·export.

## 7. 시각 품질 체크리스트 (GitHub Primer 기준)

Primer 접근성 가이드를 이 키트에 맞게 옮긴 것. 새 화면·컴포넌트는 아래를 통과해야 한다.

**대비 (WCAG AA: 본문 4.5:1, 큰 글자·UI 3:1)** — AA 보정 적용 후 실측치:

| 조합 | 대비 | 판정 |
|------|------|------|
| text-primary `#2C3E50`/흰색 | 10.98 | 통과 |
| navy-text `#DDE4EA`/`#2A3F54` | 8.44 | 통과 |
| neutral-700/neutral-100 (pill) | 6.45 | 통과 |
| 흰 글자/brand-strong `#0E7A63` (primary btn·count·선택일) | 5.27 | 통과 |
| 흰 글자/danger `#C0392B` | 5.44 | 통과 |
| badge success `#0E7A63`/`#E6F7F3` | 4.76 | 통과 |
| badge info `#1F6FA8`/`#EAF4FB` | 4.83 | 통과 |
| badge warn `#9A5B0F`/`#FEF7E0` | 5.05 | 통과 |
| badge danger `#C0392B`/`#FDECEA` | 4.76 | 통과 |
| text-secondary `#66727E`/흰색·page·muted | 4.6~4.9 | 통과 |
| navy-muted `#9FACBB`/`#2A3F54` | 4.69 | 통과 |
| 포커스 아웃라인 brand-strong/흰색 | 5.27 | 통과 (3:1 기준 충족) |
| text-tertiary `#9AA5B1`/흰색 | 2.50 | **미달** — placeholder·힌트·비활성 전용 |

- **AA 보정 계열**: 밝은 배경 위 텍스트·포커스는 `--Catui_color-brand-strong`(`#0E7A63`), 호버는 `--Catui_color-brand-stronger`(`#0B6B57`). 밝은 `color-brand`/`brand-hover`/`info`/`orange`/`danger`는 배경·장식·차트·아이콘 전용이며 텍스트 색으로 쓰지 않는다. 이 보정은 명세(design_m) 대비 Catui 구현차이 — 명세는 원본 유지.
- `text-tertiary`는 placeholder·힌트·비활성·장식 전용. 정보를 담는 라벨(지표 이름·요일·시간·메타·게이지 판정 등)은 `text-secondary`.
- **채움 vs 글자**: 흰 글자를 올리는 배경은 `--Catui_color-brand-fill`(다크에서도 유지), 글자·테두리·포커스는 `--Catui_color-brand-strong`(다크에서 밝아짐). 상태 글자색(`badge-*-fg`)을 배경으로 쓰면 다크에서 글자를 어둡게 뒤집는다.
- **다크 모드**: `<html data-catui-theme="dark">`. 값은 `foundation/theme-dark.css`에서 원본 색 토큰만 재정의(컴포넌트 토큰은 자동 반영). 새 하드코딩 색 금지.
- 한 줄 고정 높이 컨트롤(flex/grid + height 토큰)은 `line-height:1`. 상호작용 요소는 모두 `:focus-visible`(숨긴 input 구조는 `input:focus-visible + 대상`).
- 색만으로 의미 전달 금지(Primer): 상태는 아이콘+텍스트 병행 (pill의 `.Catui_dot` 패턴 준수).

**포커스**: 모든 상호작용 요소에 `:focus-visible` 아웃라인(`--Catui_color-focus-ring`, 2px, offset 2). 키보드로 도달 가능한 `label`/`summary`/`button` 구조 유지.

**터치 타겟**: WCAG 2.2 최소 24px — Catui 최소 컨트롤 28px로 충족. 클릭 영역을 시각 크기보다 작게 만들지 않는다.

**모션**: `prefers-reduced-motion` 시 transition·animation 전부 해제(베이스에 이미 존재). 새 애니메이션 추가 시 같은 가드 필수.

**타이포**: 본문 13px 고정(명세), 줄바꿈 `word-break:keep-all`, 숫자 tabular-nums. 한 화면 primary 버튼은 1개(문서 "CSS › 컴포넌트 › 버튼" 계약).

## 8. 미사용 토큰 정책

`tokens.css`는 명세 전량을 미러한다. 컴포넌트가 모두 토큰을 소비하며, 미소비로 남은 것은 `--Catui_color-purple-soft`(AA 안전 전경색 부재), `--Catui_upload-dash`(CSS dashed 테두리는 패턴 지정 불가) 두 개뿐 — **예비 공개 API이므로 삭제 금지.** 마크업이 있는 요소는 반드시 토큰을 참조하게 만든다.

## 9. 작업 절차

1. 새 아이콘: `src/icons/allow.json`에 이름 추가 → Line 01 파일명이 다르면 `map.json`에 대응, 없으면 `src/icons/svg/<이름>.svg`를 24×24 선 아이콘으로 직접 그림 → 빌드.
2. 새 CSS 컴포넌트: `src/css/<분류>/<이름>.css`(토큰만) → `src/css/index.json` 순서 추가 → `docs-src/css/<분류>/<이름>.html` 조각 → `docs-src/nav.json` 등록(`css` 항목) → 빌드.
3. 새 JS 모듈: `src/js/modules/<이름>.js`(component 빌더 우선) → `bundle.json` order·exports → `core/catui.js` 등록(필요 시 init 연결) → `index.js` export → `docs-src/js/modules/<이름>.html` + nav.json.
4. 명세에 없는 값 필요 시 `assets/spec/design_m.html`에 토큰 추가 → `tokens.css` 미러 → 컴포넌트에서 참조.
5. 시각 QA: `npm run dev` → `http://127.0.0.1:8766/docs/` → 해당 문서 페이지에서 빈값·최대폭·모바일(991/767px) 확인.

## 10. 자주 하는 실수

- `body`/`*` 선택자로 전역 오염 → `.Catui_app`/`.Catui_site` 스코프 유지.
- `color-mix`를 hex로 바꿈 → 토큰 참조 유지.
- `dist/`·`docs/`를 직접 수정 → 다음 빌드에 덮어써짐. 원본은 `src/`·`docs-src/`.
- 문서 조각에 dist 경로를 하드코딩 → `{{dist}}`, 문서 링크는 `doc:경로`.
- 체크/라디오를 `div`로 구현 → `input.Catui_clip` + `.Catui_cbx`/`.Catui_radio` 구조.
- 스크린리더용 텍스트에 `display:none` → `.Catui_clip` 유틸 사용.
- toast fixed 위치가 페이지 하단을 가림 → 데모는 `.Catui_toasts-demo`(static).
