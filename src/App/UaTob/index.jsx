import { useMemo, useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firebase_app } from '@/firebase/config';

import { useRides }           from '@/App/UaTob/useRides';
import { useAccounts }        from '@/App/UaTob/useAccounts';
import { useAllDrivers }      from '@/App/UaTob/useAllDrivers';
import { useTrackPwaInstall } from '@/App/useTrackPwaInstall';
import UaTobRider             from '@/App/UaTob/UaTobRider';
import ActiveRide             from '@/App/UaTob/ActiveRide';

// In-flight statuses that hand the screen to the active-ride view.
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
  const { account } = useAccounts(uid);
  const { rides }   = useRides(uid);
  const { drivers } = useAllDrivers();

  useTrackPwaInstall(uid, 'Accounts');   // flag + timestamp when a rider installs/opens the PWA

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

  // While a ride is in flight, show the new-design active-ride screen (live
  // driver tracking + status card). Otherwise show the rider shell.
  if (activeRide) {
    return <ActiveRide ride={activeRide} uid={uid} />;
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
