import {describe, expect, it} from "vitest";
import {EXPORT_FORMAT, MAX_CSV_BYTES, MAX_CSV_ROWS, parseCSV, restoreExportText, spreadsheetText, writeCSV} from "@/lib/csv";
import {guessMapping, importDate, importHistory, planImport, validateMapping} from "@/lib/csvImport";
import {exportApplications, exportStories} from "@/lib/csvExport";

describe("CSV parsing and writing", () => {
  it("handles BOM, quoted commas, doubled quotes and multiline fields with source line numbers", () => {
    const table = parseCSV('\uFEFFcompany,title,date\r\n"Acme, Ltd","Engineer ""II""",2026-01-01\r\n"Two\r\nlines",Analyst,2026-01-02\r\nLast,Tester,2026-01-03\r\n');
    expect(table.headers).toEqual(["company", "title", "date"]);
    expect(table.records).toEqual([{line: 2, cells: ["Acme, Ltd", 'Engineer "II"', "2026-01-01"]}, {line: 3, cells: ["Two\r\nlines", "Analyst", "2026-01-02"]}, {line: 5, cells: ["Last", "Tester", "2026-01-03"]}]);
  });
  it("ignores empty physical lines but reports empty data rows", () => {
    expect(parseCSV('\ncompany,title,date\n\n,,\n').records).toEqual([{line: 4, cells: ["", "", ""]}]);
  });
  it.each(['a,b\n"unterminated,b', 'a,b\nx"x,b', 'a,b\n"x"bad,b', '', 'company,title\n'])("reports malformed or empty files", (csv) => expect(() => parseCSV(csv)).toThrow());
  it("bounds file size, row count and column count", () => {
    expect(() => parseCSV("a".repeat(MAX_CSV_BYTES + 1))).toThrow(/2 MB/);
    expect(() => parseCSV("a\n" + "b\n".repeat(MAX_CSV_ROWS + 1))).toThrow(/500/);
    expect(() => parseCSV(Array(101).fill("a").join(",") + "\nx")).toThrow(/100 columns/);
  });
  it("round-trips escaped text without changing embedded quotes and separators", () => {
    const value = 'A, B\n"quoted"; value';
    expect(parseCSV(writeCSV([["header"], [value]])).records[0].cells[0]).toBe(value);
  });
  it.each(["=HYPERLINK(\"https://evil.test\")", "+command", "-1+2", "@SUM(A1)", "\t=1+1", "\n=1+1", "  ＝1+1"])("guards spreadsheet formulas and restores tagged export text: %j", (value) => {
    const guarded = spreadsheetText(value);
    expect(guarded).toBe(`\t${value}`);
    expect(restoreExportText(guarded)).toBe(value);
    expect(parseCSV(writeCSV([["header"], [value]], true)).records[0].cells[0]).toBe(guarded);
  });
  it("keeps literal apostrophes and ordinary values", () => {
    expect(restoreExportText(spreadsheetText("'=literal"))).toBe("'=literal");
    expect(spreadsheetText("Acme")).toBe("Acme");
  });
});

describe("import planning", () => {
  const csv = (rows: string) => parseCSV(`company,title,date,link,status,client\n${rows}`);
  const mapping = guessMapping(csv("Acme,Engineer,2026-01-01,,,").headers);
  it("guesses common headers and rejects missing or duplicate mappings", () => {
    expect(guessMapping(["Employer", "Role", "Date Applied"]).company).toBe(0);
    expect(() => validateMapping({...mapping, company: null}, csv("x").headers)).toThrow(/Company/);
    expect(() => validateMapping({...mapping, jobTitle: 0}, csv("x").headers)).toThrow(/only one/);
    expect(() => validateMapping({...mapping, company: -1}, csv("x").headers)).toThrow(/does not exist/);
  });
  it.each([["2024-02-29", "2024-02-29T00:00:00.000Z"], ["31/12/2026", "2026-12-31T00:00:00.000Z"], ["2026-01-01T09:30:00+01:00", "2026-01-01T08:30:00.000Z"]])("parses explicit dates: %s", (value, expected) => expect(importDate(value)).toBe(expected));
  it.each(["", "31/02/2026", "2026-02-30", "12/31/2026", "tomorrow", "0000-01-01", "2026-01-01T99:00:00Z"])("rejects invalid dates instead of inventing one: %s", (value) => expect(importDate(value)).toBeNull());
  it("reports invalid rows with all reasons and source lines", () => {
    const result = planImport(csv('Acme,Engineer,2026-01-01,,,\n,Missing,31/02/2026,javascript:alert(1),mystery,\nToo,few'), mapping);
    expect(result).toMatchObject({ready: 1, errors: 2, duplicates: 0});
    expect(result.rows[1]).toMatchObject({line: 3, status: "error", reason: expect.stringContaining("Company is required")});
    expect(result.rows[1].reason).toContain("valid YYYY-MM-DD");
    expect(result.rows[1].reason).toContain("Unknown status");
    expect(result.rows[1].reason).toContain("HTTP(S)");
    expect(result.rows[2].reason).toContain("Expected 6 columns");
  });
  it("rejects null characters before database writes", () => {
    expect(planImport(csv("Ac\0me,Engineer,2026-01-01,,,"), mapping).rows[0].reason).toContain("null characters");
  });
  it("uses existing title and posting-link duplicate rules, including recruiter clients", () => {
    const history = importHistory([{id: 10, jobTitle: "Senior Backend Engineer", clientCompany: "BigBank", applicationDate: new Date(), jobPostingLink: "https://linkedin.com/jobs/view/123?trackingId=old", company: {id: 1, name: "Agency"}}]);
    const result = planImport(csv("BigBank,Sr. Back-end Dev,2026-01-01,,,\nOther,Other Role,2026-01-02,https://uk.linkedin.com/jobs/view/123?refId=new,,"), mapping, history);
    expect(result.duplicates).toBe(2);
    expect(history[0].applications).toHaveLength(1);
  });
  it("detects duplicates within a file and preserves distinct roles", () => {
    const result = planImport(csv("Acme,Software Engineer,2026-01-01,,,\nACME,Software Developer,2026-02-01,,,\nAcme,Analyst,2026-01-02,,Rejected,"), mapping);
    expect(result).toMatchObject({ready: 2, duplicates: 1});
    expect(result.rows[1].reason).toContain("line 2");
    expect(result.rows[0].data?.outcome).toBe("AWAITING_RESPONSE");
    expect(result.rows[2].data?.outcome).toBe("REJECTED");
  });
});

describe("data exports", () => {
  const application = (interviews: any[] = []) => ({id: 1, company: {id: 1, name: "=Acme"}, clientCompany: null, jobTitle: 'Senior "Engineer"', applicationDate: new Date("2026-01-01"), jobPostingLink: "https://example.com/jobs/1", created_at: new Date(), updated_at: new Date(), interviews});
  const stage = (id: number) => ({id, parentId: id === 2 ? 1 : null, stage: {stage: "Technical"}, stageMethod: {method: "Phone"}, outcome: "REJECTED", questionsAsked: "Why us?\nA conflict?", debriefNotes: "Specific answer", prepNotes: "Ask about delivery", feedbackType: "SPECIFIC", feedbackText: "More detail", durationMinutes: 60});
  it("exports every stage, including multiline debriefs and applications without stages", () => {
    const table = parseCSV(exportApplications([application([stage(2), stage(1)]), {...application(), id: 2}] as any));
    expect(table.records).toHaveLength(3);
    const value = (row: number, name: string) => table.records[row].cells[table.headers.indexOf(name)];
    expect(value(0, "questionsAsked")).toBe("Why us?\nA conflict?");
    expect(value(0, "feedbackText")).toBe("More detail");
    expect(value(0, "company")).toBe("\t=Acme");
    expect(value(0, "exportFormat")).toBe(EXPORT_FORMAT);
    expect(value(2, "interviewId")).toBe("");
  });
  it("can re-import an application's export once without duplicating its stage rows", () => {
    const table = parseCSV(exportApplications([application([stage(2), stage(1)])] as any));
    const plan = planImport(table, guessMapping(table.headers));
    expect(plan).toMatchObject({ready: 1, duplicates: 1, errors: 0});
    expect(plan.rows[0].company).toBe("=Acme");
    expect(plan.rows[0].data?.outcome).toBe("REJECTED");
  });
  it("exports story answers, tags and stage references in a separate CSV", () => {
    const table = parseCSV(exportStories([{id: 3, title: "Delivery", situation: "Problem", task: "Ship", action: "Prioritised", result: "Shipped", tags: ["delivery"], usedIn: [{interviewId: 5, company: "Acme", stage: "Technical"}]}]));
    expect(table.records[0].cells[table.headers.indexOf("result")]).toBe("Shipped");
    expect(JSON.parse(table.records[0].cells[table.headers.indexOf("usedIn")])[0].interviewId).toBe(5);
  });
});
