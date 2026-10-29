import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {Prisma} from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import {POST} from "@/app/api/native/stories/route";
import {POST as legacyPost} from "@/app/api/stories/route";

const mutation = "11111111-1111-4111-8111-111111111111";
const story = {id: 10, title: "Conflict", situation: "", task: "", action: "Discussed", result: "Agreed", tags: [], interviews: []};
const request = (body: unknown) => new NextRequest("https://interviews.tools/api/native/stories", {method: "POST", body: JSON.stringify(body)});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(currentUser).mockResolvedValue({id:"user_123",emailAddresses:[{emailAddress:"a@example.com"}]} as any);
  vi.mocked(prisma.user.upsert).mockResolvedValue({id:7} as any);
  vi.mocked(prisma.story.create).mockResolvedValue(story as any);
});
describe("retry-safe native stories", () => {
  it("requires authentication before any storage", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await POST(request({title:"Conflict",clientMutationId:mutation}))).status).toBe(401);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
  it("rejects missing and malformed identities", async () => {
    expect((await POST(request({title:"Conflict"}))).status).toBe(400);
    expect((await POST(request({title:"Conflict",clientMutationId:"bad"}))).status).toBe(400);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });
  it("creates the story and owned receipt atomically", async () => {
    const response=await POST(request({title:"Conflict",userId:999,clientMutationId:mutation.toUpperCase()}));
    expect(response.status).toBe(201);
    expect(prisma.story.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:7,createReceipt:{create:{userId:7,mutationId:mutation}}})}));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("replays a lost response without creating a second story", async () => {
    vi.mocked(prisma.storyCreateReceipt.findUnique).mockResolvedValue({story} as any);
    const response=await POST(request({title:"Changed since timeout",clientMutationId:mutation}));
    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe(10);
    expect(prisma.story.create).not.toHaveBeenCalled();
    expect(prisma.storyCreateReceipt.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{userId_mutationId:{userId:7,mutationId:mutation}}}));
  });
  it("never replays another account's identity", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id:8} as any);
    expect((await POST(request({title:"Conflict",clientMutationId:mutation}))).status).toBe(201);
    expect(prisma.storyCreateReceipt.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{userId_mutationId:{userId:8,mutationId:mutation}}}));
  });
  it("does not recreate a story deleted after the original upload", async () => {
    vi.mocked(prisma.storyCreateReceipt.findUnique).mockResolvedValue({story:null} as any);
    expect((await POST(request({title:"Conflict",clientMutationId:mutation}))).status).toBe(410);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });
  it("resolves simultaneous retries through the unique receipt", async () => {
    vi.mocked(prisma.storyCreateReceipt.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({story} as any);
    vi.mocked(prisma.story.create).mockRejectedValue(new Prisma.PrismaClientKnownRequestError("race",{code:"P2002",clientVersion:"test"}));
    expect((await POST(request({title:"Conflict",clientMutationId:mutation}))).status).toBe(200);
    expect(prisma.story.create).toHaveBeenCalledTimes(1);
  });
  it("keeps ordinary website creates working without a receipt", async () => {
    expect((await legacyPost(request({title:"Conflict"}))).status).toBe(201);
    expect(prisma.storyCreateReceipt.findUnique).not.toHaveBeenCalled();
  });
  it("returns a generic error when storage fails", async () => {
    vi.mocked(prisma.story.create).mockRejectedValue(new Error("secret database connection"));
    const response=await POST(request({title:"Conflict",clientMutationId:mutation}));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret database");
  });
});
