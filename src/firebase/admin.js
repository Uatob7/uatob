// src/firebase/admin.js
// Server-side Firebase Admin — used only in API routes to write privileged data
// (credit top-ups) that Firestore security rules block for clients.
//
// Requires env FIREBASE_SERVICE_ACCOUNT: the service-account JSON, either as raw
// JSON or base64-encoded. Create one in Firebase console → Project settings →
// Service accounts → Generate new private key.

import admin from 'firebase-admin';

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
  if (admin.apps.length) return admin.apps[0];
  const sa = loadServiceAccount();
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  return admin.initializeApp({ credential: admin.credential.cert(sa) });
}

export function adminDb() {
  getAdminApp();
  return admin.firestore();
}

export { admin };
