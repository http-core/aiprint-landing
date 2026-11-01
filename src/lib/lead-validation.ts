/** Общая валидация заявки: используется и в браузере, и на сервере. */

export const LIMITS = { nameMin: 2, nameMax: 80, commentMax: 1000, modelMax: 80 } as const;

export type LeadField = 'name' | 'contact' | 'comment' | 'consent';
export type LeadErrors = Partial<Record<LeadField, string>>;

export interface LeadData {
  name: string;
  contact: string;
  contactType: 'phone' | 'telegram';
  comment: string;
  model: string;
}

export type LeadInput = Partial<Record<LeadField | 'model' | 'website', unknown>>;

const TG = /^@[A-Za-z0-9_]{5,32}$/;
const PHONE_CHARS = /^\+?[\d\s()\-.]+$/;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Телефон (10–15 цифр) или Telegram-ник (@ + 5–32 символа). Ссылки t.me/… приводятся к @нику. */
export function parseContact(raw: string): { type: 'phone' | 'telegram'; value: string } | null {
  let v = raw.trim();
  const link = v.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{5,32})\/?$/i);
  if (link) v = `@${link[1]}`;
  if (TG.test(v)) return { type: 'telegram', value: v };
  if (PHONE_CHARS.test(v) && v.indexOf('+') <= 0) {
    const digits = v.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return { type: 'phone', value: v.replace(/\s+/g, ' ') };
  }
  return null;
}

export function validateLead(input: LeadInput): { ok: true; data: LeadData } | { ok: false; errors: LeadErrors } {
  const errors: LeadErrors = {};
  const name = str(input.name).replace(/\s+/g, ' ');
  const contactRaw = str(input.contact);
  const comment = str(input.comment);
  const model = str(input.model).slice(0, LIMITS.modelMax);
  const consent = input.consent === true || input.consent === 'on' || input.consent === 'true';

  if (name.length < LIMITS.nameMin) errors.name = 'Укажите имя — хотя бы 2 буквы';
  else if (name.length > LIMITS.nameMax) errors.name = `Имя слишком длинное — до ${LIMITS.nameMax} символов`;

  const contact = contactRaw ? parseContact(contactRaw) : null;
  if (!contactRaw) errors.contact = 'Укажите телефон или Telegram, чтобы мы могли ответить';
  else if (!contact) errors.contact = 'Нужен номер телефона (10–15 цифр) или Telegram-ник вида @username';

  if (comment.length > LIMITS.commentMax) errors.comment = `Комментарий до ${LIMITS.commentMax} символов`;
  if (!consent) errors.consent = 'Нужно согласие на обработку персональных данных';

  if (Object.keys(errors).length > 0 || !contact) return { ok: false, errors };
  return { ok: true, data: { name, contact: contact.value, contactType: contact.type, comment, model } };
}
