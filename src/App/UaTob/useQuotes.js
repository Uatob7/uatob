import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, serverTimestamp, getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

// ── Pricing ───────────────────────────────────────────────────────────────────
const PRICING = {
  economy:  { id: 'economy',  label: 'Economy',  desc: 'Affordable everyday rides', capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99 },
  standard: { id: 'standard', label: 'Standard', desc: 'Comfortable daily rides',   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99 },
  premium:  { id: 'premium',  label: 'Premium',  desc: 'Luxury rides',              capacity: 4, base: 3.0,  perMile: 2.50, perMin: 0.40, bookingFee: 1.79, minimumFare: 9.99 },
  xl:       { id: 'xl',       label: 'XL',       desc: 'Large group rides',         capacity: 6, base: 2.25, perMile: 1.75, perMin: 0.28, bookingFee: 1.39, minimumFare: 7.99 },
};

const TIER_BUFFER       = { economy: 0, standard: 0, premium: 2, xl: 1 };
const FRESH_MS          = 10 * 60 * 1000;
const STALE_PENALTY_MIN = 10;
const AVG_SPEED_MPH     = 25;
const MIN_ETA_MIN       = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function estimateEtaMin(miles) {
  return Math.max(MIN_ETA_MIN, Math.round((miles / AVG_SPEED_MPH) * 60 + 1));
}

function presenceMillis(d) {
  const fromTs = (v) =>
    v && typeof v.toMillis === 'function' ? v.toMillis()
    : typeof v === 'number'               ? v
    :                                       null;
  return fromTs(d.presenceUpdatedAt) ?? fromTs(d.lastSeenAt) ?? fromTs(d.updatedAt) ?? null;
}

function buildTierEta(tierId, matchArr) {
  if (!matchArr?.length) return null;
  const nearest  = matchArr.reduce((a, b) => (a.miles < b.miles ? a : b));
  const adjusted = nearest.etaMin + (TIER_BUFFER[tierId] ?? 0);
  const buffer   = adjusted <= 7 ? 2 : adjusted <= 12 ? 3 : 5;
  return `${nearest.stale ? '~' : ''}${adjusted}–${adjusted + buffer} min`;
}

function calculateRidePrice(p, miles, minutes, etaLabel) {
  const subtotal = round2(p.base + round2(miles * p.perMile) + round2(minutes * p.perMin) + p.bookingFee);
  const total    = round2(subtotal < p.minimumFare ? p.minimumFare : subtotal);
  return { id: p.id, label: p.label, desc: p.desc, eta: etaLabel, capacity: p.capacity, total };
}

// ── Driver match ──────────────────────────────────────────────────────────────
async function buildDriverMatch(pickupLat, pickupLng, pickupZip, signal) {
  let snap = null;

  if (pickupZip) {
    const zipSnap = await getDocs(query(
      collection(db, 'Drivers'),
      where('status', '==', 'online'),
      where('contact.zip', '==', String(pickupZip)),
    ));
    if (!zipSnap.empty) snap = zipSnap;
  }

  if (!snap) {
    snap = await getDocs(query(collection(db, 'Drivers'), where('status', '==', 'online')));
  }

  if (signal?.aborted || snap.empty) return [];

  const now   = Date.now();
  const match = [];

  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;

    const lastPresence = presenceMillis(d);
    const stale        = lastPresence !== null && (now - lastPresence) > FRESH_MS;
    const miles        = round2(haversineMiles(pickupLat, pickupLng, d.lat, d.lng));
    const etaMin       = estimateEtaMin(miles) + (stale ? STALE_PENALTY_MIN : 0);

    match.push({
      uid:        d.uid ?? doc.id,
      miles,
      etaMin,
      stale,
      onlineTime: typeof d.onlineTime === 'number' ? d.onlineTime : null,
      // store as millis so Firestore doesn't nest a Timestamp inside an array
      lastSeenMs: lastPresence,
    });
  });

  match.sort((a, b) => a.miles - b.miles);
  return match;
}

// ── Search log ────────────────────────────────────────────────────────────────
async function logSearch({ uid, tripData, miles, minutes, match, rides }) {
  const pickupCity  = tripData.pickupCity  ?? null;
  const dropoffCity = tripData.dropoffCity ?? null;

  return addDoc(collection(db, 'Search'), {
    uid:         uid ?? null,
    pickup:      tripData.pickup    ?? null,
    dropoff:     tripData.dropoff   ?? null,
    pickupCity,
    dropoffCity,
    miles,
    minutes,
    pickupLat:   tripData.pickupLat ?? null,
    pickupLng:   tripData.pickupLng ?? null,
    pickupZip:   tripData.pickupZip ?? null,
    driverCount: match.length,
    nearestMi:   match[0]?.miles    ?? null,
    nearestEta:  match[0]?.etaMin   ?? null,
    match,
    rides,
    selectedRide: null,
    selectedAt:   null,
    createdAt:    serverTimestamp(),
  }).catch((err) => { console.error('[useQuotes] search log failed:', err); return null; });
}


// ── Hook ──────────────────────────────────────────────────────────────────────
export function useQuotes(tripData) {
  const [quotesData, setQuotesData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const abortRef          = useRef(null);
  const searchDocPromise  = useRef(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    searchDocPromise.current = null;
    setQuotesData(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!tripData) { reset(); return; }

    abortRef.current?.abort();
    const ctrl   = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setQuotesData(null);

    (async () => {
      try {
        const miles     = clamp(round2(tripData.miles),       0, 300);
        const minutes   = clamp(round2(tripData.durationMin), 0, 600);
        const hasPickup = Number.isFinite(tripData.pickupLat) && Number.isFinite(tripData.pickupLng);

        const match = hasPickup
          ? await buildDriverMatch(tripData.pickupLat, tripData.pickupLng, tripData.pickupZip ?? null, ctrl.signal)
          : [];

        if (ctrl.signal.aborted) return;

        const rides = Object.fromEntries(
          Object.entries(PRICING).map(([k, p]) => [
            k,
            calculateRidePrice(p, miles, minutes, buildTierEta(k, match)),
          ]),
        );

        if (ctrl.signal.aborted) return;

        setQuotesData({ rides, match, currency: 'USD', generatedAt: new Date().toISOString() });
        setError(null);

        searchDocPromise.current = logSearch({
          uid: getAuth(firebase_app).currentUser?.uid, tripData, miles, minutes, match, rides,
        });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err.message || 'Failed to calculate prices');
        setQuotesData(null);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [tripData, reset]);

  const selectRide = useCallback((tierId) => {
    if (!tierId || !searchDocPromise.current) return;
    searchDocPromise.current.then(ref => {
      if (!ref) return;
      updateDoc(ref, { selectedRide: tierId, selectedAt: serverTimestamp() }).catch(() => {});
    });
  }, []);

  return { quotesData, loading, error, reset, selectRide };
}
