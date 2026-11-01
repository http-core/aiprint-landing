import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import { initFilm } from './scenes/film';
import { initHero } from './scenes/hero';
import { initPrint } from './scenes/print';

export interface MotionEnv {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof ScrollTriggerType;
  /** ≥768px: полные закреплённые сцены и микродвижения кадров */
  desktop: boolean;
  /** ≥900px: сцена печати в две колонки (закрепляется вся секция) */
  wide: boolean;
}

declare global {
  interface Window {
    __motionReady?: boolean;
  }
}

function safe<T>(scene: string, init: () => T): T | undefined {
  try {
    return init();
  } catch (e) {
    console.error(`[motion] сцена «${scene}» не запустилась:`, e);
    return undefined;
  }
}

export async function initMotion() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  window.__motionReady = true;

  const html = document.documentElement;
  const mm = gsap.matchMedia();

  mm.add(
    {
      // колбэк вызывается, только если совпало хоть одно условие — 'all' совпадает всегда
      any: 'all',
      desktop: '(min-width: 768px)',
      wide: '(min-width: 900px)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (ctx) => {
      const { desktop = false, wide = false, reduce = false } = ctx.conditions ?? {};
      // Режим уменьшенного движения: статичные финальные версии сцен (spec: scroll-story)
      html.classList.toggle('motion', !reduce);
      if (reduce) return;

      const env: MotionEnv = { gsap, ScrollTrigger, desktop, wide };
      // Порядок важен: плёнка создаётся раньше, hero ссылается на её ScrollTrigger.
      // Каждая сцена изолирована: ошибка в одной не ломает остальные.
      const film = safe('film', () => initFilm(env));
      const cleanups = [safe('hero', () => initHero(env, film?.trigger)), safe('print', () => initPrint(env))];
      return () => cleanups.forEach((fn) => fn?.());
    },
  );

  // Шрифты могли изменить высоту блоков — пересчитываем позиции триггеров.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
