import {describe, expect, it} from "vitest";
import {daysBetween, orderedStages, stageDate, timelineActivity, timelineSummary} from "@/lib/timeline";
import {application, stage} from "./fixtures/timeline";

describe("application progression", () => {
  it("orders by the parent chain rather than IDs, dates or input order", () => {
    const stages = [stage(1, 9), stage(5, 1), stage(9, null)];
    expect(orderedStages(stages).map((item) => item.id)).toEqual([9, 1, 5]);
    expect(stages.map((item) => item.id)).toEqual([1, 5, 9]);
  });
  it("retains disconnected stages, branches and missing-parent stages deterministically", () => {
    expect(orderedStages([stage(4, 1), stage(3, 1), stage(2, 99), stage(1, null)]).map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });
  it("retains every record and terminates on cycles and self-links", () => {
    expect(orderedStages([stage(3, 3), stage(2, 1), stage(1, 2)]).map((item) => item.id)).toEqual([1, 2, 3]);
  });
  it("uses the applied date for Applied and identifies scheduled, deadline and recorded dates", () => {
    const applied = "2020-01-01T00:00:00Z";
    expect(stageDate(stage(1, null, {stage: {stage: "Applied"}}), applied)).toEqual({date: applied, label: "Applied"});
    expect(stageDate(stage(1, null, {date: applied}), "")).toEqual({date: applied, label: "Scheduled for"});
    expect(stageDate(stage(1, null, {deadline: applied}), "")).toEqual({date: applied, label: "Deadline"});
    expect(stageDate(stage(1, null), "").label).toBe("Recorded");
  });
  it("measures gaps without negative or invalid elapsed time", () => {
    expect(daysBetween("2026-01-01T12:00:00Z", "2026-01-10T12:00:00Z")).toBe(9);
    expect(daysBetween("2026-01-01T12:00:00Z", "2026-01-01T14:00:00Z")).toBe(0);
    expect(daysBetween("2026-01-10", "2026-01-01")).toBeNull();
    expect(daysBetween("bad", "2026-01-01")).toBeNull();
  });
  it.each(["REJECTED", "WITHDREW", "OFFER_ACCEPTED", "OFFER_DECLINED"] as const)("stops elapsed duration at the recorded final update for %s", (outcome) => {
    const app = application({interviews: [stage(1, null, {outcome})]});
    expect(timelineSummary(app, Date.parse("2026-03-01"))).toMatchObject({closed: true, days: 19, through: "2026-01-20T12:00:00.000Z"});
  });
  it("keeps an undecided offer open and ignores a future stage when measuring time so far", () => {
    const app = application({interviews: [stage(1, null, {outcome: "OFFER_RECEIVED", date: "2026-04-01"})]});
    expect(timelineSummary(app, Date.parse("2026-01-11T12:00:00Z"))).toMatchObject({closed: false, days: 10, outcome: "Offer received"});
  });
  it("handles applications without stages", () => {
    expect(timelineSummary(application({interviews: []}), Date.parse("2026-01-02T12:00:00Z"))).toMatchObject({stages: [], closed: false, days: 1, outcome: "Awaiting response"});
  });
  it("orders activity by known event times without claiming send or booking timestamps", () => {
    const events = timelineActivity(application());
    expect(events.map((event) => event.title)).toEqual(["Availability link created", "Availability link first opened", "Booked interview slot", "Follow-up recorded"]);
    expect(events[0].detail).toContain("does not confirm it was sent");
    expect(events[2].detail).toContain("not the time the booking was made");
  });
  it("does not invent opens or bookings for unopened links", () => {
    const app = application();
    app.availabilityLinks[0] = {...app.availabilityLinks[0], bookedSlot: null, viewCount: 0, firstViewedAt: null};
    expect(timelineActivity(app).map((event) => event.title)).toEqual(["Availability link created", "Follow-up recorded"]);
  });
});
