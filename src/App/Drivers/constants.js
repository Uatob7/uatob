export const TRIP_REQUESTS = [
  { id: 1, rider: "Alex K.",  rating: 4.8, pickup: "Terminal 2, Airport",  dropoff: "Downtown Hilton",  distance: "12.4 km", fare: "$18.50", eta: "4 min", surgeMultiplier: 1.4, rideType: "premium"  },
  { id: 2, rider: "Maria S.", rating: 4.9, pickup: "Central Park West",    dropoff: "Brooklyn Bridge",  distance: "8.1 km",  fare: "$11.20", eta: "2 min", surgeMultiplier: 1.0, rideType: "standard" },
  { id: 3, rider: "James T.", rating: 4.6, pickup: "Union Square",         dropoff: "JFK Airport",      distance: "22.7 km", fare: "$34.00", eta: "6 min", surgeMultiplier: 1.2, rideType: "xl"       },
];

export const EARNINGS_DATA = [
  { day: "Mon", amount: 87  },
  { day: "Tue", amount: 124 },
  { day: "Wed", amount: 98  },
  { day: "Thu", amount: 145 },
  { day: "Fri", amount: 210 },
  { day: "Sat", amount: 189 },
  { day: "Sun", amount: 76  },
];

export const RECENT_TRIPS = [
  { id: "t1", rider: "Sarah M.", from: "West Village",   to: "Midtown",         fare: "$14.20", time: "11:42 AM", rating: 5, type: "standard" },
  { id: "t2", rider: "John D.",  from: "SoHo",           to: "Upper East Side", fare: "$19.80", time: "10:15 AM", rating: 5, type: "premium"  },
  { id: "t3", rider: "Lisa K.",  from: "Grand Central",  to: "LaGuardia",       fare: "$38.50", time: "9:00 AM",  rating: 4, type: "xl"       },
  { id: "t4", rider: "Tom H.",   from: "Columbia Univ.", to: "Times Square",    fare: "$12.60", time: "8:20 AM",  rating: 5, type: "standard" },
];

export const TYPE_COLOR = { economy: "#059669", standard: "#2563EB", premium: "#7C3AED", xl: "#D97706" };
export const TYPE_LABEL = { economy: "ECO",     standard: "STD",     premium: "PRE",     xl: "XL"      };

/** Design tokens — white/black base, green when online */
export const C = {
  bg:           "#FAFAFA",
  surface:      "#FFFFFF",
  surfaceWarm:  "#F9FAFB",
  surfaceAlt:   "#F3F4F6",
  border:       "#E5E7EB",
  borderStrong: "#D1D5DB",
  onlineGreen:  "#16A34A",
  onlineLight:  "#22C55E",
  onlinePale:   "#F0FDF4",
  onlineBorder: "rgba(22,163,74,.25)",
  offlineInk:   "#111827",
  offlineAlt:   "#374151",
  text:         "#111827",
  textMid:      "#6B7280",
  textDim:      "#9CA3AF",
  red:          "#DC2626",
  blue:         "#2563EB",
  green:        "#059669",
  purple:       "#7C3AED",
  amber:        "#D97706",
  shadow:       "rgba(0,0,0,.05)",
  shadowMd:     "rgba(0,0,0,.09)",
};

/** Returns the four dynamic accent values derived from online state */
export function getAccent(online) {
  return {
    A:  online ? C.onlineGreen  : C.offlineInk,
    AL: online ? C.onlineLight  : C.offlineAlt,
    AP: online ? C.onlinePale   : C.surfaceAlt,
    AB: online ? C.onlineBorder : "rgba(17,24,39,.18)",
  };
}