import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import prisma from "../lib/prisma";
import {COMMUNITY_NOTICE_VERSION} from "../lib/communityPolicy";
import {employerNameKey} from "../lib/communityAggregation";
import {rebuildCommunity, readCommunitySummary} from "../lib/communityJob";
import {withdrawCommunityConsent} from "../lib/communityConsent";
import {quarantineContributor, reviewCommunityEmployer} from "../lib/communityEmployer";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.ok(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/interview_test", "Run only against the disposable local CI database");
  const token = `aggregation-${randomUUID()}`, now = new Date(), ids: number[] = [], employers: string[] = [];
  const previous = await prisma.communityControl.findUniqueOrThrow({where: {id: "global"}});
  const applied = new Date(now.getTime() - 100 * 86400000); applied.setUTCHours(0, 0, 0, 0);
  const stage = await prisma.stage.upsert({where: {stage: "Applied"}, update: {}, create: {stage: "Applied"}});
  const method = await prisma.stageMethod.upsert({where: {method: "Not recorded"}, update: {}, create: {method: "Not recorded"}});
  let canonical = "";
  async function addUser(i: number) {
    const user = await prisma.user.create({data: {clerkId: `${token}-${i}`, email: `${token}-${i}@example.com`, communityConsent: {create: {noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: new Date(applied.getTime() + i * 86400000)}}}});
    ids.push(user.id);
    const company = await prisma.company.create({data: {userId: user.id, name: "Private fixture employer"}});
    const ghosted = i < 10 || i === 20;
    const app = await prisma.application.create({data: {userId: user.id, companyId: company.id, jobTitle: "Private fixture role", applicationDate: applied, created_at: applied,
      communityEmployerId: canonical, communityEmployerConfirmedAt: now, communityEmployerIdentity: employerNameKey(company.name), firstResponseAt: ghosted ? null : new Date(applied.getTime() + 3 * 86400000),
      interviews: {create: {stageId: stage.id, stageMethodId: method.id, created_at: applied, outcome: ghosted ? "NO_RESPONSE" : "REJECTED"}}}});
    return {user, company, app};
  }
  try {
    await prisma.communityControl.update({where: {id: "global"}, data: {noticeVersion: COMMUNITY_NOTICE_VERSION, noticePublishedAt: new Date(applied), collectionEnabled: false, publicationEnabled: false, lastPublicationMonth: null}});
    assert.deepEqual(await rebuildCommunity(now), {collected: false, published: false});
    canonical = await reviewCommunityEmployer({name: "Synthetic employer Ltd", domain: "example.test", jurisdiction: "Test", aliases: ["Synthetic employer"], confirmReviewed: true, reviewCohort: true}); employers.push(canonical);
    const sibling = await reviewCommunityEmployer({name: "Synthetic employer Inc", domain: "example.test", jurisdiction: "Other test", aliases: ["Synthetic employer"], confirmReviewed: true, reviewCohort: true}); employers.push(sibling);
    for (let i = 0; i < 20; i++) await addUser(i);
    // Repeated applications cannot multiply an account's weight.
    const firstCompany = await prisma.company.findFirstOrThrow({where: {userId: ids[0]}});
    for (let i = 1; i <= 5; i++) await prisma.application.create({data: {userId: ids[0], companyId: firstCompany.id, jobTitle: "Older duplicate", applicationDate: new Date(applied.getTime() - i * 86400000), created_at: applied, communityEmployerId: canonical, communityEmployerConfirmedAt: now, communityEmployerIdentity: employerNameKey(firstCompany.name), interviews: {create: {stageId: stage.id, stageMethodId: method.id, created_at: applied, outcome: "REJECTED"}}}});
    await prisma.communityControl.update({where: {id: "global"}, data: {collectionEnabled: true, publicationEnabled: true}});
    assert.deepEqual(await rebuildCommunity(now), {collected: true, published: true});
    assert.equal(await prisma.communityContribution.count({where: {employerId: canonical}}), 20);
    const summary = await readCommunitySummary(canonical, now);
    assert.equal(summary?.responseRate, 50); assert.equal(summary?.ghostingRate, 50); assert.equal(summary?.replyTimeBand, null);
    assert.deepEqual(Object.keys(summary!).sort(), ["feedbackRate", "ghostingRate", "month", "replyTimeBand", "responseRate", "sampleBand"]);
    assert.equal(await readCommunitySummary(sibling, now), null);
    // A concurrent rerun cannot race revocation or replace the month's publication.
    await Promise.all([rebuildCommunity(now), withdrawCommunityConsent(`${token}-0`)]);
    assert.equal(await readCommunitySummary(canonical, now), null);
    assert.equal(await prisma.communityContribution.count({where: {employerId: canonical}}), 19);
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    assert.deepEqual(await rebuildCommunity(nextMonth), {collected: true, published: true});
    assert.equal(await readCommunitySummary(canonical, nextMonth), null);
    await addUser(20);
    assert.deepEqual(await rebuildCommunity(nextMonth), {collected: true, published: false});
    assert.equal(await readCommunitySummary(canonical, nextMonth), null); // a suppressed month stays sealed at 20 too
    const followingMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
    assert.deepEqual(await rebuildCommunity(followingMonth), {collected: true, published: true});
    assert.equal((await readCommunitySummary(canonical, followingMonth))?.responseRate, 50);
    await quarantineContributor(`${token}-1`, true);
    assert.equal(await readCommunitySummary(canonical, followingMonth), null);
    assert.equal(await prisma.communityContribution.count({where: {userId: ids[1]}}), 0);
    // Deferred physical purges must also finish while new collection is switched off.
    await prisma.communityConsent.update({where: {userId: ids[3]}, data: {withdrawnAt: new Date(), purgePending: true}});
    await prisma.communityControl.update({where: {id: "global"}, data: {collectionEnabled: false}});
    assert.deepEqual(await rebuildCommunity(followingMonth), {collected: false, published: false});
    assert.equal(await prisma.communityContribution.count({where: {userId: ids[3]}}), 0);
    assert.equal((await prisma.communityConsent.findUniqueOrThrow({where: {userId: ids[3]}})).purgePending, false);
    assert.equal(await prisma.communityContribution.count({where: {userId: ids[2]}}), 1);
    console.log("Community aggregation passed: default-off gates, reviewed identity isolation, one vote/account, suppression boundaries, sealed monthly snapshots, concurrent withdrawal and quarantine.");
  } finally {
    await prisma.user.deleteMany({where: {id: {in: ids}}});
    await prisma.communityEmployer.deleteMany({where: {id: {in: employers}}});
    const {id, ...restore} = previous; await prisma.communityControl.update({where: {id}, data: restore});
  }
}
main().catch((error) => {console.error("Synthetic community aggregation check failed. No real user data was used.", error); process.exitCode = 1;}).finally(() => prisma.$disconnect());
