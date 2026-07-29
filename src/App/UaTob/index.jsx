import { useMemo, useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firebase_app } from '@/firebase/config';

import { useRides }           from '@/App/UaTob/useRides';
import { useSearch }          from '@/App/Drivers/useSearch';
import { useAccounts }        from '@/App/UaTob/useAccounts';
import { useCreateTrip }      from '@/App/UaTob/useCreateTrip';
import { useScheduledRides }  from '@/App/UaTob/useScheduledRides';
import { useAllDrivers }      from '@/App/UaTob/useAllDrivers';
import UaTob                  from '@/App/UaTob/UaTobApp';
import UaTobRider             from '@/App/UaTob/UaTobRider';

// In-flight statuses that hand the screen to the full-screen map HUD.
const IN_FLIGHT = new Set([
  'searching_driver', 'driver_assigned', 'driver_arriving',
  'arrived', 'in_progress', 'timeout',
]);

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  return 0;
}

export default function App({ uid }) {
  const { account }        = useAccounts(uid);
  const { rides }          = useRides(uid);
  const { createTrip }     = useCreateTrip(uid);
  const { searches }       = useSearch();
  const { scheduledRides } = useScheduledRides();
  const { drivers }        = useAllDrivers();

  // Most-recent in-flight ride, if any.
  const activeRide = useMemo(() => {
    const active = (rides || [])
      .filter(r => IN_FLIGHT.has(r.status))
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    return active[0] ?? null;
  }, [rides]);

  const handleSignOut = useCallback(() => {
    try { signOut(getAuth(firebase_app)); } catch { /* no-op */ }
  }, []);

  // While a ride is in flight, hand off to the existing full-screen map HUD
  // (live driver tracking, route lines, ActiveRideHud). Otherwise show the
  // new 4-tab rider shell (Request / Rides / Driver / You).
  if (activeRide) {
    return (
      <UaTob
        uid={uid}
        account={account}
        createTrip={createTrip}
        rides={rides}
        searches={searches}
        scheduledRides={scheduledRides}
        activeRide={activeRide}
      />
    );
  }

  return (
    <UaTobRider
      uid={uid}
      account={account}
      drivers={drivers}
      onSignOut={handleSignOut}
    />
  );
}
