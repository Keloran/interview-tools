// Turns an application's stages into answers: what happened, and did the company ever respond?

import { LinkTracking, linkState } from "@/lib/availability";
import { GHOSTED_AFTER_DAYS, GHOSTED_AFTER_FOLLOW_UPS, times } from "@/lib/followUps";
import { FeedbackType, rejectedStatus } from "@/lib/feedback";
import { jobKey } from "@/lib/jobLinks";
import { jobTitlesMatch } from "@/lib/jobTitles";

const SETTLED_OUTCOMES = ["OFFER_ACCEPTED", "OFFER_DECLINED", "OFFER_RECEIVED", "REJECTED", "WITHDREW", "SCHEDULED"];
const DAY_MS = 24 * 60 * 60 * 1000;

export type StageSummary = {
  stage: string;
  outcome: string | null;
  updatedAt: string | Date;
  feedbackType?: FeedbackType | null;
};

export type ApplicationSummary = {
  communityEmployerId?: string | null;
  communityEmployerName?: string | null;
  firstResponseAt?: string | Date | null;
  furthestStage?: string;
  ignoredLinks?: number;
  viaRecruiter?: boolean;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  recruiterLinkedIn?: string | null;
  id: number;
  jobTitle: string;
  clientCompany: string | null;
  applicationDate: string | Date;
  jobPostingLink?: string | null;
  status: string;
  // responded: they got back to you (interview, rejection, offer); ghosted: nothing for 30+ days
  response: "responded" | "waiting" | "ghosted";
  // "Said they'd reply by 12 Oct; never replied"
  promise?: string | null;
  // whether a rejection came with feedback, when you've noted it
  feedback?: FeedbackType | null;
};

export type CompanyHistory = {
  id: number;
  name: string;
  applications: ApplicationSummary[];
};

// stages: newest first; links: availability links sent for it; followUps: times you chased them
export function summarizeApplication(
  stages: StageSummary[],
  now = Date.now(),
  links: LinkTracking[] = [],
  followUps = 0,
  firstResponseAt?: string | Date | null,
): Pick<ApplicationSummary, "status" | "response" | "feedback"> {
  const latest = stages[0];
  if (!latest) return { status: firstResponseAt ? "Reply received; awaiting next step" : "Applied", response: firstResponseAt ? "responded" : "waiting" };
  if (latest.outcome === "NO_RESPONSE") return {status: "No response (closed as ghosted)", response: "ghosted"};

  const heardBack = !!firstResponseAt || stages.some((s) => s.stage !== "Applied" || (s.outcome && !["AWAITING_RESPONSE", "NO_RESPONSE"].includes(s.outcome)));
  const response = heardBack ? "responded" : "waiting";

  // They asked for your availability, then never opened the link: ghosting, unless it's since moved on
  const ignored = links.find((l) => linkState(l, now) === "ignored");
  if (ignored && !SETTLED_OUTCOMES.includes(latest.outcome ?? "")) {
    return { status: `Availability link never opened (sent ${timeAgo(ignored.sentAt ?? ignored.created_at, now)})`, response };
  }

  switch (latest.outcome) {
    case "OFFER_ACCEPTED": return { status: "Offer accepted", response };
    case "OFFER_DECLINED": return { status: "Offer declined", response };
    case "OFFER_RECEIVED": return { status: "Offer received", response };
    case "REJECTED": return { status: rejectedStatus(latest.stage, latest.feedbackType), response, feedback: latest.feedbackType ?? null };
    case "WITHDREW": return { status: "Withdrew", response };
    case "SCHEDULED": return { status: `${latest.stage} scheduled`, response };
    case "PASSED": return { status: `Passed ${latest.stage}`, response };
  }

  const quietDays = (now - new Date(latest.updatedAt).getTime()) / DAY_MS;
  const ghosted = quietDays >= GHOSTED_AFTER_DAYS || followUps >= GHOSTED_AFTER_FOLLOW_UPS;
  const chased = followUps ? `Followed up ${times(followUps)}, no response` : null;
  if (ghosted) {
    return { status: chased ?? `No response after ${latest.stage}`, response: heardBack ? "responded" : "ghosted" };
  }
  return { status: chased ?? `Awaiting response (${latest.stage})`, response };
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "last week", "6 months ago"
export function timeAgo(date: string | Date, now = Date.now()): string {
  const days = Math.round((new Date(date).getTime() - now) / DAY_MS);
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  if (Math.abs(days) < 30) return rtf.format(Math.round(days / 7), "week");
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

// "Responded to 2 of 3 applications" / "Ghosted you 3 times"
export function responseRecord(applications: ApplicationSummary[]): string | null {
  const settled = applications.filter((a) => a.response !== "waiting");
  if (!settled.length) return null;
  const responded = settled.filter((a) => a.response === "responded").length;
  if (responded === 0) return settled.length === 1 ? "Never responded" : `Ghosted you ${settled.length} times`;
  return `Responded to ${responded} of ${settled.length}`;
}

// samePosting: the same job link (or job ID on a known board), however the company was entered
export type PreviousApplication = ApplicationSummary & { companyName: string; sameTitle: boolean; samePosting: boolean };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// The same job gets listed on several sites and by recruiters, so match the company against both
// the company and the client company of every past application, either way round.
export function findPreviousApplications(
  history: CompanyHistory[],
  companyName: string,
  clientCompany: string,
  jobTitle: string,
  jobPostingLink?: string | null,
): PreviousApplication[] {
  const names = [norm(companyName), norm(clientCompany)].filter(Boolean);
  const key = jobKey(jobPostingLink);
  if (!names.length && !key) return [];

  return history
    .flatMap((c) => c.applications.map((a) => ({ ...a, companyName: c.name })))
    .map((a) => {
      return {
        ...a,
        sameTitle: jobTitlesMatch(a.jobTitle, jobTitle),
        samePosting: !!key && jobKey(a.jobPostingLink) === key,
      };
    })
    .filter((a) => a.samePosting || [norm(a.companyName), norm(a.clientCompany)].some((n) => n && names.includes(n)))
    .sort((a, b) => Number(b.samePosting) - Number(a.samePosting) || Number(b.sameTitle) - Number(a.sameTitle));
}

// The companies page: A–Z ignoring case, matching the company, a recruiter's client or a job title.
// ponytail: filters the whole history in the browser, fine for hundreds of companies; page on the server past that
export function searchCompanies(history: CompanyHistory[], query: string): CompanyHistory[] {
  const q = norm(query);
  return history
    .filter((c) => !q || [c.name, ...c.applications.flatMap((a) => [a.clientCompany, a.jobTitle, a.recruiterName, a.recruiterEmail])].some((s) => norm(s).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: "base"}));
}
