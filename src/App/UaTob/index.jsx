import { useState, useEffect, useRef, useCallback } from "react";
import { Star, LocateFixed, Loader2, X, AlertCircle, Bell } from "lucide-react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";


import { useRides }          from '@/App/UaTob/useRides';
import { useSearch }         from "@/App/Drivers/useSearch";
import { useScheduledRides } from "@/App/Drivers/useScheduledRides";

import UaTob from '@/App/UaTob/UaTobApp';
import { useDrivers } from '@/App/UaTob/useDrivers';
import { useAccounts } from '@/App/UaTob/useAccounts';
import { useCreateTrip } from '@/App/UaTob/useCreateTrip';


export default function App({ uid }) {
const { account } = useAccounts(uid);
  const { rides }                  = useRides();
  const { createTrip } = useCreateTrip(uid);
  const { searches }               = useSearch();
  const { scheduledRides }         = useScheduledRides();

  console.log(scheduledRides)
  const { drivers }                = useDrivers();




  return (
    <UaTob
      uid={uid}
     account={account}
     createTrip={createTrip}
   
      rides={rides}
      drivers={drivers}
      searches={searches}
      scheduledRides={scheduledRides}
    />
  );
}