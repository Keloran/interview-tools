import {z} from "zod";
import type {Prisma} from "@/app/generated/prisma/client";
import {summarizeApplication} from "@/lib/applications";
import {importDate} from "@/lib/csvImport";
import {writeCSV} from "@/lib/csv";
import {localDay, parseLocalDay} from "@/lib/searchReport";

const text = (max: number) => z.string().trim().max(max).refine((value) => !value.includes("\0"), "Text cannot contain null characters");
export const activitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !!importDate(value), "Use a valid activity date"),
  activity: text(200).min(1, "Describe the activity"), employer: text(200).default(""), role: text(200).default(""), how: text(200).default(""), outcome: text(200).default(""), notes: text(1000).default(""),
});
export const entrySelect = {id: true, date: true, activity: true, employer: true, role: true, how: true, outcome: true, notes: true} as const;
export const activityApplicationSelect = {
  id: true, jobTitle: true, clientCompany: true, viaRecruiter: true, applicationDate: true, firstResponseAt: true, jobPostingLink: true, company: {select: {name: true}},
  interviews: {select: {id: true, date: true, deadline: true, outcome: true, created_at: true, updated_at: true, feedbackType: true, stage: {select: {stage: true}}, stageMethod: {select: {method: true}}}, orderBy: {created_at: "desc"}},
  followUps: {select: {id: true, sentAt: true}},
  availabilityLinks: {select: {id: true, sentAt: true, created_at: true, viewCount: true, lastViewedAt: true, bookedSlot: true}},
} satisfies Prisma.ApplicationSelect;
type Serialized<T> = T extends Date ? string : T extends object ? {[K in keyof T]: Serialized<T[K]>} : T;
export type ActivityApplication = Serialized<Prisma.ApplicationGetPayload<{select: typeof activityApplicationSelect}>>;
export type FreeActivity = z.infer<typeof activitySchema> & {id: number};
export type ActivityLogData = {applications: ActivityApplication[]; entries: FreeActivity[]};
export type ActivityRow = {id: string; date: string; timestamp: number; kind: "applied" | "interview" | "follow-up" | "availability" | "other"; activity: string; employer: string; role: string; how: string; outcome: string; notes: string};
const outcomeLabel = (outcome: string | null) => outcome ? outcome.toLowerCase().replace(/_/g, " ") : "Not recorded";
export function activityRows(data: ActivityLogData, period: {start: Date; end: Date}, now = Date.now()): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const add = (row: Omit<ActivityRow, "date" | "timestamp">, value: string, dateOnly = false) => {
    const date = dateOnly ? parseLocalDay(value.slice(0, 10)) : new Date(value);
    if (!date || !Number.isFinite(date.getTime()) || date < period.start || date >= period.end) return;
    rows.push({...row, date: localDay(date), timestamp: date.getTime()});
  };
  for (const application of data.applications) {
    const base = {employer: application.clientCompany || application.company.name, role: application.jobTitle, notes: ""};
    let how = application.viaRecruiter || application.clientCompany ? `Recruiter: ${application.company.name}` : "Direct (site not recorded)";
    if (how.startsWith("Direct") && application.jobPostingLink) {try {const url = new URL(application.jobPostingLink); if (["http:", "https:"].includes(url.protocol)) how = url.hostname;} catch {}}
    const summary = summarizeApplication(application.interviews.map((stage) => ({stage: stage.stage.stage, outcome: stage.outcome, updatedAt: stage.updated_at, feedbackType: stage.feedbackType})), now, application.availabilityLinks, application.followUps.length, application.firstResponseAt);
    add({...base, id: `applied-${application.id}`, kind: "applied", activity: "Applied", how, outcome: summary.status}, application.applicationDate);
    for (const stage of application.interviews) {
      if (["Applied", "Offer"].includes(stage.stage.stage)) continue;
      const date = stage.date || stage.deadline;
      if (date) add({...base, id: `interview-${stage.id}`, kind: "interview", activity: stage.deadline && !stage.date ? `${stage.stage.stage} deadline` : `Interview: ${stage.stage.stage}`, how: stage.deadline && !stage.date ? "Assessment deadline" : stage.stageMethod.method, outcome: outcomeLabel(stage.outcome)}, date);
    }
    for (const followUp of application.followUps) add({...base, id: `follow-up-${followUp.id}`, kind: "follow-up", activity: "Follow-up recorded", how: "Channel not recorded", outcome: "Follow-up recorded"}, followUp.sentAt);
    for (const link of application.availabilityLinks) if (link.sentAt) add({...base, id: `availability-${link.id}`, kind: "availability", activity: "Availability sent", how: "Link (channel not recorded)", outcome: link.bookedSlot ? "Slot booked" : link.viewCount ? "Link opened" : "Not opened"}, link.sentAt);
  }
  for (const entry of data.entries) add({id: `entry-${entry.id}`, kind: "other", activity: entry.activity, employer: entry.employer, role: entry.role, how: entry.how, outcome: entry.outcome, notes: entry.notes}, entry.date, true);
  return rows.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}
export function activityTotals(rows: ActivityRow[]) {
  const count = (kind: ActivityRow["kind"]) => rows.filter((row) => row.kind === kind).length;
  return {total: rows.length, applied: count("applied"), interviews: count("interview"), followUps: count("follow-up"), availability: count("availability"), other: count("other")};
}
export function activityCSV(rows: ActivityRow[], from: string, through: string): string {
  const totals = activityTotals(rows);
  return writeCSV([["Job search activity log"], ["Period from", from, "Through", through], ["Total activities", totals.total],
    ["Applied", totals.applied, "Interviews / assessment deadlines", totals.interviews, "Follow-ups", totals.followUps, "Availability sent", totals.availability, "Other", totals.other], [],
    ["Date (local)", "Activity", "Employer", "Role", "How", "Outcome (current record)", "Notes"],
    ...rows.map((row) => [row.date, row.activity, row.employer, row.role, row.how, row.outcome, row.notes])], true);
}
