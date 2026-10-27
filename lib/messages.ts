// Ready-to-send messages, pre-filled from the application so you only have to tweak and paste.
// ponytail: fixed wording for everyone; save per-user versions if people want their own defaults

export type MessageContext = {
  jobTitle: string;
  company: string;
  clientCompany?: string | null;
  stage?: string | null;
  interviewer?: string | null;
  date?: Date | null;
  formatDate: (d: Date) => string;
};

export type TemplateId = "thank-you" | "follow-up" | "withdraw" | "accept-offer" | "decline-offer" | "ask-feedback";

// Through an agency you're writing to the agency about the client's role
const role = ({jobTitle, company, clientCompany}: MessageContext) =>
  clientCompany ? `the ${jobTitle} role with ${clientCompany}` : `the ${jobTitle} role at ${company}`;

const greeting = ({interviewer}: MessageContext) => {
  const first = interviewer?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : "Hi,";
};

// "my Technical interview on Tuesday 3 March", skipping whichever parts aren't known
const theInterview = (ctx: MessageContext) =>
  ["my", ctx.stage && ctx.stage !== "Applied" ? ctx.stage : null, "interview", ctx.date ? `on ${ctx.formatDate(ctx.date)}` : null]
    .filter(Boolean)
    .join(" ");

const letter = (ctx: MessageContext, ...body: string[]) => [greeting(ctx), "", ...body, "", "Thanks"].join("\n");

export const TEMPLATES: Record<TemplateId, { label: string; render: (ctx: MessageContext) => string }> = {
  "thank-you": {
    label: "Thank you",
    render: (ctx) => letter(ctx,
      `Thank you for taking the time to speak with me in ${theInterview(ctx)} about ${role(ctx)}. I enjoyed our conversation and learning more about the team.`,
      "",
      "I'm very interested in the role and look forward to hearing about next steps.",
    ),
  },
  "follow-up": {
    label: "Follow up",
    render: (ctx) => letter(ctx,
      ctx.stage && ctx.stage !== "Applied"
        ? `I wanted to follow up after ${theInterview(ctx)} for ${role(ctx)}.`
        : `I wanted to follow up on my application for ${role(ctx)}.`,
      "",
      "I'm still very interested and would be grateful for an update on where things are.",
    ),
  },
  "withdraw": {
    label: "Withdraw",
    render: (ctx) => letter(ctx,
      `Thank you for considering me for ${role(ctx)}. I've decided to withdraw my application.`,
      "",
      "I appreciate the time you've spent on this and hope our paths cross again.",
    ),
  },
  "accept-offer": {
    label: "Accept offer",
    render: (ctx) => letter(ctx,
      `Thank you for the offer for ${role(ctx)}. I'm delighted to accept.`,
      "",
      "Please let me know what you need from me and the next steps.",
    ),
  },
  "decline-offer": {
    label: "Decline offer",
    render: (ctx) => letter(ctx,
      `Thank you for the offer for ${role(ctx)}. After careful thought I've decided to decline.`,
      "",
      "I really appreciate the time everyone spent with me and hope we stay in touch.",
    ),
  },
  "ask-feedback": {
    label: "Ask for feedback",
    render: (ctx) => letter(ctx,
      `Thank you for letting me know about ${role(ctx)}. I'm disappointed, but I appreciate you getting back to me.`,
      "",
      "If you have a moment, I'd be grateful for any feedback on how I could improve.",
    ),
  },
};

const SETTLED = ["OFFER_ACCEPTED", "OFFER_DECLINED", "WITHDREW"];

// The messages that make sense for where this interview is
export function templatesFor(
  {outcome, stage, date}: { outcome?: string | null; stage?: string | null; date?: Date | null },
  now = Date.now(),
): TemplateId[] {
  const state = (outcome ?? "").toUpperCase();
  if (SETTLED.includes(state)) return [];
  if (state === "REJECTED") return ["ask-feedback"];
  if (state === "OFFER_RECEIVED" || stage === "Offer") return ["accept-offer", "decline-offer"];
  const happened = stage !== "Applied" && !!date && date.getTime() < now;
  return happened ? ["thank-you", "follow-up", "withdraw"] : ["follow-up", "withdraw"];
}

// The note to paste into a reply, listing the times and the link to book one
export function availabilityMessage({jobTitle, company, slots, url, formatSlot, timeZoneLabel}: {
  jobTitle: string;
  company: string;
  slots: Date[];
  url: string;
  formatSlot: (d: Date) => string;
  timeZoneLabel: string;
}): string {
  return [
    "Hi,",
    "",
    `Thanks for getting in touch about the ${jobTitle} role at ${company}. I'm available at the following times (${timeZoneLabel}):`,
    "",
    ...slots.map((s) => `- ${formatSlot(s)}`),
    "",
    `You can book whichever suits you here: ${url}`,
    "",
    "Thanks",
  ].join("\n");
}
