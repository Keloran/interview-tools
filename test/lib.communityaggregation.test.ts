import {describe, expect, it} from "vitest";
import {applicationVote, CommunityApplication, CommunityVote, communitySummarySchema, employerNameKey, latestVotes, suspiciousConsentCohort, summarizeCommunity} from "@/lib/communityAggregation";
import {COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";
const now = new Date("2026-10-28T12:00:00Z");
export const consentFixture = () => ({noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: new Date("2026-01-01"), withdrawnAt: null, revision: 1, purgePending: false, quarantinedAt: null});
export function communityApp(): CommunityApplication {
  return {id: 1, userId: 1, created_at: new Date("2026-01-01"), applicationDate: new Date("2026-01-01"), firstResponseAt: null, viaRecruiter: false, clientCompany: null, company: {name: "Acme Ltd"},
    communityEmployerId: "employer-a", communityEmployerConfirmedAt: now, communityEmployerIdentity: "acme ltd", interviews: [{id: 10, parentId: null, created_at: new Date("2026-01-01"), outcome: "NO_RESPONSE", feedbackType: null, stage: {stage: "Applied"}}]};
}
export function votesFixture(size: number): CommunityVote[] {
  return Array.from({length: size}, (_, i) => ({applicationId: i + 1, userId: i + 1, employerId: "employer-a", noticeVersion: COMMUNITY_NOTICE_VERSION, consentRevision: 1,
    observedAt: new Date("2026-01-01"), responded: i % 2 === 0, ghosted: i % 2 !== 0, feedbackGiven: null, replyDays: null, grantedAt: new Date(Date.UTC(2026, 0, i + 1))}));
}
describe("community source eligibility", () => {
  it("uses explicit employer confirmation without merging legal names or ambiguous recruiter clients", () => {
    expect(employerNameKey("  ACME, Ltd. ")).toBe("acme ltd");
    expect(employerNameKey("Acme Inc")).not.toBe(employerNameKey("Acme Ltd"));
    const app = communityApp(); expect(applicationVote(app, consentFixture(), now)).toMatchObject({employerId: "employer-a", responded: false, ghosted: true, replyDays: null});
    app.communityEmployerConfirmedAt = null; expect(applicationVote(app, consentFixture(), now)).toBeNull();
    app.communityEmployerConfirmedAt = now; app.company.name = "Different employer"; expect(applicationVote(app, consentFixture(), now)).toBeNull();
    app.company.name = "Acme Ltd"; app.viaRecruiter = true; expect(applicationVote(app, consentFixture(), now)).toBeNull();
    app.clientCompany = "Acme Ltd"; expect(applicationVote(app, consentFixture(), now)).not.toBeNull();
  });
  it.each([{withdrawnAt: now}, {noticeVersion: "old"}, {purgePending: true}, {quarantinedAt: now}, {grantedAt: null}])("excludes inactive consent %j", (change) => {
    expect(applicationVote(communityApp(), {...consentFixture(), ...change}, now)).toBeNull();
  });
  it("uses actual record age to prevent backdating around the 30-day delay", () => {
    const app = communityApp(); app.created_at = new Date(now.getTime() - 30 * 86400000);
    expect(applicationVote(app, consentFixture(), now)).not.toBeNull();
    app.created_at = new Date(app.created_at.getTime() + 1); expect(applicationVote(app, consentFixture(), now)).toBeNull();
  });
  it("includes the exact 24-month calendar-day boundary and excludes older and future applications", () => {
    const app = communityApp(); app.applicationDate = new Date("2024-10-28"); expect(applicationVote(app, consentFixture(), now)).not.toBeNull();
    app.applicationDate = new Date("2024-10-27"); expect(applicationVote(app, consentFixture(), now)).toBeNull();
    app.applicationDate = new Date("2026-11-01"); expect(applicationVote(app, consentFixture(), now)).toBeNull();
  });
  it.each(["AWAITING_RESPONSE", "SCHEDULED", "OFFER_RECEIVED", "PASSED", "WITHDREW"] as const)("excludes unresolved/unknown current outcomes: %s", (outcome) => {
    const app = communityApp(); app.interviews[0].outcome = outcome;
    expect(applicationVote(app, consentFixture(), now)).toBeNull();
  });
  it("keeps earlier reply evidence distinct from explicit later ghosting, and uses only known feedback", () => {
    const app = communityApp(); app.firstResponseAt = new Date("2026-01-04"); app.interviews[0].feedbackType = "SPECIFIC";
    expect(applicationVote(app, consentFixture(), now)).toMatchObject({responded: true, ghosted: true, replyDays: 3, feedbackGiven: true});
    app.interviews[0].feedbackType = "NONE"; expect(applicationVote(app, consentFixture(), now)?.feedbackGiven).toBe(false);
    app.interviews[0].feedbackType = null; expect(applicationVote(app, consentFixture(), now)?.feedbackGiven).toBeNull();
  });
  it("leaves invalid/unknown reply timing out instead of estimating it from stages", () => {
    const app = communityApp(); app.interviews[0].stage.stage = "Phone Screen";
    expect(applicationVote(app, consentFixture(), now)).toMatchObject({responded: true, replyDays: null});
    app.firstResponseAt = new Date("2025-12-31"); expect(applicationVote(app, consentFixture(), now)?.replyDays).toBeNull();
    app.firstResponseAt = new Date("2026-11-01"); expect(applicationVote(app, consentFixture(), now)?.replyDays).toBeNull();
  });
  it("orders parent chains before deciding whether an application has closed", () => {
    const app = communityApp(); app.interviews.push({...app.interviews[0], id: 2, parentId: 10, created_at: new Date("2025-12-01"), outcome: "OFFER_RECEIVED", stage: {stage: "Offer"}});
    expect(applicationVote(app, consentFixture(), now)).toBeNull();
  });
});
describe("protected community summaries", () => {
  it("suppresses 19 contributors and releases a 20-person balanced rate", () => {
    expect(summarizeCommunity(votesFixture(19), "2026-10")).toBeNull();
    expect(summarizeCommunity(votesFixture(20), "2026-10")).toEqual({month: "2026-10", sampleBand: "20–49", responseRate: 50, ghostingRate: 50, feedbackRate: null, replyTimeBand: null});
  });
  it.each([4, 16, 0, 20])("suppresses a binary metric if either cell is below five: %s yes", (yes) => {
    const votes = votesFixture(20).map((vote, i) => ({...vote, responded: i < yes, ghosted: null}));
    expect(summarizeCommunity(votes, "2026-10")).toBeNull();
  });
  it("releases at five per cell and rounds rates without exact counts or source identifiers", () => {
    const votes = votesFixture(20).map((vote, i) => ({...vote, responded: i < 5}));
    const result = summarizeCommunity(votes, "2026-10")!;
    expect(result.responseRate).toBe(30);
    expect(Object.keys(result).sort()).toEqual(["feedbackRate", "ghostingRate", "month", "replyTimeBand", "responseRate", "sampleBand"]);
    expect(communitySummarySchema.safeParse({...result, userId: 1}).success).toBe(false);
    expect(communitySummarySchema.safeParse({...result, count: 20}).success).toBe(false);
    expect(communitySummarySchema.safeParse({...result, responseRate: 25}).success).toBe(false);
  });
  it("counts a user once per employer, choosing the latest date then source ID even if inputs are shuffled", () => {
    const original = votesFixture(20)[0];
    const duplicates = Array.from({length: 20}, (_, i) => ({...original, applicationId: i + 1, observedAt: new Date("2026-02-01")}));
    const selected = latestVotes([original, ...duplicates]);
    expect(selected).toHaveLength(1); expect(selected[0].applicationId).toBe(20);
    expect(summarizeCommunity(duplicates, "2026-10")).toBeNull();
    expect(latestVotes([original, {...original, employerId: "other"}])).toHaveLength(2);
  });
  it.each([[49, "20–49"], [50, "50–99"], [99, "50–99"], [100, "100+"]])("uses broad sample bands at %s", (size, band) => {
    expect(summarizeCommunity(votesFixture(Number(size)), "2026-10")?.sampleBand).toBe(band);
  });
  it("requires 20 known dates independently and only exposes a median band", () => {
    const votes = votesFixture(20).map((vote, i) => ({...vote, responded: null, ghosted: null, replyDays: i === 19 ? null : 8}));
    expect(summarizeCommunity(votes, "2026-10")).toBeNull();
    votes[19].replyDays = 8;
    expect(summarizeCommunity(votes, "2026-10")).toMatchObject({responseRate: null, replyTimeBand: "8–14 days"});
    votes[19].replyDays = -1; expect(summarizeCommunity(votes, "2026-10")).toBeNull();
  });
  it("quarantines a concentrated consent cohort until reviewed, while allowing spread-out contributors", () => {
    const votes = votesFixture(20);
    expect(suspiciousConsentCohort(votes, null)).toBe(false);
    const concentrated = votes.map((vote) => ({...vote, grantedAt: new Date("2026-10-01")}));
    expect(suspiciousConsentCohort(concentrated, null)).toBe(true);
    expect(suspiciousConsentCohort(concentrated, new Date("2026-10-02"))).toBe(false);
  });
});
