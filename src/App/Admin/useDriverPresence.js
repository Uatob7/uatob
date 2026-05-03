// src/App/Admin/useDriverPresence.js

import { useEffect, useMemo, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

// ── Status constants (mirror Firestore values) ──────────
export const DRIVER_STATUS = {
  IN_PROGRESS: "in_progress", // Still filling out signup
  PENDING:     "pending",     // Submitted, awaiting admin review
  APPROVED:    "approved",    // Approved but not yet logged in / went online
  ONLINE:      "online",      // Currently online & accepting rides
  OFFLINE:     "offline",     // Logged in but went offline
  SUSPENDED:   "suspended",   // Admin paused
  REJECTED:    "rejected",    // Application denied
};

// ── Hook ─────────────────────────────────────────────────
export function useDriverPresence() {
  const [uatobdrivers, setUatobdrivers] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    // No `where` filter — fetch EVERY driver doc regardless of status.
    // Order by createdAt desc so newest drivers appear first.
    const q = query(
      collection(db, "Drivers"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id:  doc.id,
          uid: doc.id,
          ...doc.data(),
        }));
        setUatobdrivers(list);
        setLoading(false);
      },
      (err) => {
        console.error("useDriverPresence error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── Derived stats (memoized) ───────────────────────────
  const stats = useMemo(() => {
    const buckets = {
      all:        uatobdrivers,
      online:     [],
      offline:    [],
      approved:   [],
      pending:    [],
      inProgress: [],
      suspended:  [],
      rejected:   [],
      unknown:    [], // No status field set
    };

    let docsComplete   = 0;
    let docsIncomplete = 0;
    let stripeConnected = 0;
    let depositReady   = 0;

    uatobdrivers.forEach((d) => {
      const s = d.status;

      switch (s) {
        case DRIVER_STATUS.ONLINE:      buckets.online.push(d);     break;
        case DRIVER_STATUS.OFFLINE:     buckets.offline.push(d);    break;
        case DRIVER_STATUS.APPROVED:    buckets.approved.push(d);   break;
        case DRIVER_STATUS.PENDING:     buckets.pending.push(d);    break;
        case DRIVER_STATUS.IN_PROGRESS: buckets.inProgress.push(d); break;
        case DRIVER_STATUS.SUSPENDED:   buckets.suspended.push(d);  break;
        case DRIVER_STATUS.REJECTED:    buckets.rejected.push(d);   break;
        default:                        buckets.unknown.push(d);
      }

      // Document completion check
      const docs = d.documents || {};
      const allDocsUploaded =
        docs.licenseFront &&
        docs.licenseBack  &&
        docs.registration &&
        docs.insurance    &&
        docs.profilePhoto;

      if (allDocsUploaded) docsComplete++;
      else docsIncomplete++;

      // Stripe / payout readiness
      if (d.accountId) stripeConnected++;
      if (d.deposit)   depositReady++;
    });

    // "Active" = anyone past the application stage
    const activeBucket = [
      ...buckets.online,
      ...buckets.offline,
      ...buckets.approved,
    ];

    // "In funnel" = anyone who hasn't been approved/rejected yet
    const inFunnelBucket = [
      ...buckets.inProgress,
      ...buckets.pending,
    ];

    return {
      buckets,

      // Counts
      total:           uatobdrivers.length,
      onlineCount:     buckets.online.length,
      offlineCount:    buckets.offline.length,
      approvedCount:   buckets.approved.length,
      pendingCount:    buckets.pending.length,
      inProgressCount: buckets.inProgress.length,
      suspendedCount:  buckets.suspended.length,
      rejectedCount:   buckets.rejected.length,
      unknownCount:    buckets.unknown.length,

      activeCount:     activeBucket.length,
      inFunnelCount:   inFunnelBucket.length,

      docsComplete,
      docsIncomplete,
      stripeConnected,
      depositReady,
    };
  }, [uatobdrivers]);

  return {
    // Full list
    uatobdrivers,

    // Buckets (use these for filtering UI)
    onlineDrivers:     stats.buckets.online,
    offlineDrivers:    stats.buckets.offline,
    approvedDrivers:   stats.buckets.approved,
    pendingDrivers:    stats.buckets.pending,
    inProgressDrivers: stats.buckets.inProgress,
    suspendedDrivers:  stats.buckets.suspended,
    rejectedDrivers:   stats.buckets.rejected,
    unknownDrivers:    stats.buckets.unknown,

    // Counts (backwards-compat with old API)
    count:           stats.total,
    onlineCount:     stats.onlineCount,
    offlineCount:    stats.offlineCount,

    // New counts
    total:           stats.total,
    approvedCount:   stats.approvedCount,
    pendingCount:    stats.pendingCount,
    inProgressCount: stats.inProgressCount,
    suspendedCount:  stats.suspendedCount,
    rejectedCount:   stats.rejectedCount,
    unknownCount:    stats.unknownCount,
    activeCount:     stats.activeCount,
    inFunnelCount:   stats.inFunnelCount,

    // Compliance / readiness
    docsComplete:    stats.docsComplete,
    docsIncomplete:  stats.docsIncomplete,
    stripeConnected: stats.stripeConnected,
    depositReady:    stats.depositReady,

    // State
    loading,
    error,
  };
}