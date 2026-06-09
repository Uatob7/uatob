// NotificationsCard.jsx — Face 3: Alerts / Notifications

import { useState, useEffect, useCallback, useMemo } from 'react';
import { C, MONO, COND, tsToMillis } from '@/App/UaTob/Statuscardtokens';

export default function NotificationsCard({ rides, callSaveFcmToken }) {
  const [permState, setPermState] = useState('default');
  const [enabling,  setEnabling]  = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermState(Notification.permission);
  }, []);

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    try {
      const perm = await Notification.requestPermission();
      setPermState(perm);
      if (perm === 'granted' && callSaveFcmToken) await callSaveFcmToken();
    } catch (e) {}
    setEnabling(false);
  }, [callSaveFcmToken]);

  const recentRides = useMemo(() => {
    return [...(rides || [])]
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, 2);
  }, [rides]);

  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.amberBright, textTransform: 'uppercase',
          }}>Alerts</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            {permState === 'granted' ? 'Push on' : 'Push off'}
          </div>
        </div>
        {permState !== 'granted' && (
          <button
            onClick={handleEnable}
            disabled={enabling || permState === 'denied'}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 7,
              cursor: permState === 'denied' ? 'default' : 'pointer',
              background: permState === 'denied' ? 'rgba(248,113,113,.12)' : 'rgba(251,191,36,.14)',
              border: `1px solid ${permState === 'denied' ? C.red : C.amberBright}44`,
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              color: permState === 'denied' ? C.red : C.amberBright,
            }}>
            {enabling ? 'Enabling…' : permState === 'denied' ? 'Blocked' : 'Enable'}
          </button>
        )}
        {permState === 'granted' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 8.5, color: C.greenBright }}>ON</span>
          </div>
        )}
      </div>

      {/* Recent rides */}
      {recentRides.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {recentRides.map((ride, i) => {
            const status = ride.status || 'unknown';
            const statusColor = {
              completed:       C.greenBright,
              in_progress:     C.amberBright,
              driver_assigned: C.cyan,
              cancelled:       C.red,
            }[status] || C.inkText;
            return (
              <div key={ride.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                borderRadius: 8, background: 'rgba(255,255,255,.03)',
                border: `1px solid ${statusColor}1a`,
                animation: `uaCardFlip .3s ease ${i * 0.06}s both`,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: statusColor, boxShadow: `0 0 5px ${statusColor}77`,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,.82)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ride.pickupLabel || ride.pickupAddress || 'Pickup'}
                  </div>
                </div>
                <span style={{
                  fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.1em',
                  color: statusColor, textTransform: 'uppercase',
                  background: `${statusColor}18`, padding: '2px 6px', borderRadius: 5,
                }}>
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '10px 0',
          fontFamily: MONO, fontSize: 10, color: C.inkTextDim, lineHeight: 1.7,
        }}>
          No recent rides yet.
        </div>
      )}
    </div>
  );
}