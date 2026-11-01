import type { ImageMetadata } from 'astro';
import { val, type Field } from '../data/schema';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

/** Изображение из src/assets по пути из конфигурации. Неизвестный путь роняет сборку. */
export function asset(path: Field<string>): ImageMetadata {
  const p = val(path);
  const mod = files[`../assets/${p}`];
  if (!mod) throw new Error(`Изображение не найдено: src/assets/${p}`);
  return mod.default;
}

/** Ширины для портретов/кадров: одинаковые везде, чтобы браузер переиспользовал файлы. */
export const PORTRAIT_WIDTHS = [320, 480, 640, 900];
export const PORTRAIT_SIZES = '(max-width: 767px) 64vw, 380px';
