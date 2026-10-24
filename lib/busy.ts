import type {Busy} from "@/lib/availability";
import {toISODate} from "@/lib/utils";

type ScheduledInterview = { date: string | null; durationMinutes?: number; outcome: string | null };

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// Your scheduled interviews around a day; the API filters by UTC day so widen by a day either side
export async function getBusy(day: string): Promise<Busy[]> {
  const url = new URL("/api/interviews", window.location.origin);
  url.searchParams.set("dateFrom", addDays(day, -1));
  url.searchParams.set("dateTo", addDays(day, 1));
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load your interviews");
  const interviews: ScheduledInterview[] = await res.json();
  return interviews
    .filter((i) => i.outcome === "SCHEDULED" && i.date)
    .map((i) => ({start: new Date(i.date!), durationMinutes: i.durationMinutes ?? 60}));
}
