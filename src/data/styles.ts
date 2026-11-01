import { ph, stylesSchema } from './schema';

/*
 * Стили на фотоплёнке. Порядок = порядок кадров; первый стиль — это портрет
 * из сцены «Вспышка» (он «падает» в первый кадр плёнки).
 * Добавление/удаление стиля не требует правки анимаций.
 * Изображения — src/assets/<image>; сейчас все — заглушки.
 */
export const styles = stylesSchema.parse({
  list: [
    { id: 'anime', name: ph('Аниме'), image: ph('styles/anime.jpg'), alt: 'Портрет в стиле аниме' },
    { id: 'noir', name: ph('Нуар'), image: ph('styles/noir.jpg'), alt: 'Чёрно-белый портрет в стиле нуар' },
    { id: 'comic', name: ph('Комикс'), image: ph('styles/comic.jpg'), alt: 'Портрет в стиле комикса' },
    { id: 'renaissance', name: ph('Ренессанс'), image: ph('styles/renaissance.jpg'), alt: 'Портрет в духе живописи Ренессанса' },
    { id: 'cyber', name: ph('Киберпанк'), image: ph('styles/cyber.jpg'), alt: 'Портрет в неоновом стиле киберпанк' },
    { id: 'pixel', name: ph('Пиксель-арт'), image: ph('styles/pixel.jpg'), alt: 'Портрет в стиле пиксель-арт' },
    { id: 'watercolor', name: ph('Акварель'), image: ph('styles/watercolor.jpg'), alt: 'Акварельный портрет' },
    { id: 'pop', name: ph('Поп-арт'), image: ph('styles/pop.jpg'), alt: 'Портрет в стиле поп-арт' },
  ],
  variants: ['comic', 'anime', 'renaissance', 'cyber'],
  selected: 1,
});

export const styleById = (id: string) => {
  const s = styles.list.find((x) => x.id === id);
  if (!s) throw new Error(`Стиль «${id}» не найден`);
  return s;
};

export const heroStyle = styles.list[0]!;
export const variantStyles = styles.variants.map(styleById);
export const selectedStyle = variantStyles[styles.selected]!;
