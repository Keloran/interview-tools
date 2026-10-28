import {employerNameKey} from "@/lib/communityAggregation";
import type {Prisma} from "@/app/generated/prisma/client";
import {CompanyHistory, summarizeApplication} from "@/lib/applications";
import {brokenPromise} from "@/lib/followUps";
import {linkState} from "@/lib/availability";
import {sortStages} from "@/lib/stages";
import type {ReportStage} from "@/lib/searchReport";

export const companyHistorySelect = {
  name: true, id: true,
  applications: {select: {
    communityEmployerId: true, communityEmployerConfirmedAt: true, communityEmployerIdentity: true, communityEmployer: {select: {name: true}},
    id: true, viaRecruiter: true, recruiterName: true, recruiterEmail: true, recruiterLinkedIn: true,
    jobTitle: true, clientCompany: true, applicationDate: true, firstResponseAt: true, jobPostingLink: true,
    interviews: {select: {id: true, date: true, deadline: true, outcome: true, updated_at: true, created_at: true, replyBy: true, feedbackType: true, stage: {select: {stage: true}}}, orderBy: {created_at: "desc"}},
    availabilityLinks: {select: {created_at: true, sentAt: true, viewCount: true, lastViewedAt: true, bookedSlot: true}},
    _count: {select: {followUps: true}},
  }, orderBy: {applicationDate: "desc"}},
} satisfies Prisma.CompanySelect;
type CompanyRow = Prisma.CompanyGetPayload<{select: typeof companyHistorySelect}>;
export type ReportHistory = (Omit<CompanyHistory, "applications"> & {applications: (CompanyHistory["applications"][number] & {stages?: ReportStage[]})[]})[];

export function companyHistory(companies: CompanyRow[], now = Date.now(), includeStages = false): ReportHistory {
  return companies.map((company) => ({id: company.id, name: company.name,
    applications: company.applications.map(({interviews, availabilityLinks, _count, communityEmployerConfirmedAt, communityEmployerIdentity, communityEmployer, ...application}) => ({
      ...application,
      communityEmployerId: communityEmployerConfirmedAt && communityEmployerIdentity === employerNameKey(application.clientCompany || company.name) ? application.communityEmployerId : null,
      communityEmployerName: communityEmployerConfirmedAt && communityEmployerIdentity === employerNameKey(application.clientCompany || company.name) ? communityEmployer?.name ?? null : null,
      ...summarizeApplication(interviews.map((interview) => ({stage: interview.stage.stage, outcome: interview.outcome, updatedAt: interview.updated_at, feedbackType: interview.feedbackType})), now, availabilityLinks, _count.followUps, application.firstResponseAt),
      furthestStage: sortStages(interviews.map((interview) => ({stage: interview.stage.stage}))).at(-1)?.stage ?? "Applied",
      ignoredLinks: (availabilityLinks ?? []).filter((link) => linkState(link, now) === "ignored").length,
      promise: brokenPromise(interviews.map((interview) => ({outcome: interview.outcome, replyBy: interview.replyBy, createdAt: interview.created_at, updatedAt: interview.updated_at})), now),
      ...(includeStages ? {stages: interviews.map((interview) => ({id: interview.id, stage: interview.stage.stage, date: interview.date, deadline: interview.deadline, outcome: interview.outcome}))} : {}),
    })),
  }));
}
