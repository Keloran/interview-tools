import {describe, expect, it} from "vitest";
import {checkJobListing} from "@/lib/jobChecks";
import {ApplicationSummary, CompanyHistory} from "@/lib/applications";

const now = new Date("2026-10-27T12:00:00Z");
const clearListing = "Software Engineer. Salary: £50,000–£70,000 per year. Build accessible websites.";
const check = (description: string) => checkJobListing({description}, now);
const ids = (description: string) => check(description).map((f) => f.id);
const app = (id: number, extra: Partial<ApplicationSummary> = {}): ApplicationSummary => ({
  id, jobTitle: "Software Engineer", clientCompany: "BigBank", applicationDate: "2026-01-01",
  status: "Awaiting response", response: "waiting", ...extra,
});
const history: CompanyHistory[] = [{id: 1, name: "Recruit Co", applications: [app(1, {
  response: "ghosted", feedback: "NONE", jobPostingLink: "https://linkedin.com/jobs/view/123",
})]}];

describe("job listing wording", () => {
  it("finds no warning signs in a clear description", () => expect(check(clearListing)).toEqual([]));

  it.each(["Competitive salary", "Salary negotiable", "Build accessible websites."])("flags missing pay amounts: %s", (text) => {
    expect(ids(text)).toContain("no-salary");
  });

  it.each(["£100 paid for the take-home assessment.", "£500 equipment allowance.", "A $1000 joining bonus."])("does not mistake other payments for salary: %s", (text) => {
    expect(ids(text)).toContain("no-salary");
  });

  it.each(["Salary: £50,000", "$80,000–$100,000", "EUR 60000", "60000 GBP", "Pay: 50k", "50k–70k", "Salary: 60000", "£50 per hour"])("recognises pay: %s", (text) => {
    expect(ids(text)).not.toContain("no-salary");
  });

  it.each([
    "There is an unpaid take-home test.",
    "The coding assessment is not compensated.",
    "Complete a take home assignment without compensation.",
    "There are unpaid take-home coding exercises.",
  ])("flags unpaid assessments with evidence: %s", (text) => {
    expect(check(`${clearListing}\n${text}`).find((f) => f.id === "unpaid-assessment"))
      .toMatchObject({evidence: text.replace(/\.$/, ""), explanation: expect.stringContaining("without payment")});
  });

  it.each(["A paid take-home test.", "No unpaid take-home tests.", "We never use unpaid coding assessments.", "An unpaid volunteering day and a paid interview."])("avoids asserting unpaid tests: %s", (text) => {
    expect(ids(`${clearListing}\n${text}`)).not.toContain("unpaid-assessment");
  });

  it.each(["We need a React rockstar.", "Become our backend ninja."])("explains vague role language: %s", (text) => {
    expect(check(`${clearListing}\n${text}`).find((f) => f.id === "buzzwords")).toMatchObject({evidence: text.replace(/\.$/, "")});
  });
  it("ignores an explicit rejection of buzzwords", () => expect(ids(`${clearListing} We don't use rockstar or ninja labels.`)).not.toContain("buzzwords"));

  it.each(["We recruit for a confidential client.", "Our client's name is not disclosed.", "An undisclosed end-client is hiring."])("explains withheld clients: %s", (text) => {
    expect(ids(`${clearListing}\n${text}`)).toContain("hidden-client");
  });
  it.each(["Our client BigBank is hiring.", "The client is not confidential."])("does not assume every agency hides its client: %s", (text) => {
    expect(ids(`${clearListing}\n${text}`)).not.toContain("hidden-client");
  });

  it.each([
    ["20+ years of React experience", "React", "2013"],
    ["20 years' experience with TypeScript", "TypeScript", "2012"],
    ["25 years professional experience in Golang", "Go", "2009"],
  ])("explains impossible public experience: %s", (text, tech, year) => {
    const flag = check(`${clearListing}\n${text}`).find((f) => f.id.startsWith("experience-"));
    expect(flag).toMatchObject({title: expect.stringContaining(tech), explanation: expect.stringContaining(year), source: expect.stringMatching(/^https:\/\//)});
  });

  it.each([
    "3–5 years of React experience", "13 years of React experience", "20 years in software and 3 years with React",
    "20 years of Java experience", "20 years of React Native experience",
  ])("does not misattribute experience: %s", (text) => {
    expect(check(`${clearListing}\n${text}`).filter((f) => f.id.startsWith("experience-"))).toEqual([]);
  });
  it("uses the check date rather than a frozen technology age", () => {
    expect(checkJobListing({description: `${clearListing} 20 years of React experience`}, new Date("2040-01-01")).filter((f) => f.id.startsWith("experience-"))).toEqual([]);
  });

  it("does not inspect absent listing text or invent flags for a URL", () => {
    expect(checkJobListing({description: "", jobPostingLink: "https://example.com/jobs/1"}, now)).toEqual([]);
  });
  it("every flag has a useful explanation and a stable unique id", () => {
    const flags = check(`${clearListing} An unpaid take-home test. Rockstar ninja. A confidential client. 20 years of React experience and 25 years of React experience.`);
    expect(new Set(flags.map((f) => f.id)).size).toBe(flags.length);
    expect(flags.every((f) => f.title && f.explanation)).toBe(true);
  });
});

describe("personal application history", () => {
  const fromHistory = (extra: object = {}) => checkJobListing({description: clearListing, history, companyName: "BigBank", jobTitle: "Software Engineer", ...extra}, now);
  it("checks recruiter and direct routes and explains all historical flags", () => {
    expect(fromHistory().map((f) => f.id)).toEqual(["already-applied", "ghosted", "no-feedback"]);
  });
  it("a link alone finds the same posting despite tracking parameters", () => {
    expect(fromHistory({companyName: "", jobTitle: "", jobPostingLink: "https://uk.linkedin.com/jobs/view/123?trackingId=other"})[0].id).toBe("already-applied");
  });
  it("a different role still shows company history without asserting a duplicate", () => {
    expect(fromHistory({jobTitle: "Data Analyst"}).map((f) => f.id)).toEqual(["ghosted", "no-feedback"]);
  });
  it("does not use another company's history", () => expect(fromHistory({companyName: "Other"})).toEqual([]));
  it("does not treat waiting applications or unknown feedback as bad history", () => {
    expect(fromHistory({history: [{id: 1, name: "Recruit Co", applications: [app(1)]}], jobTitle: "Other"})).toEqual([]);
  });
  it.each(["No response after Technical", "Followed up twice, no response", "Followed up 3 times, no response"])("recognises ghosting after an earlier response: %s", (status) => {
    const results = fromHistory({history: [{...history[0], applications: [app(1, {response: "responded", status})]}], jobTitle: "Other"});
    expect(results.map((f) => f.id)).toContain("ghosted");
  });
  it("does not classify one recent unanswered follow-up as ghosting", () => {
    expect(fromHistory({history: [{...history[0], applications: [app(1, {response: "responded", status: "Followed up once, no response"})]}], jobTitle: "Other"})).toEqual([]);
  });
  it("does not say they gave no feedback if some recorded rejections had feedback", () => {
    expect(fromHistory({history: [{...history[0], applications: [...history[0].applications, app(2, {feedback: "SPECIFIC"})]}]}).map((f) => f.id)).not.toContain("no-feedback");
  });
});
