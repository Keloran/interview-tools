import {CompanyHistory, findPreviousApplications} from "@/lib/applications";
import {GHOSTED_AFTER_FOLLOW_UPS} from "@/lib/followUps";

export type JobFlag = {
  id: string;
  title: string;
  explanation: string;
  evidence?: string;
  source?: string;
};

// Public release years, not stable/1.0 release years. Keep this small and sourced.
const TECHNOLOGIES = [
  {name: "React", pattern: "react(?:\\.js|js)?(?![\\w]|\\s+native)", year: 2013, source: "https://react.dev/versions"},
  {name: "TypeScript", pattern: "typescript", year: 2012, source: "https://devblogs.microsoft.com/typescript/ten-years-of-typescript/"},
  {name: "Go", pattern: "(?:golang|go)", year: 2009, source: "https://go.dev/doc/faq#history"},
];

const SALARY_AMOUNT = /(?:[£$€]\s*\d|\b(?:GBP|USD|EUR)\s*\d|\d[\d,.]*\s*(?:GBP|USD|EUR)\b|\b\d+(?:\.\d+)?\s*k\s*[-–]\s*\d+(?:\.\d+)?\s*k\b|\b(?:salary|pay|compensation)\s*[:=]?\s*\d[\d,]*(?:\s*k)?\b)/i;

function hasSalary(text: string): boolean {
  return text.split(/\n|[.!?]\s/).some((line) => SALARY_AMOUNT.test(line)
    // Payments for interview tasks and expenses aren't a salary disclosure.
    && (!/\b(?:assessment|take[ -]home|expenses?|equipment|bonus)\b/i.test(line)
      || /\b(?:salary|annual|hourly|per (?:year|hour|day|month|annum))\b/i.test(line)));
}
const ASSESSMENT = /\b(?:take[ -]home\s+(?:coding\s+)?(?:test|task|project|exercise|assignment|assessment)s?|coding\s+(?:test|challenge|assessment)s?)\b/i;
const UNPAID = /\b(?:unpaid|uncompensated|not\s+(?:paid|compensated)|without\s+(?:pay|compensation)|no\s+(?:payment|compensation))\b/i;

export function checkJobListing({description, history = [], companyName = "", jobTitle = "", jobPostingLink = ""}: {
  description: string;
  history?: CompanyHistory[];
  companyName?: string;
  jobTitle?: string;
  jobPostingLink?: string;
}, now = new Date()): JobFlag[] {
  const flags: JobFlag[] = [];
  const matches = findPreviousApplications(history, companyName, "", jobTitle, jobPostingLink);
  const previous = matches.filter((a) => a.samePosting || a.sameTitle);
  if (previous.length) flags.push({
    id: "already-applied", title: "You have applied for this before",
    explanation: `${previous.length} recorded application(s) match the job link or the role at this company or recruiter. See the application history below.`,
  });
  const ghosted = matches.filter((a) => {
    // response records whether they EVER responded; the current status also captures
    // applications that went quiet after an interview or repeated follow-ups.
    const chased = a.status.match(/^Followed up (once|twice|(\d+) times), no response$/);
    const followUps = chased?.[1] === "once" ? 1 : chased?.[1] === "twice" ? 2 : Number(chased?.[2] ?? 0);
    return a.response === "ghosted" || a.status.startsWith("No response after ") || followUps >= GHOSTED_AFTER_FOLLOW_UPS;
  });
  if (ghosted.length) flags.push({
    id: "ghosted", title: "Previous applications went unanswered",
    explanation: `${ghosted.length} matching application(s) are recorded as ghosted. This reflects your history, not a prediction about this listing.`,
  });
  const feedback = matches.filter((a) => a.feedback != null);
  if (feedback.length && feedback.every((a) => a.feedback === "NONE")) flags.push({
    id: "no-feedback", title: "No feedback in your recorded rejections",
    explanation: `All ${feedback.length} matching rejection(s) where you recorded feedback were marked “No feedback”. Rejections without a feedback record are not counted.`,
  });

  const text = description.trim();
  // A URL is useful for history, but cannot establish anything about listing text.
  if (!text) return flags;
  if (!hasSalary(text)) flags.push({
    id: "no-salary", title: "No salary amount found",
    explanation: "The pasted text does not include a recognised salary amount or range. Ask for the pay range before investing time in the process.",
  });
  const sentences = text.split(/(?:[.!?](?:\s|$)|\n)+/).map((s) => s.trim()).filter(Boolean);
  const unpaid = sentences.find((s) => ASSESSMENT.test(s) && UNPAID.test(s)
    && !/\b(?:no|not|never|without)\s+(?:(?:an?|any|use|require|assign)\s+){0,3}(?:unpaid|uncompensated)\b/i.test(s));
  if (unpaid) flags.push({
    id: "unpaid-assessment", title: "An unpaid assessment is mentioned",
    explanation: "The listing describes an assessment without payment. Clarify its time limit, compensation and how the work will be used.", evidence: unpaid,
  });
  const buzzwords = sentences.find((s) => /\b(?:rock[ -]?star|ninja)\b/i.test(s)
    && !/\b(?:no|not|never|avoid|don't|do not)\b/i.test(s));
  if (buzzwords) flags.push({
    id: "buzzwords", title: "Vague role language",
    explanation: "“Rockstar” or “ninja” does not explain the role's responsibilities. Ask what the expectations mean in practice.", evidence: buzzwords,
  });
  const hidden = sentences.find((s) => /\b(?:confidential|undisclosed|unnamed)\s+(?:end[ -]?)?client\b|\bclient\b.{0,30}\b(?:confidential|undisclosed|not disclosed)\b/i.test(s)
    && !/\b(?:not|never)\s+(?:confidential|undisclosed|unnamed)\b/i.test(s));
  if (hidden) flags.push({
    id: "hidden-client", title: "The end client is undisclosed",
    explanation: "The listing explicitly withholds the client. Ask who the role is with before agreeing to be represented, to avoid duplicate submissions.", evidence: hidden,
  });
  for (const tech of TECHNOLOGIES) {
    // Require the years and technology to be adjacent, avoiding unrelated experience requirements.
    const years = "(\\d{1,2})(?:\\s*[-–]\\s*\\d{1,2})?\\+?\\s*(?:years?|yrs?)(?:['’])?\\s+";
    const requirement = new RegExp(`\\b${years}(?:(?:of\\s+)?(?:(?:commercial|professional)\\s+)?experience\\s+(?:in|with|using)\\s+|(?:of|in|with|using)\\s+)?${tech.pattern}\\b`, "gi");
    for (const match of text.matchAll(requirement)) {
      const requested = Number(match[1]);
      // Calendar years deliberately give the employer the benefit of the doubt.
      if (requested <= now.getUTCFullYear() - tech.year) continue;
      flags.push({
        id: `experience-${tech.name.toLowerCase()}`, title: `Check the ${tech.name} experience requirement`,
        explanation: `The listing asks for ${requested} years with ${tech.name}, which first became public in ${tech.year}. That exceeds the calendar years since its public release; ask whether they mean broader experience.`,
        evidence: match[0], source: tech.source,
      });
      break;
    }
  }
  return flags;
}
