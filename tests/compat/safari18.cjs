/*
 * Проверка в WebKit 18 (≈ Safari 18 на macOS/iOS). Основные e2e идут на свежем WebKit,
 * а реальные пользователи сидят и на Safari 18: именно там падал gsap.quickSetter('scale').
 * Запуск: npm run build && npm start (в другом окне), затем npm run test:safari18
 * Браузер (один раз): npm --prefix tests/compat ci && npx --prefix tests/compat playwright install webkit
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4321/';
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  for (const [name, ctxOpts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone', devices['iPhone 13']], ['narrow', { viewport: { width: 700, height: 800 } }]]) {
    const ctx = await b.newContext(ctxOpts);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    // повтор вспышки
    await p.getByRole('button', { name: 'Повторить вспышку' }).click();
    await p.waitForTimeout(150);
    const lensDuring = await p.evaluate(() => getComputedStyle(document.querySelector('.hero__lens')).opacity);
    await p.waitForTimeout(2000);
    const portraitAfter = await p.evaluate(() => getComputedStyle(document.querySelector('.hero__portrait')).visibility);
    // плёнка и печать
    const g = await p.evaluate(() => {
      const sp = (s) => { const el = document.querySelector(s).closest('.pin-spacer'); return el ? { top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight } : null; };
      return { film: sp('[data-scene=film]'), print: sp(innerWidth >= 900 ? '[data-scene=print]' : '[data-scene=print] .print__pin'), vh: innerHeight };
    });
    const at = async (y) => { await p.evaluate((y) => scrollTo(0, y), Math.round(y)); await p.waitForTimeout(700); };
    await at(g.film.top + (g.film.h - g.vh) * 0.4);
    const stripX = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.film__strip')).transform).m41);
    await at(g.film.top + (g.film.h - g.vh) * 0.999);
    const selVisible = await p.evaluate(() => getComputedStyle(document.querySelector('.variant__badge')).opacity);
    await at(g.print.top + (g.print.h - g.vh) * 0.45);
    const clipMid = await p.evaluate(() => getComputedStyle(document.querySelector('.print__sheet-wrap')).clipPath);
    await at(g.print.top + (g.print.h - g.vh));
    const step = await p.evaluate(() => document.querySelector('.print__step.is-active')?.dataset.step);
    
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const ok = lensDuring === '1' && portraitAfter === 'visible' && stripX < 0 && selVisible === '1' && step === '3' && ov <= 0 && errs.length === 0;
    console.log(ok ? '✓' : '✘', name, { lensDuring, portraitAfter, stripX: Math.round(stripX), selVisible, clipMid, step, overflow: ov, errs });
    if (!ok) process.exitCode = 1;
    await ctx.close();
  }
  await b.close();
})();
