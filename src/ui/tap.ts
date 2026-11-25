/**
 * Tap handler for game buttons. iOS web views inside an iframe do not always turn a touch into a click,
 * so a tap fires on pointerup over the same element, and the click that may follow it (sometimes late,
 * on a busy frame) is swallowed. A click with no pointer before it (keyboard Enter or Space) still works.
 */
const SLOP = 14;

export function onTap(el: HTMLElement, fn: () => void): void {
  let id: number | null = null;
  let sx = 0;
  let sy = 0;
  let swallowClick = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    swallowClick = false;
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    id = null;
    // a drag that ends on the button is not a tap; its click, if any, is swallowed too
    swallowClick = true;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > SLOP) return;
    fn();
  });
  el.addEventListener('pointercancel', () => (id = null));
  el.addEventListener('click', () => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    fn();
  });
}
