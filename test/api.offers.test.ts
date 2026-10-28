import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET} from "@/app/api/offers/route";
import {PUT} from "@/app/api/offers/[id]/route";
import {POST as createInterview} from "@/app/api/interview/route";
import {GET as calendar} from "@/app/api/calendar/[uuid]/route";
import {offerApplicationSelect} from "@/lib/offers";
import {offerApplication} from "./fixtures/offers";

const request = (body: unknown) => new NextRequest("https://interviews.tools/api/offers/10", {method: "PUT", body: JSON.stringify(body)});
const context = {params: Promise.resolve({id: "10"})};
const tx = {interview: {findFirst: vi.fn(), updateMany: vi.fn()}, application: {findFirst: vi.fn()}, $queryRaw: vi.fn()};
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
  tx.interview.findFirst.mockResolvedValue({applicationId: 1}); tx.application.findFirst.mockResolvedValue(offerApplication()); tx.$queryRaw.mockResolvedValue([{id: 1}]); tx.interview.updateMany.mockResolvedValue({count: 1});
});
describe("private offer API", () => {
  it("requires authentication for reads and changes", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PUT(request({deadline: null}), context)).status).toBe(401);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("returns only the owner's open current offers including expired dates", async () => {
    const decided = offerApplication(2); decided.interviews[0].outcome = "OFFER_DECLINED";
    vi.mocked(prisma.application.findMany).mockResolvedValue([offerApplication(1, "2020-01-01"), decided] as any);
    const response = await GET();
    expect(prisma.application.findMany).toHaveBeenCalledWith({where: {user: {clerkId: "user_123"}}, select: offerApplicationSelect});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual([{applicationId: 1, interviewId: 10, jobTitle: "Engineer", company: "Client", agency: "Agency", interviewer: "Jane", deadline: "2020-01-01", outcome: "OFFER_RECEIVED"}]);
  });
  it("validates deadline dates and explicit decision confirmation before writing", async () => {
    expect((await PUT(request({deadline: "2026-02-30"}), context)).status).toBe(400);
    expect((await PUT(request({decision: "OFFER_ACCEPTED"}), context)).status).toBe(400);
    expect((await PUT(request({deadline: null}), {params: Promise.resolve({id: "1.5"})})).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("locks and rechecks the owned current offer before setting or clearing its calendar-day deadline", async () => {
    expect((await PUT(request({deadline: "2026-11-02", userId: 999}), context)).status).toBe(200);
    expect(tx.interview.findFirst).toHaveBeenCalledWith({where: {id: 10, application: {user: {clerkId: "user_123"}}}, select: {applicationId: true}});
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([1, "user_123"]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.application.findFirst.mock.invocationCallOrder[0]);
    expect(tx.interview.updateMany).toHaveBeenCalledWith({where: {id: 10, applicationId: 1, updated_at: new Date("2026-10-15")}, data: {deadline: new Date("2026-11-02T00:00:00Z"), date: null}});
    expect((await PUT(request({deadline: null}), context)).status).toBe(200);
    expect(tx.interview.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data: {deadline: null, date: null}}));
  });
  it("does not change an inaccessible, superseded or decided offer", async () => {
    tx.interview.findFirst.mockResolvedValueOnce(null);
    expect((await PUT(request({deadline: null}), context)).status).toBe(404);
    const app = offerApplication(); app.interviews[0].outcome = "OFFER_ACCEPTED";
    tx.application.findFirst.mockResolvedValueOnce(app);
    expect((await PUT(request({deadline: null}), context)).status).toBe(409);
    tx.interview.updateMany.mockResolvedValueOnce({count: 0});
    expect((await PUT(request({deadline: null}), context)).status).toBe(409);
  });
  it("records only a validated decision and reports private failures generically", async () => {
    expect((await PUT(request({decision: "OFFER_ACCEPTED", confirmDecision: true}), context)).status).toBe(200);
    expect(tx.interview.updateMany).toHaveBeenCalledWith(expect.objectContaining({data: {outcome: "OFFER_ACCEPTED"}}));
    tx.$queryRaw.mockRejectedValueOnce(new Error("private offer details"));
    const response = await PUT(request({deadline: null}), context);
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("private offer details");
  });
});
describe("new Offer stages", () => {
  it("stores an explicit respond-by day and Offer received outcome without inventing a scheduled call", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1} as any);
    vi.mocked(prisma.company.upsert).mockResolvedValue({id: 2} as any);
    vi.mocked(prisma.stage.upsert).mockResolvedValue({id: 3} as any);
    vi.mocked(prisma.stageMethod.findFirst).mockResolvedValue({id: 4} as any);
    vi.mocked(prisma.interview.create).mockResolvedValue({application: {id: 1, company: {name: "Acme"}}} as any);
    const response = await createInterview(request({stage: "Offer", companyName: "Acme", jobTitle: "Engineer", offerDeadline: "2026-11-01", date: "2026-11-10T12:00:00Z", interviewLink: "https://meet.example/call", interviewer: "Someone"}));
    expect(response.status).toBe(201);
    expect(vi.mocked(prisma.interview.create).mock.calls[0][0].data).toMatchObject({deadline: new Date("2026-11-01T00:00:00Z"), date: null, link: null, interviewer: null, outcome: "OFFER_RECEIVED"});
    expect(prisma.stageMethod.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {method: {equals: "Not recorded", mode: "insensitive"}}}));
  });
});
describe("offer calendar feed", () => {
  it("scopes the feed to its calendar owner and includes only current open offer IDs", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 99} as any);
    vi.mocked(prisma.application.findMany).mockResolvedValue([offerApplication()] as any);
    const app = offerApplication();
    vi.mocked(prisma.interview.findMany).mockResolvedValue([{...app.interviews[0], date: null, durationMinutes: 60, notes: null, link: null, application: {...app, interviews: undefined}}] as any);
    const response = await calendar(new NextRequest("https://interviews.tools/api/calendar/private-calendar"), {params: Promise.resolve({uuid: "private-calendar"})});
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("DTSTART;VALUE=DATE:20261101"); expect(text).toContain("DTEND;VALUE=DATE:20261102"); expect(text).toContain("TRIGGER:-P1D");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({where: {calendarUuid: "private-calendar"}, select: {id: true}});
    expect(prisma.application.findMany).toHaveBeenCalledWith({where: {userId: 99}, select: offerApplicationSelect});
    expect(vi.mocked(prisma.interview.findMany).mock.calls[0][0]!.where).toMatchObject({application: {userId: 99}, AND: [{OR: expect.arrayContaining([{id: {in: [10]}, deadline: {not: null}}])}, expect.anything()]});
  });
  it("returns 404 for deleted or unknown calendar tokens without reading history", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    expect((await calendar(new NextRequest("https://interviews.tools/api/calendar/gone"), {params: Promise.resolve({uuid: "gone"})})).status).toBe(404);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
  });
});
