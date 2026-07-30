// src/firebase/admin.js
// Server-side Firebase Admin — used only in API routes to write privileged data
// (credit top-ups, request settlement) that Firestore security rules block for
// clients.
//
// firebase-admin v14 dropped the legacy namespaced default export
// (`import admin from 'firebase-admin'` → admin.credential / admin.firestore are
// now undefined), so this uses the modular subpath API. A small `admin` shim is
// re-exported so existing call sites can keep using `admin.firestore.FieldValue`.
//
// Requires env FIREBASE_SERVICE_ACCOUNT: the service-account JSON, either as raw
// JSON or base64-encoded. Create one in Firebase console → Project settings →
// Service accounts → Generate new private key.

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(json);
    // Vercel/dotenv escape newlines in the private key — restore them.
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    return sa;
  } catch (e) {
    console.error('[admin] Invalid FIREBASE_SERVICE_ACCOUNT:', e.message);
    return null;
  }
}

export function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];
  const sa = loadServiceAccount();
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  return initializeApp({ credential: cert(sa) });
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

// Back-compat shim: existing routes call `admin.firestore.FieldValue.increment`
// / `.serverTimestamp()`. Keep that surface working on top of the modular API.
export const admin = { firestore: { FieldValue } };

export { FieldValue };
