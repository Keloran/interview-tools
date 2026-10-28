import {clerkClient} from "@clerk/nextjs/server";
import {isClerkAPIResponseError} from "@clerk/nextjs/errors";
import {GOOGLE_FREEBUSY_SCOPE, type Busy} from "@/lib/availability";
import {reportError} from "@/lib/bugfixes";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const CACHE_MS = 5 * MINUTE_MS;

// ponytail: per-instance memory cache, cleared wholesale when it gets big; shared cache if instances multiply
const cache = new Map<string, { at: number; busy: Busy[] }>();

async function googleFreeBusy(token: string, from: Date, to: Date): Promise<Busy[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{id: "primary"}]}),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Google freeBusy returned ${res.status}`);
  const body = await res.json();
  const busy: { start: string; end: string }[] = body.calendars?.primary?.busy ?? [];
  return busy.map(({start, end}) => ({start: new Date(start), durationMinutes: (Date.parse(end) - Date.parse(start)) / MINUTE_MS}));
}

// Busy times from the user's connected Google Calendar: free/busy only, no event details, nothing stored.
// Fails open: not connected, no calendar scope or a Google error gives [], so availability works as before.
export async function externalBusy(clerkId: string, from: Date, to: Date, now = Date.now()): Promise<Busy[]> {
  const key = `${clerkId}|${from.getTime()}|${to.getTime()}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.busy;

  let busy: Busy[] = [];
  try {
    const {data} = await (await clerkClient()).users.getUserOauthAccessToken(clerkId, "google");
    const token = data.find((t) => t.scopes?.includes(GOOGLE_FREEBUSY_SCOPE))?.token;
    if (token) busy = await googleFreeBusy(token, from, to);
  } catch (error) {
    // Clerk 4xx: no Google account linked (or access revoked), which just means no calendar
    if (!(isClerkAPIResponseError(error) && error.status < 500 && error.status !== 429)) reportError("externalBusy (Google free/busy)", error);
    return [];
  }
  if (cache.size > 1000) cache.clear();
  cache.set(key, {at: now, busy});
  return busy;
}

// For an availability link: the day either side of its offered slots, so the booking page and booking share a cache entry
export function externalBusyAroundSlots(clerkId: string, slots: Date[]): Promise<Busy[]> {
  if (!slots.length) return Promise.resolve([]);
  const times = slots.map((s) => s.getTime());
  return externalBusy(clerkId, new Date(Math.min(...times) - DAY_MS), new Date(Math.max(...times) + DAY_MS));
}
