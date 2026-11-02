# 보안 정책

## 취약점 신고

공개 이슈에 올리지 말고 **imcat@imcat.dev**로 보내 주세요. 재현 방법, 영향 범위, 사용 버전을 적어 주시면 7일 안에 답장하고, 확인된 문제는 수정 버전과 함께 공지합니다.

## 지원 버전

| 버전 | 보안 수정 |
|------|-----------|
| 2.x  | 지원 |
| 1.x  | 지원 종료 (2.x로 올려 주세요) |

## 설계상 보안 원칙

- 문자열은 항상 글자(textContent)로 넣습니다. 마크업은 `catui.html```·`catui.raw()`로 만든 값만 들어가며, 서버 JSON의 `{ "__raw": … }` 같은 위조 객체는 escape됩니다.
- `eval`·`new Function`을 쓰지 않습니다. 인라인 스크립트를 만들지 않아 `script-src 'self'` CSP와 함께 쓸 수 있습니다.
- iframe·메뉴 링크·명령 팔레트 주소는 http·https·상대 경로(메뉴는 mailto·tel 포함)만 허용합니다.
- CSRF 토큰은 같은 출처의 쓰기 요청에만 붙입니다. CSV 내보내기는 수식 실행(CSV 인젝션)을 막습니다.
- 아이콘 빌드는 스크립트·이벤트 속성·외부 참조가 든 SVG를 거부합니다.

## 권장 CSP 예

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'
```

`style-src 'unsafe-inline'`은 컴포넌트가 위치·크기를 `style` 속성으로 정하기 때문에 필요합니다.
