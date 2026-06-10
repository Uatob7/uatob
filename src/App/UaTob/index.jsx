import { useMemo } from "react";

import { useRides }      from '@/App/UaTob/useRides';
import { useSearch }     from "@/App/Drivers/useSearch";
import { useAccounts }   from '@/App/UaTob/useAccounts';
import { useCreateTrip } from '@/App/UaTob/useCreateTrip';
import { useDrivers }    from '@/App/UaTob/useDrivers';
import UaTob             from '@/App/UaTob/UaTobApp';

export default function App({ uid }) {
  const { account }   = useAccounts(uid);
  const { rides }     = useRides(uid);
  const { createTrip } = useCreateTrip(uid);
  const { searches }  = useSearch();
  const { drivers }   = useDrivers();

  const scheduledRides = useMemo(
    () => rides.filter(r => r.isScheduled && r.status === 'scheduled'),
    [rides]
  );

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
