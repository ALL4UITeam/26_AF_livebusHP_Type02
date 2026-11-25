import { CONTACT } from '../data/site.js';

const EMPTY = '질문에 답하면 상담 메모가 여기에 정리됩니다.';

/**
 * 도입 문의: 네 가지 질문의 답을 상담 메모로 정리한다.
 * 이 페이지는 내용을 서버로 보내지 않는다. 복사하거나(연락처가 등록돼 있으면) 메일 앱으로 넘길 뿐이다.
 */
export function initInquiry() {
  const form = document.querySelector('#ask-form');
  const out = document.querySelector('#memo-text');
  const status = document.querySelector('#memo-status');
  const actions = document.querySelector('#memo-actions');
  const copyBtn = document.querySelector('#memo-copy');
  const contact = document.querySelector('#memo-contact');

  const memo = () => {
    const data = new FormData(form);
    const area = data.get('area')?.trim();
    const fleet = data.get('fleet')?.trim();
    const bis = data.get('bis');
    const scope = data.getAll('scope');
    if (!area && !fleet && !bis && !scope.length) return '';
    const v = (x) => x || '(미정)';
    return [
      '[라이브버스 도입 상담 메모]',
      `1. 운영 지역·대상 노선: ${v(area)}`,
      `2. 차량 규모: ${v(fleet)}`,
      `3. 기존 버스정보시스템: ${v(bis)}`,
      `4. 필요한 범위: ${v(scope.join(', '))}`,
    ].join('\n');
  };

  let mailLink = null;
  const paint = () => {
    const text = memo();
    out.textContent = text || EMPTY;
    status.textContent = '';
    if (mailLink) mailLink.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent('라이브버스 도입 상담 문의')}&body=${encodeURIComponent(text)}`;
  };
  form.addEventListener('input', paint);
  form.addEventListener('submit', (e) => e.preventDefault());

  copyBtn.addEventListener('click', async () => {
    const text = memo();
    if (!text) { status.textContent = '질문에 하나 이상 답하면 메모를 복사할 수 있습니다.'; return; }
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = '메모를 복사했습니다. 상담 요청 시 붙여 넣어 주세요.';
    } catch {
      /* 복사 권한이 없으면 직접 선택할 수 있게 한다 */
      const range = document.createRange();
      range.selectNodeContents(out);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      status.textContent = '메모를 선택했습니다. 복사(Ctrl+C)해 주세요.';
    }
  });

  /* 확인된 상담 창구가 등록돼 있을 때만 연락 수단을 보여 준다 */
  if (CONTACT.email) {
    mailLink = document.createElement('a');
    mailLink.className = 'btn btn--line';
    mailLink.textContent = '메일로 보내기';
    actions.appendChild(mailLink);
  }
  if (CONTACT.email || CONTACT.phone) {
    const parts = [];
    if (CONTACT.phone) parts.push(`전화 <a href="tel:${CONTACT.phone.replace(/[^0-9+]/g, '')}">${CONTACT.phone}</a>`);
    if (CONTACT.email) parts.push(`메일 <a href="mailto:${CONTACT.email}">${CONTACT.email}</a>`);
    contact.innerHTML = `도입 상담 창구 · ${parts.join(' · ')}`;
  }
  paint();

  /* '도입 상담하기'로 내려오면 첫 질문에 바로 입력할 수 있게 한다 */
  document.querySelectorAll('a[href="#inquiry"]').forEach((a) => {
    a.addEventListener('click', () => {
      setTimeout(() => form.querySelector('input')?.focus({ preventScroll: true }), 700);
    });
  });
}
