/**
 * 사이트에서 쓰는 사실 정보.
 * 확인된 내용만 넣는다. 확인되지 않은 값은 null 로 두면 화면에서 그 자리가 안내 문구로 남는다.
 */

/**
 * 실제로 운영 중인 지역 서비스(헤더의 '버스 위치 확인' 목록).
 * 공식 주소가 확인된 지역만 추가한다.
 */
export const REGIONS = [
  { id: 'wanju', name: '완주군', host: 'wanju.livebus.ai', url: 'https://wanju.livebus.ai/' },
];

/**
 * 도입 상담 창구.
 * 기존 프로젝트 자료에서 확인된 연락처가 없어 비워 두었다.
 * email 을 넣으면 '메일로 보내기' 버튼이 생기고, phone 을 넣으면 전화번호가 표시된다.
 */
export const CONTACT = {
  email: null, // 예: 'name@example.com'
  phone: null, // 예: '02-000-0000'
};
