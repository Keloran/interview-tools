import {ApplicationSummary, CompanyHistory} from "@/lib/applications";
import {recruiterStats} from "@/lib/recruiters";
import {sortStages} from "@/lib/stages";

const day = 86400000;
export function replyDays(application: ApplicationSummary): number | null {
  if (!application.firstResponseAt) return null;
  const applied = new Date(application.applicationDate).toISOString().slice(0, 10);
  const replied = new Date(application.firstResponseAt).toISOString().slice(0, 10);
  const days = (Date.parse(replied) - Date.parse(applied)) / day;
  return Number.isFinite(days) && days >= 0 ? days : null;
}
export function insights(applications: ApplicationSummary[]) {
  const values = applications.map(replyDays).filter((value): value is number => value !== null).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {...recruiterStats(applications),
    medianReplyDays: !values.length ? null : values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    replyDates: values.length,
    furthestStage: sortStages(applications.map((application) => ({stage: application.furthestStage ?? "Applied"}))).at(-1)?.stage ?? "Applied",
    ignoredLinks: applications.reduce((count, application) => count + (application.ignoredLinks ?? 0), 0),
  };
}
export function insightsOverview(companies: CompanyHistory[]) {
  const all = companies.flatMap((company) => company.applications);
  const cohorts = new Map<string, ApplicationSummary[]>();
  for (const application of all) {
    const month = new Date(application.applicationDate).toISOString().slice(0, 7);
    cohorts.set(month, [...(cohorts.get(month) ?? []), application]);
  }
  const summaries = companies.map((company) => ({id: company.id, name: company.name, ...insights(company.applications)}));
  return {overall: insights(all), months: [...cohorts].sort(([a], [b]) => b.localeCompare(a)).map(([month, applications]) => ({month, ...insights(applications)})),
    ghostMost: summaries.filter((company) => company.ghosted > 0).sort((a, b) => b.ghosted - a.ghosted || a.name.localeCompare(b.name)).slice(0, 10),
    fastest: summaries.filter((company) => company.medianReplyDays !== null).sort((a, b) => a.medianReplyDays! - b.medianReplyDays! || b.replyDates - a.replyDates || a.name.localeCompare(b.name)).slice(0, 10)};
}

export function validateReplyDate(value: unknown, applicationDate: Date, now = new Date()): {date: Date | null; error?: undefined} | {error: string; date?: undefined} {
  if (value === null || value === "") return {date: null};
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return {error: "Use a YYYY-MM-DD first-reply date, or clear it if unknown."};
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return {error: "Enter a valid first-reply date."};
  if (value < applicationDate.toISOString().slice(0, 10)) return {error: "The first reply cannot be before you applied."};
  if (value > now.toISOString().slice(0, 10)) return {error: "The first reply cannot be in the future."};
  return {date};
}
