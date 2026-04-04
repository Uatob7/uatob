import { useState, useEffect } from 'react';
import { DRIVERS } from '@/App/UaTob/locations.js';
import { AVG_SPEED_MPH } from '@/App/UaTob/pricing.js';
import { calcMiles } from '@/App/UaTob/fare.js';
 
export function useRideTracking({ pickupCoords, dropoffCoords, selectedRide, fareData, tripData, onComplete }) {
  const [isTracking, setIsTracking]         = useState(false);
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [driverPos, setDriverPos]           = useState(null);
  const [rideStatus, setRideStatus]         = useState('waiting');
  const [etaMinutes, setEtaMinutes]         = useState(5);
  const [distToDropoff, setDistToDropoff]   = useState(0);
  const [showConfirm, setShowConfirm]       = useState(false);
 
  // Internal refs so the interval always has fresh coords
  const [activePickup,  setActivePickup]  = useState(null);
  const [activeDropoff, setActiveDropoff] = useState(null);
 
  // initiateRide accepts optional coords for cases where state hasn't
  // settled yet (e.g. recovering an active ride on mount)
  const initiateRide = (overridePickup, overrideDropoff) => {
    const pickup  = overridePickup  ?? pickupCoords;
    const dropoff = overrideDropoff ?? dropoffCoords;
 
    if (!pickup || !dropoff) return; // guard — nothing to do without coords
 
    const avail  = DRIVERS.filter(d => d.type === selectedRide);
    const driver = avail.length ? avail[Math.floor(Math.random() * avail.length)] : DRIVERS[0];
 
    setAssignedDriver(driver);
    setDriverPos({ x: driver.x, y: driver.y });
    setActivePickup(pickup);
    setActiveDropoff(dropoff);
 
    const dm = calcMiles(driver.x, driver.y, pickup.x, pickup.y);
    setEtaMinutes(Math.max(1, Math.ceil((dm / AVG_SPEED_MPH) * 60)));
    setDistToDropoff(fareData?.miles || tripData?.miles || 0);
    setRideStatus('waiting');
    setShowConfirm(true);
    setTimeout(() => { setShowConfirm(false); setIsTracking(true); }, 3000);
  };
 
  const resetRide = () => {
    setIsTracking(false);
    setAssignedDriver(null);
    setDriverPos(null);
    setRideStatus('waiting');
    setActivePickup(null);
    setActiveDropoff(null);
    onComplete?.();
  };
 
  useEffect(() => {
    if (!isTracking || !driverPos || !assignedDriver) return;
 
    const pickup  = activePickup  ?? pickupCoords;
    const dropoff = activeDropoff ?? dropoffCoords;
 
    if (!pickup || !dropoff) return;
 
    const iv = setInterval(() => {
      setDriverPos(prev => {
        const target = ['waiting', 'arriving', 'arrived'].includes(rideStatus)
          ? pickup
          : dropoff;
        if (!target) return prev;
 
        const dx   = target.x - prev.x;
        const dy   = target.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const miles = calcMiles(prev.x, prev.y, target.x, target.y);
        const eta   = Math.max(0, Math.ceil((miles / AVG_SPEED_MPH) * 60));
        setEtaMinutes(eta);
 
        if (rideStatus === 'waiting' && eta <= 1) setRideStatus('arriving');
 
        if (rideStatus === 'arriving' && dist < 5) {
          setRideStatus('arrived');
          setTimeout(() => {
            setRideStatus('picked_up');
            setTimeout(() => setRideStatus('heading_to_dropoff'), 2000);
          }, 3000);
        }
 
        if (rideStatus === 'heading_to_dropoff') {
          const dm = calcMiles(prev.x, prev.y, dropoff.x, dropoff.y);
          setDistToDropoff(+dm.toFixed(1));
          setEtaMinutes(Math.max(0, Math.ceil((dm / AVG_SPEED_MPH) * 60)));
          if (dist < 5) {
            setRideStatus('arrived_at_dropoff');
            setTimeout(() => {
              setRideStatus('completed');
              setTimeout(resetRide, 3000);
            }, 3000);
          }
        }
 
        return { x: prev.x + dx * 0.18, y: prev.y + dy * 0.18 };
      });
    }, 5000);
 
    return () => clearInterval(iv);
  }, [isTracking, rideStatus, activePickup, activeDropoff, pickupCoords, dropoffCoords, assignedDriver]);
 
  const getStatusMsg = () => ({
    waiting:             `${assignedDriver?.name} is on the way`,
    arriving:            `${assignedDriver?.name} is arriving`,
    arrived:             'Driver has arrived!',
    picked_up:           'Picked up — starting trip',
    heading_to_dropoff:  'On the way to destination',
    arrived_at_dropoff:  'Arriving at destination',
    completed:           'Trip completed! 🎉',
  }[rideStatus] || '');
 
  const getProgress = () => [
    { label: 'Confirmed',       status: 'completed' },
    { label: 'Driver Arriving', status: rideStatus === 'waiting' ? 'current' : 'completed' },
    {
      label: 'Picked Up',
      status: ['arriving', 'arrived'].includes(rideStatus)
        ? 'current'
        : ['picked_up', 'heading_to_dropoff', 'arrived_at_dropoff', 'completed'].includes(rideStatus)
          ? 'completed'
          : 'pending',
    },
    {
      label: 'Drop Off',
      status: ['heading_to_dropoff', 'arrived_at_dropoff'].includes(rideStatus)
        ? 'current'
        : rideStatus === 'completed'
          ? 'completed'
          : 'pending',
    },
  ];
 
  return {
    isTracking, assignedDriver, driverPos, rideStatus,
    etaMinutes, distToDropoff, showConfirm,
    initiateRide, getStatusMsg, getProgress,
  };
}