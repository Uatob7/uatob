// src/App/Drivers.jsx
import React, { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';

const db = getFirestore();

export default function Drivers({ uid }) {
  const [isOnline, setIsOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);

  // ── LISTEN FOR RIDE REQUESTS ─────────────
  useEffect(() => {
    if (!isOnline) return;

    const q = query(
      collection(db, 'Rides'),
      where('status', '==', 'searching_driver')
    );

    const unsub = onSnapshot(q, (snap) => {
      const rides = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRequests(rides);
    });

    return () => unsub();
  }, [isOnline]);

  // ── ACCEPT RIDE ─────────────────────────
  const acceptRide = async (ride) => {
    try {
      const ref = doc(db, 'Rides', ride.id);

      await updateDoc(ref, {
        status: 'driver_assigned',
        driver: {
          id: uid,
          name: 'Driver Name',
          vehicle: 'Toyota Camry',
          plate: 'ABC123',
        },
      });

      setActiveRide(ride);
      setRequests([]);
    } catch (err) {
      console.error('Accept ride error:', err);
    }
  };

  // ── COMPLETE RIDE ───────────────────────
  const completeRide = async () => {
    if (!activeRide) return;

    try {
      const ref = doc(db, 'Rides', activeRide.id);

      await updateDoc(ref, {
        status: 'completed',
      });

      setActiveRide(null);
    } catch (err) {
      console.error('Complete ride error:', err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🚗 Driver Dashboard</h2>

      {/* ONLINE TOGGLE */}
      <button
        onClick={() => setIsOnline(!isOnline)}
        style={{
          padding: 10,
          marginBottom: 20,
          background: isOnline ? 'green' : 'gray',
          color: '#fff',
          borderRadius: 8,
        }}
      >
        {isOnline ? 'Online' : 'Go Online'}
      </button>

      {/* ACTIVE RIDE */}
      {activeRide && (
        <div style={{ border: '1px solid #ddd', padding: 15, marginBottom: 20 }}>
          <h3>Current Ride</h3>
          <p><b>Pickup:</b> {activeRide.pickup}</p>
          <p><b>Dropoff:</b> {activeRide.dropoff}</p>

          <button
            onClick={completeRide}
            style={{
              marginTop: 10,
              padding: 10,
              background: 'black',
              color: '#fff',
              borderRadius: 8,
            }}
          >
            Complete Ride
          </button>
        </div>
      )}

      {/* REQUESTS */}
      {!activeRide && isOnline && (
        <>
          <h3>Ride Requests</h3>

          {requests.length === 0 && <p>No requests...</p>}

          {requests.map((ride) => (
            <div
              key={ride.id}
              style={{
                border: '1px solid #ddd',
                padding: 15,
                marginBottom: 10,
                borderRadius: 10,
              }}
            >
              <p><b>Pickup:</b> {ride.pickup}</p>
              <p><b>Dropoff:</b> {ride.dropoff}</p>
              <p><b>Fare:</b> ${ride.fareEstimate}</p>

              <button
                onClick={() => acceptRide(ride)}
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: 'green',
                  color: '#fff',
                  borderRadius: 8,
                }}
              >
                Accept Ride
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}