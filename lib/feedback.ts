// Did they tell you why? Recorded per stage, mostly on rejection

export const FEEDBACK_TYPES = ["NONE", "GENERIC", "SPECIFIC"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_LABEL: Record<FeedbackType, string> = {
  NONE: "No feedback",
  GENERIC: "Generic",
  SPECIFIC: "Specific",
};

// From a request body; null = no feedback given in this request
export function parseFeedback(body: unknown): { feedbackType: FeedbackType | null; feedbackText: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const {type, text} = body as { type?: unknown; text?: unknown };
  return {
    feedbackType: FEEDBACK_TYPES.includes(type as FeedbackType) ? (type as FeedbackType) : null,
    feedbackText: typeof text === "string" && text.trim() ? text.trim() : null,
  };
}

// "Rejected at Technical, specific feedback"
export function rejectedStatus(stage: string, feedback?: FeedbackType | null): string {
  if (!feedback) return `Rejected at ${stage}`;
  return `Rejected at ${stage}, ${feedback === "NONE" ? "no" : feedback.toLowerCase()} feedback`;
}

// "Gives feedback: 2 of 5 rejections", counting only rejections where you noted whether they did
export function feedbackRecord(applications: { feedback?: FeedbackType | null }[]): string | null {
  const noted = applications.filter((a) => a.feedback);
  if (!noted.length) return null;
  const gave = noted.filter((a) => a.feedback !== "NONE").length;
  return `Gives feedback: ${gave} of ${noted.length} rejection${noted.length === 1 ? "" : "s"}`;
}
