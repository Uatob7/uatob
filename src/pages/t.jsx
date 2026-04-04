import { useState, useEffect } from "react";

/* ─── DATA ─────────────────────────────────────────────────── */
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

const tierColors = { Economy: "#0284c7", Standard: "#059669", Premium: "#7c3aed", XL: "#ea580c" };
const tierBg    = { Economy: "#e0f2fe", Standard: "#d1fae5", Premium: "#ede9fe", XL: "#ffedd5" };

const statusCfg = {
  enroute:     { label: "En Route",    color: "#0284c7", bg: "#e0f2fe" },
  arrived:     { label: "Arrived",     color: "#b45309", bg: "#fef3c7" },
  in_progress: { label: "In Progress", color: "#059669", bg: "#dcfce7" },
  completed:   { label: "Completed",   color: "#6b7280", bg: "#f3f4f6" },
  cancelled:   { label: "Cancelled",   color: "#dc2626", bg: "#fee2e2" },
};

const fmt = n => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = name => name.split(" ").map(w => w[0]).join("");

/* ─── STYLES ───────────────────────────────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Instrument+Mono:ital,wght@0,300;0,400&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}

:root{
  --bg:#f5f3ef;
  --white:#ffffff;
  --border:#e5e1db;
  --text:#18120e;
  --text2:#6b6460;
  --text3:#b0a9a4;
  --coral:#f4521e;
  --coral-l:#fff2ed;
  --coral-m:#fdd5c4;
  --green:#059669;
  --green-l:#dcfce7;
  --blue:#0284c7;
  --blue-l:#e0f2fe;
  --amber:#b45309;
  --amber-l:#fef3c7;
  --red:#dc2626;
  --red-l:#fee2e2;
  --font:'Bricolage Grotesque',sans-serif;
  --mono:'Instrument Mono',monospace;
  --r:14px;
  --rs:10px;
}

html,body{background:var(--bg);min-height:100vh;}

.app{
  max-width:430px;
  margin:0 auto;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  background:var(--bg);
  font-family:var(--font);
  color:var(--text);
}

/* TOPBAR */
.topbar{
  background:var(--white);
  padding:48px 18px 14px;
  border-bottom:1px solid var(--border);
  display:flex;
  align-items:center;
  justify-content:space-between;
  position:sticky;
  top:0;z-index:100;
}
.logo{font-size:21px;font-weight:800;letter-spacing:-.5px;}
.logo span{color:var(--coral);}
.topbar-r{display:flex;align-items:center;gap:8px;}
.city{background:var(--coral-l);color:var(--coral);font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid var(--coral-m);}
.bell{width:32px;height:32px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;position:relative;}
.bell-dot{position:absolute;top:4px;right:4px;width:7px;height:7px;background:var(--coral);border-radius:50%;border:1.5px solid var(--white);}

/* SCROLL */
.scroll{flex:1;overflow-y:auto;padding:14px 14px 96px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch;}

/* HERO */
.hero{
  background:var(--coral);
  border-radius:var(--r);
  padding:20px 18px;
  color:#fff;
  position:relative;
  overflow:hidden;
}
.hero::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.07);}
.hero::after{content:'';position:absolute;bottom:-40px;left:40px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.04);}
.hero-lbl{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:.65;margin-bottom:4px;}
.hero-val{font-size:36px;font-weight:800;letter-spacing:-1.5px;line-height:1;position:relative;z-index:1;}
.hero-sub{font-size:11px;opacity:.6;margin-top:4px;}
.hero-chips{display:flex;gap:8px;margin-top:16px;position:relative;z-index:1;}
.chip{flex:1;background:rgba(255,255,255,.14);border-radius:10px;padding:10px 10px;backdrop-filter:blur(8px);}
.chip-val{font-size:15px;font-weight:800;letter-spacing:-.3px;}
.chip-lbl{font-size:9px;opacity:.65;margin-top:1px;letter-spacing:.3px;}

/* STAT GRID */
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.stat-card{background:var(--white);border-radius:var(--rs);padding:14px;border:1px solid var(--border);}
.stat-ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:8px;}
.stat-num{font-size:21px;font-weight:800;letter-spacing:-.8px;line-height:1;}
.stat-name{font-size:11px;color:var(--text2);margin-top:3px;}
.stat-chg{font-size:10px;font-weight:700;margin-top:4px;}
.up{color:var(--green);}
.nt{color:var(--text3);}

/* CARD */
.card{background:var(--white);border-radius:var(--r);border:1px solid var(--border);overflow:hidden;}
.card-hd{padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;}
.card-ttl{font-size:14px;font-weight:700;letter-spacing:-.2px;}

/* BADGE */
.bdg{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;}
.bdg-coral{background:var(--coral-l);color:var(--coral);}
.bdg-green{background:var(--green-l);color:var(--green);}
.bdg-blue{background:var(--blue-l);color:var(--blue);}
.bdg-amber{background:var(--amber-l);color:var(--amber);}

/* BAR CHART */
.bars{padding:0 16px 14px;display:flex;align-items:flex-end;gap:5px;height:110px;}
.bc{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end;}
.bf{width:100%;border-radius:4px 4px 0 0;background:linear-gradient(to top,var(--coral),#fb7c52);transition:height .9s cubic-bezier(.4,0,.2,1);min-height:3px;}
.bf.hi{background:linear-gradient(to top,#d43e0e,var(--coral));box-shadow:0 -2px 10px rgba(244,82,30,.25);}
.bd{font-size:10px;color:var(--text3);font-weight:600;}
.bar-vals{padding:0 16px 12px;display:flex;}
.bv{flex:1;text-align:center;font-size:10px;font-weight:700;}

/* SPLIT */
.split{padding:16px;}
.split-track{height:7px;border-radius:4px;overflow:hidden;display:flex;gap:2px;margin:12px 0 14px;}
.split-seg{height:100%;border-radius:4px;}
.split-2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.split-box{border-radius:10px;padding:13px;}
.sb-lbl{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.55;margin-bottom:5px;}
.sb-amt{font-size:17px;font-weight:800;letter-spacing:-.4px;}
.sb-pct{font-size:10px;opacity:.55;margin-top:2px;}

/* LIVE COUNT */
.live-ct{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--green);}
.pdot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 1.5s infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.7);}}

/* RIDE ROW */
.ride{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
.ride:last-child{border-bottom:none;}
.rav{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;}
.ri{flex:1;min-width:0;}
.rnames{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rroute{font-size:10px;color:var(--text2);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--mono);}
.rtags{display:flex;align-items:center;gap:4px;margin-top:4px;}
.rr{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;}
.rfare{font-size:13px;font-weight:800;letter-spacing:-.3px;}
.reta{font-size:10px;color:var(--text3);font-family:var(--mono);}

/* STATUS PILL */
.spill{font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap;}

/* TIER TAG */
.ttag{display:inline-flex;align-items:center;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}

/* TRIP ROW */
.trip{padding:13px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
.trip:last-child{border-bottom:none;}
.tico{width:34px;height:34px;border-radius:9px;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.tinfo{flex:1;min-width:0;}
.tid{font-size:10px;font-weight:700;font-family:var(--mono);color:var(--coral);}
.tnames{font-size:12px;font-weight:600;margin-top:1px;}
.tmeta{font-size:10px;color:var(--text3);margin-top:2px;display:flex;align-items:center;gap:5px;}
.tr{text-align:right;flex-shrink:0;}
.tfare{font-size:13px;font-weight:800;letter-spacing:-.3px;}
.tsplit{font-size:10px;font-family:var(--mono);}
.stars{color:#f59e0b;font-size:10px;letter-spacing:-1px;}

/* DRIVER ROW */
.drv{padding:13px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
.drv:last-child{border-bottom:none;}
.drnk{font-size:15px;font-weight:800;width:20px;text-align:center;flex-shrink:0;color:var(--text3);}
.drnk.g{color:#f59e0b;}
.drnk.s{color:#94a3b8;}
.drnk.b{color:#cd7c4c;}
.dav{width:37px;height:37px;border-radius:11px;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;position:relative;}
.sring{position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:50%;border:1.5px solid var(--white);}
.sring.online{background:var(--green);}
.sring.busy{background:#f59e0b;}
.sring.offline{background:var(--text3);}
.dinfo{flex:1;min-width:0;}
.dname{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dmeta{font-size:10px;color:var(--text3);margin-top:2px;display:flex;align-items:center;gap:5px;}
.dr{text-align:right;flex-shrink:0;}
.dearn{font-size:13px;font-weight:800;color:var(--green);}
.dtrips{font-size:10px;color:var(--text3);margin-top:2px;}

/* BOTTOM NAV */
.bnav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:430px;
  background:var(--white);
  border-top:1px solid var(--border);
  display:flex;
  padding:6px 0 22px;
  z-index:200;
  box-shadow:0 -4px 20px rgba(0,0,0,.06);
}
.ntab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 0;transition:transform .1s;}
.ntab:active{transform:scale(.92);}
.niw{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background .15s;}
.ntab.active .niw{background:var(--coral-l);}
.nlbl{font-size:10px;font-weight:600;color:var(--text3);transition:color .15s;}
.ntab.active .nlbl{color:var(--coral);}
`;

/* ─── COMPONENTS ───────────────────────────────────────────── */
const StatusPill = ({ status }) => {
  const c = statusCfg[status] || statusCfg.completed;
  return <span className="spill" style={{ color: c.color, background: c.bg }}>{c.label}</span>;
};

const TierTag = ({ tier }) => (
  <span className="ttag" style={{ color: tierColors[tier], background: tierBg[tier] }}>{tier}</span>
);

const Stars = ({ n }) => n
  ? <span className="stars">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>
  : <span style={{ fontSize: 10, color: "var(--text3)" }}>—</span>;

/* ─── SCREENS ──────────────────────────────────────────────── */
function Overview({ ready }) {
  const maxRev = Math.max(...weekly.map(d => d.revenue));
  return (
    <>
      <div className="hero">
        <div className="hero-lbl">Total Revenue</div>
        <div className="hero-val">{fmt(stats.totalRevenue)}</div>
        <div className="hero-sub">Orlando, FL · All time</div>
        <div className="hero-chips">
          <div className="chip">
            <div className="chip-val">{stats.totalRides.toLocaleString()}</div>
            <div className="chip-lbl">Total Rides</div>
          </div>
          <div className="chip">
            <div className="chip-val">{stats.completionRate}%</div>
            <div className="chip-lbl">Completion</div>
          </div>
          <div className="chip">
            <div className="chip-val">⭐ {stats.avgRating}</div>
            <div className="chip-lbl">Avg Rating</div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-ico" style={{ background: var(--blue-l) ?? "#e0f2fe" }}>🚗</div>
          <div className="stat-num" style={{ color: "var(--blue)" }}>{stats.activeRides}</div>
          <div className="stat-name">Active Rides</div>
          <div className="stat-chg up">↑ Live now</div>
        </div>
        <div className="stat-card">
          <div className="stat-ico" style={{ background: "#dcfce7" }}>🟢</div>
          <div className="stat-num" style={{ color: "var(--green)" }}>
            {stats.activeDrivers}
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 400 }}>/{stats.totalDrivers}</span>
          </div>
          <div className="stat-name">Drivers Online</div>
          <div className="stat-chg nt">36% active</div>
        </div>
        <div className="stat-card">
          <div className="stat-ico" style={{ background: "var(--coral-l)" }}>💰</div>
          <div className="stat-num" style={{ fontSize: 16, color: "var(--coral)" }}>{fmt(stats.platformRevenue)}</div>
          <div className="stat-name">Platform (25%)</div>
          <div className="stat-chg up">↑ 8.3%</div>
        </div>
        <div className="stat-card">
          <div className="stat-ico" style={{ background: "#ede9fe" }}>👥</div>
          <div className="stat-num" style={{ color: "#7c3aed" }}>{stats.totalRiders}</div>
          <div className="stat-name">Total Riders</div>
          <div className="stat-chg up">↑ 12%</div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Weekly Revenue</div>
          <span className="bdg bdg-coral">This Week</span>
        </div>
        <div className="bars">
          {weekly.map((d, i) => (
            <div key={i} className="bc">
              <div
                className={`bf ${i === 5 ? "hi" : ""}`}
                style={{
                  height: ready ? `${(d.revenue / maxRev) * 100}%` : "0%",
                  transition: `height .9s cubic-bezier(.4,0,.2,1) ${i * .08}s`
                }}
              />
              <div className="bd">{d.day}</div>
            </div>
          ))}
        </div>
        <div className="bar-vals">
          {weekly.map((d, i) => (
            <div key={i} className="bv" style={{ color: i === 5 ? "var(--coral)" : "var(--text2)" }}>{d.rides}</div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Revenue Split</div>
          <span className="bdg bdg-amber">25 / 75</span>
        </div>
        <div className="split">
          <div className="split-track">
            <div className="split-seg" style={{ width: "25%", background: "var(--coral)" }} />
            <div className="split-seg" style={{ width: "75%", background: "var(--green)" }} />
          </div>
          <div className="split-2">
            <div className="split-box" style={{ background: "var(--coral-l)" }}>
              <div className="sb-lbl" style={{ color: "var(--coral)" }}>Platform</div>
              <div className="sb-amt" style={{ color: "var(--coral)" }}>{fmt(stats.platformRevenue)}</div>
              <div className="sb-pct" style={{ color: "var(--coral)" }}>25% of gross</div>
            </div>
            <div className="split-box" style={{ background: "var(--green-l)" }}>
              <div className="sb-lbl" style={{ color: "var(--green)" }}>Drivers</div>
              <div className="sb-amt" style={{ color: "var(--green)" }}>{fmt(stats.driverPayouts)}</div>
              <div className="sb-pct" style={{ color: "var(--green)" }}>75% of gross</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LiveRides() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Live Rides</div>
        <div className="live-ct"><div className="pdot" />{liveRides.length} Active</div>
      </div>
      {liveRides.map(r => (
        <div key={r.id} className="ride">
          <div className="rav" style={{ background: tierBg[r.tier], color: tierColors[r.tier] }}>
            {initials(r.rider)}
          </div>
          <div className="ri">
            <div className="rnames">{r.rider} · {r.driver}</div>
            <div className="rroute">{r.pickup} → {r.dropoff}</div>
            <div className="rtags">
              <TierTag tier={r.tier} />
            </div>
          </div>
          <div className="rr">
            <StatusPill status={r.status} />
            <div className="rfare">{fmt(r.fare)}</div>
            <div className="reta">⏱ {r.eta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Trips() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Recent Trips</div>
        <span className="bdg bdg-blue">Last 2 hrs</span>
      </div>
      {recentTrips.map(t => (
        <div key={t.id} className="trip">
          <div className="tico">{t.status === "cancelled" ? "✕" : "✓"}</div>
          <div className="tinfo">
            <div className="tid">{t.id}</div>
            <div className="tnames">{t.rider} · {t.driver}</div>
            <div className="tmeta"><TierTag tier={t.tier} /><span>{t.time}</span></div>
          </div>
          <div className="tr">
            <div className="tfare">{fmt(t.fare)}</div>
            <div className="tsplit" style={{ color: "var(--coral)" }}>{fmt(t.platform)} fee</div>
            <div className="tsplit" style={{ color: "var(--green)" }}>{fmt(t.payout)} out</div>
            <Stars n={t.rating} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Drivers() {
  const rc = i => i === 0 ? "g" : i === 1 ? "s" : i === 2 ? "b" : "";
  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Top Drivers</div>
        <span className="bdg bdg-amber">This Month</span>
      </div>
      {topDrivers.map((d, i) => (
        <div key={d.name} className="drv">
          <div className={`drnk ${rc(i)}`}>{i + 1}</div>
          <div className="dav">
            {initials(d.name)}
            <div className={`sring ${d.status}`} />
          </div>
          <div className="dinfo">
            <div className="dname">{d.name}</div>
            <div className="dmeta"><TierTag tier={d.tier} /><span>⭐ {d.rating}</span></div>
          </div>
          <div className="dr">
            <div className="dearn">{fmt(d.earnings)}</div>
            <div className="dtrips">{d.trips} trips</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── APP ──────────────────────────────────────────────────── */
const TABS = [
  { id: "overview", icon: "◈", label: "Overview" },
  { id: "live",     icon: "📍", label: "Live" },
  { id: "trips",    icon: "🧾", label: "Trips" },
  { id: "drivers",  icon: "🚗", label: "Drivers" },
];

export default function UaTobAdmin() {
  const [tab, setTab] = useState("overview");
  const [ready, setReady] = useState(false);
  useEffect(() => { setTimeout(() => setReady(true), 120); }, []);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="topbar">
          <div className="logo">Ua<span>Tob</span></div>
          <div className="topbar-r">
            <span className="city">📍 Orlando</span>
            <div className="bell">🔔<div className="bell-dot" /></div>
          </div>
        </div>
        <div className="scroll">
          {tab === "overview" && <Overview ready={ready} />}
          {tab === "live"     && <LiveRides />}
          {tab === "trips"    && <Trips />}
          {tab === "drivers"  && <Drivers />}
        </div>
        <nav className="bnav">
          {TABS.map(t => (
            <div key={t.id} className={`ntab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <div className="niw">{t.icon}</div>
              <div className="nlbl">{t.label}</div>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
