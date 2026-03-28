// src/App/pricing.js

export const PRICING = {
  economy: {
    base: 1.00,
    perMile: 0.55,
    perMin: 0.10,
    bookingFee: 0.99,
    color: "#16A34A",
  },

  standard: {
    base: 1.50,
    perMile: 0.75,
    perMin: 0.14,
    bookingFee: 1.25,
    color: "#2563EB",
  },

  premium: {
    base: 2.50,
    perMile: 1.20,
    perMin: 0.22,
    bookingFee: 1.75,
    color: "#7C3AED",
  },

  xl: {
    base: 2.00,
    perMile: 0.95,
    perMin: 0.18,
    bookingFee: 1.50,
    color: "#D97706",
  },
};

export const MIN_FARE = {
  economy: 3.99,
  standard: 4.99,
  premium: 7.99,
  xl: 6.49,
};

export const AVG_SPEED_MPH = 22;
export const MAP_MILES_WIDTH = 4.0;
export const MAP_MILES_HEIGHT = 3.2;

export const RIDE_TYPES = [
  {
    id: 'economy',
    label: 'Economy',
    capacity: '4',
    eta: '3 min',
    desc: 'Lowest fare',
  },
  {
    id: 'standard',
    label: 'Standard',
    capacity: '4',
    eta: '2 min',
    desc: 'Affordable comfort',
  },
  {
    id: 'premium',
    label: 'Premium',
    capacity: '4',
    eta: '5 min',
    desc: 'Luxury ride',
  },
  {
    id: 'xl',
    label: 'XL',
    capacity: '6',
    eta: '4 min',
    desc: 'More seats',
  },
];

export const PAYMENT_METHODS = [
  {
    id: 'card',
    label: 'Credit or Debit Card',
    sub: 'Secure encrypted payment',
    activeClass: 'ac',
    color: '#16A34A',
  },
  {
    id: 'cashapp',
    label: 'Cash App',
    sub: 'Pay instantly via $Cashtag',
    activeClass: 'aca',
    color: '#00D632',
  },
];

export const TRAFFIC_CONDITIONS = [
  { label: 'Light', color: '#16A34A', delayMin: 0, delayMax: 2 },
  { label: 'Moderate', color: '#D97706', delayMin: 3, delayMax: 8 },
  { label: 'Heavy', color: '#DC2626', delayMin: 9, delayMax: 20 },
];

export const ROAD_TYPES = [
  'Highway',
  'City Streets',
  'Mixed Route',
  'Express Lane',
  'Local Roads',
];

export const THEME = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',
  surfaceAlt2: '#F3F4F6',
  border: '#E5E7EB',
  text: '#111827',
  textMid: '#4B5563',
  textMuted: '#9CA3AF',
  accent: '#16A34A',
  accentLight: 'rgba(22,163,74,.1)',
  accentBorder: 'rgba(22,163,74,.22)',
  accentDark: '#15803D',
  ink: '#111827',
  inkLight: '#374151',
  cashapp: '#00D632',
};