import {expect, it} from "vitest";
import {companyHistory} from "@/lib/companyHistory";
it("includes only confirmed current employer associations in personal company history", () => {
  const application = {id: 7, jobTitle: "Engineer", clientCompany: "Actual Client", applicationDate: new Date("2026-01-01"), communityEmployerId: "employer-id", communityEmployerConfirmedAt: new Date(), communityEmployerIdentity: "actual client", communityEmployer: {name: "Actual Client Ltd"}, interviews: [], availabilityLinks: [], _count: {followUps: 0}};
  const company = {id: 1, name: "Agency", applications: [application]};
  expect(companyHistory([company as never])[0].applications[0]).toMatchObject({communityEmployerId: "employer-id", communityEmployerName: "Actual Client Ltd"});
  application.clientCompany = "Other Client";
  expect(companyHistory([company as never])[0].applications[0]).toMatchObject({communityEmployerId: null, communityEmployerName: null});
  expect(companyHistory([company as never])[0].applications[0]).not.toHaveProperty("communityEmployerIdentity");
});
