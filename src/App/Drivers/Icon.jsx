import { C } from '@/App/Drivers/constants.js';


/**
 * UaTob brand icon — turns green when the driver is online.
 */
export default function UaTobIcon({ size = 38, online = false }) {
  const acc      = online ? C.onlineGreen : "#171717";
  const accLight = online ? C.onlineLight : "#404040";

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="li-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#F5F5F5"/>
        </linearGradient>
        <linearGradient id="li-road" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={acc}/>
          <stop offset="100%" stopColor={accLight}/>
        </linearGradient>
        <linearGradient id="li-car" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={acc}/>
          <stop offset="100%" stopColor={online ? "#15803D" : "#0A0A0A"}/>
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="14" fill="url(#li-bg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke={acc} strokeOpacity="0.3"/>

      {/* Dashed road A → B */}
      <path d="M 10 46 Q 32 28 54 46" stroke="url(#li-road)" strokeWidth="2" strokeDasharray="4 3.5" strokeLinecap="round" fill="none" opacity="0.7"/>

      {/* Point A */}
      <circle cx="10" cy="46" r="5" fill={acc}      fillOpacity="0.2"/>
      <circle cx="10" cy="46" r="3" fill={acc}/>
      <text x="10" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">A</text>

      {/* Point B */}
      <circle cx="54" cy="46" r="5" fill={accLight} fillOpacity="0.2"/>
      <circle cx="54" cy="46" r="3" fill={accLight}/>
      <text x="54" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">B</text>

      {/* Mini car */}
      <g transform="translate(26,22)">
        <ellipse cx="6" cy="13" rx="7" ry="1.5" fill={acc} opacity="0.15"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#li-car)"/>
        <path d="M2.5 5 L3.5 2 L8.5 2 L9.5 5Z" fill={online ? "#15803D" : "#0A0A0A"}/>
        <rect x="3.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#fff" fillOpacity="0.75"/>
        <rect x="6.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#fff" fillOpacity="0.75"/>
        <circle cx="3" cy="11" r="1.7" fill={online ? "#14532D" : "#0A0A0A"}/>
        <circle cx="3" cy="11" r="0.85" fill={acc}/>
        <circle cx="9" cy="11" r="1.7" fill={online ? "#14532D" : "#0A0A0A"}/>
        <circle cx="9" cy="11" r="0.85" fill={accLight}/>
        <rect x="10.2" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D" opacity="0.9"/>
      </g>
    </svg>
  );
}