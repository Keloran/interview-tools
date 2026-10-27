import {describe, expect, it} from "vitest";
import {companyKind, contactData, recruiterRecords, recruiterSchema, recruiterStats, viaAgency} from "@/lib/recruiters";
import {ApplicationSummary, searchCompanies, summarizeApplication} from "@/lib/applications";

const application = (id: number, changes: Partial<ApplicationSummary> = {}): ApplicationSummary => ({id, jobTitle: "Engineer", clientCompany: null, applicationDate: "2026-01-01", status: "Applied", response: "waiting", ...changes});
describe("recruiter records", () => {
  it("recognises explicit agency routes and existing client-company applications", () => {
    expect(viaAgency(application(1))).toBe(false);
    expect(viaAgency(application(1, {viaRecruiter: true}))).toBe(true);
    expect(viaAgency(application(1, {clientCompany: "Client"}))).toBe(true);
    expect(companyKind([application(1)])).toBe("Direct employer");
    expect(companyKind([application(1, {clientCompany: "Client"})])).toBe("Recruiter / agency");
    expect(companyKind([application(1), application(2, {viaRecruiter: true})])).toBe("Employer and agency");
  });
  it("uses the existing response rules and excludes waiting roles from rates", () => {
    const now = Date.parse("2026-03-01");
    const summary = (stage: string, outcome: string) => summarizeApplication([{stage, outcome, updatedAt: "2026-01-01"}], now);
    const rows = [application(1, {...summary("Applied", "AWAITING_RESPONSE")}), application(2, {...summary("Technical", "REJECTED"), feedback: "SPECIFIC"}), application(3), application(4, {...summary("Applied", "REJECTED"), feedback: "NONE"})];
    expect(recruiterStats(rows)).toEqual({roles: 4, responded: 2, ghosted: 1, waiting: 1, responseRate: 67, ghostRate: 33, feedback: 1, feedbackNoted: 2, feedbackRate: 50});
  });
  it("does not claim 0% response or feedback with no settled or noted history", () => {
    expect(recruiterStats([application(1)])).toMatchObject({responseRate: null, ghostRate: null, feedbackRate: null, waiting: 1});
  });
  it("groups agency and contact histories separately, keeping agencies isolated", () => {
    const rows = [application(1, {viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "JANE@example.com"}), application(2, {viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com"}), application(3, {clientCompany: "Client"}), application(4)];
    const records = recruiterRecords([{id: 1, name: "Agency", applications: rows}, {id: 2, name: "Other", applications: [application(5, {viaRecruiter: true, recruiterEmail: "jane@example.com"})]}]);
    expect(records).toHaveLength(4);
    expect(records[0].applications.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(records[1].applications.map((row) => row.id)).toEqual([1, 2]);
    expect(records[3].applications.map((row) => row.id)).toEqual([5]);
    expect(rows).toHaveLength(4);
  });
  it("groups a named contact without email and searches contact details", () => {
    const history = [{id: 1, name: "Agency", applications: [application(1, {viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com"})]}];
    expect(searchCompanies(history, "Jane")).toHaveLength(1);
    expect(searchCompanies(history, "jane@example.com")).toHaveLength(1);
    history[0].applications[0].recruiterEmail = null;
    expect(recruiterRecords(history)).toHaveLength(2);
  });
});
describe("contact validation", () => {
  it("accepts optional fields, trims values and strips ownership fields", () => {
    const parsed = recruiterSchema.parse({viaRecruiter: true, recruiterName: " Jane ", recruiterEmail: "jane@example.com", recruiterLinkedIn: "https://www.linkedin.com/in/jane/", userId: 999});
    expect(parsed).not.toHaveProperty("userId");
    expect(contactData(parsed)).toMatchObject({viaRecruiter: true, recruiterName: "Jane"});
    expect(contactData({viaRecruiter: true, recruiterEmail: ""})).toMatchObject({recruiterName: null, recruiterEmail: null, recruiterLinkedIn: null});
  });
  it("clears contact fields when returning to a direct route", () => {
    expect(contactData({viaRecruiter: false, recruiterName: "Old contact"})).toEqual({viaRecruiter: false, recruiterName: null, recruiterEmail: null, recruiterLinkedIn: null});
  });
  it.each(["javascript:alert(1)", "https://linkedin.com.evil.test/in/a", "https://evil.test", "http://linkedin.com/in/a", "https://user@linkedin.com/in/a", "https://linkedin.com:444/in/a", "https://linkedin.com/in/a b"])("rejects unsafe LinkedIn URL %s", (recruiterLinkedIn) => {
    expect(recruiterSchema.safeParse({recruiterLinkedIn}).success).toBe(false);
  });
  it("rejects invalid email, oversized fields and control characters", () => {
    for (const value of [{recruiterEmail: "bad"}, {recruiterName: "a".repeat(201)}, {recruiterName: "Jane\0Doe"}, {viaRecruiter: "true"}]) expect(recruiterSchema.safeParse(value).success).toBe(false);
  });
});
