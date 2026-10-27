import {describe, expect, it} from "vitest";
import {filterQuestions, previousQuestions, questionEntries, QuestionSource} from "@/lib/questions";

const row = (id: number, extra: Partial<QuestionSource> = {}): QuestionSource => ({id, date: new Date("2026-01-01"), debriefedAt: null, created_at: new Date("2025-01-01"), questionsAsked: "Why this role?\r\n\n  Describe a conflict. ", debriefNotes: "Used my delivery example", stage: {stage: "Technical Interview"}, application: {jobTitle: "Engineer", clientCompany: "Acme", company: {name: "Recruit Co"}}, ...extra});

describe("question bank", () => {
  it("derives questions, notes, company, recruiter and dates from existing debriefs", () => {
    expect(questionEntries([row(1)])[0]).toMatchObject({interviewId: 1, company: "Acme", recruiter: "Recruit Co", date: "2026-01-01T00:00:00.000Z", questions: ["Why this role?", "Describe a conflict."], notes: "Used my delivery example"});
  });
  it("ignores empty questions and sorts newest first with deterministic ties", () => {
    expect(questionEntries([row(1), row(2), row(3, {questionsAsked: "\n "}), row(4, {questionsAsked: null})]).map((e) => e.interviewId)).toEqual([2, 1]);
  });
  it("uses debrief date when an interview has no date and recognises direct employers", () => {
    expect(questionEntries([row(1, {date: null, debriefedAt: new Date("2026-02-01"), application: {jobTitle: "Engineer", clientCompany: " ", company: {name: "Acme"}}})])[0]).toMatchObject({company: "Acme", recruiter: null, date: "2026-02-01T00:00:00.000Z"});
  });
  it("searches across companies, questions and answer notes", () => {
    const entries = questionEntries([row(1), row(2, {application: {jobTitle: "Analyst", clientCompany: null, company: {name: "Other"}}})]);
    expect(filterQuestions(entries, {q: "CONFLICT"})).toHaveLength(2);
    expect(filterQuestions(entries, {q: "delivery", company: " acme "})).toHaveLength(1);
    expect(filterQuestions(entries, {stage: "Phone Screen"})).toEqual([]);
    expect(filterQuestions(entries, {q: "Other"})[0].company).toBe("Other");
  });
  it("suggests only earlier matching company and stage questions, excluding itself", () => {
    const entries = questionEntries([row(1), row(2, {date: new Date("2027-01-01")}), row(3, {stage: {stage: "Phone Screen"}})]);
    expect(previousQuestions(entries, {interviewId: 2, company: "ACME", stage: "Technical Interview", date: "2026-12-01"}).map((e) => e.interviewId)).toEqual([1]);
    expect(previousQuestions(entries, {interviewId: 1, company: "Acme", stage: "Technical Interview", date: "2026-12-01"})).toEqual([]);
  });
});
