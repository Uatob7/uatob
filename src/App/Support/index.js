/**
 * UaTobSupportAgent.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Full-featured internal support agent console for UaTob.
 *
 * FEATURES:
 *  - Ticket queue (riders + drivers) with filter, status, priority
 *  - Live chat workspace per ticket with thread history
 *  - Resolve / Transfer / Snooze ticket actions
 *  - Ride lookup by ID or phone number
 *  - Quick actions: 50% refund, full refund, fare adjust, flag user
 *  - User profile panel with stats pulled from ticket context
 *  - Agent notes (internal, per ticket)
 *  - Toast notifications for all actions
 *
 * USAGE:
 *   import UaTobSupportAgent from '@/App/Support/UaTobSupportAgent';
 *   <UaTobSupportAgent agentName="Sarah M." agentUid="agent-123" />
 *
 * REAL DATA INTEGRATION (replace mock data with Firestore):
 *   - TICKETS array  → useCollection('supportTickets', orderBy('createdAt','desc'))
 *   - RIDE_DATA obj  → httpsCallable(functions, 'getRideById')({ rideId })
 *   - sendMessage()  → addDoc(collection(db,'supportTickets',id,'messages'), {...})
 *   - resolveTicket()→ updateDoc(ticketRef, { status:'resolved', resolvedAt: serverTimestamp() })
 *   - doAction()     → httpsCallable(functions, 'supportAction')({ ticketId, action, rideId })
 *
 * DEPENDENCIES: React, lucide-react
 * ─────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, CheckCircle, RefreshCw, Clock, Flag, AlertCircle,
  Search, User, Car, ChevronDown, X, Phone, Mail,
  ArrowLeftRight, SlidersHorizontal, FileText, Zap,
  MessageSquare, Star, MapPin, DollarSign,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — matches UaTob light palette
// ─────────────────────────────────────────────────────────────────────
const C = {
  bg:           "#F2F5F2",
  surface:      "#FFFFFF",
  surface2:     "#F7F9F7",
  border:       "rgba(0,0,0,0.08)",
  borderMid:    "rgba(0,0,0,0.13)",
  text:         "#0F1A0F",
  textMid:      "#4A5A4A",
  textDim:      "#8A9A8A",
  accent:       "#16A34A",
  accentBg:     "rgba(22,163,74,0.08)",
  accentBorder: "rgba(22,163,74,0.20)",
  blue:         "#2563EB",
  blueBg:       "rgba(37,99,235,0.07)",
  blueBorder:   "rgba(37,99,235,0.18)",
  amber:        "#D97706",
  amberBg:      "rgba(217,119,6,0.08)",
  amberBorder:  "rgba(217,119,6,0.20)",
  red:          "#DC2626",
  redBg:        "rgba(220,38,38,0.07)",
  redBorder:    "rgba(220,38,38,0.18)",
  purple:       "#7C3AED",
  purpleBg:     "rgba(124,58,237,0.07)",
  purpleBorder: "rgba(124,58,237,0.18)",
};

// ─────────────────────────────────────────────────────────────────────
// MOCK DATA — replace with Firestore hooks in production
// ─────────────────────────────────────────────────────────────────────
const MOCK_TICKETS = [
  {
    id: "TK001", type: "rider", priority: true, status: "open",
    name: "Marcus Johnson", initials: "MJ",
    avatarColor: C.accent, avatarBg: C.accentBg,
    subject: "Charged twice for ride", time: "2m ago",
    messages: [
      { from: "user",  text: "Hi, I was charged twice for my ride this morning. Ride ID R-9921.", time: "9:04 AM" },
      { from: "agent", text: "Hi Marcus! I can see your account. Let me pull up that ride right now.", time: "9:06 AM" },
      { from: "user",  text: "It shows two charges of $14.80 on my card statement.", time: "9:07 AM" },
    ],
    user: { name: "Marcus Johnson", email: "marcus@email.com", phone: "+1 407-555-0122",
      type: "Rider", since: "Jan 2024", rides: 47, rating: 4.8, spend: "$612" },
  },
  {
    id: "TK002", type: "driver", priority: true, status: "open",
    name: "Devon Richards", initials: "DR",
    avatarColor: C.blue, avatarBg: C.blueBg,
    subject: "App crashed mid-trip, lost earnings", time: "5m ago",
    messages: [
      { from: "user", text: "The app crashed while I had a passenger. I lost the trip completely.", time: "8:51 AM" },
      { from: "user", text: "I never got paid for it. The ride was about 12 miles.", time: "8:52 AM" },
    ],
    user: { name: "Devon Richards", email: "devon.r@email.com", phone: "+1 407-555-0198",
      type: "Driver", since: "Mar 2023", rides: 312, rating: 4.93, spend: "$8,440 earned" },
  },
  {
    id: "TK003", type: "rider", priority: false, status: "pending",
    name: "Alicia Torres", initials: "AT",
    avatarColor: C.purple, avatarBg: C.purpleBg,
    subject: "Driver never arrived, still charged", time: "18m ago",
    messages: [
      { from: "user", text: "I waited 20 minutes and the driver never showed. Still got charged a wait fee.", time: "8:38 AM" },
    ],
    user: { name: "Alicia Torres", email: "alicia.t@email.com", phone: "+1 407-555-0177",
      type: "Rider", since: "Jun 2024", rides: 12, rating: 4.5, spend: "$98" },
  },
  {
    id: "TK004", type: "driver", priority: false, status: "open",
    name: "James Kim", initials: "JK",
    avatarColor: C.amber, avatarBg: C.amberBg,
    subject: "Insurance doc rejected — still valid", time: "34m ago",
    messages: [
      { from: "user",  text: "My insurance doc was rejected but it is valid until 2026. Can you review?", time: "8:23 AM" },
      { from: "agent", text: "Thanks James, I've escalated this to our compliance team. You'll hear back within 24 hours.", time: "8:31 AM" },
      { from: "user",  text: "Thank you, I appreciate it.", time: "8:33 AM" },
    ],
    user: { name: "James Kim", email: "james.k@email.com", phone: "+1 407-555-0144",
      type: "Driver", since: "Apr 2024", rides: 0, rating: "N/A", spend: "Pending" },
  },
  {
    id: "TK005", type: "rider", priority: true, status: "open",
    name: "Priya Sharma", initials: "PS",
    avatarColor: C.red, avatarBg: C.redBg,
    subject: "Unsafe driving — speeding & red lights", time: "1h ago",
    messages: [
      { from: "user", text: "My driver was speeding and ran two red lights. I felt very unsafe.", time: "7:54 AM" },
    ],
    user: { name: "Priya Sharma", email: "priya.s@email.com", phone: "+1 407-555-0199",
      type: "Rider", since: "Sep 2023", rides: 29, rating: 4.7, spend: "$340" },
  },
  {
    id: "TK006", type: "driver", priority: false, status: "pending",
    name: "Nadia Williams", initials: "NW",
    avatarColor: C.accent, avatarBg: C.accentBg,
    subject: "Weekly payout not received", time: "2h ago",
    messages: [
      { from: "user",  text: "My weekly payout from last Friday still hasn't arrived.", time: "6:11 AM" },
      { from: "agent", text: "Hi Nadia, I'm checking with our payments team. This usually takes 1–2 business days but I'll escalate.", time: "7:02 AM" },
    ],
    user: { name: "Nadia Williams", email: "nadia.w@email.com", phone: "+1 407-555-0131",
      type: "Driver", since: "Nov 2023", rides: 198, rating: 4.88, spend: "$5,210 earned" },
  },
  {
    id: "TK007", type: "rider", priority: false, status: "resolved",
    name: "Ethan Chen", initials: "EC",
    avatarColor: C.blue, avatarBg: C.blueBg,
    subject: "Promo code RIDE10 not applied", time: "3h ago",
    messages: [
      { from: "user",  text: "My promo code RIDE10 didn't apply at checkout.", time: "5:30 AM" },
      { from: "agent", text: "Hi Ethan! I've manually applied a $10 credit to your account. It will appear on your next ride.", time: "5:45 AM" },
      { from: "user",  text: "Amazing, thank you so much!", time: "5:47 AM" },
    ],
    user: { name: "Ethan Chen", email: "ethan.c@email.com", phone: "+1 407-555-0166",
      type: "Rider", since: "Feb 2024", rides: 8, rating: 4.6, spend: "$74" },
  },
];

const MOCK_RIDES = {
  "R-9921": {
    id: "R-9921", rider: "Marcus Johnson", driver: "Yusuf Al-Amin",
    pickup: "6200 Visitors Circle, Orlando",
    dropoff: "Orlando International Airport",
    fare: "$14.80", status: "completed",
    date: "Today · 8:49 AM", distance: "7.3 mi", duration: "18 min",
  },
  "R-8801": {
    id: "R-8801", rider: "Alicia Torres", driver: "Unassigned",
    pickup: "5540 International Drive, Orlando",
    dropoff: "Disney Springs, Lake Buena Vista",
    fare: "$9.40", status: "cancelled",
    date: "Today · 8:22 AM", distance: "4.1 mi", duration: "—",
  },
  "R-7745": {
    id: "R-7745", rider: "Priya Sharma", driver: "Calvin Moore",
    pickup: "Mall at Millenia, Orlando",
    dropoff: "Universal Studios Florida",
    fare: "$11.20", status: "completed",
    date: "Today · 7:50 AM", distance: "5.6 mi", duration: "14 min",
  },
};

// ─────────────────────────────────────────────────────────────────────
// GLOBAL CSS STRING
// ─────────────────────────────────────────────────────────────────────
const SUPPORT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .sup-root {
    display: grid;
    grid-template-rows: 52px 1fr;
    height: 100vh;
    font-family: 'Barlow', system-ui, sans-serif;
    background: ${C.bg};
    color: ${C.text};
    font-size: 13px;
    overflow: hidden;
  }

  /* ── TOPBAR ── */
  .sup-topbar {
    background: ${C.surface};
    border-bottom: 1px solid ${C.border};
    display: flex; align-items: center; gap: 12px;
    padding: 0 18px; flex-shrink: 0;
  }
  .sup-logo { display: flex; align-items: center; gap: 8px; }
  .sup-logo-mark {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, #22C55E, #16A34A);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .sup-logo-text {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 17px; font-weight: 900; color: ${C.text}; letter-spacing: -.3px;
  }
  .sup-logo-dim { opacity: .45; font-weight: 700; }
  .sup-topbar-div { width: 1px; height: 20px; background: ${C.border}; flex-shrink: 0; }
  .sup-label {
    font-size: 10px; font-weight: 800; letter-spacing: .15em;
    text-transform: uppercase; color: ${C.textDim};
  }
  .sup-agent-chip {
    display: flex; align-items: center; gap: 6px;
    background: ${C.surface2}; border: 1px solid ${C.border};
    border-radius: 100px; padding: 4px 12px; margin-left: auto;
  }
  .sup-agent-dot {
    width: 6px; height: 6px; border-radius: 50%; background: ${C.accent}; flex-shrink: 0;
    animation: sup-pulse 2s infinite;
  }
  @keyframes sup-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  .sup-agent-name { font-size: 11px; font-weight: 700; color: ${C.textMid}; }

  /* ── 3-COL MAIN GRID ── */
  .sup-main {
    display: grid;
    grid-template-columns: 232px 1fr 308px;
    height: 100%; overflow: hidden;
  }

  /* ── QUEUE PANEL ── */
  .sup-queue {
    background: ${C.surface}; border-right: 1px solid ${C.border};
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sup-queue-header {
    padding: 14px 14px 10px; flex-shrink: 0;
    border-bottom: 1px solid ${C.border};
  }
  .sup-queue-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px; font-weight: 900; color: ${C.text};
    letter-spacing: -.1px; margin-bottom: 7px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sup-count-badge {
    font-size: 9px; font-weight: 800;
    background: ${C.redBg}; color: ${C.red};
    border: 1px solid ${C.redBorder};
    border-radius: 100px; padding: 2px 8px; letter-spacing: .04em;
  }
  .sup-filter-row { display: flex; gap: 4px; }
  .sup-filter-btn {
    font-size: 10px; font-weight: 700; padding: 4px 9px;
    border-radius: 7px; border: 1px solid ${C.border};
    background: transparent; color: ${C.textDim};
    cursor: pointer; transition: all .15s;
    font-family: 'Barlow', sans-serif;
  }
  .sup-filter-btn:hover { color: ${C.textMid}; background: ${C.surface2}; }
  .sup-filter-btn.active { background: ${C.accent}; color: #fff; border-color: ${C.accent}; }
  .sup-ticket-list {
    overflow-y: auto; flex: 1; padding: 6px;
  }
  .sup-ticket-list::-webkit-scrollbar { width: 3px; }
  .sup-ticket-list::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }

  .sup-ticket-item {
    padding: 10px; border-radius: 10px; cursor: pointer;
    margin-bottom: 3px; border: 1.5px solid transparent;
    transition: all .15s;
    animation: sup-fadein .22s ease both;
  }
  @keyframes sup-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .sup-ticket-item:hover { background: ${C.surface2}; }
  .sup-ticket-item.selected {
    background: ${C.accentBg}; border-color: ${C.accentBorder};
  }
  .sup-ticket-item.selected .sup-t-name { color: ${C.accent}; }

  .sup-t-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px; margin-bottom: 3px;
  }
  .sup-t-name {
    font-size: 12px; font-weight: 700; color: ${C.text};
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;
  }
  .sup-t-time { font-size: 10px; color: ${C.textDim}; font-weight: 600; flex-shrink: 0; }
  .sup-t-subject {
    font-size: 11px; color: ${C.textMid}; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;
  }
  .sup-t-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

  /* ── PILLS ── */
  .sup-pill {
    font-size: 9px; font-weight: 800; border-radius: 6px;
    padding: 2px 7px; letter-spacing: .04em; border: 1px solid;
  }
  .sup-pill-rider { background: ${C.accentBg}; color: ${C.accent}; border-color: ${C.accentBorder}; }
  .sup-pill-driver { background: ${C.blueBg}; color: ${C.blue}; border-color: ${C.blueBorder}; }
  .sup-pill-open { background: ${C.redBg}; color: ${C.red}; border-color: ${C.redBorder}; }
  .sup-pill-pending { background: ${C.amberBg}; color: ${C.amber}; border-color: ${C.amberBorder}; }
  .sup-pill-resolved { background: ${C.accentBg}; color: ${C.accent}; border-color: ${C.accentBorder}; }
  .sup-pill-urgent { background: ${C.redBg}; color: ${C.red}; border-color: ${C.redBorder}; }

  /* ── WORKSPACE ── */
  .sup-workspace {
    display: flex; flex-direction: column; overflow: hidden; background: ${C.bg};
  }
  .sup-ws-topbar {
    background: ${C.surface}; border-bottom: 1px solid ${C.border};
    padding: 11px 18px; flex-shrink: 0;
    display: flex; align-items: center; gap: 12px;
  }
  .sup-ws-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 900; flex-shrink: 0;
  }
  .sup-ws-info { flex: 1; min-width: 0; }
  .sup-ws-name { font-size: 13px; font-weight: 800; color: ${C.text}; }
  .sup-ws-subject {
    font-size: 11px; color: ${C.textDim}; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sup-ws-actions { display: flex; gap: 6px; margin-left: auto; }
  .sup-ws-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 8px;
    border: 1px solid ${C.border}; background: ${C.surface};
    color: ${C.textMid}; font-size: 11px; font-weight: 700;
    cursor: pointer; font-family: 'Barlow', sans-serif;
    transition: all .15s; white-space: nowrap;
  }
  .sup-ws-btn:hover { border-color: ${C.borderMid}; background: ${C.surface2}; color: ${C.text}; }
  .sup-ws-btn.resolve {
    background: ${C.accent}; color: #fff; border-color: ${C.accent};
  }
  .sup-ws-btn.resolve:hover { opacity: .88; }
  .sup-ws-btn.resolved {
    background: ${C.textDim}; color: #fff; border-color: ${C.textDim}; cursor: default;
  }

  /* ── CHAT AREA ── */
  .sup-chat-area {
    flex: 1; overflow-y: auto; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .sup-chat-area::-webkit-scrollbar { width: 3px; }
  .sup-chat-area::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }

  .sup-msg-row { display: flex; gap: 8px; max-width: 90%; }
  .sup-msg-row.agent { flex-direction: row-reverse; align-self: flex-end; }
  .sup-msg-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 900; flex-shrink: 0; margin-top: 2px;
  }
  .sup-msg-bubble {
    padding: 9px 12px; border-radius: 12px;
    font-size: 12px; line-height: 1.55; font-weight: 500; max-width: 100%;
  }
  .sup-msg-row:not(.agent) .sup-msg-bubble {
    background: ${C.surface}; border: 1px solid ${C.border};
    color: ${C.text}; border-top-left-radius: 4px;
  }
  .sup-msg-row.agent .sup-msg-bubble {
    background: ${C.accent}; color: #fff; border-top-right-radius: 4px;
  }
  .sup-msg-time { font-size: 9px; color: ${C.textDim}; font-weight: 600; margin-top: 3px; }
  .sup-msg-row:not(.agent) .sup-msg-time { text-align: left; }
  .sup-msg-row.agent .sup-msg-time { text-align: right; }
  .sup-system-msg {
    text-align: center; font-size: 10px; color: ${C.textDim};
    font-weight: 600; padding: 4px 0; letter-spacing: .04em;
  }

  /* ── COMPOSE ── */
  .sup-compose-area {
    padding: 12px 18px; background: ${C.surface};
    border-top: 1px solid ${C.border}; flex-shrink: 0;
  }
  .sup-compose-box {
    display: flex; align-items: flex-end; gap: 8px;
    background: ${C.surface2}; border: 1.5px solid ${C.border};
    border-radius: 12px; padding: 10px 12px;
    transition: border-color .15s;
  }
  .sup-compose-box:focus-within { border-color: ${C.accentBorder}; }
  .sup-compose-input {
    flex: 1; border: none; background: transparent;
    font-family: 'Barlow', sans-serif;
    font-size: 12.5px; font-weight: 500; color: ${C.text};
    resize: none; outline: none; line-height: 1.5;
    min-height: 36px; max-height: 100px;
  }
  .sup-compose-input::placeholder { color: ${C.textDim}; }
  .sup-send-btn {
    width: 32px; height: 32px; border-radius: 9px;
    background: ${C.accent}; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0; transition: opacity .15s;
  }
  .sup-send-btn:hover { opacity: .88; }

  /* ── DETAIL PANEL ── */
  .sup-detail {
    background: ${C.surface}; border-left: 1px solid ${C.border};
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sup-dp-section { border-bottom: 1px solid ${C.border}; padding: 13px 14px; flex-shrink: 0; }
  .sup-dp-title {
    font-size: 9.5px; font-weight: 800; color: ${C.textDim};
    letter-spacing: .12em; text-transform: uppercase;
    margin-bottom: 9px;
  }

  /* ride search */
  .sup-ride-search { display: flex; gap: 6px; }
  .sup-ride-input {
    flex: 1; border: 1.5px solid ${C.border}; border-radius: 8px;
    padding: 7px 10px; font-family: 'Barlow', sans-serif;
    font-size: 12px; font-weight: 600; color: ${C.text};
    background: ${C.surface2}; outline: none; transition: border-color .15s;
  }
  .sup-ride-input:focus { border-color: ${C.accentBorder}; }
  .sup-ride-input::placeholder { color: ${C.textDim}; font-weight: 500; }
  .sup-look-btn {
    padding: 7px 12px; border-radius: 8px;
    background: ${C.blue}; color: #fff; border: none;
    font-family: 'Barlow', sans-serif; font-size: 11px; font-weight: 700;
    cursor: pointer; transition: opacity .15s; white-space: nowrap;
  }
  .sup-look-btn:hover { opacity: .88; }
  .sup-ride-card {
    background: ${C.surface2}; border: 1px solid ${C.border};
    border-radius: 10px; padding: 10px 12px; margin-top: 9px;
    animation: sup-fadein .2s ease;
  }
  .sup-ride-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 5px;
  }
  .sup-ride-label { font-size: 10px; color: ${C.textDim}; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  .sup-ride-val { font-size: 12px; color: ${C.text}; font-weight: 700; }
  .sup-ride-val.green { color: ${C.accent}; }
  .sup-ride-val.blue { color: ${C.blue}; }
  .sup-ride-route {
    display: flex; flex-direction: column; gap: 4px;
    margin: 8px 0; padding: 8px;
    background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 8px;
  }
  .sup-route-row { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600; color: ${C.textMid}; }
  .sup-route-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sup-route-line { width: 1px; height: 10px; background: ${C.border}; margin-left: 3px; }
  .sup-ride-err {
    font-size: 11px; color: ${C.red}; font-weight: 600; margin-top: 8px;
    padding: 8px 10px; background: ${C.redBg}; border: 1px solid ${C.redBorder};
    border-radius: 8px; animation: sup-fadein .2s ease;
  }

  /* quick actions */
  .sup-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .sup-action-btn {
    padding: 9px 8px; border-radius: 8px;
    border: 1px solid ${C.border}; background: ${C.surface2};
    font-family: 'Barlow', sans-serif; font-size: 11px; font-weight: 700;
    color: ${C.textMid}; cursor: pointer; text-align: center;
    transition: all .15s; display: flex; align-items: center;
    justify-content: center; gap: 5px;
  }
  .sup-action-btn:hover { border-color: ${C.borderMid}; color: ${C.text}; background: ${C.bg}; }
  .sup-action-btn.danger {
    border-color: ${C.redBorder}; color: ${C.red}; background: ${C.redBg};
  }
  .sup-action-btn.danger:hover { background: ${C.red}; color: #fff; border-color: ${C.red}; }

  /* user section */
  .sup-user-section { padding: 13px 14px; flex: 1; overflow-y: auto; }
  .sup-user-section::-webkit-scrollbar { width: 3px; }
  .sup-user-section::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  .sup-user-card { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .sup-user-av {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px; font-weight: 900; flex-shrink: 0;
  }
  .sup-user-name { font-size: 13px; font-weight: 800; color: ${C.text}; margin-bottom: 1px; }
  .sup-user-sub { font-size: 11px; color: ${C.textDim}; font-weight: 500; }
  .sup-user-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .sup-stat-box {
    background: ${C.surface2}; border: 1px solid ${C.border};
    border-radius: 8px; padding: 8px 10px;
  }
  .sup-stat-label {
    font-size: 9px; font-weight: 800; color: ${C.textDim};
    letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px;
  }
  .sup-stat-val {
    font-size: 15px; font-weight: 900;
    font-family: 'Barlow Condensed', sans-serif; color: ${C.text};
  }
  .sup-stat-val.small { font-size: 11px; font-weight: 700; padding-top: 2px; }

  /* notes */
  .sup-notes-input {
    width: 100%; border: 1.5px solid ${C.border}; border-radius: 8px;
    padding: 8px 10px; font-family: 'Barlow', sans-serif;
    font-size: 11.5px; font-weight: 500; color: ${C.text};
    background: ${C.surface2}; outline: none; resize: none;
    height: 68px; line-height: 1.5; transition: border-color .15s;
  }
  .sup-notes-input:focus { border-color: ${C.accentBorder}; }
  .sup-notes-input::placeholder { color: ${C.textDim}; }
  .sup-save-note-btn {
    width: 100%; margin-top: 6px; padding: 9px;
    border-radius: 8px; background: ${C.accent}; color: #fff;
    border: none; font-family: 'Barlow', sans-serif;
    font-size: 12px; font-weight: 700; cursor: pointer; transition: opacity .15s;
  }
  .sup-save-note-btn:hover { opacity: .88; }

  /* empty state */
  .sup-empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 9px; color: ${C.textDim}; padding: 24px; text-align: center;
  }
  .sup-empty-icon {
    width: 42px; height: 42px; border-radius: 13px;
    background: ${C.surface2}; border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center; color: ${C.textDim};
  }
  .sup-empty-title { font-size: 12.5px; font-weight: 700; color: ${C.textMid}; }
  .sup-empty-sub { font-size: 11.5px; line-height: 1.55; }

  /* toast */
  .sup-toast {
    position: fixed; bottom: 20px; right: 20px; z-index: 999;
    background: ${C.text}; color: #fff;
    border-radius: 10px; padding: 10px 16px;
    font-size: 12.5px; font-weight: 700;
    animation: sup-toast-in .25s ease;
    font-family: 'Barlow', sans-serif;
    display: flex; align-items: center; gap: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  @keyframes sup-toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ─────────────────────────────────────────────────────────────────────
// HELPER UTILS
// ─────────────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ initials, bg, color, size = 32, fontSize = 12 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize, fontWeight: 900,
    }}>
      {initials}
    </div>
  );
}

function Pill({ label, cls }) {
  return <span className={`sup-pill ${cls}`}>{label}</span>;
}

// ─────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────

// ── TICKET ITEM ──────────────────────────────────────────────────────
function TicketItem({ ticket, selected, onClick, animDelay }) {
  const statusCls = ticket.status === "open"
    ? "sup-pill-open"
    : ticket.status === "pending"
      ? "sup-pill-pending"
      : "sup-pill-resolved";

  return (
    <div
      className={`sup-ticket-item${selected ? " selected" : ""}`}
      style={{ animationDelay: `${animDelay}s` }}
      onClick={onClick}
    >
      <div className="sup-t-row">
        <span className="sup-t-name">{ticket.name}</span>
        <span className="sup-t-time">{ticket.time}</span>
      </div>
      <div className="sup-t-subject">{ticket.subject}</div>
      <div className="sup-t-meta">
        <Pill label={ticket.type.toUpperCase()} cls={ticket.type === "rider" ? "sup-pill-rider" : "sup-pill-driver"} />
        <Pill label={ticket.status.toUpperCase()} cls={statusCls} />
        {ticket.priority && <Pill label="URGENT" cls="sup-pill-urgent" />}
      </div>
    </div>
  );
}

// ── QUEUE PANEL ───────────────────────────────────────────────────────
function QueuePanel({ tickets, selectedId, onSelect }) {
  const [filter, setFilter] = useState("all");

  const filtered = tickets.filter(t => filter === "all" || t.type === filter);
  const openCount = filtered.filter(t => t.status !== "resolved").length;

  return (
    <div className="sup-queue">
      <div className="sup-queue-header">
        <div className="sup-queue-title">
          Ticket Queue
          <span className="sup-count-badge">{openCount} OPEN</span>
        </div>
        <div className="sup-filter-row">
          {["all", "rider", "driver"].map(f => (
            <button
              key={f}
              className={`sup-filter-btn${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="sup-ticket-list">
        {filtered.map((t, i) => (
          <TicketItem
            key={t.id}
            ticket={t}
            selected={t.id === selectedId}
            onClick={() => onSelect(t)}
            animDelay={i * 0.04}
          />
        ))}
      </div>
    </div>
  );
}

// ── CHAT MESSAGE ──────────────────────────────────────────────────────
function ChatMessage({ msg, ticket }) {
  const isAgent = msg.from === "agent";
  return (
    <div className={`sup-msg-row${isAgent ? " agent" : ""}`}>
      <Avatar
        initials={isAgent ? "SM" : ticket.initials}
        bg={isAgent ? C.accentBg : ticket.avatarBg}
        color={isAgent ? C.accent : ticket.avatarColor}
        size={26}
        fontSize={10}
      />
      <div>
        <div className="sup-msg-bubble">{msg.text}</div>
        <div className="sup-msg-time">{msg.time}</div>
      </div>
    </div>
  );
}

// ── WORKSPACE ─────────────────────────────────────────────────────────
function Workspace({ ticket, messages, onSend, onResolve, onTransfer, onSnooze }) {
  const chatRef    = useRef(null);
  const inputRef   = useRef(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => { setDraft(""); }, [ticket?.id]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  };

  if (!ticket) {
    return (
      <div className="sup-workspace">
        <div className="sup-empty">
          <div className="sup-empty-icon">
            <MessageSquare size={20} />
          </div>
          <div className="sup-empty-title">No ticket selected</div>
          <div className="sup-empty-sub">Select a ticket from the queue to open the conversation</div>
        </div>
      </div>
    );
  }

  const resolved = ticket.status === "resolved";

  return (
    <div className="sup-workspace">
      {/* Topbar */}
      <div className="sup-ws-topbar">
        <Avatar
          initials={ticket.initials}
          bg={ticket.avatarBg}
          color={ticket.avatarColor}
          size={32}
          fontSize={12}
        />
        <div className="sup-ws-info">
          <div className="sup-ws-name">{ticket.name} · {ticket.id}</div>
          <div className="sup-ws-subject">{ticket.subject}</div>
        </div>
        <div className="sup-ws-actions">
          <button className="sup-ws-btn" onClick={onTransfer}>
            <ArrowLeftRight size={12} /> Transfer
          </button>
          <button className="sup-ws-btn" onClick={onSnooze}>
            <Clock size={12} /> Snooze
          </button>
          <button
            className={`sup-ws-btn ${resolved ? "resolved" : "resolve"}`}
            onClick={!resolved ? onResolve : undefined}
          >
            <CheckCircle size={12} />
            {resolved ? "Resolved ✓" : "Resolve"}
          </button>
        </div>
      </div>

      {/* Chat thread */}
      <div className="sup-chat-area" ref={chatRef}>
        <div className="sup-system-msg">— Ticket opened · {ticket.time} —</div>
        {messages.map((m, i) => (
          m.type === "system"
            ? <div key={i} className="sup-system-msg">{m.text}</div>
            : <ChatMessage key={i} msg={m} ticket={ticket} />
        ))}
      </div>

      {/* Compose */}
      <div className="sup-compose-area">
        <div className="sup-compose-box">
          <textarea
            ref={inputRef}
            className="sup-compose-input"
            placeholder={resolved ? "Ticket is resolved" : "Type a reply… (Enter to send)"}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            disabled={resolved}
            rows={1}
          />
          <button className="sup-send-btn" onClick={handleSend} disabled={resolved}>
            <Send size={14} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RIDE LOOKUP ───────────────────────────────────────────────────────
function RideLookup() {
  const [query, setQuery]   = useState("");
  const [ride, setRide]     = useState(null);
  const [error, setError]   = useState("");

  const lookup = () => {
    const key = query.trim().toUpperCase();
    const found = MOCK_RIDES[key];
    if (found) { setRide(found); setError(""); }
    else        { setRide(null); setError(`No ride found for "${key}"`); }
  };

  const statusColor  = ride?.status === "completed" ? C.accent : C.red;
  const statusBg     = ride?.status === "completed" ? C.accentBg : C.redBg;
  const statusBorder = ride?.status === "completed" ? C.accentBorder : C.redBorder;

  return (
    <div className="sup-dp-section">
      <div className="sup-dp-title">Ride Lookup</div>
      <div className="sup-ride-search">
        <input
          className="sup-ride-input"
          placeholder="Ride ID (e.g. R-9921)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookup()}
        />
        <button className="sup-look-btn" onClick={lookup}>Look up</button>
      </div>
      {error && <div className="sup-ride-err">{error}</div>}
      {ride && (
        <div className="sup-ride-card">
          <div className="sup-ride-row">
            <span className="sup-ride-label">Ride ID</span>
            <span className="sup-ride-val blue">{ride.id}</span>
          </div>
          <div className="sup-ride-row">
            <span className="sup-ride-label">Date</span>
            <span className="sup-ride-val">{ride.date}</span>
          </div>
          <div className="sup-ride-row">
            <span className="sup-ride-label">Status</span>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "2px 8px",
              borderRadius: 6, background: statusBg,
              color: statusColor, border: `1px solid ${statusBorder}`,
              letterSpacing: ".04em",
            }}>
              {ride.status.toUpperCase()}
            </span>
          </div>
          <div className="sup-ride-route">
            <div className="sup-route-row">
              <div className="sup-route-dot" style={{ background: "#111" }} />
              <span>{ride.pickup}</span>
            </div>
            <div style={{ display: "flex", paddingLeft: 3 }}>
              <div className="sup-route-line" />
            </div>
            <div className="sup-route-row">
              <div className="sup-route-dot" style={{ background: C.accent }} />
              <span>{ride.dropoff}</span>
            </div>
          </div>
          <div className="sup-ride-row">
            <span className="sup-ride-label">Fare</span>
            <span className="sup-ride-val green">{ride.fare}</span>
          </div>
          <div className="sup-ride-row">
            <span className="sup-ride-label">Distance</span>
            <span className="sup-ride-val">{ride.distance}</span>
          </div>
          <div className="sup-ride-row" style={{ marginBottom: 0 }}>
            <span className="sup-ride-label">Driver</span>
            <span className="sup-ride-val">{ride.driver}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── QUICK ACTIONS ─────────────────────────────────────────────────────
function QuickActions({ onAction }) {
  const actions = [
    { label: "50% Refund",   key: "Partial refund issued (50%)",  icon: <DollarSign size={12} />,  cls: "" },
    { label: "Full Refund",  key: "Full refund issued",            icon: <DollarSign size={12} />,  cls: "" },
    { label: "Adjust Fare",  key: "Fare adjustment applied",       icon: <SlidersHorizontal size={12} />, cls: "" },
    { label: "Flag User",    key: "User flagged for review",       icon: <Flag size={12} />,        cls: "danger" },
  ];
  return (
    <div className="sup-dp-section">
      <div className="sup-dp-title">Quick Actions</div>
      <div className="sup-action-grid">
        {actions.map(a => (
          <button key={a.key} className={`sup-action-btn ${a.cls}`} onClick={() => onAction(a.key)}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── USER PROFILE ──────────────────────────────────────────────────────
function UserProfile({ ticket, notes, onNotesChange, onSaveNote }) {
  if (!ticket) {
    return (
      <div className="sup-user-section">
        <div className="sup-dp-title">User Profile</div>
        <div style={{ color: C.textDim, fontSize: 11, fontWeight: 500, textAlign: "center", padding: "16px 0" }}>
          Select a ticket to view user info
        </div>
      </div>
    );
  }

  const u = ticket.user;
  const typeColor  = u.type === "Driver" ? C.blue   : C.accent;
  const typeBg     = u.type === "Driver" ? C.blueBg : C.accentBg;
  const typeBorder = u.type === "Driver" ? C.blueBorder : C.accentBorder;

  return (
    <div className="sup-user-section">
      <div className="sup-dp-title">User Profile</div>

      <div className="sup-user-card">
        <Avatar initials={ticket.initials} bg={ticket.avatarBg} color={ticket.avatarColor} size={36} fontSize={14} />
        <div>
          <div className="sup-user-name">{u.name}</div>
          <div className="sup-user-sub">{u.email}</div>
          <div className="sup-user-sub">{u.phone}</div>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: "3px 10px",
          borderRadius: 100, background: typeBg, color: typeColor,
          border: `1px solid ${typeBorder}`, letterSpacing: ".08em",
        }}>
          {u.type.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, marginLeft: 8 }}>
          Member since {u.since}
        </span>
      </div>

      <div className="sup-user-stats">
        <div className="sup-stat-box">
          <div className="sup-stat-label">Rides</div>
          <div className="sup-stat-val">{u.rides}</div>
        </div>
        <div className="sup-stat-box">
          <div className="sup-stat-label">Rating</div>
          <div className="sup-stat-val">{u.rating}</div>
        </div>
        <div className="sup-stat-box" style={{ gridColumn: "1 / -1" }}>
          <div className="sup-stat-label">{u.type === "Driver" ? "Total Earned" : "Total Spent"}</div>
          <div className="sup-stat-val small">{u.spend}</div>
        </div>
      </div>

      <div className="sup-dp-title">Agent Notes</div>
      <textarea
        className="sup-notes-input"
        placeholder="Internal notes (not visible to user)..."
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
      />
      <button className="sup-save-note-btn" onClick={onSaveNote}>
        Save Note
      </button>
    </div>
  );
}

// ── TOAST ─────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="sup-toast">
      <CheckCircle size={14} color={C.accent} />
      {msg}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────
export default function UaTobSupportAgent({
  agentName = "Sarah M.",
  agentUid  = "agent-001",
  // In production, pass real data via props or hooks:
  // tickets, onSendMessage, onResolveTicket, onLookupRide, onAction
}) {
  const [tickets,     setTickets]     = useState(() =>
    MOCK_TICKETS.map(t => ({ ...t, messages: [...t.messages] }))
  );
  const [selectedId,  setSelectedId]  = useState(null);
  const [notesMap,    setNotesMap]    = useState({});  // { [ticketId]: string }
  const [toast,       setToast]       = useState(null);
  const toastTimer = useRef(null);

  const selectedTicket = tickets.find(t => t.id === selectedId) ?? null;
  const messages       = selectedTicket?.messages ?? [];

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── Select ticket ─────────────────────────────────────────────────
  const handleSelect = useCallback((ticket) => {
    setSelectedId(ticket.id);
  }, []);

  // ── Send message ──────────────────────────────────────────────────
  const handleSend = useCallback((text) => {
    if (!selectedId) return;
    const msg = { from: "agent", text, time: nowTime() };
    setTickets(prev =>
      prev.map(t =>
        t.id === selectedId
          ? { ...t, messages: [...t.messages, msg] }
          : t
      )
    );
    showToast("Reply sent");
    // Production: await addDoc(collection(db,'supportTickets',selectedId,'messages'), { ...msg, agentUid, createdAt: serverTimestamp() })
  }, [selectedId, showToast]);

  // ── Resolve ticket ────────────────────────────────────────────────
  const handleResolve = useCallback(() => {
    if (!selectedId) return;
    setTickets(prev =>
      prev.map(t =>
        t.id === selectedId
          ? { ...t, status: "resolved", messages: [...t.messages, { type: "system", text: "— Ticket marked resolved —" }] }
          : t
      )
    );
    showToast("Ticket resolved ✓");
    // Production: await updateDoc(doc(db,'supportTickets',selectedId), { status:'resolved', resolvedAt: serverTimestamp(), resolvedBy: agentUid })
  }, [selectedId, showToast]);

  // ── Transfer ──────────────────────────────────────────────────────
  const handleTransfer = useCallback(() => {
    if (!selectedId) return;
    setTickets(prev =>
      prev.map(t =>
        t.id === selectedId
          ? { ...t, messages: [...t.messages, { type: "system", text: `— Transferred to Tier 2 · ${nowTime()} —` }] }
          : t
      )
    );
    showToast("Ticket transferred to Tier 2");
  }, [selectedId, showToast]);

  // ── Snooze ────────────────────────────────────────────────────────
  const handleSnooze = useCallback(() => {
    if (!selectedId) return;
    setTickets(prev =>
      prev.map(t =>
        t.id === selectedId
          ? { ...t, messages: [...t.messages, { type: "system", text: `— Snoozed 2 hours · ${nowTime()} —` }] }
          : t
      )
    );
    showToast("Snoozed for 2 hours");
  }, [selectedId, showToast]);

  // ── Quick action ──────────────────────────────────────────────────
  const handleAction = useCallback((label) => {
    if (!selectedId) { showToast("Select a ticket first"); return; }
    setTickets(prev =>
      prev.map(t =>
        t.id === selectedId
          ? { ...t, messages: [...t.messages, { type: "system", text: `— ${label} · ${nowTime()} —` }] }
          : t
      )
    );
    showToast(label);
    // Production: await httpsCallable(functions,'supportAction')({ ticketId: selectedId, action: label, agentUid })
  }, [selectedId, showToast]);

  // ── Notes ─────────────────────────────────────────────────────────
  const handleNotesChange = useCallback((val) => {
    if (!selectedId) return;
    setNotesMap(prev => ({ ...prev, [selectedId]: val }));
  }, [selectedId]);

  const handleSaveNote = useCallback(() => {
    showToast("Note saved");
    // Production: await setDoc(doc(db,'supportTickets',selectedId,'notes','agent'), { text: notesMap[selectedId], updatedAt: serverTimestamp() })
  }, [selectedId, notesMap, showToast]);

  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SUPPORT_CSS }} />
      <div className="sup-root">

        {/* TOPBAR */}
        <div className="sup-topbar">
          <div className="sup-logo">
            <div className="sup-logo-mark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 18l7-7 7 7" />
              </svg>
            </div>
            <div className="sup-logo-text">
              UaTob <span className="sup-logo-dim">Support</span>
            </div>
          </div>
          <div className="sup-topbar-div" />
          <span className="sup-label">Agent Console</span>
          <div className="sup-agent-chip">
            <div className="sup-agent-dot" />
            <span className="sup-agent-name">{agentName} · Online</span>
          </div>
        </div>

        {/* 3-COLUMN GRID */}
        <div className="sup-main">

          {/* LEFT: Queue */}
          <QueuePanel
            tickets={tickets}
            selectedId={selectedId}
            onSelect={handleSelect}
          />

          {/* MIDDLE: Workspace */}
          <Workspace
            ticket={selectedTicket}
            messages={messages}
            onSend={handleSend}
            onResolve={handleResolve}
            onTransfer={handleTransfer}
            onSnooze={handleSnooze}
          />

          {/* RIGHT: Detail Panel */}
          <div className="sup-detail">
            <RideLookup />
            <QuickActions onAction={handleAction} />
            <UserProfile
              ticket={selectedTicket}
              notes={notesMap[selectedId] ?? ""}
              onNotesChange={handleNotesChange}
              onSaveNote={handleSaveNote}
            />
          </div>

        </div>
      </div>

      <Toast msg={toast} />
    </>
  );
}