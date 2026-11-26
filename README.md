# LIVEBUS 홈페이지 type02

AI 버스정보 서비스 LIVEBUS(올포랜드 × LG유플러스)의 서비스 경험 페이지와 도입 문의 페이지.
Vite + 바닐라 JS. 3D 는 three.js r128(CDN 스크립트)을 쓰고, npm 런타임 의존성은 없다.

## 실행
```bash
npm install
npm run dev      # 개발 서버 → http://localhost:5173/26_AF_livebusHP_Type02/concept-b.html
npm run build    # dist/ (index.html, concept-b.html 두 페이지)
npm run preview  # 빌드 결과 확인
```

## 페이지 역할 (2026-11-26 정리)
| 주소 | 역할 | 파일 |
|---|---|---|
| `/concept-b.html` | **서비스 경험(3D)**: 첫 등장 → LIVEBUS → BMS → BIT → BIS → 도입 문의 제안 | `src/concept-b-journey/` ([설명](src/concept-b-journey/README.md)) |
| `/index.html` | **도입 문의**: 양식·입력 확인·전송 상태 | `src/contact/` |

흐름: 서비스 경험의 마지막 버튼 `도입 문의하기` → `index.html`(같은 탭). 문의 페이지의 `서비스 살펴보기` → `concept-b.html`.
페이지 사이 링크는 상대 주소(`./index.html`, `./concept-b.html`)라서 개발 서버와 배포 경로에서 똑같이 동작한다.

> 배포 주소의 첫 화면(`/`)은 `index.html`, 곧 **문의 페이지**다. 서비스 경험을 첫 화면으로 삼으려면 두 파일의 역할을 바꾸거나 루트에서 넘겨 주는 처리가 따로 필요하다.

## 도입 문의 — 실제 접수에 필요한 것
`src/contact/config.js` 가 비어 있는 동안에는 폼이 **입력 확인까지만** 한다. 내용을 어디로도 보내거나 저장하지 않고 '접수 완료'도 표시하지 않는다.
| 값 | 설명 |
|---|---|
| `endpoint` | 문의를 받을 서버 주소(https). POST · JSON. 2xx 만 접수 성공으로 본다. 다른 도메인이면 CORS 허용 필요 |
| `privacy` | 개인정보 수집·이용 동의 확정 문구(수집 항목, 목적, 보유·이용 기간, 거부 권리, 처리방침 주소). 넣으면 동의 영역과 필수 체크가 나타난다 |
| `headers`, `timeout` | 필요할 때만 |

- 두 값이 **모두** 있어야 전송한다. 수신 주소·보유기간 등은 확정된 것만 넣는다.
- GitHub Pages 는 정적 호스팅이라 폼을 받아 주는 서버가 없다. 접수 서버(또는 폼 접수 서비스)가 별도로 있어야 한다.
- 보내는 내용(`buildPayload()`): `requestId, organization, name, email, phone, service, message, consent, consentVersion, submittedAt, source`.
  입력값은 주소(URL)에 싣지 않는다. 실패하면 입력값을 그대로 두고 다시 보낼 수 있고, 보내는 동안·접수 뒤에는 다시 보내지지 않는다.

## 구조
```
index.html                     도입 문의 페이지
concept-b.html                 서비스 경험 페이지(3D)
src/contact/                   문의 페이지: config.js(연결 정보) · main.js(확인·전송·상태) · contact.css
src/concept-b-journey/         서비스 경험: main.js · bus.js · world.js · stop.js · journey.css · poster.jpg
src/assets/brand/              받은 로고(모양 그대로 사용)
vite.config.js                 배포 경로(base)와 빌드에 포함할 두 페이지
```

## 보존본 — 빌드에는 들어가지 않고 개발 서버에서만 열린다
| 주소 | 내용 |
|---|---|
| `/concept-a.html` | A안 홈페이지 "기다림에, 정보를 더하다."(이전 `index.html`). `src/main.js`, `src/style.css`, `src/data`, `src/lib`, `src/sections` 사용 |
| `/concept-b-v1.html` ~ `/concept-b-v3.html` | 버스 여정 1~3차(`src/concept-b-journey-v1 ~ v3/`) |
| `/concept-b-livefield.html` | B안 LIVE FIELD 입자 시안(`src/concept-b/`) |
| `/bus-preview.html` | 버스 모델 확인용 화면(모델만 돌려 보기, 이전 모델 전환). `/concept-b.html?bus=v1` 은 이전 버스 모델로 같은 장면을 보여 준다 |
| `_backup_2026-11-26_before-transfer/` | 전달 연출·첫 로드 로고·안내 문구 수정 직전의 `concept-b.html`, `stop.js`, `main.js`, `journey.css`, `bus.js`, README. `/concept-b.html?fx=v2` 는 이전 전달 연출을 보여 준다 |
| `_backup_2026-11-26_before-node/` | 정보 노드·스크롤 연동 전달·중앙 로고 수정 직전의 `concept-b.html`, `stop.js`, `world.js`, `main.js`, `journey.css`, README. 같은 이름의 파일에 덮어쓰면 그때의 화면으로 돌아간다 |
| `_backup_2026-11-26_before-city/` | 도시 배경·선·도트 개선 직전의 `world.js`, `stop.js`, `main.js`, `README.md`, `poster.jpg`. `/concept-b.html?city=v1` 은 이전 배경으로 같은 장면을 보여 준다 |
| `_backup_2026-11-26_before-bus-model/` | 버스 모델 개선 직전의 `bus.js`, `main.js`, `world.js`, `poster.jpg`, `README.md` |
| `_backup_2026-11-26_before-contact/` | 이번 전환 직전의 `index.html`, `concept-b.html`, `vite.config.js`, `README.md` 원본과 되돌리는 법 |
| `_legacy_figma/` | Figma 시안을 옮긴 최초 화면 |

`src/scenes`, `src/components`, `src/lib/motion.js`, `src/lib/scroll-scene.js`, `src/data/nav.js`, `src/data/services.js`, `src/image`, `src/assets/icons` 는
최초 화면의 파일이고 지금은 쓰지 않는다(삭제하지 않고 그대로 둠).

## 사실 정보와 예시 데이터
- 확인된 사실만 쓴다: 올포랜드 × LG유플러스, 완주군 운영(A안 보존본의 근거 링크 참고). 정확도·만족도 같은 수치는 넣지 않았다.
- 3D 속 BIT·스마트폰 화면은 시연용 예시다. 같은 버스(01번)와 같은 정류장을 쓰고 두 화면의 도착정보가 일치한다.
- 버스는 현재 모델이 최종 사용 모델이다(2026-11-26 확정, 한국형 저상 시내버스 참고 디자인). 설명은 `src/concept-b-journey/README.md` 의 '버스 모델'에 있다.

## GitHub 및 자동 배포
- 원격 저장소: https://github.com/ALL4UITeam/26_AF_livebusHP_Type02
- 기본 브랜치: `main`
- 최초 설정: 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택한다.
- `main` push와 PR에서 Node.js 22로 `npm ci`, `npm run build`를 실행한다.
- `main` push 시 빌드 성공 후 GitHub Pages에 자동 배포한다. PR은 빌드만 검사한다.
- Actions → Build and deploy Pages → Run workflow에서 `main`을 선택해 수동 배포할 수 있다.
- 배포 주소: https://all4uiteam.github.io/26_AF_livebusHP_Type02/
- 저장소 이름이나 배포 경로가 바뀌면 `vite.config.js`의 `base`도 수정한다.
