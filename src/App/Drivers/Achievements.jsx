import { Car, Wallet, Award, MessageSquare } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

export default function Achievements({ driver }) {
  if (!driver) return null;

  const totalTrips = driver.totalRides || 0;
  const reviewsCount = driver.totalReviews || 0;
  const payoutReady = !!driver.payoutMethod;
  const online = driver.status === "online";

  const BADGES = [
    {
      icon: Car,
      label: "First Ride",
      c: C.blue,
      earned: totalTrips >= 1,
    },
    {
      icon: Wallet,
      label: "Deposit Setup",
      c: C.onlineGreen,
      earned: payoutReady,
    },
    {
      icon: Award,
      label: "100 Rides",
      c: "#D97706",
      earned: totalTrips >= 100,
    },
    {
      icon: MessageSquare,
      label: "First Review",
      c: C.purple,
      earned: reviewsCount >= 1,
    },
  ];

  return (
    <div className="card" style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div
          className="condensed"
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: C.text,
            letterSpacing: "-0.3px",
          }}
        >
          Achievements
        </div>

        <span
          style={{
            fontSize: 12,
            color: online ? C.onlineGreen : C.offlineInk,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          See all
        </span>
      </div>

      <div style={{ display: "flex", gap: 9 }}>
        {BADGES.map((b) => (
          <div
            key={b.label}
            style={{
              flex: 1,
              background: b.earned ? b.c + "0D" : C.surfaceAlt,
              border: `1px solid ${b.earned ? b.c + "35" : C.border}`,
              borderRadius: 15,
              padding: "13px 6px",
              textAlign: "center",
              opacity: b.earned ? 1 : 0.45,
              transition: "all .2s ease",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                background: b.earned ? b.c + "18" : C.border,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px",
              }}
            >
              <b.icon size={16} color={b.earned ? b.c : C.textDim} />
            </div>

            <div
              className="condensed"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: b.earned ? b.c : C.textDim,
                letterSpacing: ".4px",
                lineHeight: 1.15,
              }}
            >
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}