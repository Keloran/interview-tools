import {ApplicationSummary} from "@/lib/applications";
import {insights} from "@/lib/companyInsights";
import {viaAgency} from "@/lib/recruiters";
import type {ReportHistory} from "@/lib/companyHistory";

export type ReportStage = {id: number; stage: string; date: string | Date | null; deadline: string | Date | null; outcome: string | null};
export const localDay = (date: Date) => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function parseLocalDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
  return year > 0 && localDay(date) === value ? date : null;
}
export function reportPeriod(from: string, through: string): {start: Date; end: Date} | null {
  const start = parseLocalDay(from), last = parseLocalDay(through);
  if (!start || !last || last < start) return null;
  const limit = new Date(start); limit.setFullYear(limit.getFullYear() + 10);
  if (last >= limit) return null;
  const end = new Date(last); end.setDate(end.getDate() + 1);
  return {start, end};
}
export function defaultPeriod(now = new Date()) {
  const from = new Date(now); from.setDate(from.getDate() - 89);
  return {from: localDay(from), through: localDay(now)};
}
function weekStart(date: Date): Date {
  const start = new Date(date); start.setDate(start.getDate() - (start.getDay() + 6) % 7); start.setHours(0, 0, 0, 0);
  return start;
}
const isInterview = (stage: ReportStage) => !["applied", "offer", "technical test"].includes(stage.stage.trim().toLowerCase());
function milestone(application: ApplicationSummary & {stages?: ReportStage[]}): number {
  let reached = application.response === "responded" || application.firstResponseAt ? 1 : 0;
  for (const stage of application.stages ?? []) {
    const name = stage.stage.trim().toLowerCase();
    if (name === "offer" || stage.outcome?.startsWith("OFFER_")) reached = Math.max(reached, 5);
    else if (name.includes("final")) reached = Math.max(reached, 4);
    else if (name.includes("screen") || name === "technical test") reached = Math.max(reached, 2);
    else if (isInterview(stage)) reached = Math.max(reached, 3);
  }
  return reached;
}
export function searchReport(history: ReportHistory, period: {start: Date; end: Date}) {
  const within = (value: string | Date) => {const date = new Date(value); return date >= period.start && date < period.end;};
  const all = history.flatMap((company) => company.applications);
  const cohort = all.filter((application) => within(application.applicationDate));
  const reached = cohort.map(milestone);
  const labels = ["Applied", "Heard back", "Screen / assessment", "Interview stage", "Final stage", "Offer"];
  const counts = labels.map((_, index) => reached.filter((value) => value >= index).length);
  const funnel = labels.map((label, index) => ({label, count: counts[index], conversion: index === 0 || !counts[index - 1] ? null : Math.round(counts[index] * 100 / counts[index - 1])}));
  const weeks = new Map<string, {week: string; applications: number; interviews: number}>();
  for (const cursor = weekStart(period.start); cursor < period.end; cursor.setDate(cursor.getDate() + 7)) {
    const week = localDay(cursor); weeks.set(week, {week, applications: 0, interviews: 0});
  }
  for (const application of all) {
    if (within(application.applicationDate)) weeks.get(localDay(weekStart(new Date(application.applicationDate))))!.applications++;
    for (const stage of application.stages ?? []) if (isInterview(stage) && stage.date && within(stage.date)) weeks.get(localDay(weekStart(new Date(stage.date))))!.interviews++;
  }
  return {funnel, response: insights(cohort), weekly: [...weeks.values()],
    sources: [{source: "Direct", ...insights(cohort.filter((application) => !viaAgency(application)))}, {source: "Recruiter / agency", ...insights(cohort.filter(viaAgency))}]};
}
