/**
 * 서비스 썸네일 목업 데이터 (Figma 1:187 · 1:230 · 1:279)
 * ─ 실제 API가 생기면 이 배열 대신 응답을 넣으면 된다. 형식은 아래와 동일하게 유지.
 * ─ 문구는 Figma 시안의 자리표시 문구 그대로다(확정 문구 아님).
 * ─ href: 상세 페이지가 정해지지 않아 null. null이면 클릭 시 '준비 중' 안내만 띄운다.
 *
 * column  : 'left' | 'right'  (도로 기준 좌/우 열)
 * index   : 열 안에서의 순서 (0부터, 카드 간격 390px)
 * imgWidth: 시안의 이미지 폭(340 또는 350)
 * image   : Figma 썸네일 프레임을 2배로 내보낸 이미지(시안의 자르기 그대로)
 */
import thumbMaintenance from '../image/thumb-maintenance.webp';
import thumbBisStreet from '../image/thumb-bis-street.webp';
import thumbControl from '../image/thumb-control.webp';
import thumbStopPeople from '../image/thumb-stop-people.webp';
import thumbStopEpaper from '../image/thumb-stop-epaper.webp';

export const services = [
  {
    id: 'ebit-maintenance',
    column: 'left', index: 0,
    badge: 'eBIT',
    title: ['데이터 기반', '선제적 유지보수'],
    desc: '초정밀·친환경 AI 버스정보 솔루션',
    image: thumbMaintenance, imgWidth: 350,
    alt: '정류장 안내기를 태블릿으로 점검하는 작업자',
    href: null,
  },
  {
    id: 'ebit-stop',
    column: 'right', index: 0,
    badge: 'eBIT',
    title: ['초정밀·친환경 AI 버스정보', '초정밀·친환경 AI 버스정보'],
    desc: '초정밀·친환경 AI 버스정보 솔루션',
    image: thumbStopPeople, imgWidth: 340,
    alt: '정류장 안내기를 함께 보는 시민들',
    href: null,
  },
  {
    id: 'bis-street',
    column: 'left', index: 1,
    badge: 'BIS',
    title: ['초정밀·친환경 AI 버스정보', '초정밀·친환경 AI 버스정보'],
    desc: '초정밀·친환경 AI 버스정보 솔루션',
    image: thumbBisStreet, imgWidth: 340,
    alt: '도심 정류장에 정차하는 버스',
    href: null,
  },
  {
    id: 'bis-epaper',
    column: 'right', index: 1,
    badge: 'BIS',
    title: ['초정밀·친환경 AI 버스정보', '초정밀·친환경 AI 버스정보'],
    desc: '초정밀·친환경 AI 버스정보 솔루션',
    image: thumbStopEpaper, imgWidth: 350,
    alt: '가로수길 정류장의 ePaper 안내기',
    href: null,
  },
  {
    id: 'bis-control',
    column: 'left', index: 2,
    badge: 'BIS',
    title: ['초정밀·친환경 AI 버스정보', '초정밀·친환경 AI 버스정보'],
    desc: '초정밀·친환경 AI 버스정보 솔루션',
    image: thumbControl, imgWidth: 350,
    alt: '관제 화면으로 버스 운행을 모니터링하는 담당자',
    href: null,
  },
];

/** 실제 API로 교체할 자리. 지금은 목업을 비동기로 돌려준다(로딩·오류 상태 확인용). */
export async function fetchServices() {
  return services;
}
