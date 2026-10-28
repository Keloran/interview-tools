import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import prisma from "../lib/prisma";
import {closeStaleApplications} from "../lib/closeStaleApplications";
import {staleCandidate, staleSelect} from "../lib/staleApplications";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.ok(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/interview_test", "Run only against the disposable local CI database");
  const token = `closure-test-${randomUUID()}`;
  const owner = await prisma.user.create({data: {clerkId: token, email: `${token}@example.com`}});
  const other = await prisma.user.create({data: {clerkId: `${token}-other`, email: `${token}-other@example.com`}});
  try {
    const stage = await prisma.stage.upsert({where: {stage: "Applied"}, update: {}, create: {stage: "Applied"}});
    const method = await prisma.stageMethod.upsert({where: {method: "Phone"}, update: {}, create: {method: "Phone"}});
    const company = await prisma.company.create({data: {name: "Closure fixture", userId: owner.id}});
    const otherCompany = await prisma.company.create({data: {name: "Other closure fixture", userId: other.id}});
    const old = new Date(Date.now() - 100 * 86400000);
    const create = (userId: number, companyId: number, date = old) => prisma.application.create({data: {userId, companyId, jobTitle: "Closure fixture", applicationDate: old, created_at: old, updated_at: date,
      interviews: {create: {stageId: stage.id, stageMethodId: method.id, outcome: "AWAITING_RESPONSE", notes: "Keep this history", date: null, created_at: old, updated_at: date}}}, include: {interviews: true}});
    const stale = await create(owner.id, company.id), fresh = await create(owner.id, company.id, new Date()), foreign = await create(other.id, otherCompany.id);
    const closed = await closeStaleApplications(token, [stale.id, fresh.id, foreign.id], 60);
    assert.deepEqual(closed.closed, [stale.id]);
    assert.deepEqual(closed.skipped.sort((a, b) => a - b), [fresh.id, foreign.id].sort((a, b) => a - b));
    const saved = await prisma.interview.findUniqueOrThrow({where: {id: stale.interviews[0].id}});
    assert.equal(saved.outcome, "NO_RESPONSE"); assert.equal(saved.notes, "Keep this history");
    assert.deepEqual((await closeStaleApplications(token, [stale.id], 60)).closed, []);
    assert.equal((await prisma.interview.findUniqueOrThrow({where: {id: foreign.interviews[0].id}})).outcome, "AWAITING_RESPONSE");
    await prisma.interview.update({where: {id: stale.interviews[0].id}, data: {outcome: "AWAITING_RESPONSE", updated_at: old}});
    const concurrent = await Promise.all([closeStaleApplications(token, [stale.id], 60), closeStaleApplications(token, [stale.id], 60)]);
    assert.equal(concurrent.reduce((count, result) => count + result.closed.length, 0), 1);
    await prisma.interview.update({where: {id: stale.interviews[0].id}, data: {outcome: "AWAITING_RESPONSE", updated_at: old}});
    const preview = await prisma.application.findUniqueOrThrow({where: {id: stale.id}, select: staleSelect});
    assert.ok(staleCandidate(preview, 60));
    let release!: () => void, signal!: () => void;
    const gate = new Promise<void>((resolve) => {release = resolve;});
    const ready = new Promise<void>((resolve) => {signal = resolve;});
    const writing = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${stale.id} FOR UPDATE`;
      await tx.followUp.create({data: {applicationId: stale.id}});
      signal(); await gate;
    });
    await ready;
    let finished = false;
    const closing = closeStaleApplications(token, [stale.id], 60).finally(() => {finished = true;});
    try {await new Promise((resolve) => setTimeout(resolve, 100)); assert.equal(finished, false, "Closure must wait for concurrent parent activity");}
    finally {release();}
    await writing;
    assert.deepEqual((await closing).closed, []);
    assert.equal((await prisma.interview.findUniqueOrThrow({where: {id: stale.interviews[0].id}})).outcome, "AWAITING_RESPONSE");
    console.log("Stale closure passed: ownership, preserved history, retry idempotence, one concurrent winner and activity re-check after parent locking.");
  } finally {await prisma.user.deleteMany({where: {id: {in: [owner.id, other.id]}}});}
}
main().catch((error) => {console.error(error); process.exitCode = 1;}).finally(() => prisma.$disconnect());
