import {ActivityLogData} from "@/lib/activityLog";

export function activityData(): ActivityLogData {
  return {applications: [{id: 7, jobTitle: "Engineer", clientCompany: "Client", viaRecruiter: true, applicationDate: "2026-01-01T12:00:00Z", firstResponseAt: null, jobPostingLink: "https://jobs.example/role", company: {name: "Agency"},
    interviews: [{id: 1, date: "2026-01-05T12:00:00Z", deadline: null, outcome: "REJECTED", created_at: "2026-01-02T12:00:00Z", updated_at: "2026-01-06T12:00:00Z", feedbackType: "SPECIFIC", stage: {stage: "Technical Interview"}, stageMethod: {method: "Phone"}}],
    followUps: [{id: 1, sentAt: "2026-01-07T12:00:00Z"}],
    availabilityLinks: [{id: "sent", sentAt: "2026-01-03T12:00:00Z", created_at: "2026-01-02T12:00:00Z", viewCount: 0, lastViewedAt: null, bookedSlot: null}, {id: "unsent", sentAt: null, created_at: "2026-01-02T12:00:00Z", viewCount: 1, lastViewedAt: "2026-01-04T12:00:00Z", bookedSlot: null}],
  }], entries: [{id: 1, date: "2026-01-04T00:00:00Z", activity: "Careers fair", employer: "Local employers", role: "", how: "In person", outcome: "Made contacts", notes: "Asked about openings"}]};
}
