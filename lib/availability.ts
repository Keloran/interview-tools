// When you can take an interview without bunching them up.
// Between two interviews: 30m to get ready + 15m for overruns and a drink/toilet break.
// Nothing gets booked within 30m of now either, so there's always time to get ready.
// ponytail: fixed for everyone; make these per-user settings if people want different gaps
export const PREP_MINUTES = 30;
export const GAP_BETWEEN_MINUTES = 45;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;

const MINUTE_MS = 60 * 1000;

export type Busy = { start: Date; durationMinutes: number };

// Requested only when the user connects their calendar, never at sign-in
export const GOOGLE_FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";

const end = ({start, durationMinutes}: Busy) => start.getTime() + durationMinutes * MINUTE_MS;

export function clashes(candidate: Busy, busy: Busy[]): boolean {
  const gap = GAP_BETWEEN_MINUTES * MINUTE_MS;
  return busy.some((b) => candidate.start.getTime() < end(b) + gap && b.start.getTime() < end(candidate) + gap);
}

const tooSoon = (start: Date, now: number) => start.getTime() < now + PREP_MINUTES * MINUTE_MS;

// Offered slots on an availability link that can still be booked
export function openSlots(slots: Date[], durationMinutes: number, busy: Busy[], now = Date.now()): Date[] {
  return slots
    .filter((start) => !tooSoon(start, now) && !clashes({start, durationMinutes}, busy))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function isOfferedSlot(slots: Date[], slot: Date): boolean {
  return slots.some((s) => s.getTime() === slot.getTime());
}

const atMinutes = (day: Date, minutes: number) => {
  const d = new Date(day);
  d.setHours(0, minutes, 0, 0); // rolls minutes over and stays right across DST changes
  return d;
};

// Free start times on a day (local time, e.g. from the owner's browser), every `stepMinutes`
export function suggestSlots(
  day: Date,
  durationMinutes: number,
  busy: Busy[],
  {fromHour = DAY_START_HOUR, toHour = DAY_END_HOUR, stepMinutes = 30} = {},
  now = Date.now(),
): Date[] {
  const suggestions: Date[] = [];
  for (let minutes = fromHour * 60; minutes + durationMinutes <= toHour * 60; minutes += stepMinutes) {
    const start = atMinutes(day, minutes);
    if (!tooSoon(start, now) && !clashes({start, durationMinutes}, busy)) suggestions.push(start);
  }
  return suggestions;
}

// Windows on a day you could fit another interview into, e.g. 9:00-11:15 and 14:45-18:00
export function freeWindows(
  day: Date,
  busy: Busy[],
  {fromHour = DAY_START_HOUR, toHour = DAY_END_HOUR, minMinutes = 30} = {},
  now = Date.now(),
): { start: Date; end: Date }[] {
  const gap = GAP_BETWEEN_MINUTES * MINUTE_MS;
  let cursor = Math.max(atMinutes(day, fromHour * 60).getTime(), now + PREP_MINUTES * MINUTE_MS);
  const dayEnd = atMinutes(day, toHour * 60).getTime();
  const windows: { start: Date; end: Date }[] = [];

  for (const b of [...busy].sort((x, y) => x.start.getTime() - y.start.getTime())) {
    const blockedFrom = b.start.getTime() - gap;
    if (blockedFrom - cursor >= minMinutes * MINUTE_MS && cursor < dayEnd) {
      windows.push({start: new Date(cursor), end: new Date(Math.min(blockedFrom, dayEnd))});
    }
    cursor = Math.max(cursor, end(b) + gap);
  }
  if (dayEnd - cursor >= minMinutes * MINUTE_MS) windows.push({start: new Date(cursor), end: new Date(dayEnd)});
  return windows;
}

// Tracking a sent availability link: an unopened one is a ghosting signal
export const LINK_IGNORED_AFTER_DAYS = 7;

export type LinkTracking = {
  sentAt?: string | Date | null;
  created_at: string | Date;
  viewCount: number;
  lastViewedAt: string | Date | null;
  bookedSlot: string | Date | null;
};

export type LinkState = "booked" | "opened" | "sent" | "ignored" | "created";

export function linkState(link: LinkTracking, now = Date.now()): LinkState {
  if (link.bookedSlot) return "booked";
  if (link.viewCount > 0) return "opened";
  if (link.sentAt === null) return "created";
  const ageDays = (now - new Date(link.sentAt ?? link.created_at).getTime()) / (24 * 60 * MINUTE_MS);
  return ageDays >= LINK_IGNORED_AFTER_DAYS ? "ignored" : "sent";
}
