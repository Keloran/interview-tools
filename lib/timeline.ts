import type {Prisma} from "@/app/generated/prisma/client";

export const timelineSelect = {
  id: true, jobTitle: true, clientCompany: true, applicationDate: true,
  company: {select: {name: true}},
  interviews: {select: {
    id: true, parentId: true, date: true, deadline: true, created_at: true, updated_at: true,
    interviewer: true, outcome: true, notes: true, feedbackType: true, feedbackText: true,
    debriefedAt: true, rating: true, debriefNotes: true, peopleMet: true, questionsAsked: true,
    prepNotes: true, nextStep: true, replyBy: true,
    stage: {select: {stage: true}}, stageMethod: {select: {method: true}},
  }},
  followUps: {select: {id: true, sentAt: true}, orderBy: [{sentAt: "asc"}, {id: "asc"}]},
  availabilityLinks: {select: {
    id: true, created_at: true, bookedSlot: true, viewCount: true, firstViewedAt: true, lastViewedAt: true,
    stage: {select: {stage: true}},
  }, orderBy: [{created_at: "asc"}, {id: "asc"}]},
} satisfies Prisma.ApplicationSelect;
type Serialized<T> = T extends Date ? string : T extends object ? {[K in keyof T]: Serialized<T[K]>} : T;
export type TimelineApplication = Serialized<Prisma.ApplicationGetPayload<{select: typeof timelineSelect}>>;
export type TimelineStage = TimelineApplication["interviews"][number];

const timestamp = (date: string) => Date.parse(date);
const day = 86400000;
const terminal = new Set(["REJECTED", "WITHDREW", "OFFER_ACCEPTED", "OFFER_DECLINED"]);
export const OUTCOME_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled", PASSED: "Passed", REJECTED: "Rejected", AWAITING_RESPONSE: "Awaiting response",
  OFFER_RECEIVED: "Offer received", OFFER_ACCEPTED: "Offer accepted", OFFER_DECLINED: "Offer declined", WITHDREW: "Withdrew",
};
export function daysBetween(from: string, to: string): number | null {
  const difference = timestamp(to) - timestamp(from);
  return Number.isFinite(difference) && difference >= 0 ? Math.floor(difference / day) : null;
}
export const dayLabel = (days: number) => `${days} day${days === 1 ? "" : "s"}`;
export function stageDate(stage: TimelineStage, applied: string): {date: string; label: string} {
  if (stage.stage.stage === "Applied") return {date: applied, label: "Applied"};
  if (stage.date) return {date: stage.date, label: "Scheduled for"};
  if (stage.deadline) return {date: stage.deadline, label: "Deadline"};
  return {date: stage.created_at, label: "Recorded"};
}

// Parents precede children even when dates or IDs disagree. Roots, siblings and
// disconnected records have a stable creation-time/ID order. Break malformed
// cycles once, retaining every stage rather than hiding history or looping.
export function orderedStages(stages: TimelineStage[]): TimelineStage[] {
  const pending = [...stages].sort((a, b) => timestamp(a.created_at) - timestamp(b.created_at) || a.id - b.id);
  const ids = new Set(stages.map((stage) => stage.id));
  const visited = new Set<number>();
  const result: TimelineStage[] = [];
  while (pending.length) {
    const ready = pending.findIndex((stage) => stage.parentId === null || !ids.has(stage.parentId) || visited.has(stage.parentId));
    const [stage] = pending.splice(ready < 0 ? 0 : ready, 1);
    result.push(stage); visited.add(stage.id);
  }
  return result;
}

export function timelineSummary(application: TimelineApplication, now = Date.now()) {
  const stages = orderedStages(application.interviews);
  const latest = stages.at(-1);
  const closed = !!latest?.outcome && terminal.has(latest.outcome);
  const through = closed ? latest!.updated_at : new Date(now).toISOString();
  return {
    stages, closed, through,
    days: daysBetween(application.applicationDate, through),
    outcome: latest?.outcome ? OUTCOME_LABELS[latest.outcome] ?? latest.outcome : "Awaiting response",
  };
}

export type TimelineActivity = {id: string; date: string; title: string; detail: string};
export function timelineActivity(application: TimelineApplication): TimelineActivity[] {
  const events = application.followUps.map((followUp) => ({id: `follow-up-${followUp.id}`, date: followUp.sentAt, title: "Follow-up recorded", detail: "You recorded that you chased this application."}));
  for (const link of application.availabilityLinks) {
    events.push({id: `link-${link.id}`, date: link.created_at, title: "Availability link created", detail: `For ${link.stage.stage}. Creating a link does not confirm it was sent.`});
    if (link.firstViewedAt) events.push({id: `opened-${link.id}`, date: link.firstViewedAt, title: "Availability link first opened", detail: `For ${link.stage.stage}. ${link.viewCount} recorded view${link.viewCount === 1 ? "" : "s"}.`});
    if (link.bookedSlot) events.push({id: `booked-${link.id}`, date: link.bookedSlot, title: "Booked interview slot", detail: `For ${link.stage.stage}. This is the interview time, not the time the booking was made.`});
  }
  return events.sort((a, b) => timestamp(a.date) - timestamp(b.date) || a.id.localeCompare(b.id));
}
