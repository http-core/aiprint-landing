import type { LeadData } from './lead-validation';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function formatLeadMessage(d: LeadData, at = new Date()): string {
  const when = at.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' });
  const contact =
    d.contactType === 'telegram'
      ? `${escapeHtml(d.contact)} (Telegram)`
      : `<code>${escapeHtml(d.contact)}</code> (телефон)`;
  const lines = ['<b>Новая заявка с сайта</b>', '', `<b>Имя:</b> ${escapeHtml(d.name)}`, `<b>Контакт:</b> ${contact}`];
  if (d.model) lines.push(`<b>Модель:</b> ${escapeHtml(d.model)}`);
  if (d.comment) lines.push('<b>Комментарий:</b>', escapeHtml(d.comment));
  lines.push('', `<i>${when} МСК</i>`);
  return lines.join('\n');
}

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export async function sendTelegram(
  cfg: TelegramConfig,
  text: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (res.ok && body?.ok) return { ok: true };
    return { ok: false, reason: body?.description ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.name : 'network' };
  }
}
