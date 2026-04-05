// src/App/Admin/useAnalyticsData.js

import { useTotalRides } from "./useTotalRides";
import { useRevenueToday } from "./useRevenueToday";
import { useActiveDrivers } from "./useActiveDrivers";
import { useLiveRides } from "./useLiveRides";
import { useApprovals } from "./useApprovals";

export function useAnalyticsData() {
  const { totalRides, loading: loadingRides, error: errorRides } = useTotalRides();
  const { revenue, rideCount: revenueRideCount, loading: loadingRevenue, error: errorRevenue } = useRevenueToday();
  const { activeDrivers, count: activeDriverCount, loading: loadingDrivers, error: errorDrivers } = useActiveDrivers();
  const { liveRides, count: liveRidesCount, loading: loadingLiveRides, error: errorLiveRides } = useLiveRides();
  const { approvals, count: pendingApprovalsCount, loading: loadingApprovals, error: errorApprovals } = useApprovals();

  const loading = loadingRides || loadingRevenue || loadingDrivers || loadingLiveRides || loadingApprovals;
  const error = errorRides || errorRevenue || errorDrivers || errorLiveRides || errorApprovals;

  return {
    totalRides,
    revenue,
    revenueRideCount,
    activeDrivers,
    activeDriverCount,
    liveRides,
    liveRidesCount,
    approvals,
    pendingApprovalsCount,
    loading,
    error
  };
}