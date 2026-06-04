// src/App/Admin/useRideUids.js
import { useMemo } from "react";

/**
 * Hook to extract ride UIDs from rides data
 * @param {Array} rides - Array of ride objects with 'id' field
 * @returns {Array} Array of ride UIDs
 */
export function useRideUids(rides = []) {
  return useMemo(() => {
    if (!Array.isArray(rides)) return [];
    return rides.map(ride => ride.id).filter(Boolean);
  }, [rides]);
}
