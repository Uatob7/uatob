// GET|POST /api/push/dispatch?secret=CRON_SECRET
//
// Stage 4 of the push flow — the send service. Runs on a schedule (cron-job.org).
// Scans active rides for un-notified state changes and sends FCM pushes via the
// Firebase Admin SDK (your existing FIREBASE_SERVICE_ACCOUNT — no Cloud Function
// needed). Idempotent: each event flips a flag on the ride so it's sent once.
//
//   searching_driver → each candidate driver: "New ride request"  (dispatchPushedTo[])
//   driver_assigned  → rider: "Your driver is on the way"          (pushedAssigned)
//   arrived          → rider: "Your driver is here"                (pushedArrived)
//
// Stale tokens (unregistered) are cleared off the recipient's doc.
// Auth: ?secret=CRON_SECRET (or x-cron-secret header).

import { getAdminApp, adminDb, admin } from '@/firebase/admin';
import { getMessaging } from 'firebase-admin/messaging';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  const provided = req.query.secret || req.headers['x-cron-secret'];
  if (!CRON_SECRET || provided !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const db = adminDb();
  const messaging = getMessaging(getAdminApp());
  const tokenCache = {};

  const tokenFor = async (coll, uid) => {
    if (!uid) return null;
    const key = `${coll}/${uid}`;
    if (key in tokenCache) return tokenCache[key];
    const s = await db.collection(coll).doc(uid).get();
    const t = s.exists ? (s.data().fcmToken || null) : null;
    tokenCache[key] = t;
    return t;
  };

  // Send one push (DATA-ONLY — the service worker's onBackgroundMessage builds
  // the notification from data.title/body/url, and notificationclick opens
  // data.url). Clears the token on the recipient doc if FCM says it's dead.
  const push = async ({ coll, uid, token, title, body, link, data }) => {
    if (!token) return { skipped: 'no_token' };
    try {
      await messaging.send({
        token,
        data: Object.fromEntries(Object.entries({ title, body, url: link || '/', ...(data || {}) })
          .map(([k, v]) => [k, String(v)])),
        webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: link || '/' } },
      });
      return { sent: true };
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || '';
      if (String(code).includes('registration-token-not-registered') || String(code).includes('invalid-argument')) {
        try { await db.collection(coll).doc(uid).set({ fcmToken: null, fcmInvalidAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
        return { stale: true };
      }
      return { error: e.message };
    }
  };

  try {
    // Single index-free query (in on one field, no orderBy).
    const snap = await db.collection('Rides')
      .where('status', 'in', ['searching_driver', 'driver_assigned', 'arrived'])
      .limit(100).get();

    const results = [];
    for (const d of snap.docs) {
      const r = d.data();
      try {
        if (r.status === 'searching_driver') {
          const cands   = Array.isArray(r.candidateDriverUids) ? r.candidateDriverUids : [];
          const already = Array.isArray(r.dispatchPushedTo)    ? r.dispatchPushedTo    : [];
          const todo    = cands.filter((u) => !already.includes(u));
          const done    = [];
          const fare    = r.fareEstimate ?? r.fareTotal;
          for (const uid of todo) {
            const token = await tokenFor('Drivers', uid);
            const out = await push({
              coll: 'Drivers', uid, token,
              title: 'New ride request',
              body: `${r.pickupCity || 'Pickup'} → ${r.dropoffCity || 'Dropoff'}${fare != null ? ` · $${Number(fare).toFixed(2)}` : ''}`,
              link: `/driver?ride=${d.id}`,
              data: { rideId: d.id, type: 'ride_request' },
            });
            if (out.sent || out.stale) done.push(uid);   // don't re-attempt a dead token
          }
          if (done.length) await d.ref.set({ dispatchPushedTo: admin.firestore.FieldValue.arrayUnion(...done) }, { merge: true });
          if (todo.length) results.push({ id: d.id, dispatched: done.length });
        }

        else if (r.status === 'driver_assigned' && !r.pushedAssigned) {
          let driverName = 'Your driver';
          if (r.driverUid) {
            const ds = await db.collection('Drivers').doc(r.driverUid).get();
            if (ds.exists && ds.data().firstName) driverName = ds.data().firstName;
          }
          const token = await tokenFor('Accounts', r.uid);
          const out = await push({
            coll: 'Accounts', uid: r.uid, token,
            title: 'Your driver is on the way',
            body: `${driverName} is heading to your pickup`,
            link: `/?ride=${d.id}`, data: { rideId: d.id, type: 'driver_assigned' },
          });
          await d.ref.set({ pushedAssigned: true }, { merge: true });
          results.push({ id: d.id, assigned: !!out.sent });
        }

        else if (r.status === 'arrived' && !r.pushedArrived) {
          const token = await tokenFor('Accounts', r.uid);
          const out = await push({
            coll: 'Accounts', uid: r.uid, token,
            title: 'Your driver is here',
            body: 'Meet at your pickup point',
            link: `/?ride=${d.id}`, data: { rideId: d.id, type: 'arrived' },
          });
          await d.ref.set({ pushedArrived: true }, { merge: true });
          results.push({ id: d.id, arrived: !!out.sent });
        }
      } catch (e) {
        results.push({ id: d.id, error: e.message });
      }
    }

    return res.status(200).json({ checked: snap.size, results });
  } catch (e) {
    console.error('[push/dispatch]', e);
    return res.status(500).json({ error: e.message || 'dispatch failed' });
  }
}
