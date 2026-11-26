/**
 * The game's own icon set: chunky shapes with a 3px plum outline and a two-tone fill, so every icon
 * matches the lettering and the gel buttons. No emoji, no glyph fonts.
 */
const O = '#2a1b4a';

const wrap = (body: string, vb = 48) =>
  `<svg viewBox="0 0 ${vb} ${vb}" width="100%" height="100%" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

export const ICONS = {
  /** upward chevrons over a little pedestal: upgrades */
  upgrade: wrap(
    `<path d="M10 40h28v-6H10z" fill="#ffb020" stroke="${O}" stroke-width="3"/>` +
      `<path d="M24 6 39 21h-8v10H17V21H9z" fill="#5ce27a" stroke="${O}" stroke-width="3"/>` +
      `<path d="M24 11 33 20" stroke="#c6ffd2" stroke-width="3" fill="none"/>`,
  ),
  /** shopping bag with a gem: gem shop */
  shop: wrap(
    `<path d="M17 16a7 7 0 0 1 14 0" fill="none" stroke="${O}" stroke-width="3.5"/>` +
      `<path d="M8 16h32l-3 25H11z" fill="#ff79b4" stroke="${O}" stroke-width="3"/>` +
      `<path d="M24 22l6 6-6 8-6-8z" fill="#6ff0ff" stroke="${O}" stroke-width="2.5"/>`,
  ),
  gear: wrap(
    `<path d="M24 5l4 5 6-2 1 6 6 2-2 6 5 4-5 4 2 6-6 2-1 6-6-2-4 5-4-5-6 2-1-6-6-2 2-6-5-4 5-4-2-6 6-2 1-6 6 2z" fill="#9fd7ff" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="24" cy="24" r="6" fill="#3a2560" stroke="${O}" stroke-width="3"/>`,
  ),
  close: wrap(`<path d="M13 13l22 22M35 13 13 35" stroke="${O}" stroke-width="10"/><path d="M13 13l22 22M35 13 13 35" stroke="#fff" stroke-width="4.5"/>`),
  sound: wrap(
    `<path d="M8 19h8l10-9v28l-10-9H8z" fill="#ffd23f" stroke="${O}" stroke-width="3"/>` +
      `<path d="M32 17c4 4 4 10 0 14M36 12c7 7 7 17 0 24" fill="none" stroke="${O}" stroke-width="3.5"/>`,
  ),
  music: wrap(
    `<path d="M18 34V12l20-5v22" fill="none" stroke="${O}" stroke-width="4"/>` +
      `<ellipse cx="13" cy="35" rx="6" ry="5" fill="#ff79b4" stroke="${O}" stroke-width="3"/>` +
      `<ellipse cx="33" cy="30" rx="6" ry="5" fill="#ff79b4" stroke="${O}" stroke-width="3"/>`,
  ),
  chest: wrap(
    `<path d="M7 20h34v20H7z" fill="#e48e4c" stroke="${O}" stroke-width="3"/>` +
      `<path d="M7 20c0-9 6-13 17-13s17 4 17 13z" fill="#ff8a2b" stroke="${O}" stroke-width="3"/>` +
      `<path d="M7 24h34" stroke="#ffd23f" stroke-width="4"/><rect x="20" y="20" width="8" height="10" rx="2" fill="#ffd23f" stroke="${O}" stroke-width="2.5"/>`,
  ),
  lock: wrap(
    `<path d="M16 22v-6a8 8 0 0 1 16 0v6" fill="none" stroke="${O}" stroke-width="4"/>` +
      `<rect x="11" y="21" width="26" height="20" rx="5" fill="#ffb020" stroke="${O}" stroke-width="3"/>`,
  ),
  check: wrap(`<path d="M11 25l9 9 17-19" fill="none" stroke="${O}" stroke-width="10"/><path d="M11 25l9 9 17-19" fill="none" stroke="#5ce27a" stroke-width="5"/>`),
  arrow: wrap(`<path d="M8 24h26M24 12l12 12-12 12" fill="none" stroke="${O}" stroke-width="10"/><path d="M8 24h26M24 12l12 12-12 12" fill="none" stroke="#fff" stroke-width="4.5"/>`),
  play: wrap(`<path d="M15 9.5 39 24 15 38.5z" fill="#fff" stroke="${O}" stroke-width="4"/>`),
  /** a plump two-tone heart with a shine: a happy guest */
  heart: wrap(
    `<path d="M24 41C11 32 5 25 5 17a9.5 9.5 0 0 1 19-3 9.5 9.5 0 0 1 19 3c0 8-6 15-19 24z" fill="#ff4f7b" stroke="${O}" stroke-width="3.5"/>` +
      `<path d="M24 37c-9-6.5-14-12-15.5-17" fill="none" stroke="#c92557" stroke-width="3" opacity="0.55"/>` +
      `<ellipse cx="14" cy="16" rx="3.6" ry="2.4" transform="rotate(-35 14 16)" fill="#fff" opacity="0.85"/>`,
  ),
  /** clipboard with two ticked lines: daily quests */
  quest: wrap(
    `<rect x="9" y="8" width="30" height="35" rx="5" fill="#fff4dc" stroke="${O}" stroke-width="3"/>` +
      `<rect x="17" y="4" width="14" height="8" rx="3" fill="#ff8a2b" stroke="${O}" stroke-width="3"/>` +
      `<path d="M15 21l3 3 5-6M15 32l3 3 5-6" fill="none" stroke="#2fb85a" stroke-width="3.5"/>` +
      `<path d="M27 22h7M27 33h7" stroke="${O}" stroke-width="3.5"/>`,
  ),
  back: wrap(`<path d="M40 24H14M24 12 12 24l12 12" fill="none" stroke="${O}" stroke-width="10"/><path d="M40 24H14M24 12 12 24l12 12" fill="none" stroke="#fff" stroke-width="4.5"/>`),
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = 'ico'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = ICONS[name];
  return s;
}
