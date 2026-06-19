import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { firebase_app } from '@/firebase/config'; // Ensure this path is correct

const auth = getAuth(firebase_app);

export const AuthContext = createContext({});

export const useAuthContext = () => useContext(AuthContext);

export const AuthContextProvider = ({ children }) => {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ uid }}>
      {children}
    </AuthContext.Provider>
  );
};
