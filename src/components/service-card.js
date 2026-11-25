/**
 * 서비스 썸네일 카드 (Figma thumbnail: img 340|350×240 r16 + txt 250)
 * 이미지 로딩 중에는 은은한 스켈레톤, 실패하면 대체 표시를 보여 준다.
 */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function serviceCard(item, order) {
  const linkAttr = item.href ? `href="${esc(item.href)}"` : `href="#" data-pending="${esc(item.badge)} 상세"`;
  return `
  <a class="card card--${item.column}" ${linkAttr} data-id="${esc(item.id)}"
     style="--i:${item.index};--imgw:${item.imgWidth}" data-col="${item.column}" data-order="${order}">
    <span class="card__media is-loading">
      <img src="${item.image}" alt="${esc(item.alt)}" loading="lazy" decoding="async">
      <span class="card__fallback" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/></svg>
        이미지를 불러오지 못했습니다
      </span>
    </span>
    <span class="card__txt">
      <span class="badge">${esc(item.badge)}</span>
      <strong class="card__title">${item.title.map(esc).join('<br>')}</strong>
      <span class="card__desc">${esc(item.desc)}</span>
    </span>
  </a>`;
}

/** 카드 이미지 로딩/오류 상태 연결 */
export function bindCardMedia(root) {
  root.querySelectorAll('.card__media img').forEach((img) => {
    const media = img.parentElement;
    const done = () => media.classList.remove('is-loading');
    const fail = () => { media.classList.remove('is-loading'); media.classList.add('is-error'); };
    if (img.complete) (img.naturalWidth ? done() : fail());
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', fail, { once: true }); }
  });
}
