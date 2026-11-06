import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Прокрутка всей страницы шагами — проверяем каждую точку (пины, анимации). */
async function scrollThrough(page: Page, check: (y: number) => Promise<void>) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => innerHeight);
  for (let y = 0; y <= height; y += Math.round(vh * 0.6)) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(120);
    await check(y);
  }
}

test.describe('сквозной сценарий', () => {
  test('пять сцен в нужном порядке, один h1', async ({ page }) => {
    await page.goto('/');
    const ids = await page.locator('main > section, main > .pin-spacer > section').evaluateAll((els) =>
      els.map((e) => e.id),
    );
    expect(ids).toEqual(['top', 'film', 'print', 'equipment', 'faq', 'lead']);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('нет горизонтального переполнения и ошибок консоли в любой точке скролла', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await scrollThrough(page, async (y) => {
      expect(await overflowX(page), `переполнение на y=${y}`).toBeLessThanOrEqual(0);
    });
    expect(errors).toEqual([]);
  });

  test('сайт не запрашивает разрешения (камера и т.п.)', async ({ page, context }) => {
    const asked: string[] = [];
    await context.exposeFunction('__permAsked', (n: string) => asked.push(n));
    await page.addInitScript(() => {
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = (() => ((window as any).__permAsked('getUserMedia'), Promise.reject())) as any;
      const q = navigator.permissions?.query?.bind(navigator.permissions);
      if (q) navigator.permissions.query = ((d: PermissionDescriptor) => ((window as any).__permAsked(d.name), q(d))) as any;
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await scrollThrough(page, async () => {});
    expect(asked).toEqual([]);
  });

  test('быстрый скролл (End, якорь) приводит сцены в корректное состояние', async ({ page, isMobile }) => {
    test.skip(isMobile, 'клавиша End — десктопный сценарий');
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.keyboard.press('End');
    await page.waitForTimeout(800);
    // после печати снимок стоит в рамке, все шаги пройдены
    await expect(page.locator('.print__step').last()).toHaveClass(/is-active/);
    await page.keyboard.press('Home');
    await page.waitForTimeout(800);
    await expect(page.locator('.hero__portrait')).toBeVisible();
    await page.getByRole('link', { name: 'Получить предложение' }).first().click();
    await expect(page.locator('#lead')).toBeInViewport();
  });

  test('ресайз окна (десктоп ↔ мобильный) не ломает закрепления', async ({ page, isMobile }) => {
    test.skip(isMobile, 'меняем размер окна десктопного браузера');
    const errors = collectErrors(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    for (const size of [{ width: 375, height: 740 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(600);
      await expect(page.locator('.pin-spacer')).toHaveCount(2);
      await scrollThrough(page, async (y) => {
        expect(await overflowX(page), `переполнение на ${size.width}px, y=${y}`).toBeLessThanOrEqual(0);
      });
    }
    expect(errors).toEqual([]);
  });

  test('повторная прокрутка детерминирована', async ({ page, isMobile }) => {
    test.skip(isMobile, 'проверяем на десктопной ветке анимаций');
    await page.goto('/', { waitUntil: 'networkidle' });
    const spacer = page.locator('.pin-spacer:has([data-scene="print"])');
    const { top, h } = await spacer.evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: (el as HTMLElement).offsetHeight }));
    const mid = Math.round(top + (h - 900) * 0.5);
    const read = () =>
      page.locator('.print__sheet-wrap').evaluate((el) => getComputedStyle(el).transform + getComputedStyle(el).clipPath);
    await page.evaluate((y) => scrollTo(0, y), mid);
    await page.waitForTimeout(900);
    const first = await read();
    await page.evaluate((y) => scrollTo(0, y), top - 400);
    await page.waitForTimeout(600);
    await page.evaluate((y) => scrollTo(0, y), top + h);
    await page.waitForTimeout(600);
    await page.evaluate((y) => scrollTo(0, y), mid);
    await page.waitForTimeout(900);
    expect(await read()).toBe(first);
  });

  test('доступность: axe без серьёзных нарушений', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'networkidle' });
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });

  test('клавиатура: CTA и поля формы достижимы, фокус виден', async ({ page, isMobile, browserName }) => {
    test.skip(isMobile, 'клавиатурная навигация');
    test.skip(browserName === 'webkit', 'в WebKit Tab по умолчанию не переходит по ссылкам (настройка macOS)');
    await page.goto('/');
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el || el === document.body) return { id: 'body', outline: true };
        const cs = getComputedStyle(el);
        return { id: el.id || el.getAttribute('name') || el.textContent?.trim().slice(0, 30) || el.tagName, outline: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' };
      });
      seen.add(info.id);
      expect(info.outline, `видимый фокус у «${info.id}»`).toBe(true);
    }
    for (const id of ['lf-name', 'lf-contact', 'lf-comment', 'lf-consent']) expect([...seen]).toContain(id);
  });
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('все сцены статичны и полны: без пинов, без вспышки', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).not.toHaveClass(/motion/);
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await expect(page.locator('.flash')).toHaveCSS('opacity', '0');
    await expect(page.locator('.hero__portrait img')).toBeVisible();
    await expect(page.locator('.film__frame')).toHaveCount(8);
    await expect(page.locator('.variant')).toHaveCount(4);
    await expect(page.locator('.variant.is-selected')).toHaveCount(1);
    await expect(page.locator('.photo-frame__card img')).toBeVisible();
    await expect(page.locator('.print__step')).toHaveCount(4);
    await expect(page.locator('.model')).toHaveCount(1);
    await expect(page.locator('form[data-lead-form]')).toBeVisible();
  });
});

test.describe('анимации', () => {
  test('вспышка: один раз, портрет появляется', async ({ page }) => {
    await page.goto('/');
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      samples.push(Number(await page.locator('.flash').evaluate((el) => getComputedStyle(el).opacity)));
      await page.waitForTimeout(50);
    }
    await expect(page.locator('.hero__portrait')).toBeVisible();
    // не больше одного «пика» засветки и не выше 0.85
    const peaks = samples.filter((v, i) => v > 0.3 && (samples[i - 1] ?? 0) <= 0.3).length;
    expect(peaks).toBeLessThanOrEqual(1);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.85);
    await page.reload();
    await page.waitForTimeout(1500);
    // повтор в той же сессии — сразу финальное состояние
    expect(Number(await page.locator('.flash').evaluate((el) => getComputedStyle(el).opacity))).toBe(0);
    await expect(page.locator('.hero__portrait')).toBeVisible();
  });
});

test.describe('кнопка повтора вспышки', () => {
  test('проигрывает объектив → вспышку → портрет заново', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__portrait')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    // Пишем каждое изменение прозрачности вспышки прямо в странице: опрос по таймеру
    // на медленном CI может «проскочить» короткую (≤ 300 мс) вспышку.
    await page.evaluate(() => {
      const flash = document.querySelector<HTMLElement>('.flash')!;
      const w = window as unknown as { __flashPeak: number };
      w.__flashPeak = 0;
      const read = (style: string | null) => Number(/opacity:\s*([\d.]+)/.exec(style ?? '')?.[1] ?? 0);
      new MutationObserver((records) => {
        for (const r of records) w.__flashPeak = Math.max(w.__flashPeak, read(r.oldValue), read(flash.getAttribute('style')));
      }).observe(flash, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    });
    const btn = page.getByRole('button', { name: 'Повторить вспышку' });
    await btn.click();
    await expect(page.locator('.hero__lens')).toBeVisible();
    await expect(page.locator('.hero__portrait')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.hero__lens')).toBeHidden();
    const peak = await page.evaluate(() => (window as unknown as { __flashPeak: number }).__flashPeak);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(0.85);
  });

  test('не отображается при reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Повторить вспышку' })).toBeHidden();
  });
});

test.describe('форма заявки', () => {
  const fill = async (page: Page, contact = '@ivan_petrov') => {
    await page.locator('#lf-name').fill('Иван');
    await page.locator('#lf-contact').fill(contact);
    await page.locator('#lf-consent').check();
  };

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#lead');
  });

  test('валидация: ошибки у полей, фокус на первой ошибке, без запроса', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/lead', (r) => (requests++, r.continue()));
    await page.locator('#lf-contact').fill('abc');
    await page.getByRole('button', { name: 'Получить предложение' }).click();
    await expect(page.locator('#lf-name')).toBeFocused();
    await expect(page.locator('#lf-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#lf-contact-err')).toBeVisible();
    await expect(page.locator('#lf-consent-err')).toBeVisible();
    expect(requests).toBe(0);
  });

  test('успех — только после ответа сервера ok', async ({ page }) => {
    await page.route('**/api/lead', async (r) => {
      await new Promise((res) => setTimeout(res, 300));
      await r.fulfill({ json: { ok: true, code: 'ok' } });
    });
    await fill(page);
    await page.getByRole('button', { name: 'Получить предложение' }).click();
    await expect(page.locator('form[data-lead-form]')).toHaveAttribute('data-state', 'submitting');
    await expect(page.getByRole('button', { name: 'Получить предложение' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
    await expect(page.locator('form[data-lead-form]')).toBeHidden();
  });

  test('ошибка доставки: данные сохранены, предложен Telegram', async ({ page }) => {
    await page.route('**/api/lead', (r) => r.fulfill({ status: 502, json: { ok: false, code: 'delivery_failed' } }));
    await fill(page);
    await page.getByRole('button', { name: 'Получить предложение' }).click();
    await expect(page.locator('[data-status]')).toContainText('Не удалось отправить');
    await expect(page.locator('[data-status] a[href*="t.me"]')).toBeVisible();
    await expect(page.locator('[data-status] a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator('#lf-name')).toHaveValue('Иван');
    await expect(page.getByText('Заявка отправлена')).toBeHidden();
  });

  test('сетевая ошибка: без ложного успеха', async ({ page }) => {
    await page.route('**/api/lead', (r) => r.abort('failed'));
    await fill(page);
    await page.getByRole('button', { name: 'Получить предложение' }).click();
    await expect(page.locator('[data-status]')).toContainText('Не удалось связаться');
    await expect(page.getByText('Заявка отправлена')).toBeHidden();
  });

  test('реальный сервер без токенов: «приём заявок не настроен»', async ({ page }) => {
    await fill(page, '+7 900 123-45-67');
    await page.getByRole('button', { name: 'Получить предложение' }).click();
    await expect(page.locator('[data-status]')).toContainText('не настроен');
    await expect(page.getByText('Заявка отправлена')).toBeHidden();
  });

  test('«Обсудить покупку» подставляет модель в заявку', async ({ page }) => {
    await page.goto('/#equipment');
    await page.getByRole('link', { name: 'Обсудить покупку' }).click();
    await expect(page.locator('[data-model-chip]')).toBeVisible();
    await expect(page.locator('[data-model-chip] [data-model-name]')).toHaveText('Будка 1.0');
    await expect(page.locator('input[name="model"]')).toHaveValue('Будка 1.0');
    await expect(page.locator('#lead')).toBeInViewport();
  });
});

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('страница полна, форма отправляется нативно и получает честный ответ', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__portrait img')).toBeVisible();
    await expect(page.locator('.variant')).toHaveCount(4);
    await page.locator('#lf-name').fill('Иван');
    await page.locator('#lf-contact').fill('@ivan_petrov');
    await page.locator('#lf-consent').check();
    await page.getByRole('button', { name: 'Получить предложение' }).click();
    await expect(page.getByText('не настроен')).toBeVisible();
    await expect(page.getByRole('link', { name: /Вернуться/ })).toBeVisible();
  });
});

test.describe('FAQ', () => {
  test('раскрывается клавиатурой, открыт только один вопрос', async ({ page, isMobile, browserName }) => {
    test.skip(isMobile || browserName === 'webkit', 'клавиатура: десктопные Chrome/Firefox');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#faq');
    const items = page.locator('.faq__item');
    await items.nth(0).locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(items.nth(0)).toHaveAttribute('open', '');
    await expect(items.nth(0).locator('.faq__a')).toBeVisible();
    await items.nth(1).locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(items.nth(1)).toHaveAttribute('open', '');
    await expect(items.nth(0)).not.toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(items.nth(1)).not.toHaveAttribute('open', '');
  });

  test('JSON-LD FAQPage совпадает с видимыми вопросами', async ({ page }) => {
    await page.goto('/');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    const visible = (await page.locator('.faq__q > span:first-child').allTextContents()).map((t) => t.trim());
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible);
  });
});

test.describe('FAQ без JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('вопросы раскрываются', async ({ page }) => {
    await page.goto('/#faq');
    const first = page.locator('.faq__item').first();
    await first.locator('summary').click();
    await expect(first.locator('.faq__a')).toBeVisible();
  });
});

test.describe('карусель', () => {
  test('одна модель — без стрелок и индикатора', async ({ page }) => {
    await page.goto('/#equipment');
    await expect(page.locator('[data-carousel-prev], [data-carousel-next]')).toHaveCount(0);
    await expect(page.getByText('Стоимость по запросу')).toBeVisible();
  });
});
