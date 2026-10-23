// Turns an application's stages into answers: what happened, and did the company ever respond?

export const GHOSTED_AFTER_DAYS = 30;
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
  status: string;
  // responded: they got back to you (interview, rejection, offer); ghosted: nothing for 30+ days
  response: "responded" | "waiting" | "ghosted";
};

export type CompanyHistory = {
  id: number;
  name: string;
  applications: ApplicationSummary[];
};

// stages: newest first
export function summarizeApplication(stages: StageSummary[], now = Date.now()): Pick<ApplicationSummary, "status" | "response"> {
  const latest = stages[0];
  if (!latest) return { status: "Applied", response: "waiting" };

  const heardBack = stages.some((s) => s.stage !== "Applied" || (s.outcome && s.outcome !== "AWAITING_RESPONSE"));
  const response = heardBack ? "responded" : "waiting";

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
  if (quietDays >= GHOSTED_AFTER_DAYS) {
    return { status: `No response after ${latest.stage}`, response: heardBack ? "responded" : "ghosted" };
  }
  return { status: `Awaiting response (${latest.stage})`, response };
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

export type PreviousApplication = ApplicationSummary & { companyName: string; sameTitle: boolean };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// The same job gets listed on several sites and by recruiters, so match the company against both
// the company and the client company of every past application, either way round.
// ponytail: title match is equal-or-contains after lowercasing; "Sr" vs "Senior" won't match, the company match still surfaces it
export function findPreviousApplications(
  history: CompanyHistory[],
  companyName: string,
  clientCompany: string,
  jobTitle: string,
): PreviousApplication[] {
  const names = [norm(companyName), norm(clientCompany)].filter(Boolean);
  if (!names.length) return [];
  const title = norm(jobTitle);

  return history
    .flatMap((c) => c.applications.map((a) => ({ ...a, companyName: c.name })))
    .filter((a) => [norm(a.companyName), norm(a.clientCompany)].some((n) => n && names.includes(n)))
    .map((a) => {
      const t = norm(a.jobTitle);
      return { ...a, sameTitle: !!title && (t === title || t.includes(title) || title.includes(t)) };
    })
    .sort((a, b) => Number(b.sameTitle) - Number(a.sameTitle));
}
