# 변경 이력

이 프로젝트는 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다. 2.x 안에서는 공개 API(`Catui_` 클래스, `catui.*` 함수·옵션, `data-catui-*` 속성, `Catui_ic-*` 아이콘 id)를 깨뜨리지 않습니다.

## 2.1.0 — 미배포

### 추가: CatuiAdmin (관리자 대시보드 확장)
- `dist/admin.css`(+min) — 관리 셸 확장(접힘·서랍·고정 바닥글), 위젯·화면별 블록. 모든 규칙은 `.Catui_adm` 아래, 토큰만 사용
- `dist/catadmin.js`(+esm·min·map·d.ts) — `catui.admin`: shell · theme · notify · 명령 팔레트 · widgets(차트·카운트업·상대 시간) · form(변경 감지) · list(필터↔주소) · chat · kanban · auth
- 템플릿 52종(`docs/admin/templates/`): 대시보드 4 · 폼 6 · 표 2 · 차트 3 · 캘린더 · 지도 · 앱 5 · 커머스 6 · 프로젝트 2 · UI 7 · 관리 5 · 레이아웃 4 · 인증·오류 6
- 문서 상단 **CatuiAdmin** 탭, `exports`에 `./admin` · `./admin.css`
- 빌드 검사: 본체 클래스 재정의·hex 색·없는 토큰·템플릿 링크·id·label·h1·안 쓰인 클래스

## 2.0.0 — 2026-11-02

전면 개편판 (MIT). 패키지 이름 `@imcat-ckim/catui`. 1.x(2026-03 이전 배포)와 API가 달라 메이저 버전을 올렸습니다.

### CSS 키트
- 토큰 618개(`--Catui_*`), WCAG AA 대비 실측, 다크 모드(`data-catui-theme="dark"`), 모션 줄이기 대응
- 컴포넌트·폼·뷰·차트·웹 블록 100여 파일, 스크립트 없이 동작(모달·탭·드롭다운은 체크박스·radio·details)

### catui.js (의존성 없음)
- 코어: `use · config · extend · define · init · destroy`, 컴포넌트 빌더, `'이벤트(필터)'` 이벤트, 안전한 마크업(`html`·`raw`), 자동 정리(autoDestroy), CSRF, 경고 단계(debug)
- 모듈 21개: layer · form · table · laypage · tabs · dropdown · datePicker · upload · slider · rate · tree · collapse · canvas · fx · util · carousel · field · autocomplete · command · page · site
- 한글 IME(조합 중 Esc·Enter) 처리, 키보드·스크린리더 접근성

### 배포
- `catui.min.js`·`catui.esm.min.js`(+소스맵), `catui.d.ts`, `catui.min.css`, `icons.svg`
- 아이콘 1,265개: Line 01(CC0) + Catui 원본 — 저작권 표시 불필요
- `npm test`: 문서 전체 콘솔 오류 0건 + 모듈 시나리오 E2E
