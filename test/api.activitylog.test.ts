import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET, POST} from "@/app/api/activity-log/route";
import {PUT, DELETE} from "@/app/api/activity-log/[id]/route";
import {PUT as sent} from "@/app/api/availability/[id]/sent/route";
import {activityApplicationSelect, entrySelect} from "@/lib/activityLog";

const request = (value: unknown) => new NextRequest("https://interviews.tools/api/activity-log", {method: "POST", body: JSON.stringify(value)});
const context = (id = "7") => ({params: Promise.resolve({id})});
const body = {date: "2026-01-01", activity: "Careers fair"};
beforeEach(() => {vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);});
describe("private activity log API", () => {
  it("requires authentication for reads, creation, updates, deletion and sent tracking", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request(body))).status).toBe(401);
    expect((await PUT(request(body), context())).status).toBe(401);
    expect((await DELETE(request(body), context())).status).toBe(401);
    expect((await sent(request({sent: true}), context())).status).toBe(401);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.activityEntry.create).not.toHaveBeenCalled();
  });
  it("scopes both application activity and free entries to the signed-in owner", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activityEntry.findMany).mockResolvedValue([]);
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({applications: [], entries: []});
    expect(prisma.application.findMany).toHaveBeenCalledWith({where: {user: {clerkId: "user_123"}}, select: activityApplicationSelect, orderBy: {id: "asc"}});
    expect(prisma.activityEntry.findMany).toHaveBeenCalledWith({where: {user: {clerkId: "user_123"}}, select: entrySelect, orderBy: [{date: "asc"}, {id: "asc"}]});
    expect(activityApplicationSelect.interviews.select).not.toHaveProperty("notes");
    expect(entrySelect).not.toHaveProperty("userId");
  });
  it("creates entries for the authenticated user and rejects ownership injection", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1} as any);
    vi.mocked(prisma.activityEntry.create).mockResolvedValue({id: 7} as any);
    expect((await POST(request({...body, userId: 999, id: 5}))).status).toBe(201);
    expect(prisma.activityEntry.create).toHaveBeenCalledWith({data: {...body, date: new Date("2026-01-01"), userId: 1, employer: "", role: "", how: "", outcome: "", notes: ""}, select: entrySelect});
  });
  it("validates free-entry dates and text before creating a database user", async () => {
    expect((await POST(request({...body, date: "2026-02-30"}))).status).toBe(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect((await PUT(request({...body, activity: ""}), context())).status).toBe(400);
    expect(prisma.activityEntry.updateMany).not.toHaveBeenCalled();
  });
  it("updates or deletes only owned entries and returns 404 for inaccessible records", async () => {
    vi.mocked(prisma.activityEntry.updateMany).mockResolvedValue({count: 1});
    expect((await PUT(request(body), context())).status).toBe(200);
    expect(prisma.activityEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({where: {id: 7, user: {clerkId: "user_123"}}}));
    vi.mocked(prisma.activityEntry.deleteMany).mockResolvedValueOnce({count: 0}).mockResolvedValueOnce({count: 1});
    expect((await DELETE(request(body), context())).status).toBe(404);
    expect((await DELETE(request(body), context())).status).toBe(204);
    expect(prisma.activityEntry.deleteMany).toHaveBeenLastCalledWith({where: {id: 7, user: {clerkId: "user_123"}}});
    expect((await PUT(request(body), context("1e2"))).status).toBe(400);
  });
  it("returns generic errors without exposing private data", async () => {
    vi.mocked(prisma.application.findMany).mockRejectedValue(new Error("private notes"));
    vi.mocked(prisma.activityEntry.findMany).mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private notes");
  });
});
describe("explicit availability send tracking", () => {
  it("does nothing without a boolean confirmation or when the link is inaccessible", async () => {
    expect((await sent(request({}), context())).status).toBe(400);
    vi.mocked(prisma.availabilityLink.findFirst).mockResolvedValue(null);
    expect((await sent(request({sent: true}), context())).status).toBe(404);
    expect(prisma.availabilityLink.updateMany).not.toHaveBeenCalled();
  });
  it("sets only the owner's unrecorded send timestamp and permits clearing a mistake", async () => {
    vi.mocked(prisma.availabilityLink.findFirst).mockResolvedValue({id: "link"} as any);
    vi.mocked(prisma.availabilityLink.updateMany).mockResolvedValue({count: 1});
    expect((await sent(request({sent: true}), context("link"))).status).toBe(200);
    const where = {id: "link", application: {user: {clerkId: "user_123"}}};
    expect(prisma.availabilityLink.findFirst).toHaveBeenCalledWith({where, select: {id: true}});
    expect(prisma.availabilityLink.updateMany).toHaveBeenCalledWith({where: {...where, sentAt: null}, data: {sentAt: expect.any(Date)}});
    expect((await sent(request({sent: false}), context("link"))).status).toBe(200);
    expect(prisma.availabilityLink.updateMany).toHaveBeenLastCalledWith({where, data: {sentAt: null}});
  });
});
