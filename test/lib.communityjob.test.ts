import {beforeEach, describe, expect, it, vi} from "vitest";
import prisma from "@/lib/prisma";
import {COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";
import {rebuildCommunity, readCommunitySummary} from "@/lib/communityJob";
const now = new Date("2026-10-28T12:00:00Z");
const control = () => ({id: "global", noticeVersion: COMMUNITY_NOTICE_VERSION, noticePublishedAt: new Date("2026-01-01"), collectionEnabled: true, publicationEnabled: true, revocationEpoch: 3, lastPublicationMonth: null as string | null});
const summary = () => ({month: "2026-10", sampleBand: "20–49", responseRate: 50, ghostingRate: 50, feedbackRate: null, replyTimeBand: null});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{id: "global"}]);
  vi.mocked(prisma.communityControl.findUnique).mockResolvedValue(control());
  vi.mocked(prisma.communityEmployer.findMany).mockResolvedValue([]);
  vi.mocked(prisma.communityConsent.findMany).mockResolvedValue([]);
  vi.mocked(prisma.communityContribution.count).mockResolvedValue(0);
});
describe("community publication locks and suppression", () => {
  it("does not collect before the notice/collection gate, even if a scheduler is configured", async () => {
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue({...control(), collectionEnabled: false});
    expect(await rebuildCommunity(now)).toEqual({collected: false, published: false});
    expect(prisma.communityContribution.deleteMany).not.toHaveBeenCalled();
  });
  it("seals an entirely suppressed month and never replaces it in the same month", async () => {
    expect(await rebuildCommunity(now)).toEqual({collected: true, published: true});
    expect(prisma.communityControl.update).toHaveBeenCalledWith({where: {id: "global"}, data: {lastPublicationMonth: "2026-10"}});
    expect(prisma.communitySnapshot.create).not.toHaveBeenCalled();
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue({...control(), lastPublicationMonth: "2026-10", revocationEpoch: 5});
    vi.mocked(prisma.communitySnapshot.deleteMany).mockClear();
    expect(await rebuildCommunity(now)).toEqual({collected: true, published: false});
    expect(prisma.communitySnapshot.deleteMany).not.toHaveBeenCalled();
  });
  it("permits collection with publication still disabled", async () => {
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue({...control(), publicationEnabled: false});
    expect(await rebuildCommunity(now)).toEqual({collected: true, published: false});
    expect(prisma.communitySnapshot.create).not.toHaveBeenCalled();
  });
  it("returns only a validated allowlisted summary with fresh controls", async () => {
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue({...control(), lastPublicationMonth: "2026-10"});
    const employer = {reviewedAt: now, suppressedAt: null, snapshot: {revocationEpoch: 3, noticeVersion: COMMUNITY_NOTICE_VERSION, publishedAt: now, data: summary()}};
    vi.mocked(prisma.communityEmployer.findUnique).mockResolvedValue(employer as never);
    expect(await readCommunitySummary("employer-a", now)).toEqual(summary());
    vi.mocked(prisma.communityEmployer.findUnique).mockResolvedValue({...employer, snapshot: {...employer.snapshot, data: {...summary(), userId: 7}}} as never);
    expect(await readCommunitySummary("employer-a", now)).toBeNull();
  });
  it.each(["epoch", "month", "notice", "employer", "disabled"])("fails closed for stale or suppressed %s", async (kind) => {
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue({...control(), lastPublicationMonth: "2026-10", publicationEnabled: kind !== "disabled"});
    vi.mocked(prisma.communityEmployer.findUnique).mockResolvedValue({reviewedAt: now, suppressedAt: kind === "employer" ? now : null, snapshot: {revocationEpoch: kind === "epoch" ? 2 : 3, noticeVersion: kind === "notice" ? "old" : COMMUNITY_NOTICE_VERSION, publishedAt: kind === "month" ? new Date("2026-09-01") : now, data: summary()}} as never);
    expect(await readCommunitySummary("employer-a", now)).toBeNull();
  });
});
