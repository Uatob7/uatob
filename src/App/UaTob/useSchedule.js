// src/App/UaTob/useSchedule.js
import { useState, useMemo, useCallback } from 'react';

const pad = n => String(n).padStart(2, '0');

/**
 * Encapsulates all schedule-picker state and logic.
 *
 * @param {function} onChange  Called with an ISO string when a time is confirmed,
 *                             or null when "Ride Now" is selected.
 *
 * Returns:
 *   step          'now' | 'cal' | 'time' | 'done'
 *   calYear       number
 *   calMonth      number  (0-based)
 *   selDay        Date | null
 *   selHour       number | null
 *   selMinute     number | null
 *   scheduledAt   ISO string | null
 *   summary       Formatted string for the done state, e.g. "Sat, Jun 7, 2:30 PM"
 *   firstDow      number  Day-of-week of the 1st of calMonth (for calendar grid)
 *   daysInMonth   number
 *   hours         number[]  0-23
 *   minDate       Date      Now + 15 min
 *   maxDate       Date      Now + 7 days
 *
 *   handleSelectNow()
 *   handleScheduleBtn()
 *   prevMonth()
 *   nextMonth()
 *   handleDayClick(d: number)
 *   handleHourClick(h: number)
 *   handleMinuteClick(m: number)
 *   isDayDisabled(y, m, d) → bool
 *   isDaySelected(y, m, d) → bool
 *   isToday(y, m, d)       → bool
 *   isHourDisabled(h, min?) → bool
 */
export function useSchedule(onChange) {
  const now = new Date();

  const [step,       setStep]      = useState('now');
  const [calYear,    setCalYear]   = useState(now.getFullYear());
  const [calMonth,   setCalMonth]  = useState(now.getMonth());
  const [selDay,     setSelDay]    = useState(null);
  const [selHour,    setSelHour]   = useState(null);
  const [selMinute,  setSelMinute] = useState(null);
  const [scheduledAt, setScheduledAt] = useState(null);

  const minDate = useMemo(() => new Date(now.getTime() + 15 * 60 * 1000), []);
  const maxDate = useMemo(() => new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), []);

  const firstDow   = useMemo(() => new Date(calYear, calMonth, 1).getDay(), [calYear, calMonth]);
  const daysInMonth = useMemo(() => new Date(calYear, calMonth + 1, 0).getDate(), [calYear, calMonth]);
  const hours      = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  // ── Helpers ──────────────────────────────────────────────────────
  const isDayDisabled = useCallback((y, m, d) => {
    const date = new Date(y, m, d, 23, 59);
    return date < minDate || date > maxDate;
  }, [minDate, maxDate]);

  const isDaySelected = useCallback((y, m, d) =>
    selDay &&
    selDay.getFullYear() === y &&
    selDay.getMonth()    === m &&
    selDay.getDate()     === d,
  [selDay]);

  const isToday = useCallback((y, m, d) =>
    y === now.getFullYear() &&
    m === now.getMonth()    &&
    d === now.getDate(),
  [now]);

  const isHourDisabled = useCallback((h, min = 0) => {
    if (!selDay) return true;
    const dt = new Date(selDay);
    dt.setHours(h, min, 0, 0);
    return dt < minDate;
  }, [selDay, minDate]);

  // ── Commit when day + hour + minute are all set ──────────────────
  const commit = useCallback((day, hour, minute) => {
    if (day === null || hour === null || minute === null) return;
    const d = new Date(day);
    d.setHours(hour, minute, 0, 0);
    const iso = d.toISOString();
    setScheduledAt(iso);
    onChange?.(iso);
    setStep('done');
  }, [onChange]);

  // ── Navigation / selection ────────────────────────────────────────
  const handleSelectNow = useCallback(() => {
    setStep('now');
    setSelDay(null);
    setSelHour(null);
    setSelMinute(null);
    setScheduledAt(null);
    onChange?.(null);
  }, [onChange]);

  const handleScheduleBtn = useCallback(() => {
    if (step === 'now' || step === 'done') setStep('cal');
    // mid-flow: tapping Schedule again is a no-op; use Cancel row
  }, [step]);

  const handleBackToCal = useCallback(() => {
    setStep('cal');
    setSelHour(null);
    setSelMinute(null);
  }, []);

  const prevMonth = useCallback(() => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }, [calMonth]);

  const handleDayClick = useCallback((d) => {
    setSelDay(new Date(calYear, calMonth, d));
    setSelHour(null);
    setSelMinute(null);
    setStep('time');
  }, [calYear, calMonth]);

  const handleHourClick = useCallback((h) => {
    if (isHourDisabled(h)) return;
    setSelHour(h);
    setSelMinute(null);
  }, [isHourDisabled]);

  const handleMinuteClick = useCallback((m) => {
    if (selHour === null || isHourDisabled(selHour, m)) return;
    setSelMinute(m);
    commit(selDay, selHour, m);
  }, [selHour, selDay, isHourDisabled, commit]);

  // ── Derived display ───────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, [scheduledAt]);

  return {
    // State
    step,
    calYear,
    calMonth,
    selDay,
    selHour,
    selMinute,
    scheduledAt,
    summary,
    // Calendar helpers
    firstDow,
    daysInMonth,
    hours,
    minDate,
    maxDate,
    // Predicates
    isDayDisabled,
    isDaySelected,
    isToday,
    isHourDisabled,
    // Handlers
    handleSelectNow,
    handleScheduleBtn,
    handleBackToCal,
    prevMonth,
    nextMonth,
    handleDayClick,
    handleHourClick,
    handleMinuteClick,
  };
}