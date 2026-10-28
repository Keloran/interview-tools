import type {Busy} from "@/lib/availability";
import {toISODate} from "@/lib/utils";

type ScheduledInterview = { date: string | null; durationMinutes?: number; outcome: string | null; stage?: {stage: string} };

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// Busy times from a connected calendar around a day; failing just means interviews only
async function getCalendarBusy(day: string): Promise<Busy[]> {
  const url = new URL("/api/busy", window.location.origin);
  url.searchParams.set("from", new Date(`${addDays(day, -1)}T00:00`).toISOString());
  url.searchParams.set("to", new Date(`${addDays(day, 2)}T00:00`).toISOString());
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return [];
  const busy: { start: string; durationMinutes: number }[] = await res.json();
  return busy.map((b) => ({start: new Date(b.start), durationMinutes: b.durationMinutes}));
}

// Your scheduled interviews around a day, plus your calendar's busy times; the API filters by UTC day so widen by a day either side
export async function getBusy(day: string): Promise<Busy[]> {
  const calendar = getCalendarBusy(day);
  const url = new URL("/api/interviews", window.location.origin);
  url.searchParams.set("dateFrom", addDays(day, -1));
  url.searchParams.set("dateTo", addDays(day, 1));
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load your interviews");
  const interviews: ScheduledInterview[] = await res.json();
  return interviews
    .filter((i) => i.outcome === "SCHEDULED" && i.date && i.stage?.stage.trim().toLowerCase() !== "offer")
    .map((i) => ({start: new Date(i.date!), durationMinutes: i.durationMinutes ?? 60}))
    .concat(await calendar);
}
