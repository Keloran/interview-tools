import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {POST} from "@/app/api/data/import/route";
import {GET} from "@/app/api/data/export/route";
import {guessMapping, ImportHistoryRow} from "@/lib/csvImport";
import {MAX_CSV_BYTES, parseCSV} from "@/lib/csv";

const csv = "company,title,date,link,status\nAcme,Engineer,2020-01-01,,Applied";
const body = (action = "preview", contents = csv) => ({csv: contents, mapping: guessMapping(parseCSV(contents).headers), action});
const request = (value: unknown) => new NextRequest("http://localhost/api/data/import", {method: "POST", body: JSON.stringify(value)});
const tx = {user: {upsert: vi.fn()}, application: {findMany: vi.fn(), create: vi.fn()}, company: {findMany: vi.fn(), upsert: vi.fn()}, stage: {upsert: vi.fn()}, stageMethod: {upsert: vi.fn()}, $queryRaw: vi.fn()};
let saved: ImportHistoryRow[];
beforeEach(() => {
  vi.resetAllMocks(); saved = [];
  vi.mocked(currentUser).mockResolvedValue({id: "user_123", emailAddresses: [{emailAddress: "a@example.com"}]} as any);
  vi.mocked(prisma.application.findMany).mockImplementation(vi.fn(async () => saved) as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
    const snapshot = [...saved];
    try {return await callback(tx);} catch (error) {saved = snapshot; throw error;}
  });
  tx.user.upsert.mockResolvedValue({id: 7});
  tx.$queryRaw.mockResolvedValue([{value: 1}]);
  tx.application.findMany.mockImplementation(async () => [...saved]);
  tx.company.findMany.mockResolvedValue([{id: 4, name: "ACME"}]);
  tx.company.upsert.mockImplementation(async ({create}) => ({id: 5, name: create.name}));
  tx.stage.upsert.mockResolvedValue({id: 2}); tx.stageMethod.upsert.mockResolvedValue({id: 3});
  tx.application.create.mockImplementation(async ({data}) => {
    saved.push({id: saved.length + 1, jobTitle: data.jobTitle, applicationDate: data.applicationDate, clientCompany: data.clientCompany, jobPostingLink: data.jobPostingLink, company: {id: data.companyId, name: data.companyId === 4 ? "ACME" : "Other"}});
    return {id: saved.length};
  });
});

describe("CSV import", () => {
  it("rejects anonymous preview, import and export", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await POST(request(body()))).status).toBe(401);
    expect((await POST(request(body("import")))).status).toBe(401);
    expect((await GET(new NextRequest("http://localhost/api/data/export"))).status).toBe(401);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("previews privately without writing and ignores supplied ownership", async () => {
    const response = await POST(request({...body(), userId: 999}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ready: 1, errors: 0});
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {user: {clerkId: "user_123"}}}));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.user.upsert).not.toHaveBeenCalled();
  });
  it("re-imports the same file without creating another application", async () => {
    const first = await POST(request(body("import")));
    expect(await first.json()).toMatchObject({imported: 1, duplicates: 0});
    const second = await POST(request(body("import")));
    expect(await second.json()).toMatchObject({imported: 0, duplicates: 1});
    expect(saved).toHaveLength(1);
    expect(tx.application.create).toHaveBeenCalledTimes(1);
    expect(tx.application.create).toHaveBeenCalledWith({data: expect.objectContaining({userId: 7, companyId: 4, applicationDate: new Date("2020-01-01"), interviews: {create: {stageId: 2, stageMethodId: 3, outcome: "AWAITING_RESPONSE", date: null, created_at: new Date("2020-01-01"), updated_at: new Date("2020-01-01")}}})});
    expect(tx.company.upsert).not.toHaveBeenCalled();
  });
  it("acquires a parameterised per-user lock before reading existing history", async () => {
    await POST(request(body("import")));
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toBe("SELECT 1 FROM pg_advisory_xact_lock(1313, ?::int)");
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(7);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.application.findMany.mock.invocationCallOrder[0]);
    expect(tx.application.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {userId: 7}}));
  });
  it("handles concurrent submissions when the advisory lock serialises their history reads", async () => {
    let gate = Promise.resolve();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const previous = gate;
      let release!: () => void;
      gate = new Promise<void>((resolve) => {release = resolve;});
      try {return await callback({...tx, $queryRaw: async () => {await previous; return [];}});} finally {release();}
    });
    const responses = await Promise.all([POST(request(body("import"))), POST(request(body("import")))]);
    const values = await Promise.all(responses.map((response) => response.json()));
    expect(values.reduce((sum, value) => sum + value.imported, 0)).toBe(1);
    expect(values.reduce((sum, value) => sum + value.duplicates, 0)).toBe(1);
    expect(saved).toHaveLength(1);
  });
  it("rechecks duplicates at commit if history changed after preview", async () => {
    expect(await (await POST(request(body()))).json()).toMatchObject({ready: 1});
    saved.push({id: 3, jobTitle: "Engineer", applicationDate: new Date("2020-01-01"), clientCompany: null, jobPostingLink: null, company: {id: 4, name: "Acme"}});
    expect(await (await POST(request(body("import")))).json()).toMatchObject({imported: 0, duplicates: 1});
    expect(tx.application.create).not.toHaveBeenCalled();
    expect(tx.stage.upsert).not.toHaveBeenCalled();
  });
  it("reports bad rows and same-file duplicates while importing only ready rows", async () => {
    const contents = csv + "\nACME,Developer,2020-01-01,,\nBad,Tester,not-a-date,,";
    const value = await (await POST(request(body("import", contents)))).json();
    expect(value).toMatchObject({imported: 1, duplicates: 1, errors: 1});
    expect(value.rows[2]).toMatchObject({line: 4, status: "error", reason: expect.stringContaining("valid YYYY-MM-DD")});
    expect(saved).toHaveLength(1);
  });
  it("does not leave partial applications after a database failure", async () => {
    const create = tx.application.create.getMockImplementation()!;
    tx.application.create.mockImplementationOnce(create).mockRejectedValueOnce(new Error("private database failure"));
    const response = await POST(request(body("import", csv + "\nOther,Analyst,2020-01-02,,")));
    expect(response.status).toBe(500);
    expect(saved).toEqual([]);
    expect(await response.text()).not.toContain("private database failure");
  });
  it("rejects malformed CSV and mappings before accessing storage", async () => {
    expect((await POST(request({...body(), csv: 'a,b\n"broken'}))).status).toBe(400);
    expect((await POST(request({...body(), mapping: {...body().mapping, company: null}}))).status).toBe(400);
    expect((await POST(request({...body(), action: "delete"}))).status).toBe(400);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("bounds requests even without a Content-Length header", async () => {
    const response = await POST(new NextRequest("http://localhost/api/data/import", {method: "POST", body: "x".repeat(MAX_CSV_BYTES * 3 + 1)}));
    expect(response.status).toBe(413);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("CSV export", () => {
  it("exports only owned applications with private download headers", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValueOnce([{id: 1, company: {id: 4, name: "Acme"}, clientCompany: null, jobTitle: "Engineer", applicationDate: new Date("2020-01-01"), jobPostingLink: null, created_at: new Date(), updated_at: new Date(), interviews: []}] as any);
    const response = await GET(new NextRequest("http://localhost/api/data/export?userId=999"));
    expect(response.status).toBe(200);
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {user: {clerkId: "user_123"}}}));
    expect(response.headers.get("Content-Disposition")).toContain("interview-tools-applications.csv");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(parseCSV(await response.text()).records[0].cells).toContain("Engineer");
  });
  it("exports private story answers separately and handles failures", async () => {
    vi.mocked(prisma.story.findMany).mockResolvedValueOnce([{id: 2, title: "Conflict", situation: "Problem", task: "Resolve", action: "Listened", result: "Agreed", tags: ["conflict"], interviews: []}] as any);
    const response = await GET(new NextRequest("http://localhost/api/data/export?kind=stories"));
    expect(await response.text()).toContain('"Listened"');
    expect(prisma.story.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {user: {clerkId: "user_123"}}}));
    vi.mocked(prisma.application.findMany).mockRejectedValueOnce(new Error("private failure"));
    const failed = await GET(new NextRequest("http://localhost/api/data/export"));
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("private failure");
  });
});
