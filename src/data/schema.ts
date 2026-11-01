import { z } from 'zod';

/**
 * Значение, не подтверждённое заказчиком. В dev подсвечивается на странице,
 * в production-сборке попадает в предупреждение со списком заглушек.
 */
export type Placeholder<T> = { value: T; placeholder: true };
export type Field<T> = T | Placeholder<T>;

export const ph = <T>(value: T): Placeholder<T> => ({ value, placeholder: true });

export const isPh = (f: unknown): f is Placeholder<unknown> =>
  typeof f === 'object' && f !== null && 'value' in f && (f as { placeholder?: unknown }).placeholder === true;

export const val = <T>(f: Field<T>): T => (isPh(f) ? (f.value as T) : (f as T));

/** Атрибут для разметки: в dev-режиме такие элементы обводятся пунктиром. */
export const phAttr = (...fields: unknown[]) =>
  fields.some(isPh) ? { 'data-placeholder': '' } : {};

const field = <T extends z.ZodType>(inner: T) =>
  z.union([inner, z.object({ value: inner, placeholder: z.literal(true) })]);

/** Путь к изображению относительно src/assets (проверяется при сборке). */
const imagePath = z.string().regex(/^[\w\-/]+\.(jpe?g|png|webp|avif)$/i, 'ожидается путь вида styles/noir.jpg');

export const styleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: field(z.string().min(1)),
  image: field(imagePath),
  alt: z.string().min(1),
});

export const stylesSchema = z
  .object({
    list: z.array(styleSchema).min(4),
    /** Четыре варианта одного образа в финале плёнки. */
    variants: z.array(z.string()).length(4),
    /** Индекс выбранного варианта — именно он уходит в печать. */
    selected: z.number().int().min(0).max(3),
  })
  .superRefine((s, ctx) => {
    const ids = new Set(s.list.map((x) => x.id));
    if (ids.size !== s.list.length) ctx.addIssue({ code: 'custom', message: 'id стилей должны быть уникальны' });
    for (const v of s.variants) {
      if (!ids.has(v)) ctx.addIssue({ code: 'custom', message: `вариант «${v}» не найден среди стилей` });
    }
  });

export const modelSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: field(z.string().min(1)),
  /** Цена в рублях. Если не задана — показывается priceOnRequest из site. */
  price: field(z.number().positive()).optional(),
  description: field(z.string().min(1)),
  specs: z
    .array(z.object({ label: z.string().min(1), value: field(z.string().min(1)) }))
    .min(1),
  image: field(imagePath),
  imageAlt: z.string().min(1),
});

export const modelsSchema = z.array(modelSchema).min(1);

export const siteSchema = z.object({
  brand: z.string().min(1),
  meta: z.object({ title: z.string(), description: z.string() }),
  /** Контакт для «написать напрямую» (без @). */
  telegramContact: field(z.string().regex(/^[A-Za-z0-9_]{5,32}$/)),
  /** Бот, через который гость получает остальные варианты (без @). */
  resultsBot: field(z.string().regex(/^[A-Za-z0-9_]{5,32}$/)),
  hero: z.object({
    titleTop: z.string(),
    titleBottomPlain: z.string(),
    titleBottomAccent: z.string(),
    lead: z.string(),
    cta: z.string(),
    secondaryCta: z.string(),
  }),
  film: z.object({
    kicker: z.string(),
    title: z.string(),
    lead: z.string(),
    variantsTitle: z.string(),
    selectedLabel: z.string(),
  }),
  print: z.object({
    kicker: z.string(),
    title: z.string(),
    lead: z.string(),
    steps: z.array(z.string()).length(4),
  }),
  equipment: z.object({
    kicker: z.string(),
    title: z.string(),
    lead: z.string(),
    priceOnRequest: z.string(),
    cta: z.string(),
  }),
  lead: z.object({
    kicker: z.string(),
    title: z.string(),
    subtitle: z.string(),
    submit: z.string(),
  }),
  privacy: z.object({
    operator: field(z.string()),
    email: field(z.string()),
    body: field(z.array(z.string()).min(1)),
  }),
});

export type Style = z.infer<typeof styleSchema>;
export type Styles = z.infer<typeof stylesSchema>;
export type Model = z.infer<typeof modelSchema>;
export type Site = z.infer<typeof siteSchema>;
