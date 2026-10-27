import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET} from "@/app/api/applications/[id]/timeline/route";
import {timelineSelect} from "@/lib/timeline";
import {application} from "./fixtures/timeline";

const get = (id = "7") => GET(new NextRequest(`https://interviews.tools/api/applications/${id}/timeline`), {params: Promise.resolve({id})});
beforeEach(() => {vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);});
describe("owned application timeline API", () => {
  it("rejects anonymous callers without reading the database", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(prisma.application.findFirst).not.toHaveBeenCalled();
  });
  it.each(["-1", "0", "1.2", "1e2", "NaN", "2147483648"])("rejects invalid application IDs: %s", async (id) => {
    expect((await get(id)).status).toBe(400);
    expect(prisma.application.findFirst).not.toHaveBeenCalled();
  });
  it("reads the whole history only through an owned application and disables caching", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(application() as any);
    const response = await get();
    expect(prisma.application.findFirst).toHaveBeenCalledWith({where: {id: 7, user: {clerkId: "user_123"}}, select: timelineSelect});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(application());
    expect(timelineSelect).not.toHaveProperty("user");
    expect(timelineSelect.availabilityLinks.select).not.toHaveProperty("slots");
  });
  it("returns the same 404 for missing and other users' applications", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
  it("returns a generic message on database failure", async () => {
    vi.mocked(prisma.application.findFirst).mockRejectedValue(new Error("private notes"));
    const response = await get();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private notes");
  });
});
