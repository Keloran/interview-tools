import prisma from "@/lib/prisma";
import {collectionOpen, consentCurrent, COMMUNITY_NOTICE_VERSION, snapshotCurrent} from "@/lib/communityPolicy";
import {lockCommunity} from "@/lib/communityConsent";
import {applicationVote, communityApplicationSelect, communitySummarySchema, latestVotes, suspiciousConsentCohort, summarizeCommunity} from "@/lib/communityAggregation";

export async function rebuildCommunity(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    let control = await tx.communityControl.findUnique({where: {id: "global"}});
    const invalidWhere = {user: {OR: [
      {communityConsent: {is: null}},
      {communityConsent: {is: {OR: [{noticeVersion: {not: COMMUNITY_NOTICE_VERSION}}, {grantedAt: null}, {withdrawnAt: {not: null}}, {purgePending: true}, {quarantinedAt: {not: null}}]}}},
    ]}};
    const invalid = await tx.communityContribution.count({where: invalidWhere});
    if (invalid) {
      control = await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
      await tx.communityContribution.deleteMany({where: invalidWhere});
    }
    await tx.communityConsent.updateMany({where: {withdrawnAt: {not: null}, purgePending: true}, data: {purgePending: false}});
    // Removal runs even while collection is paused; source records are read only after the gate.
    if (!collectionOpen(control, now)) return {collected: false, published: false};
    await tx.communityContribution.deleteMany({});
    const employers = await tx.communityEmployer.findMany({where: {reviewedAt: {not: null}, suppressedAt: null}});
    const allowed = new Set(employers.map((employer) => employer.id));
    const consents = await tx.communityConsent.findMany({where: {noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: {not: null}, withdrawnAt: null, purgePending: false, quarantinedAt: null}, include: {user: {select: {applications: {select: communityApplicationSelect, orderBy: [{applicationDate: "desc"}, {id: "desc"}]}}}}});
    const votes = latestVotes(consents.filter(consentCurrent).flatMap((consent) => consent.user.applications.flatMap((application) => {
      const vote = applicationVote(application, consent, now); return vote && allowed.has(vote.employerId) ? [vote] : [];
    })));
    if (votes.length) await tx.communityContribution.createMany({data: votes.map((vote) => ({userId: vote.userId, employerId: vote.employerId, noticeVersion: vote.noticeVersion, consentRevision: vote.consentRevision, observedAt: vote.observedAt, responded: vote.responded, ghosted: vote.ghosted, feedbackGiven: vote.feedbackGiven, replyDays: vote.replyDays}))});
    const month = now.toISOString().slice(0, 7);
    if (!control!.publicationEnabled || control!.lastPublicationMonth === month) return {collected: true, published: false};
    await tx.communitySnapshot.deleteMany({});
    for (const employer of employers) {
      const cohort = votes.filter((vote) => vote.employerId === employer.id);
      if (suspiciousConsentCohort(cohort, employer.cohortReviewedAt)) continue;
      const data = summarizeCommunity(cohort, month);
      if (data) await tx.communitySnapshot.create({data: {employerId: employer.id, revocationEpoch: control!.revocationEpoch, noticeVersion: COMMUNITY_NOTICE_VERSION, publishedAt: now, data}});
    }
    // Even an entirely suppressed month is sealed: revocation must not enable a same-month replacement.
    await tx.communityControl.update({where: {id: "global"}, data: {lastPublicationMonth: month}});
    return {collected: true, published: true};
  }, {timeout: 60000});
}
export async function readCommunitySummary(employerId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const control = await tx.communityControl.findUnique({where: {id: "global"}});
    const employer = await tx.communityEmployer.findUnique({where: {id: employerId}, include: {snapshot: true}});
    const snapshot = employer?.snapshot;
    if (!employer?.reviewedAt || employer.suppressedAt || !snapshot || !snapshotCurrent(control, snapshot, now) || control?.lastPublicationMonth !== now.toISOString().slice(0, 7) || snapshot.publishedAt.toISOString().slice(0, 7) !== now.toISOString().slice(0, 7)) return null;
    const parsed = communitySummarySchema.safeParse(snapshot.data);
    return parsed.success && parsed.data.month === now.toISOString().slice(0, 7) ? parsed.data : null;
  });
}
