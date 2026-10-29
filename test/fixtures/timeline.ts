import {TimelineApplication, TimelineStage} from "@/lib/timeline";

export function stage(id: number, parentId: number | null, changes: Partial<TimelineStage> = {}): TimelineStage {
  return {id, parentId, date: null, deadline: null, created_at: `2026-01-${String(id).padStart(2, "0")}T12:00:00.000Z`, updated_at: "2026-01-20T12:00:00.000Z",
    interviewer: null, outcome: "AWAITING_RESPONSE", notes: null, feedbackType: null, feedbackText: null,
    debriefedAt: null, rating: null, debriefNotes: null, peopleMet: null, questionsAsked: null, prepNotes: null, nextStep: null, replyBy: null,
    stage: {stage: `Round ${id}`}, stageMethod: {method: "Phone"}, ...changes};
}
export function application(changes: Partial<TimelineApplication> = {}): TimelineApplication {
  return {id: 7, firstResponseAt: null, jobTitle: "Engineer", clientCompany: "Client", company: {name: "Agency"}, applicationDate: "2026-01-01T12:00:00.000Z",
    interviews: [stage(2, 1, {stage: {stage: "Technical"}, date: "2026-01-10T12:00:00.000Z", outcome: "REJECTED", interviewer: "Jane", feedbackType: "SPECIFIC", feedbackText: "More SQL experience", debriefNotes: "Practice joins", questionsAsked: "Explain indexes", replyBy: "2026-01-15T12:00:00.000Z"}), stage(1, null, {stage: {stage: "Applied"}, created_at: "2026-01-05T12:00:00.000Z"})],
    followUps: [{id: 4, sentAt: "2026-01-17T12:00:00.000Z"}],
    availabilityLinks: [{id: "private-link", created_at: "2026-01-03T12:00:00.000Z", firstViewedAt: "2026-01-04T12:00:00.000Z", lastViewedAt: "2026-01-04T12:00:00.000Z", viewCount: 2, bookedSlot: "2026-01-10T12:00:00.000Z", stage: {stage: "Technical"}}], ...changes};
}
