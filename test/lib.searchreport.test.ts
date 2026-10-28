import {describe, expect, it} from "vitest";
import {defaultPeriod, localDay, parseLocalDay, reportPeriod, searchReport, ReportStage} from "@/lib/searchReport";
import {insights} from "@/lib/companyInsights";
import type {ReportHistory} from "@/lib/companyHistory";

const stage = (name: string, date: string | Date | null = null, outcome: string | null = "SCHEDULED"): ReportStage => ({id: 1, stage: name, date, outcome, deadline: null});
const at = (day: number, hour = 12) => new Date(2026, 0, day, hour).toISOString();
const application = (id: number, stages: ReportStage[] = [], changes: Partial<ReportHistory[number]["applications"][number]> = {}) => ({id, jobTitle: "Engineer", clientCompany: null, applicationDate: at(1), response: "waiting" as const, status: "Applied", stages, ...changes});
const period = () => reportPeriod("2026-01-01", "2026-01-31")!;
describe("local report periods", () => {
  it("uses local midnight through the next midnight, with inclusive end dates", () => {
    expect(period().start).toEqual(new Date(2026, 0, 1));
    expect(period().end).toEqual(new Date(2026, 1, 1));
    const history: ReportHistory = [{id: 1, name: "Acme", applications: [application(1, [], {applicationDate: new Date(2026, 0, 1)}), application(2, [], {applicationDate: new Date(2026, 0, 31, 23, 59, 59)}), application(3, [], {applicationDate: new Date(2026, 1, 1)})]}];
    expect(searchReport(history, period()).response.roles).toBe(2);
  });
  it("advances calendar days across DST rather than adding a fixed 24 hours", () => {
    for (const day of ["2026-03-08", "2026-11-01", "2026-03-29", "2026-10-25"]) {
      const range = reportPeriod(day, day)!;
      expect(range.end.getHours()).toBe(0);
      const expectedHours = 24 + (range.end.getTimezoneOffset() - range.start.getTimezoneOffset()) / 60;
      expect((range.end.getTime() - range.start.getTime()) / 3600000).toBe(expectedHours);
    }
  });
  it("rejects invalid, backwards or excessive ranges", () => {
    expect(parseLocalDay("2026-02-30")).toBeNull();
    expect(parseLocalDay("2026-2-01")).toBeNull();
    expect(reportPeriod("2026-02-01", "2026-01-01")).toBeNull();
    expect(reportPeriod("2000-01-01", "2026-01-01")).toBeNull();
    expect(localDay(new Date(2026, 0, 1, 23))).toBe("2026-01-01");
  });
  it("defaults to ninety local calendar dates, including today", () => {
    expect(defaultPeriod(new Date(2026, 2, 31, 12))).toEqual({from: "2026-01-01", through: "2026-03-31"});
  });
});
describe("search report aggregates", () => {
  it("builds a cumulative funnel and safe conversion rates from recorded stages", () => {
    const rows = [application(1), application(2, [], {response: "responded"}), application(3, [stage("Phone Screen")]), application(4, [stage("Technical Interview")]), application(5, [stage("Final Stage")]), application(6, [stage("Applied", null, "OFFER_ACCEPTED")])];
    const result = searchReport([{id: 1, name: "Acme", applications: rows}], period());
    expect(result.funnel.map((step) => step.count)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(result.funnel.map((step) => step.conversion)).toEqual([null, 83, 80, 75, 67, 50]);
  });
  it("matches the same response and reply-time metrics as company insights for a cohort", () => {
    const rows = [application(1, [], {response: "responded", firstResponseAt: "2026-01-04"}), application(2, [], {response: "ghosted"}), application(3)];
    expect(searchReport([{id: 1, name: "Acme", applications: rows}], period()).response).toEqual(insights(rows));
  });
  it("counts activity from earlier applications but keeps the funnel cohort in the chosen period", () => {
    const history: ReportHistory = [{id: 1, name: "Acme", applications: [application(1, [stage("Phone Screen", at(5))], {applicationDate: at(-10)}), application(2, [stage("Technical Interview", at(10)), stage("Technical Test", null), stage("Offer", at(11)), stage("Technical Interview", null)])]}];
    const result = searchReport(history, period());
    expect(result.response.roles).toBe(1);
    expect(result.weekly.reduce((count, week) => count + week.applications, 0)).toBe(1);
    expect(result.weekly.reduce((count, week) => count + week.interviews, 0)).toBe(2);
    expect(result.weekly.find((week) => week.week === "2026-01-05")).toMatchObject({applications: 0, interviews: 2});
  });
  it("keeps empty weeks and splits direct and agency applications using shared route rules", () => {
    const rows = [application(1), application(2, [], {clientCompany: "Client"}), application(3, [], {viaRecruiter: true})];
    const result = searchReport([{id: 1, name: "Mixed", applications: rows}], period());
    expect(result.sources.map((source) => [source.source, source.roles])).toEqual([["Direct", 1], ["Recruiter / agency", 2]]);
    expect(result.weekly.map((week) => week.week)).toEqual(["2025-12-29", "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
    expect(result.weekly.at(-1)).toMatchObject({applications: 0, interviews: 0});
  });
  it("handles zero data without NaN, fabricated medians or divide-by-zero", () => {
    const result = searchReport([], period());
    expect(result.funnel.every((step) => step.count === 0 && step.conversion === null)).toBe(true);
    expect(result.response).toMatchObject({roles: 0, responseRate: null, ghostRate: null, medianReplyDays: null});
    expect(result.weekly).toHaveLength(5);
  });
});
