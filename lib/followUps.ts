// When to chase a quiet application, and whether the company kept its word about replying

export const FOLLOW_UP_AFTER_APPLYING_DAYS = 10;
export const FOLLOW_UP_AFTER_INTERVIEW_DAYS = 5;
export const FOLLOW_UP_AGAIN_DAYS = 7;
// Past these it counts as ghosted (see summarizeApplication), and chasing again is pointless
export const GHOSTED_AFTER_DAYS = 30;
export const GHOSTED_AFTER_FOLLOW_UPS = 2;

// Calendar days, so a reminder doesn't shift an hour when the clocks change
const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

// The working day after `d` (Friday -> Monday), at the start of that day
export function nextWorkingDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  do next.setDate(next.getDate() + 1); while (next.getDay() === 0 || next.getDay() === 6);
  return next;
}

export type LatestStage = {
  stage: string;
  outcome: string | null;
  date: Date | null;
  replyBy: Date | null;
};

// Still waiting on them: nothing back yet, or an interview that's happened with no news since
function waiting({outcome, date}: LatestStage, now: number): boolean {
  if (!outcome || outcome === "AWAITING_RESPONSE") return true;
  return outcome === "SCHEDULED" && !!date && date.getTime() < now;
}

// When a follow-up is due for an application, or null if you're not waiting on them or it's already ghosted.
// A date they promised wins over the defaults; after you've chased, wait a week before chasing again.
export function followUpDueAt(
  {applicationDate, latest, followUps}: { applicationDate: Date; latest: LatestStage; followUps: Date[] },
  now = Date.now(),
): Date | null {
  if (!waiting(latest, now)) return null;
  const lastFollowUp = followUps.reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);

  // Ghosted: chased twice with no answer, or a month since anything happened
  if (followUps.length >= GHOSTED_AFTER_FOLLOW_UPS) return null;
  const lastActivity = Math.max(...[applicationDate, latest.date, latest.replyBy, lastFollowUp].map((d) => d?.getTime() ?? 0));
  if (now >= addDays(new Date(lastActivity), GHOSTED_AFTER_DAYS).getTime()) return null;

  if (lastFollowUp) return addDays(lastFollowUp, FOLLOW_UP_AGAIN_DAYS);
  if (latest.replyBy) return nextWorkingDay(latest.replyBy);
  if (latest.stage === "Applied") return addDays(applicationDate, FOLLOW_UP_AFTER_APPLYING_DAYS);
  return addDays(latest.date ?? applicationDate, FOLLOW_UP_AFTER_INTERVIEW_DAYS);
}

export type PromiseStage = {
  outcome: string | null;
  replyBy: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const dayFmt = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short"});

// "Said they'd reply by 12 Oct; replied 20 Oct" / "...; never replied". Only broken promises are worth noting.
// stages: newest first. They replied when a later stage was added, or this stage's outcome moved on.
// ponytail: outcome changes are dated by updatedAt, which a later edit (e.g. the debrief) also bumps
export function brokenPromise(stages: PromiseStage[], now = Date.now()): string | null {
  const i = stages.findIndex((s) => s.replyBy);
  if (i === -1) return null;
  const promised = stages[i];
  const deadline = nextWorkingDay(promised.replyBy!); // any time on the day they said counts
  const moved = promised.outcome && !["AWAITING_RESPONSE", "SCHEDULED", "NO_RESPONSE"].includes(promised.outcome);
  const repliedAt = i > 0 ? stages[i - 1].createdAt : moved ? promised.updatedAt : null;
  const said = `Said they'd reply by ${dayFmt.format(promised.replyBy!)}`;

  if (repliedAt) return repliedAt >= deadline ? `${said}; replied ${dayFmt.format(repliedAt)}` : null;
  return now >= deadline.getTime() ? `${said}; never replied` : null;
}

// "once", "twice", "3 times"
export const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
