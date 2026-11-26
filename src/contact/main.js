/**
 * LIVEBUS 도입 문의 페이지.
 *
 * - 입력 확인: 보내기를 누를 때 전체를, 칸을 떠날 때 그 칸을 확인한다. 오류는 해당 칸 바로 아래에 적는다.
 * - 전송: config.js 에 수신 주소와 동의 문구가 모두 있을 때만 POST(JSON)로 보낸다. 입력값을 주소(URL)에 싣지 않는다.
 * - 상태: 서버가 2xx 로 응답한 경우에만 '접수 완료'를 보인다. 실패하면 입력값을 그대로 두고 다시 보낼 수 있다.
 * - 중복 방지: 보내는 동안과 접수된 뒤에는 다시 보내지지 않는다. 같은 문의에는 같은 requestId 가 붙는다.
 */
import { INQUIRY, isConfigured } from './config.js';

const form = document.querySelector('#inquiry');
const statusBox = form.querySelector('[data-status]');
const submit = form.querySelector('.submit');
const submitLabel = form.querySelector('[data-submit-label]');
const done = document.querySelector('[data-done]');
const consentBox = form.querySelector('[data-consent]');
const counter = form.querySelector('[data-count]');
const SUBMIT_TEXT = submitLabel.textContent;

/* ── 서비스 페이지로 돌아가는 링크: 돌아간 쪽에서 오프닝을 다시 재생하지 않도록 표시만 남긴다(개인정보 없음) ── */
document.querySelectorAll('a[data-service]').forEach((a) => a.addEventListener('click', () => {
  try { sessionStorage.setItem('lb:from-contact', '1'); } catch { /* 저장소를 쓸 수 없으면 그냥 이동한다 */ }
}));

/* ── 개인정보 수집·이용 동의: 확정 문구가 있을 때만 그린다 ── */
function renderConsent() {
  const p = INQUIRY.privacy;
  if (!p) return;
  const rows = [['수집 항목', p.items], ['수집·이용 목적', p.purpose], ['보유·이용 기간', p.retention], ['동의 거부 권리', p.refusal]].filter(([, v]) => v);
  const title = document.createElement('p'); title.className = 'field__label'; title.id = 'l-consent';
  title.append('개인정보 수집·이용 동의 '); const tag = document.createElement('span'); tag.className = 'tag tag--req'; tag.textContent = '필수'; title.append(tag);
  const dl = document.createElement('dl'); dl.className = 'consent__terms';
  for (const [k, v] of rows) { const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.append(d); }
  const label = document.createElement('label'); label.className = 'check';
  const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'consent'; input.id = 'f-consent'; input.required = true; input.setAttribute('aria-describedby', 'e-consent');
  const text = document.createElement('span'); text.textContent = '개인정보 수집·이용에 동의합니다.';
  label.append(input, text);
  const err = document.createElement('p'); err.className = 'field__error'; err.id = 'e-consent'; err.hidden = true;
  consentBox.append(title, dl, label);
  if (p.policyUrl) { const a = document.createElement('a'); a.className = 'consent__link'; a.href = p.policyUrl; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '개인정보처리방침 보기'; consentBox.append(a); }
  consentBox.append(err);
  consentBox.hidden = false;
}
renderConsent();
form.querySelector('[data-unconfigured]').hidden = isConfigured();

/* ── 입력 확인 ── */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s\-()]{6,18}[0-9]$/;
const value = (name) => (form.elements[name]?.value ?? '').trim();
const rules = {
  organization: () => (value('organization') ? '' : '기관·기업명을 입력해 주세요.'),
  name: () => (value('name') ? '' : '담당자명을 입력해 주세요.'),
  email: () => { const v = value('email'); return !v ? '이메일을 입력해 주세요.' : EMAIL.test(v) ? '' : '이메일 주소 형식을 확인해 주세요. 예: name@example.com'; },
  phone: () => { const v = value('phone'); return !v || PHONE.test(v) ? '' : '연락처는 숫자와 하이픈(-)으로 입력해 주세요. 예: 02-1234-5678'; },
  message: () => (value('message') ? '' : '문의 내용을 입력해 주세요.'),
  consent: () => { const c = form.elements.consent; return !c || c.checked ? '' : '개인정보 수집·이용에 동의해 주세요.'; },
};
function show(name, message) {
  const field = form.querySelector(`[data-field="${name}"]`), err = form.querySelector(`#e-${name}`), input = form.elements[name];
  if (!field || !err) return;
  field.classList.toggle('is-invalid', Boolean(message));
  err.textContent = message; err.hidden = !message;
  if (input && input.setAttribute) { if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
}
const check = (name) => { const message = rules[name](); show(name, message); return !message; };
for (const name of Object.keys(rules)) {
  const input = form.elements[name];
  if (!input || !input.addEventListener) continue;
  input.addEventListener('blur', () => check(name));
  input.addEventListener(name === 'consent' ? 'change' : 'input', () => { if (form.querySelector(`[data-field="${name}"]`)?.classList.contains('is-invalid')) check(name); });
}
const message = form.elements.message;
const count = () => { counter.textContent = `${message.value.length} / ${message.maxLength}`; };
message.addEventListener('input', count); count();

/* ── 상태 표시 ── */
function setStatus(text, kind = 'error') {
  statusBox.textContent = text; statusBox.dataset.kind = kind; statusBox.hidden = !text;
  if (text) statusBox.focus({ preventScroll: false });
}
let sending = false, sent = false;
let requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
function setSending(on) {
  sending = on; submit.disabled = on; form.setAttribute('aria-busy', String(on));
  submitLabel.textContent = on ? '보내는 중…' : SUBMIT_TEXT;
}
/** 서버로 보내는 내용. 주소(URL)에는 아무것도 싣지 않는다 */
export function buildPayload() {
  return {
    requestId,                                      // 같은 문의를 다시 보내도 서버가 한 건으로 볼 수 있게 하는 값
    organization: value('organization'), name: value('name'), email: value('email'), phone: value('phone'),
    service: value('service') || null, message: value('message'),
    consent: Boolean(form.elements.consent?.checked), consentVersion: INQUIRY.privacy?.version ?? null,
    submittedAt: new Date().toISOString(), source: 'livebus-contact',
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (sending || sent) return;                      // 중복 전송 방지
  setStatus('');
  const invalid = Object.keys(rules).filter((name) => !check(name));
  if (invalid.length) {
    const first = form.elements[invalid[0]];
    first?.focus?.();
    return;
  }
  if (!isConfigured()) {
    setStatus('아직 문의를 접수할 수 없습니다. 전송 연결이 설정되지 않아 내용이 전송되지 않았습니다. 입력하신 내용은 이 화면에 그대로 남아 있습니다.', 'blocked');
    return;
  }
  setSending(true);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), INQUIRY.timeout || 15000);
  try {
    const res = await fetch(INQUIRY.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...INQUIRY.headers },
      body: JSON.stringify(buildPayload()), signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sent = true;                                    // 서버가 접수를 확인한 경우에만
    form.hidden = true; done.hidden = false; done.focus();
    form.reset(); count();
  } catch (err) {
    console.warn('[inquiry] 전송 실패', err?.message || err);
    setStatus(err?.name === 'AbortError'
      ? '응답이 늦어 전송을 마치지 못했습니다. 잠시 뒤 다시 보내 주세요. 입력하신 내용은 그대로 남아 있습니다.'
      : '문의를 보내지 못했습니다. 네트워크 상태를 확인한 뒤 다시 보내 주세요. 입력하신 내용은 그대로 남아 있습니다.');
  } finally {
    clearTimeout(timer);
    setSending(false);
  }
});
