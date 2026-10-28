import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET, PUT} from "@/app/api/interview/[id]/compensation/route";
import {compensationSchema, cleanCompensation} from "@/lib/compensation";
import {calendarEvent} from "@/lib/calendarFeed";
import {openOffers} from "@/lib/offers";
import {offerApplication} from "./fixtures/offers";
const context = {params: Promise.resolve({id: "10"})};
const request = (body: unknown) => new NextRequest("http://localhost/api/interview/10/compensation", {method: "PUT", body: JSON.stringify(body)});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as never);
  vi.mocked(prisma.interview.findFirst).mockResolvedValue({id: 10, applicationId: 1, stage: {stage: "Offer"}, application: {advertisedSalary: "£70–80k per year"}, offerBase: "£75k per year"} as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
});
describe("private salary and offer details", () => {
  it("requires authentication for reads and writes", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET(request({}), context)).status).toBe(401);
    expect((await PUT(request({offerBase: "x"}), context)).status).toBe(401);
    expect(prisma.interview.findFirst).not.toHaveBeenCalled();
  });
  it("loads only the owner's stage, with private cache headers", async () => {
    const response = await GET(request({}), context);
    expect(await response.json()).toMatchObject({advertisedSalary: "£70–80k per year", offerBase: "£75k per year", isOffer: true});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(prisma.interview.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {id: 10, application: {user: {clerkId: "user_123"}}}}));
    vi.mocked(prisma.interview.findFirst).mockResolvedValue(null);
    expect((await GET(request({}), context)).status).toBe(404);
    expect((await PUT(request({advertisedSalary: null}), context)).status).toBe(404);
  });
  it("saves only supplied fields, clears whitespace, and scopes both writes to the owner", async () => {
    expect((await PUT(request({advertisedSalary: " £70–80k/year ", offerBase: " £75k/year ", offerBonus: " ", userId: 99, outcome: "OFFER_ACCEPTED"}), context)).status).toBe(200);
    expect(prisma.application.updateMany).toHaveBeenCalledWith({where: {id: 1, user: {clerkId: "user_123"}}, data: {advertisedSalary: "£70–80k/year"}});
    expect(prisma.interview.updateMany).toHaveBeenCalledWith({where: {id: 10, application: {user: {clerkId: "user_123"}}}, data: {offerBase: "£75k/year", offerBonus: null}});
  });
  it("allows advertised ranges before an offer without inventing offer details", async () => {
    vi.mocked(prisma.interview.findFirst).mockResolvedValue({id: 10, applicationId: 1, stage: {stage: "Applied"}} as never);
    expect((await PUT(request({offerBase: "£75k"}), context)).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect((await PUT(request({advertisedSalary: null}), context)).status).toBe(200);
    expect(prisma.interview.updateMany).not.toHaveBeenCalled();
  });
  it("does not expose salary details in a shareable calendar event", () => {
    const event = calendarEvent({id: 10, date: null, deadline: new Date("2026-11-01"), durationMinutes: 60, jobTitle: "Engineer", company: {name: "Acme"}, clientCompany: null, interviewer: null, notes: null, link: null, outcome: "OFFER_RECEIVED", stage: {stage: "Offer"}, offerBase: "PRIVATE_SALARY", advertisedSalary: "PRIVATE_RANGE"} as Parameters<typeof calendarEvent>[0]);
    expect(event).toContain("Offer response deadline");
    expect(event).not.toContain("PRIVATE_");
  });
  it("rejects malformed, oversized and empty mutations before writing", async () => {
    for (const body of [{}, {userId: 1}, {advertisedSalary: 80000}, {advertisedSalary: 'x'.repeat(501)}, {offerBenefits: 'x'.repeat(2001)}]) expect((await PUT(request(body), context)).status).toBe(400);
    expect((await PUT(request({offerBase: null}), {params: Promise.resolve({id: "Infinity"})})).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(compensationSchema.safeParse({offerBase: null}).success).toBe(true);
    expect(cleanCompensation({offerBase: "  "})).toEqual({offerBase: null});
  });
  it("keeps comparison details private to current open offers and retains unknown fields as null", () => {
    const open = offerApplication(); open.advertisedSalary = "£70–80k/year"; open.interviews[0].offerBase = "£75k/year";
    const closed = offerApplication(2); closed.interviews[0].outcome = "OFFER_ACCEPTED";
    const historical = offerApplication(3); historical.interviews.push({...historical.interviews[0], id: 31, parentId: 30, outcome: "WITHDREW"});
    const result = openOffers([closed, historical, open]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({advertisedSalary: "£70–80k/year", offerBase: "£75k/year", offerBonus: null});
  });
});
