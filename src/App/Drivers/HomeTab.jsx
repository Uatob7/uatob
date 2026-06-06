import { useEffect, useRef, useState } from 'react';
import StatusCard from '@/App/Drivers/StatusCard.jsx';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE   = 'mapbox://styles/mapbox/dark-v11';

/**
 * HomeTab — full-screen Mapbox background with a floating StatusCard HUD.
 *
 * Props:
 *   driver          — { lat, lng, ... }
 *   online          — bool
 *   searches        — array of active ride searches
 *   scheduledRides  — array of scheduled ride objects
 *   activeTrip      — trip object | null
 *   tripStage       — stage string
 *   tripStageColor  — hex color for current stage
 *   tripBtnLabel    — CTA button label
 *   earnings        — { today, week, trips }
 *   onToggleOnline  — handler
 *   onAdvanceTrip   — handler
 *   advancePending  — bool
 *   onUnreadChange  — (count: number) => void
 */
export default function HomeTab({
  driver,
  online,
  searches = [],
  scheduledRides = [],
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  earnings,
  onToggleOnline,
  onAdvanceTrip,
  advancePending,
  onUnreadChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const sweepRef        = useRef(0);
  const rafRef          = useRef(null);
  const svgRef          = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Init / destroy Mapbox based on online ─────────────────────────────
  useEffect(() => {
    if (!online) {
      // tear down if going offline
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
      return;
    }

    if (mapRef.current) return; // already loaded

    const script = document.createElement('script');
    script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;
    const link   = document.createElement('link');
    link.rel     = 'stylesheet';
    link.href    = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl      = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [driver?.lng ?? -81.3792, driver?.lat ?? 28.5383],
        zoom:               13.5,
        pitch:              45,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);

        // slow drift
        let bearing = -20;
        const drift = setInterval(() => {
          bearing += 0.04;
          map.setBearing(bearing);
        }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [online]); // eslint-disable-line

  // ── Radar sweep rAF ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !online) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.2) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
        const toRad = d => (d * Math.PI) / 180;
        const R     = 55;
        const leadA = (angle + 80) % 360;

        const trailX = 50 + R * Math.cos(toRad(angle));
        const trailY = 50 + R * Math.sin(toRad(angle));
        const leadX  = 50 + R * Math.cos(toRad(leadA));
        const leadY  = 50 + R * Math.sin(toRad(leadA));
        const tipX   = 50 + 52 * Math.cos(toRad(leadA));
        const tipY   = 50 + 52 * Math.sin(toRad(leadA));

        const sweep = svgRef.current.querySelector('#ht-sweep');
        const arm   = svgRef.current.querySelector('#ht-arm');
        const tip   = svgRef.current.querySelector('#ht-tip');
        const tipGlow = svgRef.current.querySelector('#ht-tipglow');

        if (sweep) sweep.setAttribute('d', `M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`);
        if (arm)   { arm.setAttribute('x2', leadX); arm.setAttribute('y2', leadY); }
        if (tip)   { tip.setAttribute('cx', tipX); tip.setAttribute('cy', tipY); }
        if (tipGlow) { tipGlow.setAttribute('cx', tipX); tipGlow.setAttribute('cy', tipY); }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapReady, online]);

  return (
    <>
      <style>{`
        @keyframes htSpin   { to { transform: rotate(360deg); } }
        @keyframes htSlideDown {
          from { opacity: 0; transform: translateY(-12px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes htRingPulse {
          0%,100% { transform: scale(1);   opacity: .18; }
          50%      { transform: scale(1.45); opacity: 0;  }
        }
        @keyframes htBlink {
          0%,100% { opacity: 1; }
          50%      { opacity: .25; }
        }
      `}</style>

      {/* ── Full-screen container ── */}
      <div style={{
        position:   'fixed',
        inset:      0,
        background: '#050A06',  /* dark fallback when offline */
        overflow:   'hidden',
      }}>

        {/* Mapbox canvas — only mounted when online */}
        <div
          ref={mapContainerRef}
          style={{
            position:   'absolute',
            inset:      0,
            opacity:    online ? 1 : 0,
            transition: 'opacity .6s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Offline dark overlay */}
        {!online && (
          <div style={{
            position:       'absolute',
            inset:          0,
            background:     'radial-gradient(ellipse at 50% 60%, #0D1A0F 0%, #050A06 100%)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            {/* subtle offline rings */}
            {[60, 110, 160].map((r, i) => (
              <div key={i} style={{
                position:     'absolute',
                width:        r * 2,
                height:       r * 2,
                borderRadius: '50%',
                border:       '1px solid rgba(34,197,94,0.07)',
                animation:    `htRingPulse ${2.8 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
              }}/>
            ))}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
                width:          48, height: 48, borderRadius: '50%',
                border:         '1.5px solid rgba(255,255,255,0.07)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                margin:         '0 auto 12px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="1"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)' }}>
                Offline
              </div>
            </div>
          </div>
        )}

        {/* Radar SVG — shown when online and map ready */}
        {online && mapReady && (
          <svg
            ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <radialGradient id="ht-sweepGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(34,197,94,0.50)"/>
                <stop offset="45%"  stopColor="rgba(34,197,94,0.14)"/>
                <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
              </radialGradient>
              <radialGradient id="ht-vig" cx="50%" cy="50%" r="60%">
                <stop offset="30%" stopColor="transparent"/>
                <stop offset="100%" stopColor="rgba(0,0,0,0.60)"/>
              </radialGradient>
            </defs>

            {/* vignette */}
            <rect width="100" height="100" fill="url(#ht-vig)"/>

            {/* rings */}
            {[14, 25, 36, 47].map((r, i) => (
              <circle key={i} cx="50" cy="50" r={r} fill="none"
                stroke="rgba(34,197,94,0.09)" strokeWidth="0.25" strokeDasharray="1.2 2.4"/>
            ))}

            {/* crosshair */}
            <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
            <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
            <circle cx="50" cy="50" r="0.75" fill="rgba(74,222,128,0.7)"/>

            {/* sweep cone */}
            <path id="ht-sweep" d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z"
              fill="url(#ht-sweepGrad)" opacity="0.75"/>

            {/* sweep arm */}
            <line id="ht-arm" x1="50" y1="50" x2="50" y2="0"
              stroke="#4ADE80" strokeWidth="0.45" strokeLinecap="round" opacity="0.9"/>

            {/* tip dot */}
            <circle id="ht-tipglow" cx="50" cy="0" r="2.2" fill="rgba(74,222,128,0.22)"/>
            <circle id="ht-tip"     cx="50" cy="0" r="1.1" fill="#4ADE80" opacity="0.95"/>
          </svg>
        )}

        {/* Map loading spinner */}
        {online && !mapReady && (
          <div style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexDirection:  'column',
            gap:            12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border:    '2px solid rgba(34,197,94,0.15)',
              borderTop: '2px solid #22C55E',
              animation: 'htSpin .9s linear infinite',
            }}/>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'rgba(255,255,255,0.35)' }}>
              Loading map…
            </span>
          </div>
        )}

        {/* ── Floating StatusCard HUD ── */}
        <div style={{
          position:        'absolute',
          top:             0,
          left:            0,
          right:           0,
          display:         'flex',
          justifyContent:  'center',
          padding:         '56px 16px 0',    /* top safe area + breathing room */
          zIndex:          30,
          pointerEvents:   'none',
          animation:       'htSlideDown .5s cubic-bezier(.34,1.2,.64,1) both',
        }}>
          <div style={{
            width:         '100%',
            maxWidth:      420,
            pointerEvents: 'auto',
            /* frosted glass lift */
            filter:        'drop-shadow(0 8px 32px rgba(0,0,0,0.55))',
          }}>
            <StatusCard
              online={online}
              activeTrip={activeTrip}
              tripStage={tripStage}
              onToggle={onToggleOnline}
              scheduledRides={scheduledRides}
              driver={driver}
            />
          </div>
        </div>

      </div>
    </>
  );
}





Rides
1lamttXboNuHV66yeaAv
(default)

Accounts

Admin

Drivers

Rides

Search

Support

SupportThreads
Rides

1T0rQvkIpRYQaNyTm8lx

1lamttXboNuHV66yeaAv

BCCx17PgJoEmjMnJZ6dK

CCORFoKt5s5npoTRCNqo

PlzVo8BNK7YNtJxqkYEP

navuZiRgaxX3gK4YnWIr

vBxXLEArYcXWayvUmBBc
1lamttXboNuHV66yeaAv
adminNotified
true
(boolean)


createdAt
June 6, 2026 at 12:54:44 PM UTC-4
(timestamp)


discountAmount
null
(null)



driverInfo
(map)


driverCount
3
(int64)


etaLabel
"21–26 min"
(string)


etaMin
21
(int64)


nearestMiles
7.54
(double)


stale
false
(boolean)


driverPayout
5.24
(double)


dropoff
"Downtown Orlando, Orlando, FL, USA"
(string)


dropoffCity
"Orlando"
(string)


dropoffLat
28.5475134
(double)


dropoffLng
-81.3791202
(double)


dropoffZip
"32801"
(string)



fareBreakdown
(map)


fareTotal
6.99
(double)


isScheduled
true
(boolean)


paymentIntentId
null
(null)


paymentMethod
"cash"
(string)


paymentStatus
"succeeded"
(string)


payoutStatus
"pending"
(string)


pickup
"Downtown Orlando, Orlando, FL, USA"
(string)


pickupCity
"Orlando"
(string)


pickupLat
28.5475134
(double)


pickupLng
-81.3791202
(double)


pickupZip
"32801"
(string)


platformFee
1.75
(double)


polyline
"aufmDrjuoN"
(string)


promoCode
null
(null)


rideLabel
"Standard"
(string)


rideType
"standard"
(string)


scheduledAt
June 6, 2026 at 9:00:00 PM UTC-4
(timestamp)


status
"scheduled"
(string)


tripDistanceMiles
0
(int64)


tripDurationMin
1
(int64)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


updatedAt
June 6, 2026 at 12:54:44 PM UTC-4

and 


Data
Rules
Indexes
Disaster Recovery
Usage
Query Insights
Extensions
Protect your Cloud Firestore resources from abuse, such as billing fraud or phishing



Search
1lYtJBAp1xOq6fIsCfFE
(default)

Accounts

Admin

Drivers

Rides

Search

Support

SupportThreads
Search

1lYtJBAp1xOq6fIsCfFE

2hlt39XxirigXZrc5SGS

2jIzNM6jmCk9pN6wTG90

3Ck3h8RFvYHV3kQCl8Sf

3RSfvIWkTg8gF8gDsw2x

3f7od0m38gMvYKETm0FM

5N0QAAMBifMCSyHrzkgK

5Pqy9Hhp0m5XLTZlNyqc

5R3UzaSBCY6Q87titvYR

5mN2dwBbqZOwK4iQ2mt4

5n9ckrP7f0yscK7OfPhh

6pNMC2ICK5n7i97kP41F

7tK1RVCi1AbbcJoIjKJo

88UE6C7bl86HkriLW0dL

8NSLSPI2QPmeAF04XZz6

8fuKGXR3IpGmOLLw38Md

8nvWPXwvSZCnnHVKAti8

9LaJaYcMDU0gg68HLwin

9RzT2cqJanjHpt11lwyA

AGUM57m6hKQibF6dVuC3

B7q7Buwn9b2QnGKzE5h1

BSIcxNZF9sorp38kh2tK

BmNesgMY4vR2JwrffMXc

By7ToFJwnsZoe4TdUJmP

C83iY5uvV9pDiX8bKO56

CmGNVIHweRIjjMC03Str

CvNtT7xCu4MrCyRlV75z

Dio6k0JSphTYnorHlCRm

DmFzlB1wW5vn1lg0apHv

EISVGWjTGPlwqcSBIZf9

EM8YquZPoj8h5wuGyFeM

EY0EHd8AYTIdXjUnUMrY

FaoLufIcfs9XFVIbPYWQ

GheAyeaWnZNWVcH0zJQ7

GouZxNOSGlGlEV7tTES8

H23ccZ81GZo9mmwpS6kR

HGaddPXMzVgLvD072sbk

HUKXLfrXcvEnQaDiQVNN

HpGl5Cb1vHdRrqKV2MEp

IWIBPVKYF3w7F6n3qf68

IdtAvrayW4BxOfQzPw38

IjpBBYOKY5ZyuSC8VLws

J377mZWYP7CocALJJFcM

JHhMYAkrtC6uWLXkwlOg

KG2sTO7gSrsda2LwGbmt

KdkCypEFew16WVzJ5Rzd

Khhs0sTrdaSnsDIEWFao

Ks3eJpga2jx7KwmeuO7A

LgciAr1crCYQ3rLZfcIt

LsevCzkAoLkBPFth6p4o

MOU14cpW1jD5vJDeD9Xv

MOm7G1MGDyILpnXGIt0w

MVdl6PDD7gK2rVzF7HvJ

MrEEMfCKt8Ob1VVCTZtN

MvfWH0ul1gkdenRRBFD9

NVElyENgJF3Pommf9HXX

NeQcu2USEDFH2kfh9GcK

Nrucr2ebk7snbsNtCrvi

Ny5x6x6NJd1QaLIM7aGC

O4bLnp71xYKnm9zoD7RR
1lYtJBAp1xOq6fIsCfFE
createdAt
June 6, 2026 at 6:35:29 AM UTC-4
(timestamp)



driverInfo
(map)



candidateDriverUids
(array)


0
"dbv1tBKM2nf9WVYN3MRTysWFxpw2"
(string)



candidateDrivers
(array)



0
(map)


distance
70.14
(double)


uid
"dbv1tBKM2nf9WVYN3MRTysWFxpw2"
(string)


driverCount
1
(int64)


etaLabel
"~86–91 min"
(string)


etaMin
86
(int64)


etaSeconds
5142
(int64)


nearestMiles
81.28
(double)


stale
true
(boolean)


dropoff
"Winter Garden, FL, USA"
(string)


miles
24.35
(double)


minutes
30
(int64)


pickup
"DoubleTree by Hilton Hotel Orlando Airport, Hazeltine National Drive, Orlando, FL, USA"
(string)


pickupLat
28.4639174
(double)


pickupLng
-81.3112159
(double)



rides
(map)



economy
(map)


capacity
4
(int64)


desc
"Affordable everyday rides"
(string)


eta
"~86–91 min"
(string)


id
"economy"
(string)


label
"Economy"
(string)


total
37.11
(double)



premium
(map)


capacity
4
(int64)


desc
"Luxury rides"
(string)


eta
"~88–93 min"
(string)


id
"premium"
(string)


label
"Premium"
(string)


total
77.67
(double)



standard
(map)


capacity
4
(int64)


desc
"Comfortable daily rides"
(string)


eta
"~86–91 min"
(string)


id
"standard"
(string)


label
"Standard"
(string)


total
50.97
(double)



xl
(map)


capacity
6
(int64)


desc
"Large group rides"
(string)


eta
"~87–92 min"
(string)


id
"xl"
(string)


label
"XL"
(string)


total
54.65
(double)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


Database location: nam5



Database
(default)
Data
Rules
Indexes
Disaster Recovery
Usage
Query Insights
Extensions
Protect your Cloud Firestore resources from abuse, such as billing fraud or phishing



Drivers
duuEID4AofX1ooCLfSsfVMjJpUu1
(default)

Accounts

Admin

Drivers

Rides

Search

Support

SupportThreads
Drivers

1lu4XNwiM0fTYD0tD5pqRNuI1WW2

1tw4E15GBGgNsYlvfMFQudJveke2

2L1vviHxDaUoub2V1FbMbQfdt0I2

2nzY4Dle8mRP87cvBl3iiRIZQVF2

2qLrPQ2FMWZ1RAZ1sVb6zm38sTb2

47HjcOmHIXQ5YOWnB0UruH5TtW12

48j0PdETpggHZnlnUfN0K7GNrqA3

4N8zeFABzkfZN4Xi6GalaK9jyt92

4gM3YviwOiagyNU9gV2vuFJ68EL2

4gmxZQmeFQYIzj4x2ZKI6K1EdB02

5Zkyt5lJBRYamLv32nxMEyRZGuc2

5u2TDlnyxDSTqIENyxmaPB3SeAt1

6EbCIqy61nMGjuUYTLUX5cGjnGu1

6Xq0SPFdjeh8l1LJ99w1JE0AXIH2

7CnqgEJRvwOkVHWrE7cMNKZpIYl1

7Uh6WlBZ0wYCZqF8OTrwpkODG7F2

7v10uW6UEdSmVt7B2frFEJ9NSSM2

9lDhZxV0cBPNsP8ZTkMA2t8Gv1v1

AbP8iGZrOaTYJ957Q5rz65GNMGR2

Atjj87ildUUMf0sHG2E7u7FbBVu2

Aym7EwwPM1PaMsbINiOYR49VzuD2

BO0xuKwH7bWDb2EszFcFjxwAuCN2

BSz5B9gjWAaWIqnTqki1lCSwNXu2

BbfYXgQkZ0bdVgCRrw0eUulvDrD3

BkbfMT1pOFUBAAUntvtnA8wVCer1

CBmYmBLg5PN2I2BEdQQGRTDYcx92

CesVpfiH4aWeVCizL1tG6D6xE7Z2

F6NkWOSeRkR2mOxnaOkAMbXqHlB3

FAjEkpLWkiRVU7VEnXXAA3qWzHJ3

H4hY2NoE5STL55gVzlj7E7ZsSKu2

IXG4waieuMhDDDtm7gaHUGvZDiu1

J7E5nYJW1yQfbBiTGe4guHEesFy2

JPl6DKsrKMOIwd3GjNUBqJxxhKs2

JVZRDOZu98TNyXhiE9gnxMPk3hg2

KJBTiHJDHITTt5QoELRfxIJ94oO2

KbNHci2uNwMvMDYM1jgEvwZI5jf1

KeQ8Y5kHGmQzXe5ALo80LoVGtTk2

KxpiDTE1hyM9bYEqmeRs0Fu4ZwK2

L385Q9CL38ai3hIJ5ckukRx9n723

MHvo9Af7r3PzjaBZXJaJUmbe12t1

MJb7EUxcXZPDy1qIWm2BMn5WBbf1

NOVSg7pxz8PXzby3nlah5LplVPt1

OWrtmINIsHZcCCFyPgVzrxnMPw73

OZ9NGNLPj5VIIEmcWNecWjXqXLV2

QqytV9vP2FgxoXTwmWx8Kz4maO72

RbCcs0meJHQ1784FyXoFgvttvfC2

ShwYtnVgnmYHYOv3i7J2KIwuCPh2

TWHjp5GmmBfrO6843CEmHcaywvd2

TlzhXxOVioR3aTAaEJZK0hlKRiz2

UStTVToQE1NMlAkKOX8t7BB9LRb2

Ua2nCYitVMUCyEOPXnDpu1R3QTv2

Ure8E0iyx8Ob0dR7yN08GIHgHRy2

WMQR7zmXs3f6SdjlvXMWVgP7Pdz1

XinBKi27ONeTAs4h3wwSLzBtuOP2

YeF7ORioZAQKTiB4zU2n8mpSSB92

Z0SucKpv8iNCuNO1haW7Qe0rUSQ2

ZDNOkXmPDvc8Dyz1maiSHvy0TUs2

ZGB5kXWRYMMCfC22OEDx2jzK6dV2

ahqafQE01xQDoJDrXVIBdRy4ICf2

at5VxbnwfXWAzsXVdKOwHMQCnOb2

bBb4dBnOk7acwvpPpEH8tgyTuKX2

beVkhSMhXlgDodcBpHNmnZ0O7SO2

c8VuQdP10zNgAqDuBoVFmJL2Pyn2

cR6ue5g18easS54CaG6svi1AFXj1

cVmIpoU5ErblWk0kyih9YnSVNWg1

cfsxJKtQhcSjo2wEsvY8LCfII6u1

d0Ud2s6CEnZoEoS9sTSFHd1oaNo1

dbv1tBKM2nf9WVYN3MRTysWFxpw2

duuEID4AofX1ooCLfSsfVMjJpUu1

eSjhghUw98OGsUlwXwnqiTV4Omy2

fNUiMv7uh4X73HPTramhtO47tn53

fwOGRp9xHCZQBWYdznnDXcErBp32

gmikoLPXOnRTf0T0AUgDog8VYUr1

iN2fZjDY0POyrgYQ8DHqM7I81Jj2

khfZ88XTF8TjI9dBcbqY0730MQA3

lL4eKvhnI7czObaWNOfmpgqbMfo1

lU9imSvYTwMGzqCjvxlm4rYHBme2

mfdCQM5oCPRTuvujW1cqXD0Cyn92

myLhbEIwA3gn8PqUDPVg8kDNDKh1

nd6S5BeBlpaNnCaY3IvyxbVwshq1

ojcVTlatVCUEynX6SfMLCUaljrr1

qN36tWyOfxWuUv3GWPI1FQruEQo2

qglT9bECjKZ5dCkkb90c9BT3rPN2

qiRo2yaIBzONhpJGS8dfn3gFgP62

rcQzx7SVykddjHgFWAO6Biv4opo2

rr5rvgmy8HQcWLdAyOKssV9LdRv2

sJI0xwd77wfsrLPQWeRy1hsgeor1

sON4bFyQbkhD0Nzd1FEXxVEPwf72

sbL6XHXGDpb3bFPGeRITdGA7VSj1

tNwCvgJhPxPPMRYJlqZ3nIKUYQL2
duuEID4AofX1ooCLfSsfVMjJpUu1
accountId
"acct_1TNLq8JjpI5W0Bwk"
(string)



achievements
(map)


earningsMilestone10
true
(boolean)


firstRide
true
(boolean)


adminApprovalEmailSent
true
(boolean)


approvalEmailSent
true
(boolean)


approvedAt
June 5, 2026 at 7:13:02 PM UTC-4
(timestamp)


cashOwedBalance
0
(int64)


city
"Orlando"
(string)



contact
(map)


address
"2382 locke ave"
(string)


city
"Orlando"
(string)


phone
"4079426078"
(string)


state
"FL"
(string)


zip
"32818"
(string)


createdAt
May 3, 2026 at 9:54:01 AM UTC-4
(timestamp)


currentStep
5
(int64)


deposit
true
(boolean)


depositCheckedAt
June 6, 2026 at 2:26:07 PM UTC-4
(timestamp)



documents
(map)


insurance
true
(boolean)


insuranceUrl
"https://firebasestorage.googleapis.com/v0/b/uatob-e7b4b.firebasestorage.app/o/drivers%2FduuEID4AofX1ooCLfSsfVMjJpUu1%2Fdocuments%2Finsurance_1777816596712.jpg?alt=media&token=188ff59d-677a-4830-ad0b-61aa1b63d6f8"
(string)


licenseBack
true
(boolean)


licenseBackUrl
"https://firebasestorage.googleapis.com/v0/b/uatob-e7b4b.firebasestorage.app/o/drivers%2FduuEID4AofX1ooCLfSsfVMjJpUu1%2Fdocuments%2FlicenseBack_1777816536723.jpg?alt=media&token=4584d9f7-5c9b-4bee-8879-943ae18ecfd4"
(string)


licenseFront
true
(boolean)


licenseFrontUrl
"https://firebasestorage.googleapis.com/v0/b/uatob-e7b4b.firebasestorage.app/o/drivers%2FduuEID4AofX1ooCLfSsfVMjJpUu1%2Fdocuments%2FlicenseFront_1777816514176.jpg?alt=media&token=76ccb19c-51a8-48e2-9a00-0a23e57e1881"
(string)


licenseNumber
""
(string)


profilePhoto
false
(boolean)


profilePhotoUrl
""
(string)


registration
false
(boolean)


registrationUrl
""
(string)



earnings
(map)


lastSyncedAt
June 6, 2026 at 2:26:21 PM UTC-4
(timestamp)



month
(map)


earnings
0
(int64)


trips
0
(int64)



today
(map)


earnings
0
(int64)


trips
0
(int64)



week
(map)


changePercent
0
(int64)



dailyBreakdown
(array)



0
(map)


amount
0
(int64)


day
"Sun"
(string)


isToday
false
(boolean)



1
(map)


amount
0
(int64)


day
"Mon"
(string)


isToday
false
(boolean)



2
(map)


amount
0
(int64)


day
"Tue"
(string)


isToday
false
(boolean)



3
(map)


amount
0
(int64)


day
"Wed"
(string)


isToday
false
(boolean)



4
(map)


amount
0
(int64)


day
"Thu"
(string)


isToday
false
(boolean)



5
(map)


amount
0
(int64)


day
"Fri"
(string)


isToday
false
(boolean)



6
(map)


amount
0
(int64)


day
"Sat"
(string)


isToday
true
(boolean)


earnings
0
(int64)


lastWeekEarnings
0
(int64)


trips
0
(int64)


email
"support@uatob.com"
(string)


fcmToken
"d_7wwxFycnXh-eTg8sC63z:APA91bHB8wnrt5nuSUFuPxHzC7yQGvxfaQwS2YgcFeskLOysoEDy-z2eg9wno3VdQtWeFZJ66BBtW638NBk60YHLNxgsYiRTkZBWht_SK-xRbEkGfJcEwXU"
(string)


fcmTokenUpdatedAt
June 6, 2026 at 2:22:28 PM UTC-4
(timestamp)


firstName
"Dar"
(string)


lastApprovedNotifyAt
June 6, 2026 at 6:36:01 AM UTC-4
(timestamp)


lastLocationAt
June 6, 2026 at 2:25:25 PM UTC-4
(timestamp)


lastMidnightEmailAt
May 17, 2026 at 12:00:04 AM UTC-4
(timestamp)


lastName
"Corvoisier"
(string)


lastOfflineNotifyAt
June 1, 2026 at 5:02:04 PM UTC-4
(timestamp)


lastOfflineNudgeAt
June 1, 2026 at 5:02:02 PM UTC-4
(timestamp)


lastSeenAt
June 6, 2026 at 2:25:25 PM UTC-4
(timestamp)


lat
28.5730728
(double)


lng
-81.469633
(double)


minutesSinceLastSeen
0
(int64)


presenceUpdatedAt
June 6, 2026 at 2:26:23 PM UTC-4
(timestamp)


rewardsBalance
85
(double)



settings
(map)


darkModeAuto
false
(boolean)


dataSaver
false
(boolean)


notifyAppUpdates
false
(boolean)


notifyPayoutConfirmed
false
(boolean)


notifyPromotions
false
(boolean)


notifyRideRequests
true
(boolean)


notifyWeeklySummary
false
(boolean)


soundHaptics
false
(boolean)


updatedAt
May 30, 2026 at 1:36:16 PM UTC-4
(timestamp)


status
"online"
(string)


submittedAt
June 5, 2026 at 6:13:42 PM UTC-4
(timestamp)


submittedEmailSent
true
(boolean)


thankYouEmailSentAt
May 10, 2026 at 9:13:05 PM UTC-4
(timestamp)


thankYouEmailVersion
1
(int64)


totalRides
5
(int64)


transferCapability
"enabled"
(string)


transferCapabilityCheckedAt
June 6, 2026 at 2:28:07 PM UTC-4
(timestamp)


trip
false
(boolean)


tripStartedAt
May 16, 2026 at 2:22:01 PM UTC-4
(timestamp)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


updatedAt
June 6, 2026 at 2:26:21 PM UTC-4
(timestamp)



vehicle
(map)


color
"Black"
(string)


make
"Ford"
(string)


model
"Cicvi"
(string)


plate
"UFF"
(string)



rideTypes
(array)


0
"economy"
(string)


1
"standard"
(string)


vin
null
(null)


year
"2025"
(string)


welcomeEmailSent
true
(boolean)



withdrawal
(map)


carriedCashOwed
0
(int64)


cashFeeOwed
0
(int64)


cashOwedAfter
0
(int64)



cashRideBreakdown
(array)


cashRideCount
0
(int64)



cashRideIds
(array)


createdAt
May 3, 2026 at 2:06:01 PM UTC-4
(timestamp)


netPayout
0
(int64)



rideBreakdown
(array)


rideCount
0
(int64)



rideIds
(array)


status
"cancelled"
(string)


totalPayout
0
(int64)


updatedAt
May 18, 2026 at 7:06:01 PM UTC-4
(timestamp)


zip
"32818"