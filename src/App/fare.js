import {
  PRICING, MIN_FARE, AVG_SPEED_MPH,
  MAP_MILES_WIDTH, MAP_MILES_HEIGHT,
  TRAFFIC_CONDITIONS, ROAD_TYPES,
} from '@/App/pricing.js';

export function calcMiles(x1, y1, x2, y2) {
  const dx = ((x2 - x1) / 100) * MAP_MILES_WIDTH;
  const dy = ((y2 - y1) / 100) * MAP_MILES_HEIGHT;
  return Math.sqrt(dx * dx + dy * dy);
}



export function calcFare(rideType, miles, surge = 1.0) {
  const p = PRICING[rideType];
  const mins = (miles / AVG_SPEED_MPH) * 60;
  const raw = p.base + p.perMile * miles + p.perMin * mins + p.bookingFee;
  const total = Math.max(MIN_FARE[rideType], raw * surge);
  return {
    total: +total.toFixed(2),
    miles: +miles.toFixed(1),
    durationMin: Math.round(mins),
    breakdown: {
      base: +p.base.toFixed(2),
      distance: +(p.perMile * miles).toFixed(2),
      time: +(p.perMin * mins).toFixed(2),
      bookingFee: +p.bookingFee.toFixed(2),
      surge: surge > 1 ? +((raw * surge) - raw).toFixed(2) : 0,
    },
  };
}

export function getSurge() {
  const r = Math.random();
  if (r < 0.55) return 1.0;
  if (r < 0.75) return 1.2;
  if (r < 0.88) return 1.4;
  if (r < 0.95) return 1.7;
  return 2.1;
}

function generateMidpoints() {
  const allStreets = [
    '5th Ave', 'Broadway', 'Park Ave', 'Lexington Ave', 'W 34th St',
    'E 42nd St', 'Houston St', 'Canal St', 'Atlantic Ave', 'Flatbush Ave',
    'Queens Blvd', 'Northern Blvd',
  ];
  const count = 1 + Math.floor(Math.random() * 2);
  return [...allStreets].sort(() => 0.5 - Math.random()).slice(0, count);
}

export function generateTripData(pickupName, dropoffName, baseMiles) {
  const windingFactor = 1.15 + Math.random() * 0.35;
  const actualMiles = +(baseMiles * windingFactor).toFixed(1);
  const actualKm    = +(actualMiles * 1.60934).toFixed(1);
  const trafficIdx  = Math.floor(Math.random() * 3);
  const traffic     = TRAFFIC_CONDITIONS[trafficIdx];
  const trafficDelay = traffic.delayMin + Math.floor(Math.random() * (traffic.delayMax - traffic.delayMin + 1));
  const baseDriveMin = Math.round((actualMiles / AVG_SPEED_MPH) * 60);
  const totalMin     = baseDriveMin + trafficDelay;
  const roadType     = ROAD_TYPES[Math.floor(Math.random() * ROAD_TYPES.length)];
  const stopLights   = Math.floor(actualMiles * 2.5 + Math.random() * 4);
  const turns        = Math.floor(actualMiles * 1.8 + Math.random() * 3);
  const co2Saved     = +(actualMiles * 0.404).toFixed(2);
  const now          = new Date();
  now.setMinutes(now.getMinutes() + totalMin);
  const arrivalTime  = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const midpoints    = generateMidpoints();
  return {
    actualMiles, actualKm, baseDriveMin, totalMin, trafficDelay,
    traffic, roadType, stopLights, turns, co2Saved, arrivalTime, midpoints,
  };
}
