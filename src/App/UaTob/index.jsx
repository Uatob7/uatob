import { useRides }           from '@/App/UaTob/useRides';
import { useSearch }          from "@/App/Drivers/useSearch";
import { useAccounts }        from '@/App/UaTob/useAccounts';
import { useCreateTrip }      from '@/App/UaTob/useCreateTrip';
import { useScheduledRides }  from '@/App/UaTob/useScheduledRides';
import UaTob                  from '@/App/UaTob/UaTobApp';

export default function App({ uid }) {
  const { account }        = useAccounts(uid);
  const { rides }          = useRides(uid);
  const { createTrip }     = useCreateTrip(uid);
  const { searches }       = useSearch();
  const { scheduledRides } = useScheduledRides();

  return (
    <UaTob
      uid={uid}
      account={account}
      createTrip={createTrip}
      rides={rides}
      searches={searches}
      scheduledRides={scheduledRides}
    />
  );
}
