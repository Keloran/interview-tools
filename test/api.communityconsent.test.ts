import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {GET, PUT} from "@/app/api/community/consent/route";
import {COMMUNITY_NOTICE_VERSION, collectionOpen, snapshotCurrent} from "@/lib/communityPolicy";
import {deleteAccountData, grantCommunityConsent, withdrawCommunityConsent} from "@/lib/communityConsent";
const control = () => ({id: "global", noticeVersion: COMMUNITY_NOTICE_VERSION, noticePublishedAt: new Date("2026-01-01"), collectionEnabled: true, publicationEnabled: true, revocationEpoch: 4});
const choice = () => ({userId: 1, noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: new Date("2026-01-01"), withdrawnAt: null as Date | null, revision: 1, purgePending: false});
const req = (body: unknown) => new NextRequest("http://localhost/api/community/consent", {method: "PUT", body: JSON.stringify(body)});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("COMMUNITY_OPERATOR_NAME", "Example operator"); vi.stubEnv("COMMUNITY_PRIVACY_EMAIL", "privacy@example.com");
  vi.mocked(currentUser).mockResolvedValue({id: "user_123", emailAddresses: [{emailAddress: "owner@example.com", verification: {status: "verified"}}]} as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{id: "global"}]);
  vi.mocked(prisma.communityControl.findUnique).mockResolvedValue(control());
  vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 1, communityConsent: null} as never);
  vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1, communityConsent: null} as never);
  vi.mocked(prisma.communityContribution.count).mockResolvedValue(0);
  vi.mocked(prisma.communityContribution.deleteMany).mockResolvedValue({count: 0});
});
afterEach(() => vi.unstubAllEnvs());
describe("community consent", () => {
  it("defaults off, including accounts with no local user, and uses private no-store responses", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const response = await GET();
    expect(await response.json()).toMatchObject({enabled: false, canEnable: true, agreedVersion: null});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({where: {clerkId: "user_123"}, select: {communityConsent: true}});
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
  it("requires authentication and explicit confirmation of exactly the current notice", async () => {
    for (const body of [{enabled: true}, {enabled: true, confirm: true, noticeVersion: "old"}, {enabled: "false"}, {userId: 9}]) expect((await PUT(req(body))).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await PUT(req({enabled: false}))).status).toBe(401);
  });
  it("rejects unverified contributors without creating records; still allows withdrawal", async () => {
    vi.mocked(currentUser).mockResolvedValue({id: "user_123", emailAddresses: []} as never);
    expect((await PUT(req({enabled: true, confirm: true, noticeVersion: COMMUNITY_NOTICE_VERSION}))).status).toBe(403);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect((await PUT(req({enabled: false}))).status).toBe(200);
  });
  it("fails closed before publication, with disabled collection, missing identity or a changed notice version", async () => {
    for (const gate of [null, {...control(), noticePublishedAt: null}, {...control(), noticeVersion: "old"}, {...control(), collectionEnabled: false}, {...control(), noticePublishedAt: new Date("9999-01-01")}]) {
      vi.mocked(prisma.communityControl.findUnique).mockResolvedValue(gate);
      expect((await PUT(req({enabled: true, confirm: true, noticeVersion: COMMUNITY_NOTICE_VERSION}))).status).toBe(409);
    }
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue(control()); vi.stubEnv("COMMUNITY_PRIVACY_EMAIL", "");
    expect(collectionOpen(control())).toBe(false);
    expect((await PUT(req({enabled: true, confirm: true, noticeVersion: COMMUNITY_NOTICE_VERSION}))).status).toBe(409);
    expect(prisma.communityConsent.upsert).not.toHaveBeenCalled();
  });
  it("records versioned explicit agreement only for the authenticated account, never materializing contributions", async () => {
    expect((await PUT(req({enabled: true, confirm: true, noticeVersion: COMMUNITY_NOTICE_VERSION, userId: 99}))).status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({where: {clerkId: "user_123"}}));
    expect(prisma.communityConsent.upsert).toHaveBeenCalledWith(expect.objectContaining({where: {userId: 1}, create: expect.objectContaining({userId: 1, noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: expect.any(Date)})}));
    expect(prisma.communityControl.update).not.toHaveBeenCalled(); // a first opt-in changes no published contribution
    expect(vi.mocked(prisma.$queryRaw).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(prisma.communityConsent.upsert).mock.invocationCallOrder[0]);
  });
  it("makes a duplicate grant idempotent and blocks reenrolment during cleanup", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1, communityConsent: choice()} as never);
    expect((await grantCommunityConsent({id: "user_123", email: "owner@example.com", name: null})).status).toBe(200);
    expect(prisma.communityConsent.upsert).not.toHaveBeenCalled();
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1, communityConsent: {...choice(), purgePending: true, withdrawnAt: new Date()}} as never);
    expect((await grantCommunityConsent({id: "user_123", email: "owner@example.com", name: null})).status).toBe(409);
  });
  it("pauses old-version consent until fresh explicit agreement", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 1, communityConsent: {...choice(), noticeVersion: "old"}} as never);
    expect(await (await GET()).json()).toMatchObject({enabled: false, needsReview: true});
  });
  it("commits withdrawal and invalidation before purging, leaving no private tracking writes", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 1, communityConsent: choice()} as never);
    vi.mocked(prisma.communityConsent.findUnique).mockResolvedValue({...choice(), revision: 2, withdrawnAt: new Date(), purgePending: true});
    await withdrawCommunityConsent("user_123");
    expect(prisma.communityControl.update).toHaveBeenCalledWith({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
    expect(prisma.communityContribution.deleteMany).toHaveBeenCalledWith({where: {userId: 1}});
    expect(vi.mocked(prisma.communityControl.update).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(prisma.communityContribution.deleteMany).mock.invocationCallOrder[0]);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled(); expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
  it("returns failure on purge errors after durable withdrawal, and retries without granting again", async () => {
    const stopped = {...choice(), revision: 2, withdrawnAt: new Date(), purgePending: true};
    vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 1, communityConsent: choice()} as never);
    vi.mocked(prisma.communityConsent.findUnique).mockResolvedValue(stopped);
    vi.mocked(prisma.communityContribution.deleteMany).mockRejectedValueOnce(new Error("purge failed"));
    expect((await PUT(req({enabled: false}))).status).toBe(503);
    expect(prisma.communityConsent.upsert).toHaveBeenCalledWith(expect.objectContaining({update: expect.objectContaining({purgePending: true, withdrawnAt: expect.any(Date)})}));
    expect(prisma.communityConsent.updateMany).not.toHaveBeenCalled();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 1, communityConsent: stopped} as never);
    expect((await PUT(req({enabled: false}))).status).toBe(200);
    expect(prisma.communityConsent.updateMany).toHaveBeenCalledWith({where: {userId: 1, revision: 2, withdrawnAt: {not: null}}, data: {purgePending: false}});
    expect(prisma.communityControl.update).toHaveBeenCalledTimes(1);
  });
  it("does not let stale cleanup delete a newer agreement's contribution", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({id: 1, communityConsent: {...choice(), withdrawnAt: new Date(), purgePending: true}} as never);
    vi.mocked(prisma.communityConsent.findUnique).mockResolvedValue({...choice(), revision: 3});
    await withdrawCommunityConsent("user_123");
    expect(prisma.communityContribution.deleteMany).not.toHaveBeenCalled();
  });
  it("does not invalidate results when a non-contributor deletes their account", async () => {
    await deleteAccountData("user_123");
    expect(prisma.user.deleteMany).toHaveBeenCalled();
    expect(prisma.communityControl.update).not.toHaveBeenCalled();
  });
  it("fails closed if locking/invalidation is unavailable", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    expect((await PUT(req({enabled: false}))).status).toBe(503);
    expect(prisma.communityContribution.deleteMany).not.toHaveBeenCalled();
    expect(prisma.communityConsent.upsert).not.toHaveBeenCalled();
    expect(snapshotCurrent(null, {noticeVersion: COMMUNITY_NOTICE_VERSION, revocationEpoch: 4})).toBe(false);
    expect(snapshotCurrent({...control(), revocationEpoch: 5}, {noticeVersion: COMMUNITY_NOTICE_VERSION, revocationEpoch: 4})).toBe(false);
    expect(snapshotCurrent({...control(), publicationEnabled: false}, {noticeVersion: COMMUNITY_NOTICE_VERSION, revocationEpoch: 4})).toBe(false);
  });
  it("invalidates snapshots atomically with account cascade deletion, and makes retries harmless", async () => {
    vi.mocked(prisma.communityContribution.count).mockResolvedValue(1);
    await deleteAccountData("user_123");
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({where: {clerkId: "user_123"}});
    expect(prisma.communityControl.update).toHaveBeenCalledTimes(1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null); await deleteAccountData("user_123");
    expect(prisma.communityControl.update).toHaveBeenCalledTimes(1);
  });
});
