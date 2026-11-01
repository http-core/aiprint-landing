/**
 * Карусель моделей без зависимостей: scroll-snap + кнопки + свайп (нативный)
 * + стрелки клавиатуры + live region. Без автопрокрутки.
 */
export function initCarousels() {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(initCarousel);
  initModelPicker();
}

function initCarousel(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('[data-carousel-track]')!;
  const slides = [...root.querySelectorAll<HTMLElement>('[data-carousel-slide]')];
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const current = root.querySelector<HTMLElement>('[data-carousel-current]');
  const live = root.querySelector<HTMLElement>('[data-carousel-live]');
  if (slides.length < 2) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;

  const render = (announce: boolean) => {
    slides.forEach((s, i) => {
      s.inert = i !== index;
    });
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === slides.length - 1;
    if (current) current.textContent = String(index + 1).padStart(2, '0');
    if (announce && live) live.textContent = slides[index]!.getAttribute('aria-label') ?? '';
  };

  const go = (i: number) => {
    const target = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: target * track.clientWidth, behavior: reduce.matches ? 'auto' : 'smooth' });
  };

  let raf = 0;
  track.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== index) {
          index = i;
          render(true);
        }
      });
    },
    { passive: true },
  );

  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));

  root.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });

  addEventListener('resize', () => track.scrollTo({ left: index * track.clientWidth }));
  render(false);
}

/** «Обсудить покупку» — подставляет модель в форму заявки и ведёт к ней. */
function initModelPicker() {
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-pick-model]');
    if (!link) return;
    const model = link.dataset.pickModel ?? '';
    document.dispatchEvent(new CustomEvent('lead:model', { detail: model }));
    const form = document.getElementById('lead');
    if (!form) return;
    e.preventDefault();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#lead');
    document.querySelector<HTMLInputElement>('#lf-name')?.focus({ preventScroll: true });
  });
}
