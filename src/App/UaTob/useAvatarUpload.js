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
const MAX_BYTES = 10 * 1024 * 1024; // Cloudinary free image cap

export function useAvatarUpload(uid) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const upload = useCallback(async (file) => {
    if (!uid || !file) return;
    // Be lenient on type — iOS often reports image/heic or an empty type; let
    // Cloudinary convert. Only block clearly non-image files.
    if (file.type && !file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > MAX_BYTES) { setError('Image is too large (max 10 MB).'); return; }
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

      // Deliver via f_auto,q_auto so an iPhone HEIC source is served as JPEG/WebP
      // (a raw .heic URL won't render in most browsers) and stays optimized.
      const webUrl = data.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

      // 3 — persist on the account
      await updateDoc(doc(db, 'Accounts', uid), {
        photoURL:  webUrl,
        updatedAt: serverTimestamp(),
      });

      return webUrl;
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
