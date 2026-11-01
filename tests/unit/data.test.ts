import { describe, expect, it } from 'vitest';
import { models, site, styles, modelsSchema, stylesSchema, ph } from '../../src/data';
import { collectPlaceholders } from '../../src/lib/placeholders';

describe('данные лендинга', () => {
  it('валидны и содержат обязательное', () => {
    expect(models.length).toBeGreaterThan(0);
    expect(styles.variants).toHaveLength(4);
    expect(site.print.steps).toHaveLength(4);
  });

  it('невалидные данные отклоняются (сборка упадёт)', () => {
    expect(() => modelsSchema.parse([])).toThrow();
    expect(() => stylesSchema.parse({ ...styles, variants: ['nope', 'anime', 'noir', 'comic'] })).toThrow();
    expect(() => modelsSchema.parse([{ ...models[0], image: 'booth.gif' }])).toThrow();
  });

  it('модель без цены допустима (→ «Стоимость по запросу»)', () => {
    expect(models[0]!.price).toBeUndefined();
  });

  it('collectPlaceholders находит заглушки с путями', () => {
    expect(collectPlaceholders({ a: ph(1), b: [{ c: ph('x') }, 2] }, 'root')).toEqual(['root.a', 'root.b[0].c']);
  });

  it('тексты не содержат неподтверждённых цифр о стилях, выручке, окупаемости и скорости', () => {
    const text = JSON.stringify(site);
    expect(text).not.toMatch(/\d+\s*\+?\s*(стил|образ)/i);
    expect(text).not.toMatch(/окупа|выручк|\d+\s*(сек|минут)/i);
  });
});
