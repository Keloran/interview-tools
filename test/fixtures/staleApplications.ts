import {StaleApplication} from "@/lib/staleApplications";

export const STALE_NOW = Date.parse("2026-04-11T00:00:00Z");
export const OLD = new Date("2026-01-01T00:00:00Z");
export function staleApplication(id = 1): StaleApplication {
  return {id, jobTitle: "Engineer", clientCompany: null, applicationDate: OLD, updated_at: OLD, firstResponseAt: null, company: {name: "Acme"},
    interviews: [{id: id * 10, parentId: null, created_at: OLD, updated_at: OLD, date: null, deadline: null, replyBy: null, outcome: "AWAITING_RESPONSE", stage: {stage: "Applied"}}], followUps: [], availabilityLinks: []};
}
