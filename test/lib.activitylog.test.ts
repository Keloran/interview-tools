import {describe, expect, it} from "vitest";
import {activityCSV, activityRows, activitySchema, activityTotals} from "@/lib/activityLog";
import {reportPeriod} from "@/lib/searchReport";
import {parseCSV} from "@/lib/csv";
import {linkState} from "@/lib/availability";
import {summarizeApplication} from "@/lib/applications";
import {activityData} from "./fixtures/activityLog";

const period = () => reportPeriod("2026-01-01", "2026-01-31")!;
describe("activity-log records", () => {
  it("includes each recorded activity, identifies the client employer and keeps unknown channels explicit", () => {
    const rows = activityRows(activityData(), period());
    expect(rows.map((row) => row.kind)).toEqual(["applied", "availability", "other", "interview", "follow-up"]);
    expect(rows[0]).toMatchObject({employer: "Client", role: "Engineer", how: "Recruiter: Agency"});
    expect(rows[3]).toMatchObject({how: "Phone", outcome: "rejected"});
    expect(rows[4].how).toBe("Channel not recorded");
    expect(activityTotals(rows)).toEqual({total: 5, applied: 1, interviews: 1, followUps: 1, availability: 1, other: 1});
  });
  it("does not infer sending from link creation, opening or booking", () => {
    const data = activityData();
    data.applications[0].availabilityLinks[0].sentAt = null;
    data.applications[0].availabilityLinks[1].bookedSlot = "2026-01-05T12:00:00Z";
    expect(activityRows(data, period()).filter((row) => row.kind === "availability")).toEqual([]);
  });
  it("uses local dates for real timestamps and preserves date-only free entries across time zones", () => {
    const data = activityData();
    data.applications[0].applicationDate = new Date(2026, 0, 2, 0, 30).toISOString();
    const rows = activityRows(data, period());
    expect(rows.find((row) => row.kind === "applied")!.date).toBe("2026-01-02");
    expect(rows.find((row) => row.kind === "other")!.date).toBe("2026-01-04");
  });
  it("includes in-range interviews for earlier applications and excludes undated stages", () => {
    const data = activityData();
    data.applications[0].applicationDate = "2025-12-01T12:00:00Z";
    expect(activityRows(data, period()).filter((row) => row.kind === "applied")).toEqual([]);
    expect(activityRows(data, period()).filter((row) => row.kind === "interview")).toHaveLength(1);
    data.applications[0].interviews[0].date = null;
    expect(activityRows(data, period()).filter((row) => row.kind === "interview")).toHaveLength(0);
    data.applications[0].interviews[0].deadline = "2026-01-09T12:00:00Z";
    expect(activityRows(data, period()).find((row) => row.kind === "interview")!.activity).toBe("Technical Interview deadline");
  });
  it("shows known direct job-site hosts without inventing an email channel", () => {
    const data = activityData();
    data.applications[0].viaRecruiter = false; data.applications[0].clientCompany = null;
    expect(activityRows(data, period())[0].how).toBe("jobs.example");
    data.applications[0].jobPostingLink = "javascript:alert(1)";
    expect(activityRows(data, period())[0].how).toBe("Direct (site not recorded)");
  });
  it("exports the period, totals, multiline notes and spreadsheet text guards", () => {
    const data = activityData(); data.entries[0].employer = '=HYPERLINK("https://example.com")'; data.entries[0].notes = 'A "quoted" note\nSecond line';
    const rows = activityRows(data, period());
    const table = parseCSV(activityCSV(rows, "2026-01-01", "2026-01-31"));
    expect(table.headers).toEqual(["Job search activity log"]);
    expect(table.records[0].cells).toEqual(["Period from", "2026-01-01", "Through", "2026-01-31"]);
    expect(table.records[1].cells).toEqual(["Total activities", "5"]);
    const entry = table.records.find((record) => record.cells[1] === "Careers fair")!.cells;
    expect(entry[2]).toBe('\t=HYPERLINK("https://example.com")');
    expect(entry[6]).toBe('A "quoted" note\nSecond line');
  });
  it("validates real dates and bounded free-entry fields, stripping ownership injection", () => {
    expect(activitySchema.parse({date: "2026-01-01", activity: " Careers fair ", userId: 999})).toEqual({date: "2026-01-01", activity: "Careers fair", employer: "", role: "", how: "", outcome: "", notes: ""});
    for (const value of [{date: "2026-02-30", activity: "Fair"}, {date: "2026-01-01", activity: ""}, {date: "2026-01-01", activity: "a".repeat(201)}, {date: "2026-01-01", activity: "A\0B"}]) expect(activitySchema.safeParse(value).success).toBe(false);
  });
  it("keeps new unconfirmed links out of ignored-link counts and times confirmed sends from sentAt", () => {
    const link = {created_at: "2020-01-01", sentAt: null, viewCount: 0, lastViewedAt: null, bookedSlot: null};
    expect(linkState(link, Date.parse("2026-01-10"))).toBe("created");
    expect(linkState({...link, sentAt: "2026-01-09"}, Date.parse("2026-01-10"))).toBe("sent");
    expect(linkState({...link, sentAt: "2026-01-01"}, Date.parse("2026-01-10"))).toBe("ignored");
    expect(summarizeApplication([{stage: "Applied", outcome: "AWAITING_RESPONSE", updatedAt: "2026-01-09"}], Date.parse("2026-01-10"), [{...link, sentAt: "2026-01-01"}]).status).toContain("sent last week");
  });
});
