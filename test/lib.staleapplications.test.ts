import {describe, expect, it} from "vitest";
import {closeStaleSchema, staleCandidate, staleCandidates, staleDaysSchema} from "@/lib/staleApplications";
import {summarizeApplication} from "@/lib/applications";
import {brokenPromise, followUpDueAt} from "@/lib/followUps";
import {timelineSummary} from "@/lib/timeline";
import {templatesFor} from "@/lib/messages";
import {application, stage} from "./fixtures/timeline";
import {OLD, STALE_NOW, staleApplication} from "./fixtures/staleApplications";

describe("stale eligibility", () => {
  it("protects legacy Offer stages even when their outcome is still Scheduled", () => {
    const app = staleApplication(); app.interviews[0].stage.stage = "Offer"; app.interviews[0].outcome = "SCHEDULED";
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
  });
  it("requires the configured elapsed time since the latest actual change", () => {
    expect(staleCandidate(staleApplication(), 60, STALE_NOW)).toMatchObject({id: 1, quietDays: 100, latestId: 10});
    expect(staleCandidate(staleApplication(), 101, STALE_NOW)).toBeNull();
    const changed = staleApplication(); changed.updated_at = new Date(STALE_NOW - 86400000);
    expect(staleCandidate(changed, 60, STALE_NOW)).toBeNull();
  });
  it.each(["REJECTED", "WITHDREW", "OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED", "NO_RESPONSE"] as const)("protects settled outcomes: %s", (outcome) => {
    const app = staleApplication(); app.interviews[0].outcome = outcome;
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
  });
  it.each(["date", "deadline", "replyBy", "updated_at"] as const)("protects future or recently changed stage %s", (field) => {
    const app = staleApplication(); app.interviews[0][field] = new Date(STALE_NOW + 86400000);
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
  });
  it("protects recent follow-ups, availability activity and recorded first replies", () => {
    const recent = new Date(STALE_NOW - 86400000);
    const app = staleApplication(); app.followUps = [{sentAt: recent}];
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
    app.followUps = []; app.firstResponseAt = recent;
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
    app.firstResponseAt = null; app.availabilityLinks = [{created_at: OLD, sentAt: recent, lastViewedAt: null, bookedSlot: null}];
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
    app.availabilityLinks[0] = {created_at: OLD, sentAt: null, lastViewedAt: null, bookedSlot: new Date(STALE_NOW + 86400000)};
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
  });
  it("uses parent-chain order even when creation times disagree", () => {
    const app = staleApplication();
    app.interviews.push({...app.interviews[0], id: 1, parentId: 10, outcome: "REJECTED", created_at: new Date(OLD.getTime() - 1000)});
    expect(staleCandidate(app, 60, STALE_NOW)).toBeNull();
  });
  it("supports applications without stages and sorts oldest first without mutating input", () => {
    const app = staleApplication(); app.interviews = [];
    expect(staleCandidate(app, 60, STALE_NOW)).toMatchObject({latestId: null, lastStage: "Applied"});
    const rows = [staleApplication(2), app];
    expect(staleCandidates(rows, 60, STALE_NOW).map((row) => row.id)).toEqual([1, 2]);
    expect(rows.map((row) => row.id)).toEqual([2, 1]);
  });
  it("validates bounded thresholds and requires explicit confirmation", () => {
    for (const days of [0, -1, 3651, 1.5, "60"]) expect(staleDaysSchema.safeParse(days).success).toBe(false);
    expect(closeStaleSchema.safeParse({ids: [1], days: 60}).success).toBe(false);
    expect(closeStaleSchema.safeParse({ids: [1], days: 60, confirm: true}).success).toBe(true);
  });
});
describe("closed No response semantics", () => {
  it("counts explicit closure as ghosted, and reopening Applied does not invent a reply", () => {
    expect(summarizeApplication([{stage: "Applied", outcome: "NO_RESPONSE", updatedAt: new Date(STALE_NOW)}], STALE_NOW, [], 0, "2026-01-02")).toEqual({status: "No response (closed as ghosted)", response: "ghosted"});
    expect(summarizeApplication([{stage: "Applied", outcome: "AWAITING_RESPONSE", updatedAt: new Date(STALE_NOW)}, {stage: "Applied", outcome: "NO_RESPONSE", updatedAt: OLD}], STALE_NOW)).toMatchObject({response: "waiting"});
  });
  it("does not generate a follow-up or treat closure as a company reply to a promise", () => {
    expect(templatesFor({outcome: "NO_RESPONSE", stage: "Applied"})).toEqual([]);
    expect(followUpDueAt({applicationDate: OLD, latest: {stage: "Applied", outcome: "NO_RESPONSE", date: null, replyBy: null}, followUps: []}, STALE_NOW)).toBeNull();
    expect(brokenPromise([{outcome: "NO_RESPONSE", replyBy: new Date("2026-01-20"), createdAt: OLD, updatedAt: new Date(STALE_NOW)}], STALE_NOW)).toContain("never replied");
  });
  it("ends the timeline duration at the explicit closure update", () => {
    expect(timelineSummary(application({interviews: [stage(1, null, {outcome: "NO_RESPONSE"})]}), STALE_NOW)).toMatchObject({closed: true, outcome: "No response (closed as ghosted)"});
  });
});
