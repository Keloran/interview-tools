import {describe, expect, it} from "vitest";
import {ApplicationSummary, summarizeApplication} from "@/lib/applications";
import {insights, insightsOverview, replyDays, validateReplyDate} from "@/lib/companyInsights";

const application = (id: number, changes: Partial<ApplicationSummary> = {}): ApplicationSummary => ({id, jobTitle: "Engineer", clientCompany: null, applicationDate: "2026-01-01T23:00:00.000Z", status: "Applied", response: "waiting", ...changes});
describe("explicit reply dates", () => {
  it("never infers a reply date from outcomes or stage timestamps", () => {
    expect(replyDays(application(1, {response: "responded"}))).toBeNull();
    expect(insights([application(1, {response: "responded"})])).toMatchObject({medianReplyDays: null, replyDates: 0});
  });
  it("counts UTC calendar days and allows a same-day reply", () => {
    expect(replyDays(application(1, {firstResponseAt: "2026-01-01T00:00:00Z"}))).toBe(0);
    expect(replyDays(application(1, {firstResponseAt: "2026-01-10"}))).toBe(9);
    expect(replyDays(application(1, {firstResponseAt: "2025-12-31"}))).toBeNull();
  });
  it("computes odd/even medians from known dates only, without mutation", () => {
    const rows = [application(1, {firstResponseAt: "2026-01-11"}), application(2), application(3, {firstResponseAt: "2026-01-03"}), application(4, {firstResponseAt: "2026-01-05"})];
    expect(insights(rows)).toMatchObject({replyDates: 3, medianReplyDays: 4});
    expect(insights(rows.slice(0, 3))).toMatchObject({replyDates: 2, medianReplyDays: 6});
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });
  it("treats an explicitly recorded reply as a response in the shared summary rules", () => {
    expect(summarizeApplication([], undefined, [], 0, "2026-01-02")).toMatchObject({response: "responded"});
    expect(summarizeApplication([{stage: "Applied", outcome: "AWAITING_RESPONSE", updatedAt: "2026-01-01"}], Date.parse("2026-01-03"), [], 0, "2026-01-02")).toMatchObject({response: "responded"});
    expect(summarizeApplication([])).toMatchObject({response: "waiting"});
  });
  it.each([null, ""])("can clear an unknown or mistaken reply date: %s", (value) => {
    expect(validateReplyDate(value, new Date("2026-01-01"))).toEqual({date: null});
  });
  it.each(["2026-02-30", "2026-13-01", "01/01/2026", "2026-01-02T00:00:00Z", 123, undefined])("rejects invalid calendar dates and payloads: %s", (value) => {
    expect(validateReplyDate(value, new Date("2026-01-01"), new Date("2026-03-01"))).toHaveProperty("error");
  });
  it("rejects replies before applying or in the future", () => {
    expect(validateReplyDate("2025-12-31", new Date("2026-01-01"), new Date("2026-03-01"))).toHaveProperty("error");
    expect(validateReplyDate("2026-03-02", new Date("2026-01-01"), new Date("2026-03-01"))).toHaveProperty("error");
    expect(validateReplyDate("2026-01-01", new Date("2026-01-01T23:00:00Z"), new Date("2026-03-01"))).toEqual({date: new Date("2026-01-01")});
  });
});
describe("company insight aggregates", () => {
  it("reuses settled/feedback counts, stage order and ignored-link totals", () => {
    const result = insights([application(1, {response: "responded", feedback: "NONE", furthestStage: "Phone Screen", ignoredLinks: 2}), application(2, {response: "ghosted", feedback: "SPECIFIC", furthestStage: "Offer", ignoredLinks: 1}), application(3)]);
    expect(result).toMatchObject({roles: 3, responded: 1, ghosted: 1, waiting: 1, responseRate: 50, ghostRate: 50, feedbackRate: 50, furthestStage: "Offer", ignoredLinks: 3});
  });
  it("groups current outcomes by application month, excludes waiting denominators and ranks known replies", () => {
    const result = insightsOverview([
      {id: 1, name: "Slow", applications: [application(1, {response: "responded", firstResponseAt: "2026-01-11"}), application(2, {response: "ghosted"})]},
      {id: 2, name: "Fast", applications: [application(3, {applicationDate: "2026-02-01", response: "responded", firstResponseAt: "2026-02-02"}), application(4, {applicationDate: "2026-02-01"})]},
      {id: 3, name: "Unknown", applications: [application(5, {response: "responded"})]},
    ]);
    expect(result.months.map((month) => [month.month, month.ghostRate, month.waiting])).toEqual([["2026-02", 0, 1], ["2026-01", 33, 0]]);
    expect(result.ghostMost.map((company) => company.name)).toEqual(["Slow"]);
    expect(result.fastest.map((company) => company.name)).toEqual(["Fast", "Slow"]);
    expect(result.overall).toMatchObject({medianReplyDays: 5.5, replyDates: 2});
  });
  it("represents empty histories without fabricated zero rates", () => {
    expect(insightsOverview([])).toMatchObject({months: [], ghostMost: [], fastest: [], overall: {responseRate: null, ghostRate: null, medianReplyDays: null}});
  });
});
