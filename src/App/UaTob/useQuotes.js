// src/App/UaTob/useQuotes.js
import { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

// ── Pricing config ────────────────────────────────────────────────────
const PRICING = {
  economy:  { id: 'economy',  label: 'Economy',  desc: 'Affordable everyday rides', capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99 },
  standard: { id: 'standard', label: 'Standard', desc: 'Comfortable daily rides',   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99 },
  premium:  { id: 'premium',  label: 'Premium',  desc: 'Luxury rides',              capacity: 4, base: 3.0,  perMile: 2.50, perMin: 0.40, bookingFee: 1.79, minimumFare: 9.99 },
  xl:       { id: 'xl',       label: 'XL',       desc: 'Large group rides',         capacity: 6, base: 2.25, perMile: 1.75, perMin: 0.28, bookingFee: 1.39, minimumFare: 7.99 },
};

const TIER_BUFFER       = { economy: 0, standard: 0, premium: 2, xl: 1 };
const FRESH_MS          = 10 * 60 * 1000;
const STALE_MS          = 4  * 60 * 60 * 1000;
const STALE_PENALTY_MIN = 10;
const AVG_SPEED_MPH     = 25;
const MIN_ETA_MIN       = 7;

// ── Helpers ───────────────────────────────────────────────────────────
const round2 = (n) => Number(Number(n).toFixed(2));
const clamp  = (n, min, max) => Math.min(Math.max(Number(n), min), max);

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(miles) {
  return Math.max(MIN_ETA_MIN, Math.round((miles / AVG_SPEED_MPH) * 60 + 1));
}

function formatEtaRange(etaMin, stale = false) {
  const buffer = etaMin <= 7 ? 2 : etaMin <= 12 ? 3 : 5;
  return `${stale ? '~' : ''}${etaMin}–${etaMin + buffer} min`;
}

function presenceMillis(d) {
  const fromTs = (v) =>
    v && typeof v.toMillis === 'function' ? v.toMillis()
    : typeof v === 'number'               ? v
    :                                       null;
  return fromTs(d.presenceUpdatedAt) ?? fromTs(d.lastSeenAt) ?? fromTs(d.updatedAt) ?? null;
}

function buildTierEta(tierId, driverInfo) {
  if (!driverInfo) return null;
  const adjusted = driverInfo.etaMin + (TIER_BUFFER[tierId] ?? 0);
  const buffer   = adjusted <= 7 ? 2 : adjusted <= 12 ? 3 : 5;
  return `${driverInfo.stale ? '~' : ''}${adjusted}–${adjusted + buffer} min`;
}

function calculateRidePrice(p, miles, minutes, etaLabel) {
  const subtotal = round2(p.base + round2(miles * p.perMile) + round2(minutes * p.perMin) + p.bookingFee);
  const total    = round2(subtotal < p.minimumFare ? p.minimumFare : subtotal);
  return { id: p.id, label: p.label, desc: p.desc, eta: etaLabel, capacity: p.capacity, total };
}

// ── Driver ETA ────────────────────────────────────────────────────────
async function getDriverEta(pickupLat, pickupLng, pickupZip, signal) {
  let snap = null;

  if (pickupZip) {
    const zipQ = query(
      collection(db, 'Drivers'),
      where('status', '==', 'online'),
      where('contact.zip', '==', String(pickupZip))
    );
    snap = await getDocs(zipQ);
    if (snap.empty) snap = null;
  }

  if (!snap) {
    const allQ = query(
      collection(db, 'Drivers'),
      where('status', '==', 'online')
    );
    snap = await getDocs(allQ);
  }

  if (signal?.aborted || snap.empty) return null;

  const now = Date.now();
  let freshNearest = null;
  let staleNearest = null;
  let freshCount   = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;

    const lastPresence = presenceMillis(d);
    const miles        = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);
    const ageMs        = lastPresence === null ? 0 : now - lastPresence;

    if (lastPresence !== null && ageMs > STALE_MS) return;

    if (ageMs <= FRESH_MS) {
      freshCount++;
      if (freshNearest === null || miles < freshNearest) freshNearest = miles;
    } else {
      if (staleNearest === null || miles < staleNearest) staleNearest = miles;
    }
  });

  if (freshNearest !== null) {
    const etaMin = estimateEtaMinutes(freshNearest);
    return { etaMin, etaLabel: formatEtaRange(etaMin), driverCount: freshCount, nearestMiles: round2(freshNearest), stale: false };
  }

  if (staleNearest !== null) {
    const etaMin = estimateEtaMinutes(staleNearest) + STALE_PENALTY_MIN;
    return { etaMin, etaLabel: formatEtaRange(etaMin, true), driverCount: 1, nearestMiles: round2(staleNearest), stale: true };
  }

  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────
export function useQuotes(tripData) {
  const [quotesData, setQuotesData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const abortRef  = useRef(null);
  const resetFlag = useRef(false);

  function reset() {
    resetFlag.current = true;
    abortRef.current?.abort();
    setQuotesData(null);
    setLoading(false);
    setError(null);
  }

  useEffect(() => {
    if (!tripData) {
      abortRef.current?.abort();
      setQuotesData(null);
      setLoading(false);
      setError(null);
      return;
    }

    resetFlag.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    setError(null);
    setQuotesData(null);

    (async () => {
      try {
        const miles   = clamp(round2(tripData.miles),       0, 300);
        const minutes = clamp(round2(tripData.durationMin), 0, 600);
        const hasPickup = Number.isFinite(tripData.pickupLat) && Number.isFinite(tripData.pickupLng);

        let driverInfo = null;
        if (hasPickup) {
          driverInfo = await getDriverEta(
            tripData.pickupLat,
            tripData.pickupLng,
            tripData.pickupZip ?? null,
            signal
          );
        }

        if (signal.aborted || resetFlag.current) return;

        const rides = Object.fromEntries(
          Object.entries(PRICING).map(([k, v]) => [
            k,
            calculateRidePrice(v, miles, minutes, buildTierEta(k, driverInfo)),
          ])
        );

        // Fire-and-forget search log
        const uid = getAuth(firebase_app).currentUser?.uid ?? null;
        addDoc(collection(db, 'Search'), {
          uid,
          pickup:    tripData.pickup    ?? null,
          dropoff:   tripData.dropoff   ?? null,
          miles,
          minutes,
          pickupLat: hasPickup ? tripData.pickupLat : null,
          pickupLng: hasPickup ? tripData.pickupLng : null,
          pickupZip: tripData.pickupZip ?? null,
          driverInfo,
          rides,
          createdAt: serverTimestamp(),
        }).catch((err) => console.error('[useQuotes] Search write failed:', err));

        if (signal.aborted || resetFlag.current) return;

        setQuotesData({ rides, driverInfo, currency: 'USD', generatedAt: new Date().toISOString() });
        setError(null);
      } catch (err) {
        if (signal.aborted || resetFlag.current) return;
        setError(err.message || 'Failed to calculate prices');
        setQuotesData(null);
      } finally {
        if (!signal.aborted && !resetFlag.current) setLoading(false);
      }
    })();

    return () => { abortRef.current?.abort(); };
  }, [tripData]);

  return { quotesData, loading, error, reset };
}