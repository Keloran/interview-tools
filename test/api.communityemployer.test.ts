import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET as catalog} from "@/app/api/community/employers/route";
import {GET, PUT} from "@/app/api/applications/[id]/community-employer/route";
import {POST as rebuild} from "@/app/api/community/rebuild/route";
import {linkCommunityEmployer} from "@/lib/communityEmployer";
const id = "7a01c03a-68df-4a27-ad6f-f184c8486391";
const context = {params: Promise.resolve({id: "7"})};
const req = (body: unknown) => new NextRequest("http://localhost/api/applications/7/community-employer", {method: "PUT", body: JSON.stringify(body)});
const app = () => ({id: 7, userId: 1, communityEmployerId: null, communityEmployerConfirmedAt: null, communityEmployerChangedAt: null, communityEmployerIdentity: null, communityEmployer: null, viaRecruiter: false, clientCompany: null, company: {name: "Acme Ltd"}});
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{id: "global"}]);
  vi.mocked(prisma.application.findFirst).mockResolvedValue(app() as never);
  vi.mocked(prisma.communityEmployer.findFirst).mockResolvedValue({id} as never);
  vi.mocked(prisma.communityContribution.deleteMany).mockResolvedValue({count: 1});
});
afterEach(() => vi.unstubAllEnvs());
describe("reviewed employer identities", () => {
  it("requires authentication and explicit confirmation; unrecognized fields cannot change ownership", async () => {
    expect((await PUT(req({employerId: id}), context)).status).toBe(400);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET(req({}), context)).status).toBe(401);
    expect((await PUT(req({employerId: null}), context)).status).toBe(401);
    expect((await catalog(req({}))).status).toBe(401);
  });
  it("returns only owned confirmation metadata and rejects inaccessible applications", async () => {
    expect(await (await GET(req({}), context)).json()).toEqual({applicationId: 7, sourceName: "Acme Ltd", employer: null, confirmed: false, requiresClient: false});
    expect(prisma.application.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {id: 7, user: {clerkId: "user_123"}}}));
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null);
    expect((await PUT(req({employerId: id, confirm: true}), context)).status).toBe(404);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
  it("links only reviewed identities and preserves legal entities as explicit IDs", async () => {
    expect((await PUT(req({employerId: id, confirm: true, userId: 99}), context)).status).toBe(200);
    expect(prisma.communityEmployer.findFirst).toHaveBeenCalledWith({where: {id, reviewedAt: {not: null}, suppressedAt: null}, select: {id: true}});
    expect(prisma.application.updateMany).toHaveBeenCalledWith({where: {id: 7, user: {clerkId: "user_123"}}, data: expect.objectContaining({communityEmployerId: id, communityEmployerIdentity: "acme ltd", communityEmployerConfirmedAt: expect.any(Date)})});
    vi.mocked(prisma.communityEmployer.findFirst).mockResolvedValue(null);
    expect((await PUT(req({employerId: id, confirm: true}), context)).status).toBe(404);
  });
  it("excludes recruiters with unknown clients and rate-limits reassignments while permitting removal", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({...app(), viaRecruiter: true} as never);
    expect((await linkCommunityEmployer("user_123", 7, id)).status).toBe(400);
    vi.mocked(prisma.application.findFirst).mockResolvedValue({...app(), communityEmployerId: "old", communityEmployerChangedAt: new Date()} as never);
    expect((await linkCommunityEmployer("user_123", 7, id)).status).toBe(429);
    expect((await linkCommunityEmployer("user_123", 7, null)).status).toBe(200);
    expect(prisma.communityContribution.deleteMany).toHaveBeenCalledWith({where: {userId: 1, employerId: "old"}});
    expect(prisma.communityControl.update).toHaveBeenCalledWith({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
  });
  it("searches the independent reviewed catalog without fetching private applications or scores", async () => {
    vi.mocked(prisma.communityEmployer.findMany).mockResolvedValue([]);
    const response = await catalog(new NextRequest("http://localhost/api/community/employers?q=ACME%2C%20Ltd."));
    expect(await response.json()).toEqual([]);
    expect(prisma.communityEmployer.findMany).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({reviewedAt: {not: null}, suppressedAt: null, OR: expect.arrayContaining([{aliases: {has: "acme ltd"}}])}), take: 20}));
    expect(prisma.application.findFirst).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("keeps the scheduled endpoint disabled without a strong secret and rejects unauthorized calls", async () => {
    vi.stubEnv("COMMUNITY_REBUILD_TOKEN", ""); expect((await rebuild(req({}))).status).toBe(404);
    vi.stubEnv("COMMUNITY_REBUILD_TOKEN", "x".repeat(40)); expect((await rebuild(req({}))).status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
