import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, Clock, User, Ghost, ArrowRight } from 'lucide-react';

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - tsToMillis(ts)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(tsToMillis(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function strip(addr) {
  if (!addr) return '—';
  return addr
    .replace(/^\s*\d+\s+[A-Za-z0-9.-]+\s+/, '')
    .replace(/,\s*(Orlando|Tampa|Kissimmee|Winter Haven|Winter Park|Ocoee|Lakeland|FL|USA).*$/i, '')
    .trim();
}

function isGuest(s) {
  return !s.uid || s.uid === 'null' || s.uid === null;
}

export default function RecentSearches({ searches = [], loading = false, limit = 5 }) {
  const feed = useMemo(() =>
    [...searches]
      .filter(s => s.pickup && s.dropoff)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, limit),
    [searches, limit]
  );

  const [index,   setIndex]   = useState(0);
  const [exiting, setExiting] = useState(false);
  const timerRef              = useRef(null);

  useEffect(() => {
    if (!feed.length) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setExiting(true);
      setTimeout(() => { setIndex(i => (i + 1) % feed.length); setExiting(false); }, 280);
    }, 3800);
    return () => clearInterval(timerRef.current);
  }, [feed.length]);

  const current = feed[index];
  const guest   = current ? isGuest(current) : false;

  return (
    <>
      <style>{`
        @keyframes rs-in  { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        @keyframes rs-out { from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(-4px) } }
        @keyframes rs-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes rs-bar { from{width:0%} to{width:100%} }
      `}</style>

      {/* ── Header row ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'3px 9px', borderRadius:100,
          background:'rgba(96,165,250,.12)', border:'1px solid rgba(96,165,250,.22)',
        }}>
          <div style={{
            width:5, height:5, borderRadius:'50%', background:'#60A5FA',
            boxShadow:'0 0 7px rgba(96,165,250,.9)',
            animation:'rs-dot 1.8s ease-in-out infinite',
          }}/>
          <span style={{
            fontFamily:"'Barlow Condensed','Barlow',sans-serif",
            fontSize:9.5, fontWeight:800, letterSpacing:'.12em',
            textTransform:'uppercase', color:'#93C5FD',
          }}>Live searches</span>
        </div>

        {feed.length > 0 && (
          <span style={{
            fontFamily:"'Barlow',monospace", fontSize:10, fontWeight:700,
            color:'rgba(96,165,250,.35)',
          }}>
            {index + 1}/{feed.length}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ height:9, borderRadius:5, width:'75%', background:'rgba(255,255,255,.08)' }}/>
          <div style={{ height:9, borderRadius:5, width:'50%', background:'rgba(255,255,255,.06)' }}/>
        </div>

      ) : !current ? (
        <div style={{ display:'flex', alignItems:'center', gap:6, color:'rgba(147,197,253,.3)', fontSize:11, fontWeight:600 }}>
          <Search size={11} strokeWidth={2.2}/> No searches yet
        </div>

      ) : (
        <div
          key={index}
          style={{ animation: exiting ? 'rs-out .28s ease both' : 'rs-in .32s cubic-bezier(.34,1.2,.64,1) both' }}
        >
          {/* ── Route line (single row) ── */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            {/* Pickup */}
            <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, minWidth:0 }}>
              <div style={{
                width:16, height:16, borderRadius:5, flexShrink:0,
                background:'rgba(96,165,250,.16)', border:'1px solid rgba(96,165,250,.28)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Navigation size={8} color="#60A5FA" strokeWidth={2.5}/>
              </div>
              <span style={{
                fontFamily:"'Barlow Condensed','Barlow',sans-serif",
                fontSize:15, fontWeight:900, letterSpacing:'-0.2px', lineHeight:1,
                color:'#fff',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {strip(current.pickup)}
              </span>
            </div>

            {/* Arrow */}
            <ArrowRight size={11} color="rgba(96,165,250,.35)" strokeWidth={2.5} style={{ flexShrink:0 }}/>

            {/* Dropoff */}
            <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, minWidth:0 }}>
              <div style={{
                width:16, height:16, borderRadius:5, flexShrink:0,
                background:'rgba(192,132,252,.12)', border:'1px solid rgba(192,132,252,.22)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <MapPin size={8} color="#C084FC" strokeWidth={2.5}/>
              </div>
              <span style={{
                fontFamily:"'Barlow',sans-serif",
                fontSize:12, fontWeight:600, lineHeight:1,
                color:'rgba(192,132,252,.7)',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {strip(current.dropoff)}
              </span>
            </div>
          </div>

          {/* ── Meta row ── */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'2px 7px', borderRadius:99,
              background: guest ? 'rgba(251,191,36,.10)' : 'rgba(96,165,250,.10)',
              border:`1px solid ${guest ? 'rgba(251,191,36,.20)' : 'rgba(96,165,250,.20)'}`,
            }}>
              {guest
                ? <Ghost size={8} color="#FCD34D" strokeWidth={2.4}/>
                : <User  size={8} color="#60A5FA" strokeWidth={2.4}/>
              }
              <span style={{
                fontFamily:"'Barlow',sans-serif",
                fontSize:9, fontWeight:800, letterSpacing:'.06em',
                color: guest ? '#FCD34D' : '#93C5FD',
                textTransform:'uppercase',
              }}>
                {guest ? 'Guest' : 'Rider'}
              </span>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              <Clock size={9} color="rgba(147,197,253,.4)" strokeWidth={2.2}/>
              <span style={{
                fontFamily:"'Barlow',sans-serif", fontSize:10, fontWeight:600,
                color:'rgba(147,197,253,.45)',
              }}>
                {fmtRelative(current.createdAt)}
              </span>
            </div>

            {current.miles != null && (
              <span style={{
                fontFamily:"'Barlow',monospace", fontSize:10, fontWeight:700,
                color:'rgba(96,165,250,.35)',
                marginLeft:'auto',
              }}>
                {current.miles.toFixed(1)} mi
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      {feed.length > 1 && (
        <div style={{
          marginTop:10, height:2, borderRadius:2,
          background:'rgba(96,165,250,.10)', overflow:'hidden',
        }}>
          <div
            key={`bar-${index}`}
            style={{
              height:'100%', borderRadius:2,
              background:'linear-gradient(90deg,#60A5FA,#A78BFA)',
              boxShadow:'0 0 5px rgba(96,165,250,.45)',
              animation:`rs-bar 3.8s linear forwards`,
            }}
          />
        </div>
      )}
    </>
  );
}


(default)

Accounts

Admin

Drivers

Rides

Search

Support

SupportThreads
Search

15bEJkcyL1YGiQd4cKd6

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

DytmAJIIaDincmjLbWa3

EISVGWjTGPlwqcSBIZf9

EM8YquZPoj8h5wuGyFeM

EY0EHd8AYTIdXjUnUMrY

FaoLufIcfs9XFVIbPYWQ

G7J7v7MsbJ6D0JKCf1S3

GheAyeaWnZNWVcH0zJQ7

GouZxNOSGlGlEV7tTES8

H23ccZ81GZo9mmwpS6kR

HGaddPXMzVgLvD072sbk

HUKXLfrXcvEnQaDiQVNN

HpGl5Cb1vHdRrqKV2MEp

Hu0LXWAQt0EbLMYRgkhb

IWIBPVKYF3w7F6n3qf68

IdtAvrayW4BxOfQzPw38

IjpBBYOKY5ZyuSC8VLws

J377mZWYP7CocALJJFcM

JHhMYAkrtC6uWLXkwlOg

KG2sTO7gSrsda2LwGbmt

KdkCypEFew16WVzJ5Rzd

Khhs0sTrdaSnsDIEWFao

KrCnVV7aX2c5OCHsAC4r

Ks3eJpga2jx7KwmeuO7A

LgciAr1crCYQ3rLZfcIt

LsevCzkAoLkBPFth6p4o

MOU14cpW1jD5vJDeD9Xv

MOm7G1MGDyILpnXGIt0w

MVdl6PDD7gK2rVzF7HvJ

MrEEMfCKt8Ob1VVCTZtN

MvfWH0ul1gkdenRRBFD9
15bEJkcyL1YGiQd4cKd6
createdAt
June 6, 2026 at 3:19:29 PM UTC-4
(timestamp)



driverInfo
(map)



candidateDriverUids
(array)


0
"dbv1tBKM2nf9WVYN3MRTysWFxpw2"
(string)


1
"1lu4XNwiM0fTYD0tD5pqRNuI1WW2"
(string)


2
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


3
"cfsxJKtQhcSjo2wEsvY8LCfII6u1"
(string)



candidateDrivers
(array)



0
(map)


distance
8.55
(double)


uid
"dbv1tBKM2nf9WVYN3MRTysWFxpw2"
(string)



1
(map)


distance
73.85
(double)


uid
"1lu4XNwiM0fTYD0tD5pqRNuI1WW2"
(string)



2
(map)


distance
73.94
(double)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)



3
(map)


distance
111.67
(double)


uid
"cfsxJKtQhcSjo2wEsvY8LCfII6u1"
(string)


driverCount
3
(int64)


etaLabel
"~27–32 min"
(string)


etaMin
27
(int64)


etaSeconds
1615
(int64)


nearestMiles
11.41
(double)


stale
true
(boolean)


dropoff
"Tampa, FL, USA"
(string)


miles
0
(int64)


minutes
1
(int64)


pickup
"Tampa, FL, USA"
(string)


pickupLat
27.9516896
(double)


pickupLng
-82.45875269999999
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
"~27–32 min"
(string)


id
"economy"
(string)


label
"Economy"
(string)


total
4.99
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
"~29–34 min"
(string)


id
"premium"
(string)


label
"Premium"
(string)


total
9.99
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
"~27–32 min"
(string)


id
"standard"
(string)


label
"Standard"
(string)


total
6.99
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
"~28–33 min"
(string)


id
"xl"
(string)


label
"XL"
(string)


total
7.99
(double)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"