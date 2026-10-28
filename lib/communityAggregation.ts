import {z} from "zod";
import type {Prisma} from "@/app/generated/prisma/client";
import {COMMUNITY_LIMITS, COMMUNITY_NOTICE_VERSION, ConsentChoice, consentCurrent} from "@/lib/communityPolicy";
import {orderedStages} from "@/lib/timeline";

const day = 86400000;
// Suggestions only: never resolves an employer ID or collapses legal suffixes.
export const employerNameKey = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
export const communityApplicationSelect = {
  id: true, userId: true, created_at: true, applicationDate: true, firstResponseAt: true, viaRecruiter: true,
  clientCompany: true, company: {select: {name: true}}, communityEmployerId: true, communityEmployerConfirmedAt: true, communityEmployerIdentity: true,
  interviews: {select: {id: true, parentId: true, created_at: true, outcome: true, feedbackType: true, stage: {select: {stage: true}}}},
} satisfies Prisma.ApplicationSelect;
export type CommunityApplication = Prisma.ApplicationGetPayload<{select: typeof communityApplicationSelect}>;
export type CommunityVote = {applicationId: number; userId: number; employerId: string; noticeVersion: string; consentRevision: number; observedAt: Date; responded: boolean | null; ghosted: boolean | null; feedbackGiven: boolean | null; replyDays: number | null; grantedAt: Date};
export function applicationVote(application: CommunityApplication, consent: ConsentChoice, now = new Date()): CommunityVote | null {
  if (!consentCurrent(consent) || !application.communityEmployerId || !application.communityEmployerConfirmedAt) return null;
  if (application.viaRecruiter && !application.clientCompany?.trim()) return null;
  const identity = employerNameKey(application.clientCompany || application.company.name);
  if (identity !== application.communityEmployerIdentity) return null;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - COMMUNITY_LIMITS.windowMonths, 1));
  start.setUTCDate(Math.min(now.getUTCDate(), new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()));
  if (application.applicationDate < start || application.applicationDate > now || application.created_at.getTime() > now.getTime() - COMMUNITY_LIMITS.delayDays * day) return null;
  const stages = orderedStages(application.interviews), latest = stages.at(-1);
  if (!latest) return null;
  const appliedDay = application.applicationDate.toISOString().slice(0, 10), repliedDay = application.firstResponseAt?.toISOString().slice(0, 10);
  const days = repliedDay ? (Date.parse(repliedDay) - Date.parse(appliedDay)) / day : null;
  const replyDays = repliedDay && repliedDay <= now.toISOString().slice(0, 10) && days !== null && days >= 0 && Number.isFinite(days) ? days : null;
  const hasReply = replyDays !== null || stages.some((stage) => stage.stage.stage.trim().toLowerCase() !== "applied" || ["REJECTED", "SCHEDULED", "PASSED", "OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED"].includes(stage.outcome ?? ""));
  if (!["REJECTED", "NO_RESPONSE", "OFFER_ACCEPTED", "OFFER_DECLINED"].includes(latest.outcome ?? "") && !(latest.outcome === "WITHDREW" && hasReply)) return null;
  const feedback = stages.map((stage) => stage.feedbackType).filter((value) => value !== null);
  return {applicationId: application.id, userId: application.userId, employerId: application.communityEmployerId, noticeVersion: COMMUNITY_NOTICE_VERSION, consentRevision: consent.revision,
    observedAt: application.applicationDate, responded: hasReply, ghosted: latest.outcome === "NO_RESPONSE", feedbackGiven: !feedback.length ? null : feedback.some((value) => value === "SPECIFIC" || value === "GENERIC"), replyDays, grantedAt: consent.grantedAt!};
}
export function latestVotes(votes: CommunityVote[]): CommunityVote[] {
  const selected = new Map<string, CommunityVote>();
  for (const vote of [...votes].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime() || b.applicationId - a.applicationId)) {const key = `${vote.userId}:${vote.employerId}`; if (!selected.has(key)) selected.set(key, vote);}
  return [...selected.values()];
}
const rate = z.number().int().min(0).max(100).refine((value) => value % 10 === 0);
export const communitySummarySchema = z.object({month: z.string().length(7).regex(/^\d{4}-(0[1-9]|1[0-2])$/), sampleBand: z.enum(["20–49", "50–99", "100+"]),
  responseRate: rate.nullable(), ghostingRate: rate.nullable(), feedbackRate: rate.nullable(), replyTimeBand: z.enum(["0–7 days", "8–14 days", "15–30 days", "31–60 days", "Over 60 days"]).nullable(),
}).strict().refine((value) => [value.responseRate, value.ghostingRate, value.feedbackRate, value.replyTimeBand].some((metric) => metric !== null), "A suppressed summary has no public sample band");
export type CommunitySummary = z.infer<typeof communitySummarySchema>;
function binaryRate(votes: CommunityVote[], key: "responded" | "ghosted" | "feedbackGiven") {
  const known = votes.map((vote) => vote[key]).filter((value) => value !== null);
  const yes = known.filter(Boolean).length, no = known.length - yes;
  return known.length >= COMMUNITY_LIMITS.contributors && yes >= COMMUNITY_LIMITS.binaryCell && no >= COMMUNITY_LIMITS.binaryCell ? {rate: Math.round(yes / known.length * 10) * 10, count: known.length} : null;
}
export function suspiciousConsentCohort(votes: CommunityVote[], reviewedAt: Date | null) {
  const times = votes.map((vote) => vote.grantedAt.getTime()).sort((a, b) => a - b);
  let left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > 72 * 3600000) left++;
    if (right - left + 1 >= 10 && (right - left + 1) * 2 >= votes.length && times[right] > (reviewedAt?.getTime() ?? 0)) return true;
  }
  return false;
}
export function summarizeCommunity(votes: CommunityVote[], month: string): CommunitySummary | null {
  const unique = latestVotes(votes);
  const response = binaryRate(unique, "responded"), ghosting = binaryRate(unique, "ghosted"), feedback = binaryRate(unique, "feedbackGiven");
  const days = unique.map((vote) => vote.replyDays).filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  let replyTimeBand: CommunitySummary["replyTimeBand"] = null;
  if (days.length >= COMMUNITY_LIMITS.contributors) {
    const i = Math.floor(days.length / 2), median = days.length % 2 ? days[i] : (days[i - 1] + days[i]) / 2;
    replyTimeBand = median <= 7 ? "0–7 days" : median <= 14 ? "8–14 days" : median <= 30 ? "15–30 days" : median <= 60 ? "31–60 days" : "Over 60 days";
  }
  const sizes = [response?.count, ghosting?.count, feedback?.count, replyTimeBand ? days.length : undefined].filter((value): value is number => value !== undefined);
  if (!sizes.length) return null;
  const minimum = Math.min(...sizes);
  return {month, sampleBand: minimum < 50 ? "20–49" : minimum < 100 ? "50–99" : "100+", responseRate: response?.rate ?? null, ghostingRate: ghosting?.rate ?? null, feedbackRate: feedback?.rate ?? null, replyTimeBand};
}
