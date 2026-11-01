import { describe, expect, it } from 'vitest';
import { parseContact, validateLead } from '../../src/lib/lead-validation';

const ok = { name: 'Иван', contact: '+7 900 123-45-67', comment: '', consent: true };

describe('parseContact', () => {
  it.each([
    ['+7 900 123-45-67', 'phone'],
    ['8 (900) 123-45-67', 'phone'],
    ['89001234567', 'phone'],
    ['+44 20 7946 0958', 'phone'],
    ['@ivan_petrov', 'telegram'],
    ['https://t.me/ivan_petrov', 'telegram'],
    ['t.me/ivan_petrov', 'telegram'],
  ])('%s → %s', (raw, type) => {
    expect(parseContact(raw)?.type).toBe(type);
  });

  it('приводит ссылку t.me к @нику', () => {
    expect(parseContact('t.me/ivan_petrov')?.value).toBe('@ivan_petrov');
  });

  it.each([
    'abc',
    '12345', // мало цифр
    '+7 900 123 45 67 89 012', // больше 15 цифр
    '7+9001234567', // плюс не в начале
    '@abcd', // ник короче 5
    '@иван_петров',
    `@${'a'.repeat(33)}`,
    '',
  ])('отклоняет «%s»', (raw) => {
    expect(parseContact(raw)).toBeNull();
  });
});

describe('validateLead', () => {
  it('принимает корректную заявку и нормализует пробелы в имени', () => {
    const r = validateLead({ ...ok, name: '  Иван   Петров ', model: 'Будка 1.0' });
    expect(r).toEqual({
      ok: true,
      data: { name: 'Иван Петров', contact: '+7 900 123-45-67', contactType: 'phone', comment: '', model: 'Будка 1.0' },
    });
  });

  it('согласие: принимает true / "on", отклоняет отсутствие', () => {
    expect(validateLead({ ...ok, consent: 'on' }).ok).toBe(true);
    const r = validateLead({ ...ok, consent: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.consent).toBeTruthy();
  });

  it('границы длины имени: 2 и 80 символов', () => {
    expect(validateLead({ ...ok, name: 'Я' }).ok).toBe(false);
    expect(validateLead({ ...ok, name: 'Ян' }).ok).toBe(true);
    expect(validateLead({ ...ok, name: 'а'.repeat(80) }).ok).toBe(true);
    expect(validateLead({ ...ok, name: 'а'.repeat(81) }).ok).toBe(false);
  });

  it('комментарий не длиннее 1000 символов', () => {
    expect(validateLead({ ...ok, comment: 'x'.repeat(1000) }).ok).toBe(true);
    const r = validateLead({ ...ok, comment: 'x'.repeat(1001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(['comment']);
  });

  it('собирает все ошибки сразу', () => {
    const r = validateLead({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['consent', 'contact', 'name']);
  });

  it('не падает на не-строковых значениях', () => {
    expect(validateLead({ name: 42, contact: { x: 1 }, consent: 'yes' }).ok).toBe(false);
  });
});
