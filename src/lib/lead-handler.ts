import { validateLead, type LeadErrors, type LeadInput } from './lead-validation';
import { formatLeadMessage, sendTelegram } from './telegram';
import type { RateLimiter } from './rate-limit';

export type LeadCode =
  | 'ok'
  | 'validation_error'
  | 'not_configured'
  | 'delivery_failed'
  | 'rate_limited'
  | 'bad_request'
  | 'payload_too_large';

export interface LeadDeps {
  env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string };
  limiter: RateLimiter;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'error' | 'warn'>;
}

const MAX_BODY = 8 * 1024;

const STATUS: Record<LeadCode, number> = {
  ok: 200,
  validation_error: 400,
  bad_request: 400,
  payload_too_large: 413,
  rate_limited: 429,
  delivery_failed: 502,
  not_configured: 503,
};

/** Тексты для отправки формы без JavaScript (ответ — простая HTML-страница). */
const HTML_TEXT: Record<LeadCode, string> = {
  ok: 'Заявка отправлена. Спасибо! Мы свяжемся с вами.',
  validation_error: 'Проверьте поля формы: имя, телефон или Telegram и согласие на обработку данных.',
  bad_request: 'Не удалось прочитать заявку. Попробуйте ещё раз.',
  payload_too_large: 'Слишком длинное сообщение. Сократите комментарий и попробуйте ещё раз.',
  rate_limited: 'Слишком много попыток. Попробуйте позже.',
  delivery_failed: 'Не удалось доставить заявку. Попробуйте ещё раз или напишите нам в Telegram.',
  not_configured: 'Приём заявок через сайт пока не настроен. Пожалуйста, напишите нам в Telegram.',
};

function reply(code: LeadCode, asHtml: boolean, errors?: LeadErrors): Response {
  const status = STATUS[code];
  if (asHtml) {
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Заявка</title><style>body{font:18px/1.5 system-ui,sans-serif;background:#faf8f3;color:#141414;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:32em}a{color:#4b31d9}</style></head><body><main><p>${HTML_TEXT[code]}</p><p><a href="/#lead">← Вернуться на сайт</a></p></main></body></html>`;
    return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return Response.json(errors ? { ok: code === 'ok', code, errors } : { ok: code === 'ok', code }, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function handleLead(request: Request, ip: string, deps: LeadDeps): Promise<Response> {
  const log = deps.log ?? console;
  const type = request.headers.get('content-type') ?? '';
  const isJson = type.includes('application/json');
  const isForm = type.includes('application/x-www-form-urlencoded');
  if (!isJson && !isForm) return reply('bad_request', false);

  if (!deps.limiter.hit(ip)) return reply('rate_limited', isForm);

  const raw = await request.text().catch(() => null);
  if (raw === null) return reply('bad_request', isForm);
  if (raw.length > MAX_BODY) return reply('payload_too_large', isForm);

  let input: LeadInput;
  try {
    input = isJson ? (JSON.parse(raw) as LeadInput) : Object.fromEntries(new URLSearchParams(raw));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('not an object');
  } catch {
    return reply('bad_request', isForm);
  }

  // Honeypot: ботам отвечаем как при успехе, но ничего не отправляем.
  if (typeof input.website === 'string' && input.website.trim() !== '') return reply('ok', isForm);

  const result = validateLead(input);
  if (!result.ok) return reply('validation_error', isForm, result.errors);

  const token = deps.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = deps.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    log.warn('[lead] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы — заявка не отправлена');
    return reply('not_configured', isForm);
  }

  const sent = await sendTelegram({ token, chatId }, formatLeadMessage(result.data), deps.fetchImpl);
  if (!sent.ok) {
    log.error(`[lead] Telegram не принял заявку: ${sent.reason}`);
    return reply('delivery_failed', isForm);
  }
  return reply('ok', isForm);
}
