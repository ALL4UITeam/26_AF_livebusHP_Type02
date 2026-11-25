/** 화면 아래 짧은 안내(성공·안내·오류). 스크린리더에도 읽힌다. */
let host;
let timer;

export function toast(message, { type = 'info', duration = 2600 } = {}) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  clearTimeout(timer);
  host.dataset.type = type;
  host.textContent = message;
  host.classList.remove('is-on');
  void host.offsetWidth; // 연속 호출 때도 다시 떠오르게
  host.classList.add('is-on');
  timer = setTimeout(() => host.classList.remove('is-on'), duration);
}

/** href 가 정해지지 않은 링크([data-pending]) 공통 처리 */
export function bindPendingLinks(root = document) {
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-pending]');
    if (!a) return;
    e.preventDefault();
    toast(`${a.dataset.pending} 페이지는 준비 중입니다.`);
  });
}
