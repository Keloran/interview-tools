import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import prisma from "../lib/prisma";
import {grantCommunityConsent, withdrawCommunityConsent, deleteAccountData} from "../lib/communityConsent";
import {COMMUNITY_NOTICE_VERSION, snapshotCurrent} from "../lib/communityPolicy";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.ok(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/interview_test", "Run only against the disposable local CI database");
  const suffix = randomUUID().replace(/-/g, ""), token = `consent-${suffix}`;
  const previous = await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}});
  const owner = await prisma.user.create({data: {clerkId: token, email: `${token}@example.com`}});
  const other = await prisma.user.create({data: {clerkId: `${token}-other`, email: `${token}-other@example.com`}});
  const employer = await prisma.communityEmployer.create({data: {name: "Synthetic employer", reviewedAt: new Date()}});
  const functionName = `fail_community_${suffix}`, triggerName = `test_community_${suffix}`;
  const identity = {id: token, email: owner.email, name: null};
  try {
    await prisma.communityControl.update({where: {id: "global"}, data: {collectionEnabled: false}});
    assert.equal((await grantCommunityConsent(identity)).status, 409);
    assert.equal(await prisma.communityConsent.count({where: {userId: owner.id}}), 0);
    await prisma.communityControl.update({where: {id: "global"}, data: {noticeVersion: COMMUNITY_NOTICE_VERSION, noticePublishedAt: new Date(), collectionEnabled: true, publicationEnabled: true}});
    assert.equal((await grantCommunityConsent(identity)).status, 200);
    const original = await prisma.communityConsent.findUniqueOrThrow({where: {userId: owner.id}});
    assert.equal((await grantCommunityConsent(identity)).status, 200);
    assert.deepEqual(await prisma.communityConsent.findUniqueOrThrow({where: {userId: owner.id}}), original);
    assert.equal((await grantCommunityConsent({id: `${token}-other`, email: other.email, name: null})).status, 200);
    const company = await prisma.company.create({data: {userId: owner.id, name: "Private application fixture"}});
    await prisma.application.create({data: {userId: owner.id, companyId: company.id, jobTitle: "Keep private history", applicationDate: new Date()}});
    await prisma.communityContribution.createMany({data: [owner, other].map((user) => ({userId: user.id, employerId: employer.id, noticeVersion: COMMUNITY_NOTICE_VERSION, consentRevision: 1, observedAt: new Date(), responded: true}))});
    const before = await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}});
    const snapshot = await prisma.communitySnapshot.create({data: {employerId: employer.id, noticeVersion: COMMUNITY_NOTICE_VERSION, revocationEpoch: before.revocationEpoch, publishedAt: new Date(), data: {synthetic: true}}});
    assert.ok(snapshotCurrent(before, snapshot));
    // Force a physical purge error, after withdrawal has durably committed.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''synthetic purge failure''; END;'`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE DELETE ON "CommunityContribution" FOR EACH ROW WHEN (OLD."userId" = ${owner.id}) EXECUTE FUNCTION "${functionName}"()`);
    await assert.rejects(withdrawCommunityConsent(token));
    const pending = await prisma.communityConsent.findUniqueOrThrow({where: {userId: owner.id}});
    assert.ok(pending.withdrawnAt); assert.equal(pending.purgePending, true);
    assert.equal(snapshotCurrent(await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}}), snapshot), false);
    assert.equal((await grantCommunityConsent(identity)).status, 409);
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "CommunityContribution"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
    await withdrawCommunityConsent(token);
    assert.equal(await prisma.communityContribution.count({where: {userId: owner.id}}), 0);
    assert.equal(await prisma.communityContribution.count({where: {userId: other.id}}), 1);
    assert.equal((await prisma.communityConsent.findUniqueOrThrow({where: {userId: owner.id}})).purgePending, false);
    assert.equal(await prisma.application.count({where: {userId: owner.id}}), 1);
    const stoppedEpoch = (await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}})).revocationEpoch;
    await withdrawCommunityConsent(token);
    assert.equal((await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}})).revocationEpoch, stoppedEpoch);
    assert.equal((await grantCommunityConsent(identity)).status, 200);
    await prisma.communityContribution.create({data: {userId: owner.id, employerId: employer.id, noticeVersion: COMMUNITY_NOTICE_VERSION, consentRevision: 3, observedAt: new Date()}});
    await deleteAccountData(token);
    assert.equal(await prisma.communityConsent.count({where: {userId: owner.id}}), 0);
    assert.equal(await prisma.communityContribution.count({where: {userId: owner.id}}), 0);
    assert.equal(await prisma.application.count({where: {userId: owner.id}}), 0);
    assert.equal(await prisma.user.count({where: {id: other.id}}), 1);
    const deletedEpoch = (await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}})).revocationEpoch;
    await deleteAccountData(token);
    assert.equal((await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}})).revocationEpoch, deletedEpoch);
    console.log("Community consent passed: default off, idempotent grant, durable withdrawal on forced purge failure, snapshot invalidation, scoped retry and deletion cascade.");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "CommunityContribution"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    await prisma.user.deleteMany({where: {id: {in: [owner.id, other.id]}}});
    await prisma.communityEmployer.delete({where: {id: employer.id}});
    const {id, ...restore} = previous; await prisma.communityControl.update({where: {id}, data: restore});
  }
}
main().catch((error) => {console.error(error); process.exitCode = 1;}).finally(() => prisma.$disconnect());
