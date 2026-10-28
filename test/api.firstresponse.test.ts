import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {PUT} from "@/app/api/applications/[id]/first-response/route";
import {GET} from "@/app/api/companies/route";

const put = (body: unknown, id = "7") => PUT(new NextRequest(`https://interviews.tools/api/applications/${id}/first-response`, {method: "PUT", body: JSON.stringify(body)}), {params: Promise.resolve({id})});
beforeEach(() => {vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any); vi.mocked(prisma.application.findFirst).mockResolvedValue({applicationDate: new Date("2026-01-01T23:00:00Z")} as any); vi.mocked(prisma.application.updateMany).mockResolvedValue({count: 1});});
describe("explicit first-response API", () => {
  it("rejects anonymous callers before accessing data", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await put({firstResponseAt: "2026-01-02"})).status).toBe(401);
    expect(prisma.application.findFirst).not.toHaveBeenCalled();
  });
  it("only reads/writes the authenticated owner's application and ignores injected ownership", async () => {
    const response = await put({firstResponseAt: "2026-01-02", userId: 999, companyId: 123, outcome: "REJECTED"});
    expect(response.status).toBe(200);
    const where = {id: 7, user: {clerkId: "user_123"}};
    expect(prisma.application.findFirst).toHaveBeenCalledWith({where, select: {applicationDate: true}});
    expect(prisma.application.updateMany).toHaveBeenCalledWith({where, data: {firstResponseAt: new Date("2026-01-02")}});
    expect(await response.json()).toEqual({firstResponseAt: "2026-01-02T00:00:00.000Z"});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("allows clearing but never overwrites unknown history implicitly", async () => {
    expect((await put({firstResponseAt: null})).status).toBe(200);
    expect(prisma.application.updateMany).toHaveBeenCalledWith(expect.objectContaining({data: {firstResponseAt: null}}));
    vi.mocked(prisma.application.updateMany).mockClear();
    expect((await put({})).status).toBe(400);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
  it.each(["2025-12-31", "2026-02-30", "2999-01-01", "not a date"])("rejects invalid or impossible reply date %s before writing", async (firstResponseAt) => {
    expect((await put({firstResponseAt})).status).toBe(400);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
  it("does not reveal another user's or deleted applications", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValueOnce(null);
    expect((await put({firstResponseAt: null})).status).toBe(404);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
    vi.mocked(prisma.application.updateMany).mockResolvedValueOnce({count: 0});
    expect((await put({firstResponseAt: null})).status).toBe(404);
  });
  it("rejects malformed IDs and generic database errors", async () => {
    expect((await put({firstResponseAt: null}, "1.2")).status).toBe(400);
    vi.mocked(prisma.application.findFirst).mockRejectedValueOnce(new Error("private application data"));
    const response = await put({firstResponseAt: null});
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private application data");
  });
  it("uses recorded dates in the shared company response rules without estimating missing dates", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{id: 1, name: "Acme", applications: [{id: 7, jobTitle: "Engineer", clientCompany: null, applicationDate: new Date("2026-01-01"), firstResponseAt: new Date("2026-01-02"), interviews: [], availabilityLinks: [{created_at: "2020-01-01", viewCount: 0, lastViewedAt: null, bookedSlot: null}], _count: {followUps: 0}}]}] as any);
    const response = await GET();
    const application = (await response.json())[0].applications[0];
    expect(application).toMatchObject({firstResponseAt: "2026-01-02T00:00:00.000Z", response: "responded", furthestStage: "Applied", ignoredLinks: 1});
  });
});
