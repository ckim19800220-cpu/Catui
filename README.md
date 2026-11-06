# Catui

한국어 관리 화면·공개 홈을 위한 CSS 키트와, 의존성 없는 UI 프레임워크 **catui.js**.
자세한 사용법은 HTML 문서 사이트(`docs/`)에 있습니다 — `npm run dev` 후 http://127.0.0.1:8766/docs/

```html
<link rel="stylesheet" href="dist/catui.min.css">
<script src="dist/catui.min.js"></script>
<script>catui.use(['layer'], function (layer) { layer.msg('안녕하세요'); });</script>
```

불러오면 콘솔에 `Catui 한국어 화면을 위한 토큰 기반 UI 키트 · v2.0.0 · MIT by Ckim` 한 줄이 나옵니다. 끄려면 스크립트 바로 뒤에 `catui.config({ banner: false })`.

```js
// ES 모듈 + TypeScript (dist/catui.d.ts 자동 인식) — package.json의 main·default도 ESM
// npm install @imcat-ckim/catui
import catui, { layer, carousel } from "@imcat-ckim/catui";
import "@imcat-ckim/catui/css";
```

## 배포 파일 (`dist/`)

| 파일 | 용도 |
|------|------|
| `catui.min.js` (+ `.map`) | 전역 `window.catui`, 압축본 (gzip 약 62KB) |
| `catui.esm.min.js` (+ `.map`) | ES 모듈 압축본 |
| `catui.js` · `catui.esm.js` | 압축 전 (디버깅용) |
| `catui.min.css` · `catui.css` | 스타일 (gzip 약 31KB) |
| `icons.svg` | 아이콘 스프라이트 (`catui.js`와 같은 폴더에 둔다) |
| `catui.d.ts` | TypeScript 타입 |

지원 브라우저: Chrome·Edge 111+, Safari 16.4+, Firefox 121+ (`:has` · `color-mix` · `inert` 사용).

## 아이콘 (저작권 표시 불필요)

- `src/icons/line01/` — [Line 01](https://iconsforfree.com) 1,178개 원본, CC0 1.0 (Andreas Dittes). `node scripts/fetch-line01.mjs`로 다시 받기
- `src/icons/svg/` — Line 01에 없는 Catui 원본(직접 그림)
- `src/icons/allow.json` — 스프라이트에 넣을 이름, `src/icons/map.json` — 이름이 다를 때 Line 01 파일 대응

`allow.json`에는 Line 01 전체가 들어 있어 아무 이름이나 바로 씁니다(`Catui_ic-이름`). 빌드 출력 `icons 1265(line01 1255 · own 10 · lucide 0)`, `icons.svg` gzip 약 42KB. 제3자 고지 파일이 필요 없습니다.

## 폴더

| 경로 | 내용 |
|------|------|
| `src/css/` | CSS 소스 — `foundation · layout · components · forms · views · charts`, 컴포넌트당 1파일. 결합 순서는 `index.json` |
| `src/js/` | catui.js 소스(ESM) — `core/ · modules/ · index.js`. 번들 순서는 `bundle.json` |
| `src/icons/` | 아이콘 — `allow.json`(이름) · `map.json`(대응) · `line01/`(CC0 원본) · `svg/`(Catui 원본) |
| `dist/` | 빌드 결과 — `catui.css · catui.min.css · catui.js · catui.esm.js · icons.svg` (직접 고치지 않음) |
| `docs-src/` | 문서 원본 — `nav.json`(분류·순서) · `layout.html` · `css/**` · `js/**` 조각 · `assets/` |
| `docs/` | 빌드된 문서 사이트 (직접 고치지 않음) |
| `scripts/` | `build.mjs`(진입) · `build-css/js/icons/docs.mjs` · `serve.mjs` |
| `assets/spec/design_m.html` | 디자인 견본 명세(토큰 원본) |

## 명령

```bash
npm install
npm run build       # CSS → 아이콘 → JS → 문서 (검사 포함)
npm run build:css   # CSS·아이콘만
npm run dev         # 정적 서버 :8766
npm test            # E2E: 문서·템플릿 전체 콘솔 오류 0건 + 모듈 시나리오 (시스템 Chrome/Edge 사용, CATUI_CHROME으로 경로 지정)
npm test -- 이름     # 이름에 그 글자가 들어간 시나리오만
npm run check       # 빌드 + 테스트
```

## CatuiAdmin (관리자 대시보드)

catui 위에 얹는 관리자 확장입니다. 본체 다음에 불러옵니다.

```html
<link rel="stylesheet" href="dist/catui.min.css"><link rel="stylesheet" href="dist/admin.min.css">
<script src="dist/catui.min.js"></script><script src="dist/catadmin.min.js"></script>
```

- 소스: `src/admin/`(css·js), 템플릿: `templates/admin/`(menu.json · layout · pages 52종) → `docs/admin/templates/`
- 문서: 상단 **CatuiAdmin** 탭 (`docs/admin/start/introduction.html`)

## CatuiCommunity (커뮤니티·게시판)

catui 위에 얹는 커뮤니티 확장입니다. CatuiAdmin과 같은 방식으로 불러옵니다.

```html
<link rel="stylesheet" href="dist/catui.min.css"><link rel="stylesheet" href="dist/community.min.css">
<script src="dist/catui.min.js"></script><script src="dist/catcommunity.min.js"></script>
```

- 소스: `src/community/`, 템플릿: `templates/community/`(menu.json · layout · data · pages 23종) → `docs/community/templates/`

두 확장은 자기 테마(라이트·다크·시스템)를 기억해 적용합니다. 다른 쪽이 테마를 관리하는 화면(예: 문서 사이트)에서는 `<html data-catui-theme-lock>`으로 덮어쓰기를 막습니다.
- 문서: 상단 **CatuiCommunity** 탭 (`docs/community/start/introduction.html`)

## 라이선스

[MIT](LICENSE) © 2026 imcatDevs — 상업적 사용·수정·재배포 자유, 저작권 고지(LICENSE 또는 배포 파일 머리 주석)만 유지하면 됩니다. 아이콘은 Line 01(CC0) + Catui 원본으로 별도 고지가 필요 없습니다. 보안 신고: [SECURITY.md](SECURITY.md) · 변경 이력: [CHANGELOG.md](CHANGELOG.md)

## 기여 규칙 요약

- **CSS 컴포넌트 추가**: `src/css/<분류>/<이름>.css` 작성 → `src/css/index.json`에 순서 추가 → `docs-src/css/<분류>/<이름>.html` 조각 작성 → `docs-src/nav.json`에 페이지 등록(`css` 항목에 소스 파일을 적으면 클래스 표가 자동 생성).
- **JS 모듈 추가**: `src/js/modules/<이름>.js` → `src/js/bundle.json` 순서·exports → `core/catui.js` 등록 → `docs-src/js/modules/<이름>.html`.
- 문서 조각 문법: `<catui-example title="…">마크업</catui-example>`(미리보기+코드), `<catui-tokens match="^color-">`, `<catui-icons>`, `href="doc:경로"`, `{{dist}}`. h1은 빌드가 만들고, 본문 h2에는 id가 필요합니다.
- 빌드는 다음을 검사해 실패합니다: 목록에 없는 소스/조각, 정의 안 된 `Catui_` 클래스(문서·JS), **예제가 없는 CSS 클래스**(CSS에 정의된 클래스는 어느 문서의 `<catui-example>`에든 한 번 이상 쓰여야 함), 깨진 문서 링크·앵커, 중복 id, `label for` 불일치, 없는 아이콘, h1 개수.
- 공개 이름은 모두 `Catui_` 접두사, 색은 토큰만, 접근성 기준은 WCAG AA (문서 "CSS › 시작 › 접근성 기준").
