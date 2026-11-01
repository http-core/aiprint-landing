import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { MotionEnv } from '../motion';
import { offsetWithin } from './dom';

const KEY = 'aiprint:flash-played';

const wasPlayed = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const markPlayed = () => {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* приватный режим — вспышка просто может повториться при перезагрузке */
  }
};

/**
 * Сцена 1: объектив → блик → одна вспышка → портрет.
 * Затем портрет «падает» в первый кадр плёнки (склейка со сценой 2).
 */
export function initHero({ gsap }: MotionEnv, filmTrigger?: ScrollTrigger) {
  const root = document.querySelector<HTMLElement>('[data-scene="hero"]');
  if (!root) return;
  const lens = root.querySelector<HTMLElement>('.hero__lens')!;
  const portrait = root.querySelector<HTMLElement>('.hero__portrait')!;
  const img = portrait.querySelector('img');
  const glare = root.querySelector('#lens-glare');
  const flash = document.querySelector<HTMLElement>('.flash');
  const firstImg = document.querySelector<HTMLElement>('[data-scene="film"] .film__frame:first-child .film__photo img');

  let handedOff = false;
  let revealed = false;

  const reveal = () => {
    revealed = true;
    gsap.set(lens, { autoAlpha: 0 });
    if (!handedOff) gsap.set(portrait, { autoAlpha: 1 });
  };

  // ---------- Вспышка: автоматически — один раз за сессию, повторно — по кнопке ----------
  const tl = gsap
    .timeline({ paused: true, onComplete: markPlayed })
    .to(lens, { scale: 1.07, duration: 0.7, ease: 'power2.out' }, 0)
    .fromTo(glare, { attr: { x: -260 } }, { attr: { x: 480 }, duration: 0.55, ease: 'power1.inOut' }, 0.12)
    // ≤ 300 мс, один перепад яркости, непрозрачность ≤ 0.85 (spec: hero-flash)
    .to(flash, { opacity: 0.85, duration: 0.06, ease: 'none' }, 0.72)
    .call(reveal)
    .to(flash, { opacity: 0, duration: 0.22, ease: 'power1.out' })
    .fromTo(
      img,
      { filter: 'brightness(1.7) saturate(0.6)', scale: 1.035 },
      { filter: 'brightness(1) saturate(1)', scale: 1, duration: 0.9, ease: 'power2.out', clearProps: 'filter' },
      '<',
    );

  const showLens = () => {
    revealed = false;
    gsap.set(lens, { autoAlpha: 1, scale: 1 });
    gsap.set(portrait, { autoAlpha: 0 });
  };

  let offTriggers = () => {};

  if (wasPlayed() || scrollY > innerHeight * 0.3) {
    reveal();
    markPlayed();
  } else {
    showLens();
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'] as const;
    const start = () => {
      offTriggers();
      if (tl.progress() === 0) tl.play();
    };
    const timer = setTimeout(start, 1200);
    offTriggers = () => {
      clearTimeout(timer);
      events.forEach((ev) => removeEventListener(ev, start));
    };
    events.forEach((ev) => addEventListener(ev, start, { passive: true }));
  }

  // Кнопка «повторить»: объектив → блик → вспышка → портрет, по явному действию посетителя.
  const replayBtn = root.querySelector<HTMLButtonElement>('[data-hero-replay]');
  const replay = () => {
    if (tl.isActive() || handedOff) return;
    offTriggers();
    showLens();
    tl.restart();
  };
  replayBtn?.addEventListener('click', replay);

  // ---------- Склейка: портрет → первый кадр плёнки ----------
  const swap = (toFilm: boolean) => {
    handedOff = toFilm;
    if (toFilm) {
      gsap.set(portrait, { autoAlpha: 0 });
      if (firstImg) gsap.set(firstImg, { opacity: 1 });
    } else {
      if (firstImg) gsap.set(firstImg, { opacity: 0 });
      if (!revealed) tl.progress(1);
      reveal();
    }
  };

  if (filmTrigger && firstImg) {
    const photo = firstImg.closest<HTMLElement>('.film__photo')!;
    const filmRoot = filmTrigger.trigger as HTMLElement;
    // Центр кадра в окне в момент закрепления плёнки и центр портрета в документе.
    const frameCenter = () => offsetWithin(photo, filmRoot).y + photo.offsetHeight / 2;
    const portraitCenter = () => offsetWithin(portrait, null).y + portrait.offsetHeight / 2;

    const caption = portrait.querySelector('figcaption');

    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 0,
          end: () => filmTrigger.start,
          scrub: true,
          invalidateOnRefresh: true,
          onLeave: () => swap(true),
          onEnterBack: () => swap(false),
          onRefresh: (self) => {
            if (self.progress >= 1 !== handedOff) swap(self.progress >= 1);
          },
        },
      })
      .to(portrait, { y: () => frameCenter() - portraitCenter() + filmTrigger.start, duration: 1 }, 0)
      // подпись кадра не должна «ехать» поверх плёнки
      .to([caption, replayBtn], { autoAlpha: 0, duration: 0.25 }, 0);
  }

  return () => {
    offTriggers();
    replayBtn?.removeEventListener('click', replay);
    tl.kill();
  };
}
