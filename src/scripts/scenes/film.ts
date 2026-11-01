import type { MotionEnv } from '../motion';
import { viewportWidth } from './dom';

/** Базовые наклоны кадров, ±3° (spec: style-filmstrip). */
const TILT = [-2, 2.2, -1.6, 2.8, -2.4, 1.4, -2.8, 1.8];

/**
 * Сцена 2: плёнка движется только от скролла, затем — сетка из 4 вариантов,
 * один из которых отмечается как выбранный.
 */
export function initFilm({ gsap, desktop }: MotionEnv) {
  const root = document.querySelector<HTMLElement>('[data-scene="film"]');
  if (!root) return null;
  const strip = root.querySelector<HTMLElement>('.film__strip')!;
  const frames = [...strip.children] as HTMLElement[];
  const figs = frames.map((f) => f.querySelector<HTMLElement>('.film__fig')!);
  const head = root.querySelector('.film__head');
  const lead = root.querySelector('.film__lead');
  const variants = root.querySelector<HTMLElement>('.variants')!;
  const vTitle = variants.querySelector('.variants__title');
  const cells = [...variants.querySelectorAll<HTMLElement>('.variant')];
  const selected = variants.querySelector<HTMLElement>('.variant.is-selected');
  const selectedPhoto = selected?.querySelector('.variant__photo');
  const badge = selected?.querySelector('.variant__badge');
  const others = cells.filter((c) => c !== selected);
  const last = frames.length - 1;

  const center = (f: HTMLElement) => f.offsetLeft + f.offsetWidth / 2;
  const xAt = (i: number) => viewportWidth() / 2 - center(frames[i]!);
  // Длина закрепления: на мобильных — не больше половины десктопной.
  const distance = () =>
    innerHeight * Math.min(frames.length * (desktop ? 0.4 : 0.15) + (desktop ? 0.8 : 0.4), desktop ? 3 : 1.4);

  // Кадр у центра выпрямляется, дальние — слегка наклонены и уменьшены (≤6%).
  const wobble = () => {
    if (!desktop) return;
    const x = Number(gsap.getProperty(strip, 'x'));
    const mid = viewportWidth() / 2;
    const w = frames[0]!.offsetWidth;
    frames.forEach((f, i) => {
      const d = Math.min(Math.abs(x + center(f) - mid) / w, 1);
      // gsap.set, а не quickSetter: quickSetter(…, 'scale') в Safari 18 падает
      // с InvalidCharacterError (пытается выставить атрибут «scaleX,scaleY»).
      gsap.set(figs[i]!, { rotation: TILT[i % TILT.length]! * d, scale: 1 - 0.06 * d, y: (i % 2 ? 10 : -10) * d });
    });
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: wobble,
    scrollTrigger: {
      trigger: root,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 0.4,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: wobble,
    },
  });

  tl.fromTo(strip, { x: () => xAt(0) }, { x: () => xAt(last), duration: 7 })
    .to([strip, head, lead], { autoAlpha: 0, y: -24, duration: 0.8 }, 7)
    .set(variants, { autoAlpha: 1 }, 7.3)
    .fromTo(vTitle, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 7.4)
    .fromTo(cells, { autoAlpha: 0, y: 48, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.15 }, 7.5)
    .to(others, { opacity: 0.35, scale: 0.97, duration: 0.6 }, 8.9)
    .fromTo(
      selectedPhoto ?? [],
      { scale: 1, outlineColor: 'rgba(200, 240, 74, 0)' },
      { scale: 1.04, outlineColor: 'rgba(200, 240, 74, 1)', duration: 0.6 },
      8.9,
    )
    .fromTo(badge ?? [], { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.4 }, 9.1)
    .to({}, { duration: 0.6 });

  return { trigger: tl.scrollTrigger! };
}
