# 라이브버스 홈페이지 type02 — "기다림에, 정보를 더하다."

라이브버스의 브랜드·서비스 홈페이지. 지자체 교통 담당자와 운영기관이 서비스를 이해하고 도입을 문의하도록 안내하고,
시민에게는 지역별 실제 서비스로 가는 길을 따로 둔다.

Vite + 바닐라 JS. 런타임 라이브러리 없음. 지도는 지도 API 없이 SVG 로 직접 그린 개념도다.

## 실행
```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/
```

## 화면 구성
| 구간 | id | 내용 |
|---|---|---|
| 첫 화면 | `#top` | 지도 위 제목, 정류장을 고르면 강조 구간과 도착 정보가 바뀌는 체험 |
| 01 서비스 소개 | `#service` | 하나의 노선을 시민(A)·기술(B)·운영(C) 세 시점으로. 넓은 화면은 지도가 머물고 시점만 이동, 좁은 화면은 장면별 그림 |
| 02 이용 경험 | `#experience` | 휴대폰 화면 하나에서 정류장 찾기 → 버스 선택 → 위치·도착 확인 |
| 03 기술과 운영 | `#platform` | 초정밀 위치정보 · AI 도착 정보 · 운영 관리를 정류장 세 개짜리 노선도로 |
| 04 도입 사례 | `#case` | 완주군 |
| 05 도입 문의 | `#inquiry` | 상담 전 질문 네 가지 → 상담 메모(복사만, 전송 없음) |
| 마지막 행동 | – | 도입 상담하기 · 운영 중인 서비스 보기 |

## 구조
```
index.html                    마크업과 모든 문구(스크립트 없이도 읽힌다)
src/main.js                   시작점, 처음 보일 때 떠오르는 효과
src/style.css                 색·글자·레이아웃·반응형·동작 줄이기
src/data/site.js              ★ 사실 정보: 운영 지역(REGIONS), 상담 연락처(CONTACT)
src/data/route.js             체험용 노선(예시): 정류장·도로 좌표, 도착 정보 계산
src/lib/map.js                SVG 지도 그리기, 시점 이동
src/sections/header.js        헤더, '버스 위치 확인' 지역 목록, 모바일 메뉴
src/sections/hero.js          첫 화면 체험
src/sections/journey.js       세 가지 시점
src/sections/experience.js    휴대폰 체험
src/sections/inquiry.js       상담 메모
src/assets/brand/             받은 로고 2종(모양 그대로, 색만 CSS 로 입힘)
```

## 사실 정보 — 바꿀 때 볼 곳
- **상담 연락처**: 기존 자료에서 확인된 주소·전화·메일이 없어 비워 두었다.
  `src/data/site.js` 의 `CONTACT` 에 값을 넣으면 '메일로 보내기' 버튼과 연락처가 나타난다.
- **운영 지역**: 확인된 곳은 완주군뿐이다. 지역이 늘면 `REGIONS` 에 추가(헤더 목록에 반영)하고,
  사례 구간은 `index.html` 의 `#case` 를 고친다.
- **근거**: LG유플러스 공식 발표, wanju.livebus.ai, 완주군시설관리공단 공지(2026-02-02). 링크는 바닥글에 있다.
- 넣지 않은 것: 정확도·만족도·이용자 수 같은 수치, 구독형 상품, 태양광·전자종이 단말, 예매·결제·호출·채팅.
  현재 제공이 확인되면 그때 추가한다.

## 예시 데이터 원칙
- 지도는 실제 지역이 아닌 개념도이고, 정류장 이름도 일반 명칭이다.
- 도착 정보는 화면 속 버스 위치로 계산한 예시다. '실시간'이라고 쓰지 않고 '서비스 체험 · 예시 데이터'를 붙였다.
- QR 그림은 모서리 표식만 그려 스캔되지 않는다.
- 문의 폼은 내용을 보내거나 저장하지 않는다. '접수 완료' 문구도 없다.

## 조정값
- 색: `src/style.css` 맨 위 `:root`. 노선 파랑 `--blue #0b50e6`, 상태색 `--amber`.
  기존 화면의 하늘색 `#1eb1fa` 는 `--sky` 로 남겨 어두운 '기술의 시점'에서 위치 신호에 쓴다.
- 첫 화면(1200px 이상): 높이 `--stage-h = min(100svh, 56.25vw)`, 크기는 `--u`(= 높이/900) 기준.
- 버스 속도: `hero.js` 의 `TRIP_SECONDS`. 예시 소요 시간: `route.js` 의 `TRIP_MINUTES`.
- 장면별 시점: `journey.js` 의 `cameras`.
- 글꼴: Pretendard(jsDelivr CDN). 불러오지 못하면 시스템 한글 글꼴로 보인다.

## 접근성
건너뛰기 링크, 키보드로 모든 조작 가능(정류장 선택은 패널 버튼, 단계는 탭·방향키), 포커스 표시,
버스 움직임 멈춤 버튼, `prefers-reduced-motion` 에서는 움직임 없이 같은 정보 제공.

## 이전 작업
Figma 시안을 옮긴 이전 화면의 `index.html`·`src/main.js`·`src/style.css`·`README.md` 는 `_legacy_figma/` 에 있다.
`src/scenes`, `src/components`, `src/lib/motion.js`, `src/lib/scroll-scene.js`, `src/data/nav.js`, `src/data/services.js`,
`src/image`, `src/assets/icons` 는 이전 화면의 파일이고 지금 화면에서는 쓰지 않는다(빌드에 포함되지 않음).
되돌리려면 `_legacy_figma/` 의 네 파일을 제자리에 복사하면 된다.

## GitHub 및 자동 빌드
- 원격 저장소: https://github.com/ALL4UITeam/26_AF_livebusHP_Type02
- 기본 브랜치: `main`
- `main` push와 PR에서 GitHub Actions가 Node.js 22로 `npm ci`, `npm run build`를 실행한다.
- GitHub의 Actions → Build → Run workflow에서 수동 실행할 수 있다.
- 성공한 실행의 `dist` 아티팩트에서 빌드 결과를 내려받을 수 있다(14일 보관).
- 이 워크플로는 빌드 검증용이며 웹사이트 배포는 별도로 설정한다.
