# Catui

한국어 관리 화면·공개 홈을 위한 CSS 키트와, 의존성 없는 UI 프레임워크 **catui.js**.
자세한 사용법은 HTML 문서 사이트(`docs/`)에 있습니다 — `npm run dev` 후 http://127.0.0.1:8766/docs/

```html
<link rel="stylesheet" href="dist/catui.min.css">
<script src="dist/catui.js"></script>
<script>catui.use(['layer'], function (layer) { layer.msg('안녕하세요'); });</script>
```

## 폴더

| 경로 | 내용 |
|------|------|
| `src/css/` | CSS 소스 — `foundation · layout · components · forms · views · charts`, 컴포넌트당 1파일. 결합 순서는 `index.json` |
| `src/js/` | catui.js 소스(ESM) — `core/ · modules/ · index.js`. 번들 순서는 `bundle.json` |
| `src/icons/allow.json` | 스프라이트에 넣을 Lucide 아이콘 이름 |
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
```

## 기여 규칙 요약

- **CSS 컴포넌트 추가**: `src/css/<분류>/<이름>.css` 작성 → `src/css/index.json`에 순서 추가 → `docs-src/css/<분류>/<이름>.html` 조각 작성 → `docs-src/nav.json`에 페이지 등록(`css` 항목에 소스 파일을 적으면 클래스 표가 자동 생성).
- **JS 모듈 추가**: `src/js/modules/<이름>.js` → `src/js/bundle.json` 순서·exports → `core/catui.js` 등록 → `docs-src/js/modules/<이름>.html`.
- 문서 조각 문법: `<catui-example title="…">마크업</catui-example>`(미리보기+코드), `<catui-tokens match="^color-">`, `<catui-icons>`, `href="doc:경로"`, `{{dist}}`. h1은 빌드가 만들고, 본문 h2에는 id가 필요합니다.
- 빌드는 다음을 검사해 실패합니다: 목록에 없는 소스/조각, 정의 안 된 `Catui_` 클래스(문서·JS), **예제가 없는 CSS 클래스**(CSS에 정의된 클래스는 어느 문서의 `<catui-example>`에든 한 번 이상 쓰여야 함), 깨진 문서 링크·앵커, 중복 id, `label for` 불일치, 없는 아이콘, h1 개수.
- 공개 이름은 모두 `Catui_` 접두사, 색은 토큰만, 접근성 기준은 WCAG AA (문서 "CSS › 시작 › 접근성 기준").
