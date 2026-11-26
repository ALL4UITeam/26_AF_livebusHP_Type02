# LIVEBUS B안 — 한 대의 버스와 함께 이어지는 여정

"버스의 움직임을, 모두의 정보로." 같은 버스 한 대를 중심으로 카메라와 공간이 이어지는 3D 스크롤 경험.
기존 홈페이지(`index.html`)와 Live Field 시안(`concept-b-livefield.html`, `src/concept-b/`)과는 파일을 공유하지 않는다.

## 보기
`npm run dev` 후 `/concept-b.html`. three.js r128 을 cdnjs 에서 불러온다(패키지 설치 없음). `vite build` 대상에는 넣지 않았다.

## 지금 구현된 범위(1차)
- 장면 1 LIVEBUS: 전면 ¾ 구도, 차체를 훑는 얇은 빛, 포인터에 따른 미세한 시점 변화, 차체 가까이에서만 번지는 얇은 고리.
- 장면 2 출발과 BMS: 측면으로 이동 → 도로 등장 → 출발 → 뒤쪽 상공. 도시, 운행 연결망, 다른 버스, 주인공 버스의 위치 신호.
- 스크롤 진행률 하나가 버스 위치·바퀴 회전·카메라·환경·문구를 정한다. 바퀴 회전각 = 이동 거리 ÷ 바퀴 반지름.
- 아직 없는 것: 장면 3 BIT(정류장·안내기), 장면 4 BIS(스마트폰), 장면 5 마무리와 CTA.

## 임시인 것
- **버스 모델**: `bus.js` 가 코드로 만든 임시 모델이다(카메라·동작 검증용, 화면에도 표시).
  최종 GLB 를 받으면 `buildBus()` 가 돌려주는 `{ group, wheels, edges }` 형태에 맞춰 GLTFLoader 로 바꾼다.
  조건: 저상 시내버스 1대, glTF 2.0, 실제 비례(약 11m), 바퀴 4개가 분리된 노드(축 중심 = 바퀴 중심),
  차체·유리·타이어·휠·램프 재질 분리, 10만 삼각형·10MB 이하 권장, 상업적 사용 가능 라이선스.
- 도시와 다른 버스는 어두운 상자 형태의 배경이다.
- 행선지 표시의 "01 LIVEBUS" 는 시연용 문구다.

## 파일
```
concept-b.html                       마크업, 문구, 로고 SVG, 글꼴·three.js 불러오기
src/concept-b-journey/journey.css    글자, 문구 등장·퇴장, 커서, 로딩, 대체 화면
src/concept-b-journey/main.js        스크롤 진행률, 카메라 구도(KEYS), 이동 거리, 입력, 문구
src/concept-b-journey/bus.js         임시 버스 모델(차체·유리·문·미러·전조등·독립 바퀴)
src/concept-b-journey/world.js       반사 환경, 조명, 접지 그림자, 도로, 도시, 연결망, 신호
src/concept-b-journey/poster.jpg     WebGL 을 쓸 수 없을 때의 대표 이미지
```

## 글꼴
- 영문 제목 Termina Bold(Adobe Fonts `pjc5yrp`), 본문 Freesentation(jsDelivr). 불러오지 못하면 Lexend Exa · Noto Sans KR 로 보이고, 화면 오른쪽 아래에 "대체 서체 표시 중"이 뜬다.
- Claude 아티팩트는 두 글꼴의 주소를 막기 때문에 항상 대체 서체로 보인다.

## 조정값
- 카메라: `main.js` 의 `KEYS`(진행률 p, 방위각 az, 거리 r, 높이 h, 바라보는 점 look, 화각 fov, 화면 이동 shift)
- 주행: `distanceAt()`  /  문구가 보이는 구간: `concept-b.html` 의 `data-from`, `data-to`
- 스크롤 길이: `journey.css` 의 `.scroll-space`
- 재질: `bus.js` 의 `M`  /  반사 조명판: `world.js` 의 `buildEnvironment()`
- r128 은 색을 선형값으로 다룬다. 어두운 색은 생각보다 밝게 나오므로 낮게 잡는다.

## 접근성·성능
- 동작 줄이기: 카메라 이동 없이 두 구도(첫 화면, BMS)를 짧은 페이드로 바꾼다. 포인터 반응은 끈다.
- 터치 환경에서는 사용자 커서를 표시하지 않는다.
- 프레임이 계속 느리면 해상도 배율을 낮춘다. 좁은 화면은 신호 입자와 다른 버스 수를 줄인다.
