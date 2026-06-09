// ─── Design tokens ──────────────────────────────────────────────────────────
export const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  panel:       'rgba(5,10,6,.78)',
  panelSolid:  '#070D08',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  violet:      '#C084FC',
  cyan:        '#67E8F9',
  red:         '#F87171',
  line:        'rgba(34,197,94,.25)',
  lineSoft:    'rgba(34,197,94,.14)',
  inkText:     'rgba(255,255,255,.42)',
  inkTextDim:  'rgba(255,255,255,.22)',
  inkTextFade: 'rgba(255,255,255,.10)',
};

export const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
export const COND = "'Barlow Condensed','Barlow',sans-serif";

// ─── Face index constants ────────────────────────────────────────────────────
export const FACE_BOOK      = 0;
export const FACE_SEARCHES  = 1;
export const FACE_SCHEDULED = 2;
export const FACE_NOTIFS    = 3;
export const FACE_COUNT     = 4;
export const FACE_ACCOUNT   = 4;
export const FACE_TRIPS     = 5;

export const FACES = [
  { label: 'Book',      color: C.greenBright },
  { label: 'Searches',  color: C.cyan        },
  { label: 'Scheduled', color: C.violet      },
  { label: 'Alerts',    color: C.amberBright },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}

export function formatCountdown(ms) {
  if (!ms || ms <= 0) return 'DUE';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function fmtSchedTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

export function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}