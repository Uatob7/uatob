import {
  PRICING,
  MIN_FARE,
  AVG_SPEED_MPH,
  MAP_MILES_WIDTH,
  MAP_MILES_HEIGHT,
  TRAFFIC_CONDITIONS,
  ROAD_TYPES,
} from '@/App/pricing.js';

// ─────────────────────────────────────────────────────────────
// Distance helper (only if you still use your fake map somewhere)
// ─────────────────────────────────────────────────────────────
export function calcMiles(x1, y1, x2, y2) {
  const dx = ((x2 - x1) / 100) * MAP_MILES_WIDTH;
  const dy = ((y2 - y1) / 100) * MAP_MILES_HEIGHT;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─────────────────────────────────────────────────────────────
// Fare calculator
// Uses REAL miles + REAL duration from backend
// ─────────────────────────────────────────────────────────────
export function calcFare(rideType, miles, surge = 1.0, durationMin = null) {
  const p = PRICING[rideType];

  if (!p) {
    throw new Error(`Invalid ride type: ${rideType}`);
  }

  const safeMiles = Number.isFinite(miles) ? miles : 0;

  // If backend didn't give duration, estimate it
  const mins =
    Number.isFinite(durationMin) && durationMin > 0
      ? durationMin
      : (safeMiles / AVG_SPEED_MPH) * 60;

  const raw =
    p.base +
    p.perMile * safeMiles +
    p.perMin * mins +
    p.bookingFee;

  const surged = raw * surge;
  const total = Math.max(MIN_FARE[rideType], surged);

  return {
    total: +total.toFixed(2),
    miles: +safeMiles.toFixed(1),
    durationMin: Math.round(mins),
    breakdown: {
      base: +p.base.toFixed(2),
      distance: +(p.perMile * safeMiles).toFixed(2),
      time: +(p.perMin * mins).toFixed(2),
      bookingFee: +p.bookingFee.toFixed(2),
      surge: surge > 1 ? +(surged - raw).toFixed(2) : 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Surge generator
// ─────────────────────────────────────────────────────────────
export function getSurge() {
  const r = Math.random();

  if (r < 0.60) return 1.0;
  if (r < 0.80) return 1.1;
  if (r < 0.92) return 1.25;
  if (r < 0.98) return 1.5;
  return 1.75;
}

// ─────────────────────────────────────────────────────────────
// Fake route detail helpers (visual only)
// ─────────────────────────────────────────────────────────────
function generateMidpoints() {
  const allStreets = [
    '5th Ave',
    'Broadway',
    'Park Ave',
    'Lexington Ave',
    'W 34th St',
    'E 42nd St',
    'Houston St',
    'Canal St',
    'Atlantic Ave',
    'Flatbush Ave',
    'Queens Blvd',
    'Northern Blvd',
  ];

  const count = 1 + Math.floor(Math.random() * 2);

  return [...allStreets]
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
}

// ─────────────────────────────────────────────────────────────
// Trip data generator
// Uses REAL backend miles + REAL backend duration
// ─────────────────────────────────────────────────────────────
export function generateTripData(
  pickupName,
  dropoffName,
  miles,
  durationMin = null
) {
  const safeMiles = Number.isFinite(miles) ? miles : 0;

  // If backend doesn't provide duration, estimate it
  const baseDriveMin =
    Number.isFinite(durationMin) && durationMin > 0
      ? Math.round(durationMin)
      : Math.round((safeMiles / AVG_SPEED_MPH) * 60);

  const actualMiles = +safeMiles.toFixed(1);
  const actualKm = +(actualMiles * 1.60934).toFixed(1);

  // Light visual traffic simulation only
  const trafficIdx = Math.floor(Math.random() * TRAFFIC_CONDITIONS.length);
  const traffic = TRAFFIC_CONDITIONS[trafficIdx];

  const trafficDelay =
    traffic.delayMin +
    Math.floor(Math.random() * (traffic.delayMax - traffic.delayMin + 1));

  // If backend gave real duration, use it as final trip time
  // Otherwise add traffic delay
  const totalMin =
    Number.isFinite(durationMin) && durationMin > 0
      ? Math.round(durationMin)
      : baseDriveMin + trafficDelay;

  const roadType =
    ROAD_TYPES[Math.floor(Math.random() * ROAD_TYPES.length)];

  const stopLights = Math.max(
    1,
    Math.floor(actualMiles * 2.2 + Math.random() * 4)
  );

  const turns = Math.max(
    1,
    Math.floor(actualMiles * 1.5 + Math.random() * 3)
  );

  const co2Saved = +(actualMiles * 0.404).toFixed(2);

  const arrival = new Date();
  arrival.setMinutes(arrival.getMinutes() + totalMin);

  const arrivalTime = arrival.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const midpoints = generateMidpoints();

  return {
    pickupName,
    dropoffName,

    actualMiles,
    actualKm,

    baseDriveMin,
    totalMin,
    trafficDelay,

    traffic,
    roadType,
    stopLights,
    turns,
    co2Saved,
    arrivalTime,
    midpoints,
  };
}