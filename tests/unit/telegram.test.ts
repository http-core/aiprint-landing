import { describe, expect, it, vi } from 'vitest';
import { escapeHtml, formatLeadMessage, sendTelegram } from '../../src/lib/telegram';

describe('escapeHtml', () => {
  it('экранирует служебные символы HTML Telegram', () => {
    expect(escapeHtml(`<b>"Тест" & </b>`)).toBe('&lt;b&gt;&quot;Тест&quot; &amp; &lt;/b&gt;');
  });
});

describe('formatLeadMessage', () => {
  it('экранирует пользовательский ввод и пропускает пустые поля', () => {
    const text = formatLeadMessage(
      { name: '<script>', contact: '@ivan_petrov', contactType: 'telegram', comment: '', model: '' },
      new Date('2026-11-01T12:00:00Z'),
    );
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('Модель');
    expect(text).not.toContain('Комментарий');
    expect(text).toContain('01.11.2026');
  });
});

describe('sendTelegram', () => {
  const cfg = { token: 'T', chatId: '42' };

  it('ok, только если Telegram ответил ok: true', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch;
    await expect(sendTelegram(cfg, 'hi', fetchImpl)).resolves.toEqual({ ok: true });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://api.telegram.org/botT/sendMessage');
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '42', text: 'hi', parse_mode: 'HTML' });
  });

  it('ошибка API Telegram → ok: false', async () => {
    const fetchImpl = (async () =>
      Response.json({ ok: false, description: 'chat not found' }, { status: 400 })) as typeof fetch;
    await expect(sendTelegram(cfg, 'hi', fetchImpl)).resolves.toEqual({ ok: false, reason: 'chat not found' });
  });

  it('сетевая ошибка → ok: false', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await expect(sendTelegram(cfg, 'hi', fetchImpl)).resolves.toMatchObject({ ok: false });
  });
});
