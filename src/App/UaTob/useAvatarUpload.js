// src/App/UaTob/useAvatarUpload.js
//
// Uploads a rider's profile photo to Cloudinary (signed, via /api/cloudinary/sign
// — the API secret stays server-side) and saves the resulting secure_url onto
// Accounts/{uid}.photoURL. useAccounts is a live snapshot, so the avatar updates
// itself the moment this writes.

import { useState, useCallback } from 'react';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export function useAvatarUpload(uid) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const upload = useCallback(async (file) => {
    if (!uid || !file) return;
    if (!ALLOWED.includes(file.type)) { setError('Use a JPG, PNG or WebP image.'); return; }
    setUploading(true);
    setError('');
    try {
      // 1 — signed upload params (secret never touches the client)
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: `riders/${uid}/profile` }),
      });
      if (!signRes.ok) throw new Error(`sign ${signRes.status}`);
      const { cloudName, apiKey, timestamp, folder, signature } = await signRes.json();

      // 2 — upload to Cloudinary
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', apiKey);
      form.append('timestamp', timestamp);
      form.append('folder', folder);
      form.append('signature', signature);

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.secure_url) throw new Error(data?.error?.message || 'upload failed');

      // 3 — persist on the account
      await updateDoc(doc(db, 'Accounts', uid), {
        photoURL:  data.secure_url,
        updatedAt: serverTimestamp(),
      });

      return data.secure_url;
    } catch (e) {
      console.warn('[useAvatarUpload]', e?.message || e);
      setError('Upload failed. Try again.');
      return null;
    } finally {
      setUploading(false);
    }
  }, [uid]);

  return { upload, uploading, error };
}
