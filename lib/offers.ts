import {z} from "zod";
import type {Prisma} from "@/app/generated/prisma/client";
import {importDate} from "@/lib/csvImport";
import {localDay} from "@/lib/searchReport";
import {orderedStages} from "@/lib/timeline";

const openOutcomes = new Set<string | null>([null, "SCHEDULED", "AWAITING_RESPONSE", "OFFER_RECEIVED"]);
export function isOpenOffer(stage: string | null | undefined, outcome: string | null | undefined) {return stage?.trim().toLowerCase() === "offer" && openOutcomes.has(outcome ?? null);}
export const offerDaySchema = z.string().length(10).regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !!importDate(value), "Enter a valid respond-by date");
export const offerMutationSchema = z.object({deadline: offerDaySchema.nullable().optional(), decision: z.enum(["OFFER_ACCEPTED", "OFFER_DECLINED"]).optional(), confirmDecision: z.literal(true).optional()})
  .refine((value) => value.deadline !== undefined || !!value.decision, "Supply a deadline or decision")
  .refine((value) => !value.decision || value.confirmDecision === true, "Confirm that you want to record this decision");
export type OfferMutation = z.infer<typeof offerMutationSchema>;
export const offerApplicationSelect = {
  id: true, jobTitle: true, clientCompany: true, applicationDate: true, company: {select: {name: true}},
  interviews: {select: {id: true, parentId: true, created_at: true, updated_at: true, deadline: true, outcome: true, interviewer: true, stage: {select: {stage: true}}}},
} satisfies Prisma.ApplicationSelect;
export type OfferApplication = Prisma.ApplicationGetPayload<{select: typeof offerApplicationSelect}>;
export type OfferSummary = {applicationId: number; interviewId: number; jobTitle: string; company: string; agency: string | null; interviewer: string | null; deadline: string | null; outcome: string | null};
export function openOffers(applications: OfferApplication[]): OfferSummary[] {
  return applications.flatMap((application) => {
    const current = orderedStages(application.interviews).at(-1);
    return current && isOpenOffer(current.stage.stage, current.outcome) ? [{applicationId: application.id, interviewId: current.id, jobTitle: application.jobTitle,
      company: application.clientCompany || application.company.name, agency: application.clientCompany ? application.company.name : null,
      interviewer: current.interviewer, deadline: current.deadline?.toISOString().slice(0, 10) ?? null, outcome: current.outcome}] : [];
  }).sort((a, b) => (a.deadline ?? "9999-99-99").localeCompare(b.deadline ?? "9999-99-99") || a.company.localeCompare(b.company) || a.applicationId - b.applicationId);
}
export function offerDeadlineState(deadline: string | null, now = new Date()) {
  if (!deadline) return {kind: "none" as const, days: null, remind: false, label: "No respond-by date"};
  const days = (Date.parse(deadline.slice(0, 10)) - Date.parse(localDay(now))) / 86400000;
  return days < 0 ? {kind: "overdue" as const, days, remind: true, label: `Overdue by ${-days} day${days === -1 ? "" : "s"}`} : days === 0 ? {kind: "today" as const, days, remind: true, label: "Respond today"} : days === 1 ? {kind: "tomorrow" as const, days, remind: true, label: "Respond tomorrow"} : {kind: "upcoming" as const, days, remind: false, label: `Respond in ${days} days`};
}
