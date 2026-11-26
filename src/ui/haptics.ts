import type { Impact } from '../game/world';

/** Vibration lengths (ms) per moment; patterns are buzz, pause, buzz. */
const PATTERN: Record<Impact, number | number[]> = { light: 8, medium: 18, big: [26, 50, 34] };

/**
 * A short buzz where the device has one (Android browsers and the Android app; iPhone browsers have no
 * vibration API, so there it does nothing). Never throws: a refused vibration just means no buzz.
 */
export function haptic(kind: Impact): void {
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch (e) {
    console.warn('vibration refused', e);
  }
}

