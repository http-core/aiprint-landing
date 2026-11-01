import { isPh } from '../data/schema';

/** Пути всех значений, помеченных как заглушка (ph), внутри объекта данных. */
export function collectPlaceholders(data: unknown, path = ''): string[] {
  if (isPh(data)) return [path || '(root)'];
  if (Array.isArray(data)) return data.flatMap((x, i) => collectPlaceholders(x, `${path}[${i}]`));
  if (data && typeof data === 'object') {
    return Object.entries(data).flatMap(([k, v]) => collectPlaceholders(v, path ? `${path}.${k}` : k));
  }
  return [];
}

let reported = false;

/** Печатает предупреждение в production-сборке (один раз за сборку). */
export function reportPlaceholders(sources: Record<string, unknown>) {
  if (reported || !import.meta.env.PROD) return;
  reported = true;
  const list = Object.entries(sources).flatMap(([name, data]) => collectPlaceholders(data, name));
  if (list.length === 0) return;
  console.warn(
    `\n⚠  В сборке остались заглушки (${list.length}) — замените их в src/data и пометьте как подтверждённые:\n` +
      list.map((p) => `   • ${p}`).join('\n') +
      '\n',
  );
}
