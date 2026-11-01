/** Смещение элемента относительно предка по цепочке offsetParent (без учёта transform). */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement | null) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

export const viewportWidth = () => document.documentElement.clientWidth;
