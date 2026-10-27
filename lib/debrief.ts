// Post-interview debrief: what happened, while it's still fresh

export const DEBRIEF_FIELDS = ["debriefNotes", "peopleMet", "questionsAsked", "prepNotes", "nextStep"] as const;

export type Debrief = {
  rating: number | null;
  replyBy: Date | null;
} & Record<(typeof DEBRIEF_FIELDS)[number], string | null>;

// A debrief from a request body; any part can be left empty and filled in later. null = not a debrief.
export function parseDebrief(body: unknown): Debrief | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const rating = Number.isInteger(b.rating) && (b.rating as number) >= 1 && (b.rating as number) <= 5 ? (b.rating as number) : null;
  const replyBy = typeof b.replyBy === "string" && !isNaN(Date.parse(b.replyBy)) ? new Date(b.replyBy) : null;
  return {
    rating,
    replyBy,
    ...(Object.fromEntries(DEBRIEF_FIELDS.map((f) => [f, text(b[f])])) as Record<(typeof DEBRIEF_FIELDS)[number], string | null>),
  };
}

// Prompt for a debrief once a real interview (not the application itself) has happened
export function needsDebrief(
  {stage, outcome, date, debriefedAt}: { stage?: string | null; outcome?: string | null; date?: Date | null; debriefedAt?: string | Date | null },
  now = Date.now(),
): boolean {
  return stage !== "Applied" && (outcome ?? "").toUpperCase() === "SCHEDULED" && !!date && date.getTime() < now && !debriefedAt;
}
