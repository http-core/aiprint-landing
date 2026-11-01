import { validateLead, type LeadErrors, type LeadField } from '../lib/lead-validation';

type State = 'idle' | 'submitting' | 'success' | 'error' | 'not_configured' | 'rate_limited';

const TIMEOUT_MS = 15_000;

/**
 * Форма заявки. Успех показывается ТОЛЬКО после ответа сервера { ok: true }
 * (сервер отвечает так после подтверждения доставки в Telegram).
 */
export function initLeadForm() {
  const form = document.querySelector<HTMLFormElement>('[data-lead-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const done = document.querySelector<HTMLElement>('[data-done]')!;
  const chip = form.querySelector<HTMLElement>('[data-model-chip]')!;
  const chipName = chip.querySelector<HTMLElement>('[data-model-name]')!;
  const modelInput = form.elements.namedItem('model') as HTMLInputElement;
  const contactLink = document.querySelector<HTMLAnchorElement>('.leadsec__alt a');

  let state: State = 'idle';

  const setState = (next: State) => {
    state = next;
    form.dataset.state = next;
    submit.disabled = next === 'submitting';
    submit.setAttribute('aria-busy', String(next === 'submitting'));
  };

  const setStatus = (html: string, tone: 'info' | 'error' | 'warn' = 'info') => {
    status.dataset.tone = tone;
    status.innerHTML = html;
  };

  const tgFallback = () =>
    contactLink ? ` Или напишите нам в Telegram: <a href="${contactLink.href}" target="_blank" rel="noopener">${contactLink.textContent}</a>.` : '';

  const fields: LeadField[] = ['name', 'contact', 'comment', 'consent'];

  const showErrors = (errors: LeadErrors) => {
    let first: HTMLElement | null = null;
    for (const f of fields) {
      const input = form.elements.namedItem(f) as HTMLInputElement | null;
      const box = form.querySelector<HTMLElement>(`[data-error-for="${f}"]`);
      const msg = errors[f];
      if (input) input.setAttribute('aria-invalid', String(Boolean(msg)));
      if (box) {
        box.textContent = msg ?? '';
        box.hidden = !msg;
      }
      if (msg && !first) first = input;
    }
    first?.focus();
  };

  const clearError = (f: LeadField) => {
    const input = form.elements.namedItem(f) as HTMLInputElement | null;
    const box = form.querySelector<HTMLElement>(`[data-error-for="${f}"]`);
    input?.removeAttribute('aria-invalid');
    if (box) box.hidden = true;
  };

  form.addEventListener('input', (e) => {
    const name = (e.target as HTMLInputElement).name as LeadField;
    if (fields.includes(name)) clearError(name);
  });

  // Модель из карточки оборудования
  document.addEventListener('lead:model', (e) => {
    const model = (e as CustomEvent<string>).detail;
    modelInput.value = model;
    chipName.textContent = model;
    chip.hidden = !model;
  });
  form.querySelector('[data-model-clear]')?.addEventListener('click', () => {
    modelInput.value = '';
    chip.hidden = true;
    (form.elements.namedItem('name') as HTMLInputElement).focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state === 'submitting') return;

    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') ?? ''),
      contact: String(fd.get('contact') ?? ''),
      comment: String(fd.get('comment') ?? ''),
      consent: fd.get('consent') === 'on',
      model: String(fd.get('model') ?? ''),
      website: String(fd.get('website') ?? ''),
    };

    const check = validateLead(payload);
    if (!check.ok) {
      showErrors(check.errors);
      setStatus('');
      return;
    }
    showErrors({});

    setState('submitting');
    setStatus('Отправляем заявку…');

    let res: Response;
    let body: { ok?: boolean; code?: string; errors?: LeadErrors } | null = null;
    try {
      res = await fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      body = await res.json().catch(() => null);
    } catch (err) {
      setState('error');
      const timeout = err instanceof DOMException && err.name === 'TimeoutError';
      setStatus(
        (timeout ? 'Сервер не ответил вовремя — заявка, скорее всего, не отправлена. ' : 'Не удалось связаться с сервером. ') +
          'Данные сохранены в форме — попробуйте ещё раз.' +
          tgFallback(),
        'error',
      );
      return;
    }

    if (res.ok && body?.ok === true) {
      setState('success');
      form.hidden = true;
      done.hidden = false;
      done.focus();
      return;
    }

    switch (body?.code) {
      case 'validation_error':
        setState('idle');
        setStatus('');
        showErrors(body.errors ?? {});
        return;
      case 'not_configured':
        setState('not_configured');
        setStatus('Приём заявок через сайт пока не настроен — ваши данные не отправлены.' + tgFallback(), 'warn');
        return;
      case 'rate_limited':
        setState('rate_limited');
        setStatus('Слишком много попыток, попробуйте позже.' + tgFallback(), 'warn');
        return;
      default:
        setState('error');
        setStatus('Не удалось отправить заявку. Данные сохранены в форме — попробуйте ещё раз.' + tgFallback(), 'error');
    }
  });
}
