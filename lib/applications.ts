// Turns an application's stages into answers: what happened, and did the company ever respond?

import { LinkTracking, linkState } from "@/lib/availability";
import { times } from "@/lib/followUps";
import { jobKey } from "@/lib/jobLinks";

export const GHOSTED_AFTER_DAYS = 30;
// Chased this many times without ever hearing back counts as ghosted, however recent
export const GHOSTED_AFTER_FOLLOW_UPS = 2;
const SETTLED_OUTCOMES = ["OFFER_ACCEPTED", "OFFER_DECLINED", "OFFER_RECEIVED", "REJECTED", "WITHDREW", "SCHEDULED"];
const DAY_MS = 24 * 60 * 60 * 1000;

export type StageSummary = {
  stage: string;
  outcome: string | null;
  updatedAt: string | Date;
};

export type ApplicationSummary = {
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
): Pick<ApplicationSummary, "status" | "response"> {
  const latest = stages[0];
  if (!latest) return { status: "Applied", response: "waiting" };

  const heardBack = stages.some((s) => s.stage !== "Applied" || (s.outcome && s.outcome !== "AWAITING_RESPONSE"));
  const response = heardBack ? "responded" : "waiting";

  // They asked for your availability, then never opened the link: ghosting, unless it's since moved on
  const ignored = links.find((l) => linkState(l, now) === "ignored");
  if (ignored && !SETTLED_OUTCOMES.includes(latest.outcome ?? "")) {
    return { status: `Availability link never opened (sent ${timeAgo(ignored.created_at, now)})`, response };
  }

  switch (latest.outcome) {
    case "OFFER_ACCEPTED": return { status: "Offer accepted", response };
    case "OFFER_DECLINED": return { status: "Offer declined", response };
    case "OFFER_RECEIVED": return { status: "Offer received", response };
    case "REJECTED": return { status: `Rejected at ${latest.stage}`, response };
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
// ponytail: title match is equal-or-contains after lowercasing; "Sr" vs "Senior" won't match, the company match still surfaces it
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
  const title = norm(jobTitle);

  return history
    .flatMap((c) => c.applications.map((a) => ({ ...a, companyName: c.name })))
    .map((a) => {
      const t = norm(a.jobTitle);
      return {
        ...a,
        sameTitle: !!title && (t === title || t.includes(title) || title.includes(t)),
        samePosting: !!key && jobKey(a.jobPostingLink) === key,
      };
    })
    .filter((a) => a.samePosting || [norm(a.companyName), norm(a.clientCompany)].some((n) => n && names.includes(n)))
    .sort((a, b) => Number(b.samePosting) - Number(a.samePosting) || Number(b.sameTitle) - Number(a.sameTitle));
}
