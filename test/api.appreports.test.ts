import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET as summary} from "@/app/api/report/summary/route";
import {GET as rows} from "@/app/api/activity-log/rows/route";

const get = (path: string) => new NextRequest(`https://interviews.tools${path}`);
beforeEach(() => {vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);});

describe("report and activity log for the apps", () => {
  it("requires sign-in", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await summary(get("/api/report/summary"))).status).toBe(401);
    expect((await rows(get("/api/activity-log/rows"))).status).toBe(401);
  });

  it("rejects an invalid period", async () => {
    expect((await summary(get("/api/report/summary?from=2026-02-30&through=2026-03-01"))).status).toBe(400);
    expect((await rows(get("/api/activity-log/rows?from=2026-03-02&through=2026-03-01"))).status).toBe(400);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it("returns the website's report for the period, scoped to the user", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([]);
    const res = await summary(get("/api/report/summary?from=2026-10-01&through=2026-10-28"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({from: "2026-10-01", through: "2026-10-28"});
    expect(body.funnel.map((step: {label: string}) => step.label)).toEqual(["Applied", "Heard back", "Screen / assessment", "Interview stage", "Final stage", "Offer"]);
    expect(vi.mocked(prisma.company.findMany).mock.calls[0][0]!.where).toEqual({user: {clerkId: "user_123"}});
  });

  it("returns activity rows, and the same CSV as the website's export", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activityEntry.findMany).mockResolvedValue([
      {id: 4, date: new Date("2026-10-10T00:00:00.000Z"), activity: "Careers fair", employer: "", role: "", how: "In person", outcome: "", notes: ""},
      {id: 5, date: new Date("2026-09-01T00:00:00.000Z"), activity: "Before the period", employer: "", role: "", how: "", outcome: "", notes: ""},
    ] as any);
    const json = await (await rows(get("/api/activity-log/rows?from=2026-10-01&through=2026-10-28"))).json();
    expect(json.totals).toMatchObject({total: 1, other: 1});
    expect(json.rows[0]).toMatchObject({date: "2026-10-10", activity: "Careers fair", how: "In person"});

    vi.mocked(prisma.application.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activityEntry.findMany).mockResolvedValue([]);
    const csv = await rows(get("/api/activity-log/rows?from=2026-10-01&through=2026-10-28&format=csv"));
    expect(csv.headers.get("Content-Type")).toContain("text/csv");
    expect(await csv.text()).toContain("Job search activity log");
  });
});
