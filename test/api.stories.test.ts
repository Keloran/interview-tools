import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET, POST} from "@/app/api/stories/route";
import {PUT, DELETE} from "@/app/api/stories/[id]/route";
import {GET as getPrep, PUT as putPrep} from "@/app/api/interview/[id]/prep/route";

const ctx = (id = "1") => ({params: Promise.resolve({id})});
const request = (body: unknown = {}, method = "PUT") => new NextRequest("http://localhost/api/stories/1", {method, body: JSON.stringify(body)});
const saved = {id: 1, title: "Conflict", situation: "", task: "", action: "Discussed", result: "Agreed", tags: ["conflict"], interviews: []};
const tx = {interview: {findFirst: vi.fn(), update: vi.fn()}, story: {findMany: vi.fn()}, storyUse: {deleteMany: vi.fn(), createMany: vi.fn()}};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(currentUser).mockResolvedValue({id: "user_123", emailAddresses: [{emailAddress: "a@example.com"}]} as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
  tx.interview.findFirst.mockResolvedValue({id: 1});
  tx.story.findMany.mockResolvedValue([{id: 2}, {id: 3}]);
});

describe("private stories", () => {
  it("rejects anonymous reads and writes before accessing storage", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({}, "POST"))).status).toBe(401);
    expect((await PUT(request(), ctx())).status).toBe(401);
    expect((await DELETE(request(), ctx())).status).toBe(401);
    expect((await getPrep(request(), ctx())).status).toBe(401);
    expect((await putPrep(request(), ctx())).status).toBe(401);
    expect(prisma.story.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("scopes stories and linked usage to the signed-in user", async () => {
    vi.mocked(prisma.story.findMany).mockResolvedValue([saved] as any);
    const response = await GET();
    expect((await response.json())[0]).toMatchObject({id: 1, usedIn: []});
    expect(prisma.story.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {user: {clerkId: "user_123"}}, select: expect.objectContaining({interviews: expect.objectContaining({where: {interview: {application: {user: {clerkId: "user_123"}}}}})})}));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("creates under the current user regardless of supplied ownership", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 7} as any);
    vi.mocked(prisma.story.create).mockResolvedValue(saved as any);
    expect((await POST(request({title: "Conflict", userId: 999}, "POST"))).status).toBe(201);
    expect(prisma.story.create).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({userId: 7, title: "Conflict"})}));
  });
  it("rejects malformed data and invalid ids", async () => {
    expect((await POST(request({title: " "}, "POST"))).status).toBe(400);
    expect((await PUT(request({title: "Ok"}), ctx("-1"))).status).toBe(400);
    expect((await DELETE(request(), ctx("NaN"))).status).toBe(400);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });
  it("cannot edit another user's story", async () => {
    vi.mocked(prisma.story.updateMany).mockResolvedValue({count: 0});
    expect((await PUT(request({title: "Changed"}), ctx("99"))).status).toBe(404);
    expect(prisma.story.updateMany).toHaveBeenCalledWith(expect.objectContaining({where: {id: 99, user: {clerkId: "user_123"}}}));
  });
  it("deletes only owned stories and reports missing ones", async () => {
    vi.mocked(prisma.story.deleteMany).mockResolvedValueOnce({count: 0}).mockResolvedValueOnce({count: 1});
    expect((await DELETE(request(), ctx("99"))).status).toBe(404);
    expect((await DELETE(request(), ctx("1"))).status).toBe(204);
    expect(prisma.story.deleteMany).toHaveBeenCalledWith({where: {id: 1, user: {clerkId: "user_123"}}});
  });
});

describe("stage preparation", () => {
  it("scopes both the stage and its story links on reads", async () => {
    vi.mocked(prisma.interview.findFirst).mockResolvedValue({prepNotes: "Research", stories: [{storyId: 2}]} as any);
    const response = await getPrep(request(), ctx());
    expect(await response.json()).toEqual({notes: "Research", storyIds: [2]});
    expect(prisma.interview.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {id: 1, application: {user: {clerkId: "user_123"}}}, select: expect.objectContaining({stories: expect.objectContaining({where: {story: {user: {clerkId: "user_123"}}}})})}));
  });
  it("does not expose preparation for an unowned stage", async () => {
    vi.mocked(prisma.interview.findFirst).mockResolvedValue(null);
    expect((await getPrep(request(), ctx())).status).toBe(404);
  });
  it("updates notes and reuses story references in one transaction without copying stories", async () => {
    const response = await putPrep(request({notes: "Company research", storyIds: [2, 2, 3]}), ctx());
    expect(response.status).toBe(200);
    expect(tx.story.findMany).toHaveBeenCalledWith({where: {id: {in: [2, 3]}, user: {clerkId: "user_123"}}, select: {id: true}});
    expect(tx.interview.update).toHaveBeenCalledWith({where: {id: 1}, data: {prepNotes: "Company research"}});
    expect(tx.storyUse.createMany).toHaveBeenCalledWith({data: [{interviewId: 1, storyId: 2}, {interviewId: 1, storyId: 3}]});
    expect(prisma.story.create).not.toHaveBeenCalled();
  });
  it("does not modify anything when a selected story belongs to someone else", async () => {
    tx.story.findMany.mockResolvedValue([{id: 2}]);
    expect((await putPrep(request({notes: "New", storyIds: [2, 99]}), ctx())).status).toBe(404);
    expect(tx.interview.update).not.toHaveBeenCalled();
    expect(tx.storyUse.deleteMany).not.toHaveBeenCalled();
  });
  it("checks interview ownership inside the transaction before any story access", async () => {
    tx.interview.findFirst.mockResolvedValue(null);
    expect((await putPrep(request({notes: "New", storyIds: [2]}), ctx())).status).toBe(404);
    expect(tx.story.findMany).not.toHaveBeenCalled();
    expect(tx.interview.update).not.toHaveBeenCalled();
  });
  it("supports clearing preparation and rejects incomplete or oversized updates", async () => {
    tx.story.findMany.mockResolvedValue([]);
    expect((await putPrep(request({notes: "", storyIds: []}), ctx())).status).toBe(200);
    expect(tx.interview.update).toHaveBeenCalledWith({where: {id: 1}, data: {prepNotes: null}});
    expect(tx.storyUse.createMany).not.toHaveBeenCalled();
    expect((await putPrep(request({notes: "Only notes"}), ctx())).status).toBe(400);
    expect((await putPrep(request({notes: "", storyIds: Array(31).fill(1)}), ctx())).status).toBe(400);
  });
  it("reports transactional failures without exposing internals", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("secret connection"));
    const response = await putPrep(request({notes: "Notes", storyIds: []}), ctx());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret connection");
  });
});
