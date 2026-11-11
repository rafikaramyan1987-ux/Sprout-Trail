/** Inline SVG icons (drawn for this game). */

const svg = (body: string, vb = '0 0 64 64') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  heart: svg('<path d="M32 56 C10 40 4 28 8 18 C12 8 26 6 32 17 C38 6 52 8 56 18 C60 28 54 40 32 56Z" fill="#ff5d73" stroke="#a8243c" stroke-width="4" stroke-linejoin="round"/><ellipse cx="20" cy="20" rx="6" ry="4" fill="#ffd0d8" transform="rotate(-30 20 20)"/>'),
  heartEmpty: svg('<path d="M32 56 C10 40 4 28 8 18 C12 8 26 6 32 17 C38 6 52 8 56 18 C60 28 54 40 32 56Z" fill="rgba(60,40,30,.35)" stroke="#6a4a3a" stroke-width="4" stroke-linejoin="round"/>'),
  acorn: svg('<path d="M18 30 C18 46 26 56 32 58 C38 56 46 46 46 30Z" fill="#ffc83d" stroke="#9a5a00" stroke-width="3.5"/><path d="M12 30 C12 18 22 12 32 12 C42 12 52 18 52 30Z" fill="#c58a2a" stroke="#6a3c00" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 12 C32 8 34 5 38 4" stroke="#6a3c00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="25" cy="38" rx="3" ry="6" fill="#fff0a8"/>'),
  acornEmpty: svg('<path d="M18 30 C18 46 26 56 32 58 C38 56 46 46 46 30Z" fill="rgba(60,40,30,.3)" stroke="#6a4a3a" stroke-width="3.5"/><path d="M12 30 C12 18 22 12 32 12 C42 12 52 18 52 30Z" fill="rgba(60,40,30,.4)" stroke="#6a4a3a" stroke-width="3.5" stroke-linejoin="round"/>'),
  gem: svg('<path d="M32 4 L52 26 L32 60 L12 26Z" fill="#5fd8ff" stroke="#1676a8" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 4 L40 26 L32 60 L24 26Z" fill="#9ff0ff"/><path d="M12 26 H52" stroke="#1676a8" stroke-width="2.5"/>'),
  seed: svg('<path d="M32 8 C46 18 50 34 44 48 C40 56 24 56 20 48 C14 34 18 18 32 8Z" fill="#d79a52" stroke="#7a4a1c" stroke-width="3.5"/><path d="M32 14 C30 26 30 38 32 50" stroke="#a86a2c" stroke-width="3" fill="none"/><path d="M32 8 C30 2 38 0 42 3 C38 4 34 6 32 8Z" fill="#6cc04a" stroke="#2f7a1c" stroke-width="2"/>'),
  pause: svg('<rect x="17" y="13" width="11" height="38" rx="4" fill="#fff"/><rect x="36" y="13" width="11" height="38" rx="4" fill="#fff"/>'),
  play: svg('<path d="M20 12 L52 32 L20 52Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>'),
  retry: svg('<path d="M48 22 A20 20 0 1 0 52 36" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M40 8 L52 22 L36 26Z" fill="#fff"/>'),
  home: svg('<path d="M10 30 L32 10 L54 30" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 30 V52 H46 V30" fill="#fff"/>'),
  gear: svg('<circle cx="32" cy="32" r="10" fill="none" stroke="#fff" stroke-width="7"/><path d="M32 6V14M32 50V58M6 32H14M50 32H58M13.6 13.6L19.3 19.3M44.7 44.7L50.4 50.4M13.6 50.4L19.3 44.7M44.7 19.3L50.4 13.6" stroke="#fff" stroke-width="7" stroke-linecap="round"/>'),
  map: svg('<path d="M8 14 L24 8 L40 14 L56 8 V50 L40 56 L24 50 L8 56Z" fill="#fff"/><path d="M24 8V50M40 14V56" stroke="#7a4a1c" stroke-width="3"/>'),
  calendar: svg('<rect x="8" y="12" width="48" height="44" rx="7" fill="#fff"/><rect x="8" y="12" width="48" height="12" rx="6" fill="#ffd1a0"/><circle cx="24" cy="38" r="4" fill="#7a4a1c"/><circle cx="40" cy="38" r="4" fill="#7a4a1c"/>'),
  music: svg('<path d="M24 46 V14 L50 8 V40" stroke="#fff" stroke-width="6" fill="none" stroke-linejoin="round"/><circle cx="18" cy="46" r="8" fill="#fff"/><circle cx="44" cy="40" r="8" fill="#fff"/>'),
  sound: svg('<path d="M10 24 H22 L36 12 V52 L22 40 H10Z" fill="#fff"/><path d="M44 22 C50 28 50 36 44 42M50 16 C60 26 60 38 50 48" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>'),
  lock: svg('<rect x="14" y="28" width="36" height="28" rx="6" fill="#fff"/><path d="M22 28 V20 A10 10 0 0 1 42 20 V28" stroke="#fff" stroke-width="6" fill="none"/>'),
  star: svg('<path d="M32 4 L40 24 L61 24 L44 37 L50 58 L32 45 L14 58 L20 37 L3 24 L24 24Z" fill="#ffd54a" stroke="#b07a00" stroke-width="3" stroke-linejoin="round"/>'),
  starEmpty: svg('<path d="M32 4 L40 24 L61 24 L44 37 L50 58 L32 45 L14 58 L20 37 L3 24 L24 24Z" fill="rgba(80,60,40,.25)" stroke="#8a6a4a" stroke-width="3" stroke-linejoin="round"/>'),
  tv: svg('<rect x="6" y="16" width="52" height="38" rx="7" fill="#fff"/><path d="M22 6 L32 16 L42 6" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M27 26 L41 35 L27 44Z" fill="#e0672f"/>'),
  close: svg('<path d="M16 16 L48 48 M48 16 L16 48" stroke="#fff" stroke-width="8" stroke-linecap="round"/>'),
};

/** big plant pictures for the seed cards */
export const PLANT_ART: Record<string, string> = {
  bridge: svg(
    '<path d="M4 70 H36 V96 H4Z" fill="#9a6a43"/><path d="M84 70 H116 V96 H84Z" fill="#9a6a43"/><path d="M4 66 H36 M84 66 H116" stroke="#7cc95a" stroke-width="8" stroke-linecap="round"/><path d="M36 80 Q60 92 84 80" stroke="#5ab0e0" stroke-width="10" fill="none" opacity=".7"/>' +
      '<g fill="#c99662" stroke="#7a4a1c" stroke-width="2.5">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${22 + i * 10}" y="${62 + Math.sin((i / 7) * Math.PI) * 4}" width="8" height="8" rx="2"/>`).join('') +
      '</g><path d="M24 46 Q60 58 96 46" stroke="#3f9a37" stroke-width="5" fill="none"/><path d="M24 46 V64 M96 46 V64" stroke="#7a4a1c" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M44 52 l-5 -6 l7 1z M70 54 l5 -6 l-7 1z" fill="#5cb840"/>',
    '0 0 120 100',
  ),
  vine: svg(
    '<rect x="70" y="10" width="40" height="86" rx="4" fill="#9c9184"/><path d="M70 10 H110" stroke="#7cc95a" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M50 96 C44 76 56 60 50 40 C46 26 54 16 52 8" stroke="#3f9a37" stroke-width="6" fill="none"/><path d="M64 96 C58 76 70 60 64 40 C60 26 68 16 66 8" stroke="#3f9a37" stroke-width="6" fill="none"/>' +
      '<g stroke="#6b8f2f" stroke-width="5" stroke-linecap="round">' +
      [0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${50 + (i % 2)} ${88 - i * 12} H${64 + (i % 2)}"/>`).join('') +
      '</g><g fill="#79cf4f">' +
      [0, 1, 2, 3, 4].map((i) => `<path d="M${i % 2 ? 66 : 48} ${80 - i * 16} q${i % 2 ? 12 : -12} -4 ${i % 2 ? 14 : -14} -12 q${i % 2 ? -10 : 10} 0 ${i % 2 ? -14 : 14} 12z"/>`).join('') +
      '</g><circle cx="58" cy="10" r="5" fill="none" stroke="#79cf4f" stroke-width="4"/>',
    '0 0 120 100',
  ),
  mushroom: svg(
    '<path d="M48 92 C46 76 48 62 52 54 H68 C72 62 74 76 72 92Z" fill="#f6ead2" stroke="#b89a70" stroke-width="3"/>' +
      '<path d="M16 58 C16 26 38 12 60 12 C82 12 104 26 104 58 C90 64 30 64 16 58Z" fill="#ff6b6b" stroke="#a8243c" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<g fill="#fff8ec"><ellipse cx="44" cy="30" rx="8" ry="6"/><ellipse cx="72" cy="26" rx="9" ry="6"/><ellipse cx="88" cy="44" rx="6" ry="5"/><ellipse cx="30" cy="48" rx="6" ry="4"/><ellipse cx="60" cy="46" rx="6" ry="4"/></g>' +
      '<path d="M60 4 v-0 M38 6 l-4 -4 M82 6 l4 -4" stroke="#ffd54a" stroke-width="4" stroke-linecap="round"/><path d="M40 96 q10 -8 20 -2 q10 -6 20 2" stroke="#5cb840" stroke-width="5" fill="none" stroke-linecap="round"/>',
    '0 0 120 100',
  ),
  tree: svg('<rect x="52" y="50" width="16" height="46" fill="#8b5a35"/><circle cx="60" cy="38" r="30" fill="#5cb840"/><circle cx="46" cy="30" r="14" fill="#7bd05a"/>', '0 0 120 100'),
  leaf: svg('<path d="M20 70 C30 20 90 10 104 24 C96 60 50 86 20 70Z" fill="#6cc04a" stroke="#2f7a1c" stroke-width="3.5"/><path d="M20 70 C50 52 76 38 104 24" stroke="#2f7a1c" stroke-width="3" fill="none"/>', '0 0 120 100'),
  log: svg('<rect x="14" y="44" width="92" height="28" rx="14" fill="#8b5a35" stroke="#5a3a20" stroke-width="3"/><ellipse cx="100" cy="58" rx="8" ry="14" fill="#d9a86c" stroke="#5a3a20" stroke-width="3"/>', '0 0 120 100'),
};
