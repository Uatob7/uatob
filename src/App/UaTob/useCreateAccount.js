// src/App/UaTob/useCreateAccount.js
import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions         = getFunctions(firebase_app, 'us-east1');
const callCreateAccount = httpsCallable(functions, 'createAccount');

export function useCreateAccount() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const createAccount = useCallback(async ({ uid, email, name }) => {
    setLoading(true);
    setError('');
    try {
      await callCreateAccount({ uid, email, name });
    } catch (err) {
      const msg = err.message || 'Failed to create account';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setError(''), []);

  return { createAccount, loading, error, clear };
}