// Slots offered on an availability link that can still be booked
const MINUTE_MS = 60 * 1000;
const DEFAULT_BUSY_MINUTES = 60; // existing interviews have no end time, assume an hour like the calendar feed

export function openSlots(
  slots: Date[],
  durationMinutes: number,
  busy: Date[], // start times of interviews already scheduled
  now = Date.now(),
): Date[] {
  return slots
    .filter((start) => start.getTime() > now)
    .filter((start) => {
      const end = start.getTime() + durationMinutes * MINUTE_MS;
      return !busy.some((b) => b.getTime() < end && b.getTime() + DEFAULT_BUSY_MINUTES * MINUTE_MS > start.getTime());
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

export function isOfferedSlot(slots: Date[], slot: Date): boolean {
  return slots.some((s) => s.getTime() === slot.getTime());
}
