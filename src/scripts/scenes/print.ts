import type { MotionEnv } from '../motion';
import { offsetWithin } from './dom';

/**
 * Сцена 3: снимок выезжает из прорези, наклоняется и встаёт в рамку на полочке.
 * Шаги процесса подсвечиваются синхронно с фазой (spec: print-scene).
 */
export function initPrint({ gsap, desktop, wide }: MotionEnv) {
  const root = document.querySelector<HTMLElement>('[data-scene="print"]');
  if (!root) return;
  // Широкий экран — закрепляется вся секция; узкий — только блок с анимацией.
  const pinEl = wide ? root : root.querySelector<HTMLElement>('.print__pin')!;
  const sheet = root.querySelector<HTMLElement>('.print__sheet-wrap')!;
  const glow = root.querySelector('.print__slot span');
  const target = root.querySelector<HTMLElement>('.photo-frame__card')!;
  const steps = [...root.querySelectorAll<HTMLElement>('.print__step')];
  const now = root.querySelector<HTMLElement>('[data-print-now]');

  // Геометрия без учёта transform: центр снимка (полностью выехавшего) и центр отпечатка в рамке.
  const geo = () => {
    const s = offsetWithin(sheet, pinEl);
    const t = offsetWithin(target, pinEl);
    return {
      dx: t.x + target.offsetWidth / 2 - (s.x + sheet.offsetWidth / 2),
      dy: t.y + target.offsetHeight / 2 - (s.y + sheet.offsetHeight / 2),
      scale: target.offsetWidth / sheet.offsetWidth,
    };
  };

  let active = -1;
  let tl: gsap.core.Timeline | undefined;
  const syncSteps = () => {
    if (!tl) return;
    const p = tl.progress();
    const i = p < 0.12 ? 0 : p < 0.22 ? 1 : p < 0.66 ? 2 : 3;
    if (i === active) return;
    active = i;
    steps.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-done', k < i);
    });
    if (now) now.textContent = `${i + 1}/${steps.length} · ${steps[i]?.dataset.stepText ?? ''}`;
  };

  tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: syncSteps,
    scrollTrigger: {
      trigger: pinEl,
      start: 'top top',
      end: () => `+=${innerHeight * (desktop ? 1.6 : 0.8)}`,
      pin: pinEl,
      scrub: 0.4,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  tl.to(glow, { opacity: 1, duration: 1 }, 0.5)
    .fromTo(
      sheet,
      { yPercent: -100, clipPath: 'inset(100% 0% 0% 0%)' },
      { yPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 4, ease: 'power1.inOut' },
      1.5,
    )
    .to(glow, { opacity: 0, duration: 0.5 }, 5.5)
    .to(sheet, { rotation: -5, y: 14, scale: 1.03, duration: 1, ease: 'power1.out' }, 5.5)
    .to(
      sheet,
      {
        x: () => geo().dx,
        y: () => geo().dy,
        scale: () => geo().scale,
        rotation: 0,
        duration: 3,
        ease: 'power2.inOut',
      },
      6.6,
    )
    .to({}, { duration: 0.4 });

  syncSteps();

  return () => {
    steps.forEach((s) => s.classList.remove('is-active', 'is-done'));
    if (now) now.textContent = '';
  };
}
