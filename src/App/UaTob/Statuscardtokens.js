// Statuscardtokens.js — shared face indices for the rider StatusCard cycle.

export const FACE_BOOK      = 0; // BookRideCard — request a ride (multi-step)
export const FACE_SEARCHES  = 1; // SearchesCard — live demand around the city
export const FACE_SCHEDULED = 2; // ScheduledCard — rider's upcoming scheduled rides
export const FACE_NOTIFS    = 3; // NotificationsCard — push enable + alerts
export const FACE_ACCOUNT   = 4; // AccountCard — profile / rewards
export const FACE_TRIPS     = 5; // TripsCard — recent trip history
export const FACE_DOWNLOAD  = 6; // DownloadAppCard — PWA install prompt

export const FACE_COUNT = 7;

// Order the cycle visits faces in.
export const FACE_ORDER = [
  FACE_BOOK,
  FACE_SEARCHES,
  FACE_SCHEDULED,
  FACE_NOTIFS,
  FACE_ACCOUNT,
  FACE_TRIPS,
  FACE_DOWNLOAD,
];

// Auto-advance interval (ms). Book face pauses cycling while a flow is active.
export const FACE_CYCLE_MS = 6000;

// Per-face accent colors + short labels for the dot pagination / chrome.
export const FACE_META = {
  [FACE_BOOK]:      { key: 'book',      label: 'Book',     color: '#4ADE80' },
  [FACE_SEARCHES]:  { key: 'searches',  label: 'Live',     color: '#60A5FA' },
  [FACE_SCHEDULED]: { key: 'scheduled', label: 'Upcoming', color: '#C084FC' },
  [FACE_NOTIFS]:    { key: 'notifs',    label: 'Alerts',   color: '#34D399' },
  [FACE_ACCOUNT]:   { key: 'account',   label: 'Account',  color: '#FBBF24' },
  [FACE_TRIPS]:     { key: 'trips',     label: 'Trips',    color: '#F472B6' },
  [FACE_DOWNLOAD]:  { key: 'download',  label: 'Install',  color: '#22D3EE' },
};

// ── Shared style tokens (imported by face components) ────────────────────
export const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
export const COND = "'Barlow Condensed','Barlow',sans-serif";

export const C = {
  bg:          '#050A06',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  blue:        '#60A5FA',
  blueSoft:    '#93C5FD',
  violet:      '#C084FC',
  violetSoft:  '#A5B4FC',
  amber:       '#FBBF24',
  amberSoft:   '#FCD34D',
  pink:        '#F472B6',
  pinkSoft:    '#F9A8D4',
  red:         '#F87171',
  text:        'rgba(255,255,255,.92)',
  mid:         'rgba(255,255,255,.55)',
  dim:         'rgba(255,255,255,.32)',
  faint:       'rgba(255,255,255,.16)',
  line:        'rgba(255,255,255,.08)',
};