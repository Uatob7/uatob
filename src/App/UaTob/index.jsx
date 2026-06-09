import { useState, useEffect, useRef, useCallback } from "react";
import { Star, LocateFixed, Loader2, X, AlertCircle, Bell } from "lucide-react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

import CSS       from '@/App/Drivers/styles.js';
import { C }     from '@/App/Drivers/constants.js';
import UaTobIcon from '@/App/Drivers/Icon.jsx';

import { useRides }          from '@/App/UaTob/useRides';
import { useSearch }         from "@/App/Drivers/useSearch";
import { useScheduledRides } from "@/App/Drivers/useScheduledRides";
import { useSaveFcmToken }   from "@/App/Drivers/useSaveFcmToken";

import UaTob from '@/App/UaTob/UaTobApp';

export default function App({ uid }) {
  const { rides }                  = useRides(uid);
  const { searches }               = useSearch();
  const { scheduledRides }         = useScheduledRides();
  const { call: callSaveFcmToken } = useSaveFcmToken();

  return (
    <UaTob
      uid={uid}
      rides={rides}
      searches={searches}
      scheduledRides={scheduledRides}
      callSaveFcmToken={callSaveFcmToken}
    />
  );
}