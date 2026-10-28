import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET, PUT, POST} from "@/app/api/stale-applications/route";
import {GET as getInterviews} from "@/app/api/interviews/route";
import {StaleApplication, staleSelect} from "@/lib/staleApplications";
import {OLD, STALE_NOW, staleApplication} from "./fixtures/staleApplications";

const request = (body: unknown) => new NextRequest("https://interviews.tools/api/stale-applications", {method: "POST", body: JSON.stringify(body)});
const close = (ids = [1]) => POST(request({ids, days: 60, confirm: true}));
const tx = {$queryRaw: vi.fn(), application: {findMany: vi.fn()}, interview: {updateMany: vi.fn(), create: vi.fn()}, stage: {upsert: vi.fn()}, stageMethod: {upsert: vi.fn()}};
let rows: StaleApplication[];
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(Date, "now").mockReturnValue(STALE_NOW);
  rows = [staleApplication()];
  vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({staleAfterDays: 60} as any);
  vi.mocked(prisma.application.findMany).mockImplementation(vi.fn(async () => rows) as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
    const before = rows.map((row) => ({...row, interviews: row.interviews.map((stage) => ({...stage})), followUps: [...row.followUps]}));
    try {return await callback(tx);} catch (error) {rows = before; throw error;}
  });
  tx.$queryRaw.mockResolvedValue([{id: 1}]);
  tx.application.findMany.mockImplementation(async () => rows);
  tx.interview.updateMany.mockImplementation(async ({where, data}) => {
    const stage = rows.find((row) => row.id === where.applicationId)?.interviews.find((stage) => stage.id === where.id && stage.updated_at.getTime() === where.updated_at.getTime());
    if (!stage) return {count: 0};
    Object.assign(stage, data, {updated_at: new Date(STALE_NOW)}); return {count: 1};
  });
  tx.stage.upsert.mockResolvedValue({id: 1}); tx.stageMethod.upsert.mockResolvedValue({id: 2});
  tx.interview.create.mockImplementation(async ({data}) => {
    rows.find((row) => row.id === data.applicationId)!.interviews.push({...staleApplication().interviews[0], id: 42, outcome: data.outcome, updated_at: new Date(STALE_NOW)});
    return {id: 42};
  });
});
afterEach(() => vi.restoreAllMocks());
describe("stale preview and settings", () => {
  it("requires authentication for preview, settings and closure", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PUT(request({days: 30}))).status).toBe(401);
    expect((await close()).status).toBe(401);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("previews only owned records without writing and defaults to sixty days", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({days: 60, total: 1, candidates: [{id: 1, quietDays: 100}]});
    expect(prisma.application.findMany).toHaveBeenCalledWith({where: {user: {clerkId: "user_123"}}, select: staleSelect});
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
  it("saves only the authenticated user's validated setting without closing anything", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1} as any);
    expect((await PUT(request({days: 30, userId: 999}))).status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({where: {clerkId: "user_123"}, update: {staleAfterDays: 30}}));
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect((await PUT(request({days: 0}))).status).toBe(400);
  });
});
describe("confirmed stale closure", () => {
  it("filters outcomes after choosing the current parent-chain stage, excluding historical awaiting rows", async () => {
    const application = {id: 7, jobTitle: "Engineer", clientCompany: null, applicationDate: OLD, jobPostingLink: null, company: {id: 1, name: "Acme"}};
    vi.mocked(prisma.interview.findMany).mockResolvedValue([
      {id: 10, parentId: null, created_at: OLD, outcome: "AWAITING_RESPONSE", application},
      {id: 1, parentId: 10, created_at: new Date(OLD.getTime() - 1000), outcome: "NO_RESPONSE", application},
    ] as any);
    const base = "https://interviews.tools/api/interviews?includePast=true&latestOnly=true";
    expect(await (await getInterviews(new NextRequest(`${base}&outcome=AWAITING_RESPONSE`))).json()).toEqual([]);
    const closed = await (await getInterviews(new NextRequest(`${base}&outcome=NO_RESPONSE`))).json();
    expect(closed).toHaveLength(1); expect(closed[0]).toMatchObject({id: 1, applicationId: 7, outcome: "NO_RESPONSE"});
    expect(vi.mocked(prisma.interview.findMany).mock.calls.at(-1)![0]!.where).not.toHaveProperty("outcome");
  });
  it("does not mutate without explicit confirmation and bounded IDs/thresholds", async () => {
    for (const body of [{ids: [1], days: 60}, {ids: [1], days: 60, confirm: false}, {ids: [], days: 60, confirm: true}, {ids: [1], days: 0, confirm: true}]) expect((await POST(request(body))).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("locks owned parents before re-reading, guards stage versions and is retry-idempotent", async () => {
    const response = await close([1, 1]);
    expect(await response.json()).toEqual({closed: [1], skipped: []});
    expect(tx.$queryRaw.mock.calls[0][0].join(" ")).toContain("FOR UPDATE OF a");
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(["user_123", [1]]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.application.findMany.mock.invocationCallOrder[0]);
    expect(tx.application.findMany).toHaveBeenCalledWith({where: {id: {in: [1]}, user: {clerkId: "user_123"}}, select: staleSelect});
    expect(tx.interview.updateMany).toHaveBeenCalledWith({where: {id: 10, applicationId: 1, updated_at: OLD}, data: {outcome: "NO_RESPONSE"}});
    expect(await (await close()).json()).toEqual({closed: [], skipped: [1]});
    expect(tx.interview.updateMany).toHaveBeenCalledTimes(1);
  });
  it("rechecks activity that arrived after preview and skips concurrent stage edits", async () => {
    expect((await (await GET()).json()).total).toBe(1);
    tx.$queryRaw.mockImplementationOnce(async () => {rows[0].followUps.push({sentAt: new Date(STALE_NOW)}); return [{id: 1}];});
    expect(await (await close()).json()).toEqual({closed: [], skipped: [1]});
    expect(tx.interview.updateMany).not.toHaveBeenCalled();
    rows[0].followUps = [];
    tx.interview.updateMany.mockResolvedValueOnce({count: 0});
    expect(await (await close()).json()).toEqual({closed: [], skipped: [1]});
  });
  it("can close an application with no stage without inventing an interview date", async () => {
    rows[0].interviews = [];
    expect(await (await close()).json()).toEqual({closed: [1], skipped: []});
    expect(tx.interview.create).toHaveBeenCalledWith({data: {applicationId: 1, stageId: 1, stageMethodId: 2, outcome: "NO_RESPONSE", date: null}});
  });
  it("does not expose or update missing or unowned selections", async () => {
    rows = [];
    expect(await (await close([999])).json()).toEqual({closed: [], skipped: [999]});
    expect(tx.interview.updateMany).not.toHaveBeenCalled();
  });
  it("rolls the whole batch back if an update fails", async () => {
    rows.push(staleApplication(2));
    const original = tx.interview.updateMany.getMockImplementation()!;
    tx.interview.updateMany.mockImplementationOnce(original).mockRejectedValueOnce(new Error("private failure"));
    const response = await close([1, 2]);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private failure");
    expect(rows.every((row) => row.interviews[0].outcome === "AWAITING_RESPONSE")).toBe(true);
  });
});
