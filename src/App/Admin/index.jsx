import { useRides }           from '@/App/UaTob/useRides';
import { useSearch }          from "@/App/Admin/useSearch";
import { useAccounts, useAllAccounts } from '@/App/Admin/useAccounts';
import { useCreateTrip }      from '@/App/UaTob/useCreateTrip';
import { useDrivers }         from '@/App/Admin/useDrivers';
import { useScheduledRides }  from '@/App/Admin/useScheduledRides';
import Admin                  from '@/App/Admin/Admin';

export default function App({ uid }) {
  const { account }        = useAccounts(uid);
  const { accounts }       = useAllAccounts();
  const { rides }          = useRides(uid);
  const { createTrip }     = useCreateTrip(uid);
  const { searches }       = useSearch();
  const { drivers }        = useDrivers();
  const { scheduledRides } = useScheduledRides();

  return (
    <Admin
      uid={uid}
      account={account}
      accounts={accounts}
      createTrip={createTrip}
      rides={rides}
      drivers={drivers}
      searches={searches}
      scheduledRides={scheduledRides}
    />
  );
}
