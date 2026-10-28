import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import prisma from "../lib/prisma";
import {updateOffer} from "../lib/updateOffer";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.ok(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/interview_test", "Run only against the disposable local CI database");
  const token = `offer-test-${randomUUID()}`;
  const owner = await prisma.user.create({data: {clerkId: token, email: `${token}@example.com`}});
  const other = await prisma.user.create({data: {clerkId: `${token}-other`, email: `${token}-other@example.com`}});
  try {
    const company = await prisma.company.create({data: {userId: owner.id, name: "Offer fixture"}});
    const stage = await prisma.stage.upsert({where: {stage: "Offer"}, update: {}, create: {stage: "Offer"}});
    const method = await prisma.stageMethod.upsert({where: {method: "Not recorded"}, update: {}, create: {method: "Not recorded"}});
    const app = await prisma.application.create({data: {userId: owner.id, companyId: company.id, jobTitle: "Offer fixture", applicationDate: new Date(), interviews: {create: {stageId: stage.id, stageMethodId: method.id, outcome: "OFFER_RECEIVED", date: new Date(), deadline: new Date("2026-11-01"), notes: "Keep these offer notes"}}}, include: {interviews: true}});
    const id = app.interviews[0].id;
    assert.equal((await updateOffer(`${token}-other`, id, {deadline: null})).status, 404);
    assert.equal((await updateOffer(token, id, {deadline: "2026-11-02"})).status, 200);
    const dated = await prisma.interview.findUniqueOrThrow({where: {id}});
    assert.equal(dated.deadline?.toISOString(), "2026-11-02T00:00:00.000Z"); assert.equal(dated.date, null); assert.equal(dated.notes, "Keep these offer notes");
    assert.equal((await updateOffer(token, id, {deadline: null})).status, 200);
    assert.equal((await prisma.interview.findUniqueOrThrow({where: {id}})).deadline, null);
    const decisions = await Promise.all([updateOffer(token, id, {decision: "OFFER_ACCEPTED", confirmDecision: true}), updateOffer(token, id, {decision: "OFFER_DECLINED", confirmDecision: true})]);
    assert.deepEqual(decisions.map((result) => result.status).sort(), [200, 409]);
    assert.ok(["OFFER_ACCEPTED", "OFFER_DECLINED"].includes((await prisma.interview.findUniqueOrThrow({where: {id}})).outcome!));
    assert.equal((await updateOffer(token, id, {deadline: "2026-11-03"})).status, 409);
    console.log("Offer transactions passed: ownership, UTC calendar-day storage, clearing, preserved notes and one concurrent decision winner.");
  } finally {await prisma.user.deleteMany({where: {id: {in: [owner.id, other.id]}}});}
}
main().catch((error) => {console.error(error); process.exitCode = 1;}).finally(() => prisma.$disconnect());
