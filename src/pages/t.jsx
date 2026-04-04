import { useState, useEffect } from "react";

/* \u2500\u2500\u2500 DATA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const stats = {
  totalRides: 1284, activeRides: 7,
  totalRevenue: 24860.50, platformRevenue: 6215.13, driverPayouts: 18645.37,
  activeDrivers: 43, totalDrivers: 118, totalRiders: 892,
  avgRating: 4.83, completionRate: 96.4,
};

const liveRides = [
  { id: "R-7821", rider: "Marcus T.", driver: "Deon Williams", status: "in_progress", tier: "Standard", fare: 14.50, pickup: "Downtown Orlando", dropoff: "OIA Airport", eta: "12 min" },
  { id: "R-7820", rider: "Sofia L.", driver: "Priya Nair", status: "enroute", tier: "Premium", fare: 28.00, pickup: "Dr. Phillips", dropoff: "Universal Studios", eta: "4 min" },
  { id: "R-7819", rider: "James K.", driver: "Carlos Mendez", status: "arrived", tier: "Economy", fare: 9.25, pickup: "Thornton Park", dropoff: "Lake Nona", eta: "0 min" },
  { id: "R-7818", rider: "Aisha R.", driver: "Brandon Lee", status: "in_progress", tier: "XL", fare: 42.00, pickup: "SeaWorld", dropoff: "Windermere", eta: "18 min" },
  { id: "R-7817", rider: "Owen P.", driver: "Fatima Diallo", status: "enroute", tier: "Economy", fare: 11.75, pickup: "Audubon Park", dropoff: "Mills 50", eta: "6 min" },
  { id: "R-7816", rider: "Nina C.", driver: "Tyrone Grant", status: "in_progress", tier: "Standard", fare: 17.00, pickup: "Baldwin Park", dropoff: "UCF Campus", eta: "9 min" },
  { id: "R-7815", rider: "Liam S.", driver: "Amara Osei", status: "arrived", tier: "Premium", fare: 31.50, pickup: "Celebration", dropoff: "I-Drive", eta: "0 min" },
];

const recentTrips = [
  { id: "R-7814", rider: "Emma D.", driver: "Deon W.", tier: "Standard", fare: 13.25, platform: 3.31, payout: 9.94, status: "completed", time: "2m ago", rating: 5 },
  { id: "R-7813", rider: "Noah B.", driver: "Priya N.", tier: "Economy", fare: 8.50, platform: 2.13, payout: 6.37, status: "completed", time: "8m ago", rating: 4 },
  { id: "R-7812", rider: "Chloe M.", driver: "Carlos M.", tier: "Premium", fare: 34.00, platform: 8.50, payout: 25.50, status: "completed", time: "15m ago", rating: 5 },
  { id: "R-7811", rider: "Ethan F.", driver: "Brandon L.", tier: "XL", fare: 47.25, platform: 11.81, payout: 35.44, status: "completed", time: "22m ago", rating: 5 },
  { id: "R-7810", rider: "Ava W.", driver: "Fatima D.", tier: "Economy", fare: 7.75, platform: 1.94, payout: 5.81, status: "cancelled", time: "31m ago", rating: null },
  { id: "R-7809", rider: "Lucas H.", driver: "Tyrone G.", tier: "Standard", fare: 19.50, platform: 4.88, payout: 14.62, status: "completed", time: "45m ago", rating: 4 },
  { id: "R-7808", rider: "Mia T.", driver: "Amara O.", tier: "Premium", fare: 26.00, platform: 6.50, payout: 19.50, status: "completed", time: "1h ago", rating: 5 },
];

const topDrivers = [
  { name: "Deon Williams", trips: 184, earnings: 2840, rating: 4.97, tier: "Premium", status: "online" },
  { name: "Priya Nair", trips: 167, earnings: 2610, rating: 4.95, tier: "Standard", status: "online" },
  { name: "Carlos Mendez", trips: 153, earnings: 2480, rating: 4.92, tier: "XL", status: "busy" },
  { name: "Brandon Lee", trips: 141, earnings: 2190, rating: 4.89, tier: "Economy", status: "online" },
  { name: "Fatima Diallo", trips: 138, earnings: 2050, rating: 4.91, tier: "Standard", status: "offline" },
  { name: "Tyrone Grant", trips: 129, earnings: 1960, rating: 4.88, tier: "Economy", status: "online" },
  { name: "Amara Osei", trips: 122, earnings: 1840, rating: 4.86, tier: "Premium", status: "busy" },
];

const weekly = [
  { day: "M", rides: 142, revenue: 2890 },
  { day: "T", rides: 168, revenue: 3240 },
  { day: "W", rides: 185, revenue: 3710 },
  { day: "T", rides: 159, revenue: 3180 },
  { day: "F", rides: 214, revenue: 4260 },
  { day: "S", rides: 241, revenue: 4820 },
  { day: "S", rides: 175, revenue: 3560 },
];

const tierColors = { Economy: "#0ea5e9", Standard: "#10b981", Premium: "#8b5cf6", XL: "#f97316" };
const tierBg    = { Economy: "#e0f2fe", Standard: "#d1fae5", Premium: "#ede9fe", XL: "#ffedd5" };

const statusCfg = {
  enroute:     { label: "En Route",    color: "#0284c7", bg: "#e0f2fe" },
  arrived:     { label: "Arrived",     color: "#b45309", bg: "#fef3c7" },
  in_progress: { label: "In Progress", color: "#059669", bg: "#d1fae5" },
  completed:   { label: "Completed",   color: "#6b7280", bg: "#f3f4f6" },
  cancelled:   { label: "Cancelled",   color: "#dc2626", bg: "#fee2e2" },
};

/* \u2500\u2500\u2500 HELPERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const fmt = n => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = name => name.split(" ").map(w => w[0]).join("");

/* \u2500\u2500\u2500 STYLES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Instrument+Mono:wght@300;400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

:root {
  --bg: #f5f3ef;
  --white: #ffffff;
  --border: #e8e4de;
  --border-strong: #d4cec6;
  --text: #1a1714;
  --text-2: #57534e;
  --text-3: #a8a29e;
  --coral: #f4521e;
  --coral-light: #fff0eb;
  --coral-mid: #fdd5c8;
  --green: #059669;
  --green-light: #d1fae5;
  --blue: #0284c7;
  --blue-light: #e0f2fe;
  --amber: #d97706;
  --amber-light: #fef3c7;
  --red: #dc2626;
  --red-light: #fee2e2;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.1);
  --radius: 16px;
  --radius-sm: 10px;
  --font: 'Bricolage Grotesque', sans-serif;
  --mono: 'Instrument Mono', monospace;
}

html, body { background: var(--bg); min-height: 100vh; }

.app {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  font-family: var(--font);
  color: var(--text);
  position: relative;
}

/* TOP BAR */
.topbar {
  background: var(--white);
  padding: 52px 20px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text);
}

.logo span { color: var(--coral); }

.topbar-right { display: flex; align-items: center; gap: 10px; }

.city-pill {
  background: var(--coral-light);
  color: var(--coral);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--coral-mid);
}

.notif-btn {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--bg);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  cursor: pointer;
  position: relative;
}

.notif-dot {
  position: absolute;
  top: 5px; right: 5px;
  width: 7px; height: 7px;
  background: var(--coral);
  border-radius: 50%;
  border: 1.5px solid var(--white);
}

/* SCROLL AREA */
.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 100px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

/* SECTION LABEL */
.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: -4px;
  padding: 0 2px;
}

/* HERO CARD */
.hero-card {
  background: var(--coral);
  border-radius: var(--radius);
  padding: 22px 20px;
  color: white;
  position: relative;
  overflow: hidden;
}

.hero-card::before {
  content: '';
  position: absolute;
  top: -40px; right: -40px;
  width: 160px; height: 160px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
}

.hero-card::after {
  content: '';
  position: absolute;
  bottom: -30px; left: 60px;
  width: 120px; height: 120px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
}

.hero-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 6px;
}

.hero-value {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -1.5px;
  line-height: 1;
}

.hero-sub {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 6px;
}

.hero-row {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  position: relative;
  z-index: 1;
}

.hero-chip {
  flex: 1;
  background: rgba(255,255,255,0.15);
  border-radius: 10px;
  padding: 10px 12px;
  backdrop-filter: blur(10px);
}

.hero-chip-val {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.hero-chip-label {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 1px;
  letter-spacing: 0.3px;
}

/* STAT GRID */
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-card {
  background: var(--white);
  border-radius: var(--radius-sm);
  padding: 16px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  margin-bottom: 10px;
}

.stat-val {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.8px;
  line-height: 1;
}

.stat-lbl {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
}

.stat-delta {
  font-size: 10px;
  font-weight: 700;
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.stat-delta.up { color: var(--green); }
.stat-delta.nt { color: var(--text-3); }

/* CHART CARD */
.chart-card {
  background: var(--white);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card-header {
  padding: 16px 18px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  letter-spacing: 0.3px;
}

.badge-coral { background: var(--coral-light); color: var(--coral); }
.badge-green { background: var(--green-light); color: var(--green); }
.badge-blue  { background: var(--blue-light);  color: var(--blue); }
.badge-amber { background: var(--amber-light); color: var(--amber); }
.badge-gray  { background: #f3f4f6; color: #6b7280; }

/* BAR CHART */
.bar-chart {
  padding: 0 18px 16px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
  justify-content: flex-end;
}

.bar-fill {
  width: 100%;
  border-radius: 5px 5px 0 0;
  background: linear-gradient(to top, var(--coral), #f97316);
  transition: height 0.9s cubic-bezier(0.4,0,0.2,1);
  min-height: 4px;
}

.bar-fill.today {
  background: linear-gradient(to top, #f4521e, #fb923c);
  box-shadow: 0 -2px 8px rgba(244,82,30,0.3);
}

.bar-day {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 600;
}

/* SPLIT CARD */
.split-card {
  background: var(--white);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}

.split-track {
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  gap: 2px;
  margin: 14px 0 16px;
}

.split-seg {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.split-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.split-box {
  border-radius: 10px;
  padding: 14px;
}

.split-box-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 6px;
  opacity: 0.6;
}

.split-box-amt {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.split-box-pct { font-size: 11px; margin-top: 2px; opacity: 0.6; }

/* LIVE RIDES */
.live-card {
  background: var(--white);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.live-count {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--green);
}

.pulse-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:0.5; transform:scale(0.75); }
}

.ride-item {
  padding: 13px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.ride-item:last-child { border-bottom: none; }

.ride-avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.ride-info { flex: 1; min-width: 0; }

.ride-names {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ride-route {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--mono);
}

.ride-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.status-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.ride-fare {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.ride-eta {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--mono);
}

/* TIER TAG */
.tier-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
}

/* TRIPS LIST */
.trip-item {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.trip-item:last-child { border-bottom: none; }

.trip-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.trip-info { flex: 1; min-width: 0; }

.trip-id {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--coral);
}

.trip-names {
  font-size: 12px;
  font-weight: 600;
  margin-top: 1px;
}

.trip-meta {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.trip-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.trip-fare {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.trip-split {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--mono);
}

.stars { color: #f59e0b; font-size: 10px; letter-spacing: -1px; }

/* DRIVER ITEM */
.driver-item {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.driver-item:last-child { border-bottom: none; }

.driver-rank {
  font-size: 16px;
  font-weight: 800;
  width: 22px;
  text-align: center;
  color: var(--text-3);
  flex-shrink: 0;
}

.driver-rank.gold { color: #f59e0b; }
.driver-rank.silver { color: #94a3b8; }
.driver-rank.bronze { color: #cd7c4c; }

.driver-avatar {
  width: 38px; height: 38px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  font-weight: 800;
  background: var(--bg);
  border: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
}

.status-ring {
  position: absolute;
  bottom: -1px; right: -1px;
  width: 10px; height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--white);
}

.status-ring.online  { background: var(--green); }
.status-ring.busy    { background: var(--amber); }
.status-ring.offline { background: var(--text-3); }

.driver-info { flex: 1; min-width: 0; }

.driver-name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.driver-meta {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.driver-right { text-align: right; flex-shrink: 0; }

.driver-earn {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--green);
}

.driver-trips {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
}

/* BOTTOM NAV */
.bottom-nav {
  position: fixed;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  background: var(--white);
  border-top: 1px solid var(--border);
  display: flex;
  padding: 8px 0 20px;
  z-index: 200;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 0;
  transition: transform 0.1s;
}

.nav-tab:active { transform: scale(0.93); }

.nav-icon-wrap {
  width: 36px; height: 36px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
  transition: background 0.15s;
}

.nav-tab.active .nav-icon-wrap {
  background: var(--coral-light);
}

.nav-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--text-3);
  transition: color 0.15s;
}

.nav-tab.active .nav-label { color: var(--coral); }

.show-more {
  margin: 4px 18px 0;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  cursor: pointer;
}
`;

/* \u2500\u2500\u2500 SUB-COMPONENTS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const StatusPill = ({ status }) => {
  const c = statusCfg[status] || statusCfg.completed;
  return <span className="status-pill" style={{ color: c.color, background: c.bg }}