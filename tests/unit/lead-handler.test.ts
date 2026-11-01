import { describe, expect, it, vi } from 'vitest';
import { handleLead } from '../../src/lib/lead-handler';
import { createRateLimiter } from '../../src/lib/rate-limit';

const env = { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '42' };
const good = { name: 'Иван', contact: '@ivan_petrov', consent: true, comment: 'Хочу в ТЦ' };
const tgOk = () => vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch;
const quiet = { error: () => {}, warn: () => {} };

const json = (body: unknown) =>
  new Request('http://x/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const deps = (over: Partial<Parameters<typeof handleLead>[2]> = {}) => ({
  env,
  limiter: createRateLimiter({ limit: 5, windowMs: 600_000 }),
  fetchImpl: tgOk(),
  log: quiet,
  ...over,
});

describe('POST /api/lead', () => {
  it('200 ok — после подтверждения Telegram', async () => {
    const d = deps();
    const res = await handleLead(json(good), 'ip', d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, code: 'ok' });
    expect(d.fetchImpl).toHaveBeenCalledOnce();
  });

  it('400 validation_error с ошибками по полям, без отправки', async () => {
    const d = deps();
    const res = await handleLead(json({ ...good, contact: 'abc' }), 'ip', d);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: 'validation_error', errors: { contact: expect.any(String) } });
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });

  it('503 not_configured без токена — ничего не отправляет', async () => {
    const d = deps({ env: {} });
    const res = await handleLead(json(good), 'ip', d);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'not_configured' });
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });

  it('502 delivery_failed, если Telegram вернул ошибку', async () => {
    const fetchImpl = (async () => Response.json({ ok: false, description: 'Unauthorized' }, { status: 401 })) as typeof fetch;
    const res = await handleLead(json(good), 'ip', deps({ fetchImpl }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: 'delivery_failed' });
  });

  it('429 после 5 заявок с одного IP за 10 минут', async () => {
    const d = deps();
    for (let i = 0; i < 5; i++) expect((await handleLead(json(good), '9.9.9.9', d)).status).toBe(200);
    const res = await handleLead(json(good), '9.9.9.9', d);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'rate_limited' });
  });

  it('honeypot: отвечает как при успехе, но не отправляет', async () => {
    const d = deps();
    const res = await handleLead(json({ ...good, website: 'http://spam' }), 'ip', d);
    expect(res.status).toBe(200);
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });

  it('413 для тела больше 8 КБ', async () => {
    const res = await handleLead(json({ ...good, comment: 'x'.repeat(9000) }), 'ip', deps());
    expect(res.status).toBe(413);
  });

  it('400 для битого JSON и не-объекта', async () => {
    expect((await handleLead(json('{oops'), 'ip', deps())).status).toBe(400);
    expect((await handleLead(json('[1,2]'), 'ip', deps())).status).toBe(400);
  });

  it('400 для неподдерживаемого Content-Type', async () => {
    const req = new Request('http://x/api/lead', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' });
    expect((await handleLead(req, 'ip', deps())).status).toBe(400);
  });

  it('форма без JS (urlencoded) — HTML-ответ, без ложного успеха', async () => {
    const body = new URLSearchParams({ name: 'Иван', contact: '@ivan_petrov', consent: 'on' });
    const req = new Request('http://x/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const res = await handleLead(req, 'ip', deps({ env: {} }));
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('не настроен');
    expect(html).not.toContain('Заявка отправлена');
  });
});
