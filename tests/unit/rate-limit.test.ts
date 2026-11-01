import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../src/lib/rate-limit';

describe('createRateLimiter', () => {
  it('5 запросов за 10 минут с одного IP, шестой — отказ', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 5, windowMs: 600_000, now: () => t });
    for (let i = 0; i < 5; i++) expect(rl.hit('1.1.1.1')).toBe(true);
    expect(rl.hit('1.1.1.1')).toBe(false);
    expect(rl.hit('2.2.2.2')).toBe(true);
  });

  it('окно скользящее', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    rl.hit('a');
    t = 500;
    rl.hit('a');
    expect(rl.hit('a')).toBe(false);
    t = 1001; // первый запрос вышел из окна
    expect(rl.hit('a')).toBe(true);
  });

  it('ограничивает число хранимых ключей', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0, maxKeys: 2 });
    rl.hit('a');
    rl.hit('b');
    rl.hit('c'); // «a» вытеснен
    expect(rl.hit('a')).toBe(true);
  });
});
