# AI LIVEBUS 포털 type02

Figma `pv4rR5p9lCR7fMs9wSYeU6`의 메인 화면 6개 프레임을 한 페이지 스크롤 연출로 구현했다.
기존 `2026_AF_livebusHP`와 같은 구성이다: Vite 하나, 바닐라 JS, 외부 런타임 라이브러리 없음, master → GitHub Pages.

## 화면 ↔ Figma

| Figma 노드 | 화면 상태 | 확인 위치(1920×1080) |
|---|---|---|
| 1:331 | 첫 화면: AI LIVE BUS + SCROLL, 버스 앞부분 | 맨 위 |
| 1:366 | 버스가 위로 지나간 뒤 AI LIVE / BUS / 소개 문구 | 첫 장면 progress 0.72 |
| 1:180 | 파란 배경 소개 문구, 아래에서 버스 등장 | 도로 장면 progress 0 |
| 1:187 | 도로 등장, 버스는 위쪽, 카드가 올라오기 시작 | 도로 장면 progress 0.26 |
| 1:230 | 검은 배경, 버스가 도로 가운데 | 도로 장면 progress 0.58 |
| 1:279 | 위쪽이 어두워지고 버스가 아래쪽으로 | 도로 장면 progress 0.90 |

여섯 개는 별도 페이지가 아니라 **스크롤에 따라 바뀌는 두 장면(첫 장면 · 도로 장면)의 키프레임**이다.
키프레임 사이 값은 `src/lib/motion.js`의 `track()`이 부드럽게(속도 끊김·출렁임 없이) 잇는다.

## 구조
```
index.html                    마크업(헤더 자리, 두 장면) + 첫 로드 대기 CSS
src/main.js                   시작점: 헤더·장면·첫 로드 등장·좁은 화면 등장 효과
src/style.css                 토큰(--u, --ease-*, --dur-*), 레이아웃, 상태, 반응형, reduced-motion
src/lib/motion.js             track(키프레임 보간), damp, reducedMotion
src/lib/scroll-scene.js       sticky 장면 progress 엔진(관성 감쇠, 멈추면 rAF 정지)
src/scenes/intro.js           1:331 → 1:366 키프레임
src/scenes/drive.js           1:180 → 1:187 → 1:230 → 1:279 키프레임, 카드 목록 상태, 키보드 포커스 이동
src/components/header.js      고정 헤더(내리면 숨김·올리면 표시, 장면 색에 맞춰 글자색)
src/components/service-card.js 썸네일 카드(로딩 스켈레톤·이미지 오류 대체)
src/components/toast.js       안내 토스트, 링크가 정해지지 않은 메뉴·카드 처리
src/data/nav.js               헤더 메뉴(링크 미정 → null)
src/data/services.js          서비스 카드 목업 + fetchServices() (API 연결 자리)
src/assets/icons/*.svg        Figma에서 받은 로고, SCROLL 화살표, 도로 선 3종
src/image/*                   Figma에서 렌더한 이미지(첫 화면 버스, 도로 버스, 썸네일 5장, webp)
```

## 조정값
- 시안 1px = `--u` = min(100vw/1920, 100vh/1080). 데스크톱(≥1200px)에서 시안 비율 그대로 화면에 맞춘다.
- 1200px 미만: 세로로 쌓는 레이아웃. 도로는 왼쪽 띠로, 버스는 목록을 내리는 동안 화면 가운데 머문다.
- 장면 길이: `.intro { height: 300vh }`, `.drive { height: 520vh }`
- 키프레임 위치: `intro.js`의 `T`, `drive.js`의 `K1/K2/K3`
- 관성: `scroll-scene.js`의 `TAU`(ms)

## 실행
```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/
```

## 글꼴
Termina Test, Freesentation은 기존 프로젝트처럼 PC에 설치된 글꼴을 쓴다(웹폰트 미포함).
DM Sans, Poppins는 Google Fonts에서 불러온다. 설치되지 않은 PC에서는 대체 글꼴로 보인다.

## 이미지(src/image)
Figma 노드를 2배로 렌더해 webp 로 넣었다(썸네일·도로 버스는 시안의 자르기가 그대로 반영됨).
- bus-hero.webp (2172×2896, 1:333 2배): 시안에서 이 버스가 한 프레임 안에 다 보이는 곳이 없어
  1:333(윗부분)·1:369(아랫부분)·1:240(가운데)를 이어 붙였다. 가운데 띠는 해상도가 조금 낮다.
- bus-road.webp (1:240, 3배), thumb-*.webp (1:202·1:209·1:309·1:222·1:278, 2배)
- 도로 질감(1:188 의 20% 이미지 채우기)은 내보내지 못해 빠져 있다. 받으면 .road 배경에 다시 넣으면 된다.
