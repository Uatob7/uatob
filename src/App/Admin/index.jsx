import { useRides }           from '@/App/UaTob/useRides';
import { useSearch }          from "@/App/Drivers/useSearch";
import { useAccounts }        from '@/App/UaTob/useAccounts';
import { useCreateTrip }      from '@/App/UaTob/useCreateTrip';
import { useDrivers }         from '@/App/UaTob/useDrivers';
import { useScheduledRides }  from '@/App/UaTob/useScheduledRides';
import Admin                  from '@/App/Admin/Admin';

export default function App({ uid }) {
  const { account }        = useAccounts(uid);
  const { rides }          = useRides(uid);
  const { createTrip }     = useCreateTrip(uid);
  const { searches }       = useSearch();
  const { drivers }        = useDrivers();
  const { scheduledRides } = useScheduledRides();

  return (
    <Admin  
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
