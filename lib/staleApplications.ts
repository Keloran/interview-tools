import {z} from "zod";
import type {Prisma} from "@/app/generated/prisma/client";
import {orderedStages} from "@/lib/timeline";

export const staleDaysSchema = z.number().int().min(1).max(3650);
export const closeStaleSchema = z.object({ids: z.array(z.number().int().positive().max(2147483647)).min(1).max(500), days: staleDaysSchema, confirm: z.literal(true)});
export const staleSelect = {
  id: true, jobTitle: true, clientCompany: true, applicationDate: true, updated_at: true, firstResponseAt: true, company: {select: {name: true}},
  interviews: {select: {id: true, parentId: true, created_at: true, updated_at: true, date: true, deadline: true, replyBy: true, outcome: true, stage: {select: {stage: true}}}},
  followUps: {select: {sentAt: true}}, availabilityLinks: {select: {created_at: true, sentAt: true, lastViewedAt: true, bookedSlot: true}},
} satisfies Prisma.ApplicationSelect;
export type StaleApplication = Prisma.ApplicationGetPayload<{select: typeof staleSelect}>;
export type StaleCandidate = {id: number; company: string; jobTitle: string; lastStage: string; lastActivity: string; quietDays: number; latestId: number | null; latestUpdatedAt: string | null};
const waiting = new Set(["AWAITING_RESPONSE", "SCHEDULED", "PASSED"]);
export function staleCandidate(application: StaleApplication, days: number, now = Date.now()): StaleCandidate | null {
  const latest = orderedStages(application.interviews).at(-1);
  if (latest?.stage.stage.trim().toLowerCase() === "offer") return null;
  if (latest?.outcome && !waiting.has(latest.outcome)) return null;
  const dates = [application.applicationDate, application.updated_at, application.firstResponseAt,
    ...application.interviews.flatMap((stage) => [stage.created_at, stage.updated_at, stage.date, stage.deadline, stage.replyBy]),
    ...application.followUps.map((followUp) => followUp.sentAt),
    ...application.availabilityLinks.flatMap((link) => [link.created_at, link.sentAt, link.lastViewedAt, link.bookedSlot]),
  ].filter((date): date is Date => !!date);
  const last = Math.max(...dates.map((date) => date.getTime()));
  const quietDays = Math.floor((now - last) / 86400000);
  if (quietDays < days || !Number.isFinite(quietDays)) return null;
  return {id: application.id, company: application.clientCompany || application.company.name, jobTitle: application.jobTitle,
    lastStage: latest?.stage.stage ?? "Applied", lastActivity: new Date(last).toISOString(), quietDays, latestId: latest?.id ?? null, latestUpdatedAt: latest?.updated_at.toISOString() ?? null};
}
export function staleCandidates(applications: StaleApplication[], days: number, now = Date.now()) {
  return applications.map((application) => staleCandidate(application, days, now)).filter((item): item is StaleCandidate => !!item).sort((a, b) => a.lastActivity.localeCompare(b.lastActivity) || a.id - b.id);
}
