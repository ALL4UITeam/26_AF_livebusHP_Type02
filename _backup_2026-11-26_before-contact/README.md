# 2026-11-26 보존본 — 문의 페이지 전환 직전 상태

`index.html` 을 도입 문의 페이지로 바꾸고 `concept-b.html` 을 4차로 고치기 직전의 파일을 그대로 복사해 둔 것이다.

| 파일 | 원래 자리 | 내용 |
|---|---|---|
| `index.html` | `/index.html` | A안 홈페이지 "기다림에, 정보를 더하다." |
| `concept-b.html` | `/concept-b.html` | B안 버스 여정 3차(LIVEBUS → BMS → BIT → BIS → 마무리) |
| `vite.config.js` | `/vite.config.js` | 한 페이지만 빌드하던 설정 |
| `README.project.md` | `/README.md` | A안 기준 설명서(배포 설정 설명 포함) |

## 되돌리는 법
- **A안 홈페이지**: 이 폴더의 `index.html` 을 프로젝트 맨 위에 복사한다. `src/main.js`, `src/style.css`, `src/data`, `src/lib`, `src/sections`, `src/assets` 는 손대지 않았으므로 그대로 동작한다.
  복사하지 않고 보기만 하려면 `/concept-a.html`(같은 내용, 제목만 다름)을 연다.
- **3D 시안 3차**: `/concept-b-v3.html` + `/src/concept-b-journey-v3/` 가 실행 가능한 보존본이다.
  제자리로 되돌리려면 이 폴더의 `concept-b.html` 을 맨 위에 복사하고 `src/concept-b-journey-v3/` 의 파일을 `src/concept-b-journey/` 에 복사한다.
- **빌드 설정**: 이 폴더의 `vite.config.js` 를 맨 위에 복사한다.
