/** Скользящее окно в памяти процесса. Для одного Node-процесса этого достаточно. */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}) {
  const hits = new Map<string, number[]>();

  return {
    /** true — запрос разрешён (и учтён), false — лимит исчерпан. */
    hit(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.delete(key); // перевставка — ключ становится «самым свежим»
      hits.set(key, recent);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value!);
      return true;
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
