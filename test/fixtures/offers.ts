import {OfferApplication} from "@/lib/offers";

export function offerApplication(id = 1, deadline: string | null = "2026-11-01"): OfferApplication {
  return {id, jobTitle: "Engineer", clientCompany: "Client", applicationDate: new Date("2026-10-01"), company: {name: "Agency"},
    interviews: [{id: id * 10, parentId: null, created_at: new Date("2026-10-15"), updated_at: new Date("2026-10-15"), deadline: deadline ? new Date(`${deadline}T00:00:00Z`) : null, outcome: "OFFER_RECEIVED", interviewer: "Jane", stage: {stage: "Offer"}}]};
}
