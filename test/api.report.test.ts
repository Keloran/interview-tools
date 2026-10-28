import {beforeEach, describe, expect, it, vi} from "vitest";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET} from "@/app/api/report/route";
import {GET as getCompanies} from "@/app/api/companies/route";
import {companyHistorySelect} from "@/lib/companyHistory";

beforeEach(() => {vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);});
describe("private search report API", () => {
  it("requires authentication before reading private history", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });
  it("uses the same owner-scoped company history and adds only stage activity", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{id: 1, name: "Acme", applications: [{id: 7, jobTitle: "Engineer", applicationDate: new Date("2026-01-01"), firstResponseAt: null, interviews: [{id: 3, stage: {stage: "Technical Interview"}, date: new Date("2026-01-05"), deadline: null, outcome: "REJECTED", created_at: new Date("2026-01-04"), updated_at: new Date("2026-01-06"), replyBy: null, feedbackType: "SPECIFIC"}], availabilityLinks: [], _count: {followUps: 0}}]}] as any);
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(prisma.company.findMany).toHaveBeenCalledWith({where: {user: {clerkId: "user_123"}}, select: companyHistorySelect, orderBy: {name: "asc"}});
    const report = await response.json();
    const companies = await (await getCompanies()).json();
    const {stages, ...summary} = report[0].applications[0];
    expect(summary).toEqual(companies[0].applications[0]);
    expect(stages).toEqual([{id: 3, stage: "Technical Interview", date: "2026-01-05T00:00:00.000Z", deadline: null, outcome: "REJECTED"}]);
    expect(companyHistorySelect.applications.select.interviews.select).not.toHaveProperty("notes");
    expect(companyHistorySelect).not.toHaveProperty("user");
  });
  it("reports errors without leaking database details", async () => {
    vi.mocked(prisma.company.findMany).mockRejectedValue(new Error("private records"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private records");
  });
});
