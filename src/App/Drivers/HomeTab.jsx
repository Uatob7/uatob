import StatusCard    from '@/App/Drivers/StatusCard.jsx';
import ActiveTripCard from '@/App/Drivers/ActiveTripCard.jsx';
import LiveMap        from '@/App/Drivers/LiveMap.jsx';
import StatTiles      from '@/App/Drivers/StatTiles.jsx';
import Achievements   from '@/App/Drivers/Achievements.jsx';

/**
 * The Home tab content — pure composition of home sub-components.
 *
 * Props:
 *   online          — bool
 *   activeTrip      — trip object | null
 *   tripStage       — stage string
 *   tripStageColor  — hex color for the current stage
 *   tripBtnLabel    — CTA button label
 *   earnings        — { today, week, trips }
 *   onToggleOnline  — handler for status card toggle
 *   onAdvanceTrip   — handler for trip stage advance
 */
export default function HomeTab({
  online,
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  earnings,
  onToggleOnline,
  onAdvanceTrip,
}) {
  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .45s ease-out .05s forwards", opacity: 0 }}>
      <StatusCard
        online={online}
        activeTrip={activeTrip}
        tripStage={tripStage}
        onToggle={onToggleOnline}
      />

      <ActiveTripCard
        activeTrip={activeTrip}
        tripStage={tripStage}
        tripStageColor={tripStageColor}
        tripBtnLabel={tripBtnLabel}
        onAdvance={onAdvanceTrip}
      />

      <StatTiles earnings={earnings} online={online}/>

      <LiveMap online={online} activeTrip={activeTrip}/>

      <Achievements online={online}/>
    </div>
  );
}