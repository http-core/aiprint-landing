import { ph, stylesSchema } from './schema';

/*
 * Стили на фотоплёнке. Порядок = порядок кадров; первый стиль — это портрет
 * из сцены «Вспышка» (он «падает» в первый кадр плёнки).
 * Добавление/удаление стиля не требует правки анимаций.
 * Изображения — src/assets/<image>, 900×1200 (3:4). Первый кадр — исходный снимок без стиля.
 */
export const styles = stylesSchema.parse({
  list: [
    { id: 'original', name: 'Оригинал', image: 'styles/original.jpg', alt: 'Исходный снимок: пушистый полосатый кот сидит на деревянном полу' },
    { id: 'illustration', name: 'Иллюстрация', image: 'styles/illustration.jpg', alt: 'Тот же кот в виде яркой мультяшной иллюстрации' },
    { id: 'denim', name: 'Деним', image: 'styles/denim.jpg', alt: 'Кот, собранный из лоскутов джинсовой ткани, в технике пэчворк' },
    { id: 'monument', name: 'Монумент', image: 'styles/monument.jpg', alt: 'Гигантская каменная статуя кота в строительных лесах посреди города' },
    { id: 'toy', name: 'Фигурка', image: 'styles/toy.jpg', alt: 'Кот в виде коллекционной виниловой фигурки с большими глазами' },
    { id: 'collage', name: 'Коллаж', image: 'styles/collage.jpg', alt: 'Кот, сложенный из рваной бумаги и газетных вырезок' },
    { id: 'anime', name: 'Аниме', image: 'styles/anime.jpg', alt: 'Кот на залитой солнцем веранде в стиле аниме-пейзажа' },
    { id: 'folk', name: 'Народная роспись', image: 'styles/folk.jpg', alt: 'Кот в окружении цветов и домиков в стиле народной росписи' },
    { id: 'pixel', name: 'Пиксели', image: 'styles/pixel.jpg', alt: 'Кот в виде пиксельного персонажа на фоне лавы' },
  ],
  variants: ['toy', 'anime', 'folk', 'pixel'],
  selected: 2,
});

export const styleById = (id: string) => {
  const s = styles.list.find((x) => x.id === id);
  if (!s) throw new Error(`Стиль «${id}» не найден`);
  return s;
};

export const heroStyle = styles.list[0]!;
export const variantStyles = styles.variants.map(styleById);
export const selectedStyle = variantStyles[styles.selected]!;
