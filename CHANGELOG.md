# 변경 이력

이 프로젝트는 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다. 2.x 안에서는 공개 API(`Catui_` 클래스, `catui.*` 함수·옵션, `data-catui-*` 속성, `Catui_ic-*` 아이콘 id)를 깨뜨리지 않습니다.

## 2.1.0 — 미배포

### 바뀜: 시각 디자인 개편 (1px 잉크 테두리 · 미니멀 모서리 · 층에만 그림자·유리)
- 선 토큰 `--Catui_line`(14%) · `--Catui_line-strong`(24%) · `--Catui_line-soft`(8%) · `--Catui_line-control`(56%, 입력·체크·토글 3:1) — 글자색을 섞은 반투명 잉크(다크 12·22·8·42%). `--Catui_color-border`·`card-border`·`input-border`·`divider-color`·`tab-border` 등 공개 이름은 그대로 두고 값만 연결
- 모서리 xs 4→2 · sm 6→4 · md 8→6 · lg 12→8, `--Catui_radius-xl`(10) 추가. 모달·명령 팔레트 반경 lg→md
- 그림자 얕고 짧게, 다크는 위쪽 1px 밝은 inset. `--Catui_accent-w`(3px, 활성·인용·상태 막대) · `--Catui_ring`(2px 포커스) 추가, 입력 포커스 링 3→2px
- 유리 `components/glass.css`: 상단 바·공개 머리(::before 층)·드롭다운·메가 메뉴·토스트·아래 동작 줄·대화상자 덮개, 확장 고정 머리·아래 탭 줄. `@supports not`·`prefers-reduced-transparency`·`forced-colors` 폴백
- 빌드 검사(`scripts/lib.mjs` `visualErrors`): 2px 이상 테두리(허용 주석 없으면) · 토큰 아닌 `border-radius` · 폴백 없는 `backdrop-filter` — 본체·확장·문서 CSS 전부
- 문서 **기초 › 시각 원칙**(`css/foundation/visual`) 추가
- 고침: 쇼핑 순위·BEST 표식 다크에서 흰 글자/밝은 바탕 → 바탕색 글자

### 추가: CatuiAdmin (관리자 대시보드 확장)
- `dist/admin.css`(+min) — 관리 셸 확장(접힘·서랍·고정 바닥글), 위젯·화면별 블록. 모든 규칙은 `.Catui_adm` 아래, 토큰만 사용
- `dist/catadmin.js`(+esm·min·map·d.ts) — `catui.admin`: shell · theme · notify · 명령 팔레트 · widgets(차트·카운트업·상대 시간) · form(변경 감지) · list(필터↔주소) · chat · kanban · auth
- 템플릿 52종(`docs/admin/templates/`): 대시보드 4 · 폼 6 · 표 2 · 차트 3 · 캘린더 · 지도 · 앱 5 · 커머스 6 · 프로젝트 2 · UI 7 · 관리 5 · 레이아웃 4 · 인증·오류 6
- 문서 상단 **CatuiAdmin** 탭, `exports`에 `./admin` · `./admin.css`
- 빌드 검사: 본체 클래스 재정의·hex 색·없는 토큰·템플릿 링크·id·label·h1·안 쓰인 클래스

### 추가: CatuiCommunity (커뮤니티·게시판 확장)
- `dist/community.css`(+min) · `dist/catcommunity.js`(+esm·min·map·d.ts) — `catui.community`: 목록(주소 동기화) · 추천/비추천 · 댓글 트리 · 글쓰기(임시 저장·안전 미리보기) · 투표 · 핫딜 남은 시간 · JSON 바인딩
- 템플릿 23종(`docs/community/templates/`): 홈 · 인기 글 · 게시판 6종 · 글 보기 · 투표 · 글쓰기 · 검색 · 프로필 · 쪽지 · 알림 · 스크랩 · 설정 · 순위 · 이벤트 · 채팅방 · 로그인 · 가입 · 404
- JSON 모의 데이터 11종 — 인기글(추천 − 비추천 ≥ 게시판 기준)·레벨·합계·비율은 원자료에서 계산
- 모션: React Bits 에이전트 스킬(Emil Kowalski 기준)로 고른 곳에만, 모션 줄이기 존중
- 문서 상단 **CatuiCommunity** 탭, `exports`에 `./community` · `./community.css`

### 추가: CatuiShop (한국형 쇼핑몰 앞단 확장)
- `dist/shop.css`(+min) · `dist/catshop.js`(+esm·min·map·d.ts) — `catui.shop`: 가격(10원 단위 할인가·쿠폰가) · 장바구니(기억·선택·수량·배송비/무료 기준) · 옵션 조합 재고·품절(picker) · 찜 · 최근 본 상품 · 쿠폰 판정 · 적립금 · 주문서 최종 금액 · 선언형 속성(`data-catui-sh-*`)
- 템플릿 19종(`docs/shop/templates/`): 홈 · 상품 목록 · 검색 · 기획전 · 상품 상세 · 장바구니 · 주문서 · 주문 완료 · 마이페이지 · 주문 내역 · 배송 조회 · 찜 · 최근 본 상품 · 쿠폰·적립금 · 회원 정보 · 리뷰 쓰기 · 로그인 · 가입 · 404
- JSON 모의 데이터 8종 — 판매가·품절·별점 평균·베스트·적립금 잔액·주문 결제 금액은 원자료에서 계산
- 문서 상단 **CatuiShop** 탭, `exports`에 `./shop` · `./shop.css`, E2E 시나리오 4종(장바구니 합계 · 옵션 품절 · 주문서 금액 · 320px 넘침)

### 추가: CatuiDocs (문서·블로그 사이트 키트)
- `dist/docs.css`(+min) · `dist/catdocs.js`(+esm·min·map·d.ts) — `catui.docs`: 목차 자동 생성(h2/h3 → 링크, 스크롤 따라 `aria-current="location"`) · 제목 앵커 주소 복사 · 코드 블록 복사 버튼(`catui.util.copy`) · 문서 검색(인라인 색인 JSON 우선, 본체 command와 같은 한글 초성 규칙, 점수 순) · 읽는 시간(한글 분당 500자 + 단어 분당 200개, 올림, 코드 제외) · 피드백(예/아니오 기억) · 버전 선택(주소 이동) · 블로그 태그 필터·쪽 이동 ↔ 주소 · 안전한 마크다운 일부(이스케이프 후 굵게·코드·https 링크만) · 선언형 속성(`data-catui-dk-*`)
- 템플릿 12종(`docs/docskit/templates/`): 문서 홈 · 문서 쪽(왼쪽 메뉴·오른쪽 목차·이전/다음·편집 링크·마지막 수정일·피드백) · API 참조(시그니처·매개변수 표·반환·예제 탭) · 시작 가이드(단계·코드 복사) · 변경 이력(추가·변경·고침 배지) · 블로그 목록 · 블로그 글(머리 그림·저자·읽는 시간·목차·공유·관련 글·읽기 막대) · 태그 · 저자 · 검색 결과 · 버전별 문서 · 404
- JSON 모의 데이터 7종(nav · pages · posts · authors · tags · changelog · search-index) — 최신 순·읽는 시간·태그별 글 수·관련 글은 원자료에서 계산
- 소스·템플릿 폴더는 `src/docskit` · `templates/docskit`(저장소의 `docs/`는 문서 사이트 출력 폴더), 빌드 `scripts/build-docskit.mjs`
- 문서 상단 **CatuiDocs** 탭, `exports`에 `./docs` · `./docs.css`, E2E 시나리오 7종(목차·앵커·피드백 · 코드 복사 · 검색 · 읽는 시간·마크다운 · 태그 필터 · 버전 선택 · 320px 넘침)

### 추가: CatuiBooking (예약·일정 확장)
- `dist/booking.css`(+min) · `dist/catbooking.js`(+esm·min·map·d.ts) — `catui.booking`: 한국 시간(KST) 고정 날짜 계산(`<html data-catui-bk-now>`) · 시간 칸(영업시간·간격·이용 시간·휴게·휴무·지난 시간·이미 찬 예약) · 남은 자리·마감 임박 · 인원·옵션 금액(1인·1인 1박·1회) · 좌석 등급 금액·어린이 할인 · 숙박 박 수·기간 요금(금·토·공휴일 전날 할증, 추가 인원) · 남은 객실 · 좌석 배치도(ARIA grid 패턴, 화살표 키 roving tabindex, 최대 개수·붙은 좌석·테이블 인원 규칙) · 날짜 고르기 달력(표 + 단추) · 예약 저장·변경·취소(`catui.data`) · 취소 환불 규정(며칠 전 %, 10원 내림) · 대기 명단 순번 · 관리자 일정 블록 겹침 배치 · 선언형 속성(`data-catui-bk-*`)
- 템플릿 14종(`docs/booking/templates/`): 예약 홈(서비스·지점) · 날짜·시간 · 인원·옵션 · 좌석 배치도 · 객실(숙박) · 예약자 정보·요청사항·약관 · 예약 확인 · 예약 완료(예약 번호·QR 자리) · 내 예약(예정/지난/취소, 변경·취소 환불) · 예약 상세 · 관리자 일정표(일·주, 직원별 열) · 대기 명단 · 로그인 · 404
- JSON 모의 데이터 9종(services · branches · slots · seats · rooms · reservations · staff · schedule · waitlist) — 금액·남은 자리·남은 객실·순번·예약 상태는 원자료에서 계산
- 상태는 색만으로 알리지 않음: 시간 칸·날짜·좌석·일정 블록에 글자(“3자리 남음”·“마감”·“지난 시간”·“예약됨”·“장애인석”·“겹침”) + 아이콘·빗금·점선. 보기 전용 달력·일정표에는 `role="grid"`를 쓰지 않음(빌드가 검사)
- 문서 상단 **CatuiBooking** 탭, `exports`에 `./booking` · `./booking.css`, E2E 시나리오 6종(시간 칸 마감·지난 시간·달력 키보드 · 인원·옵션 금액 · 숙박 박 수·주말 요금 · 좌석 키보드 선택·최대 개수·붙은 좌석 · 환불 규정·취소·저장·일정 겹침 · 320px 넘침)

### 추가: CSS 키트
- **가로 내비게이션** `components/hnav.css` — `.Catui_hnav`(알약형) · `-line`(밑줄형) · `-dark`(어두운 바) · `-scroll`(한 줄 가로 스크롤) · `-item` · `-end`. 아이콘·카운트·드롭다운 하위 메뉴 지원
- 탭: `.Catui_tabs-full`(균등 분할) · `.Catui_tabs-scroll`(링크형 가로 스크롤) · `.Catui_tabs-card`(카드형), 탭 안 아이콘·카운트·점
- 버튼: `.Catui_btn-link`(링크형), `.Catui_btn[aria-busy="true"]`(처리 중)
- 배지: `.Catui_pill-outline` · 진행: `.Catui_prog-indeterminate` · `.Catui_prog-striped`
- 체크박스·라디오·토글 비활성 모양, 옵션 카드 checkbox 표시(둥근 네모+체크), 입력칸 오류 상태의 포커스 외곽선
- 문서: CSS 쪽마다 "자주 쓰는 종류" 예제 보충(타이포 단계표·읽기 막대·숨김 글자·그리드 열 수·셸 부품·로고 흐름·캐러셀 변형·선택형 드롭다운 등)

### 추가: catui.js
- `catui.config({ banner })` — 불러올 때 콘솔에 `Catui 한국어 화면을 위한 토큰 기반 UI 키트 · v버전 · MIT by Ckim` 한 줄(기본 켬, `debug: "silent"`면 끔)
- `catui.imeBusy(e)` 공개 — 한글 조합 중(확정 직후 150ms 포함) 키 판정. 확장·사용자 코드가 같은 기준을 씀
- `tabs.render({ vertical })`, `catui.mount()`가 Element·배열을 받음, `fx.names()`(효과 이름 목록)
- 모든 폼: 한글 조합을 끝내는 Enter로 암묵 제출되지 않음
- `<html data-catui-theme-lock>` — CatuiAdmin·CatuiCommunity가 테마를 덮어쓰지 않음(문서 사이트처럼 다른 쪽이 테마를 관리할 때)
- 문서: catui.js 19쪽·CatuiAdmin·CatuiCommunity에 "자주 쓰는 사용 예" 51개

### 고침
- 접근성: 닫힌 팝업을 가리키던 `aria-controls`(dropdown·datePicker·autocomplete), 속성값 안 `false`가 빠지던 `html```(예: `aria-pressed=""`), 역할 없는 span의 `aria-label` → 숨김 글자, 대비 미달(프로필 주 버튼·레벨 배지·3차 글자색 쓰던 구분선·완료 할 일·다른 달 날짜·선택 행 보조 글자·브랜드 바탕 흐린 글자), 정적 달력의 잘못된 `role="grid"`
- 좁은 화면(320·390px): `keep-all` 긴 줄 넘침(`overflow-wrap:break-word`), 스크롤 상자 안 숨김 글자가 문서를 넓히던 문제, 버튼 줄 줄바꿈, 게이지·청구서·커뮤니티 머리·사진 게시판
- 모듈: autocomplete(조합 중 ↑↓·사라진 후보 참조·비활성 건너뛰기), tree(비활성 이동·중복 id), upload(`*/*`·0바이트·해제 정리), laypage(소수 `curr`·같은 쪽 `jump`), slider·rate·tabs 경계값, util 소수 자리 RangeError, `page.flow` reset 뒤 늦은 응답, `layer.form` 이름 없는 체크 묶음, `url()` 해시 쿼리, `data('__proto__')`
- CatuiAdmin·Community: `init` 재호출 시 리스너 중복(테마 토글 상쇄·나가기 확인 두 번), `destroy` 뒤 늦은 응답 누수, 추천 연속 클릭 경쟁, 문서 쪽에서 다크 모드가 풀리던 문제
- 템플릿: 받은 편지함 마지막 메일 삭제·답장, 칸반 카드 추가, 설정 테마 값, 폼 검증 지우기, 매출 CSV·SSO 버튼 동작, 분석 기간 전환(7·30·90일 자료), 지도 선택, 사진 확대 버튼 포커스
- 개발 서버: 잘못된 `%` 인코딩으로 죽던 문제, 루트 밖 접근 검사 강화. 빌드: 타입 선언이 없으면 실패

### 변경
- `package.json`의 `main`과 `exports`의 `default`가 ESM(`catui.esm.js` 등)을 가리킵니다. 브라우저 전용 IIFE를 Node·구형 번들러가 받아 `document` 오류가 나던 문제를 막습니다. `<script>`·CDN은 `unpkg`·`jsdelivr` 필드(`catui.min.js`)로 그대로 IIFE를 받습니다.
- `fx.list()`(효과 이름 목록)를 `fx.names()`로 바꿨습니다 — `fx.list(ul)`은 차례 등장 효과입니다.
- `tabs.render`·`tree.render`가 WAI-ARIA 탭·트리 패턴으로 그립니다(CSS만 쓰는 마크업은 그대로).

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
