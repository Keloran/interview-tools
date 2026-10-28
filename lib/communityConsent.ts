import prisma from "@/lib/prisma";
import type {Prisma} from "@/app/generated/prisma/client";
import {collectionOpen, consentCurrent, COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";

type Tx = Prisma.TransactionClient;
// All writers, including the aggregation job, take this lock before user/consent rows.
export async function lockCommunity(tx: Tx) {
  const rows = await tx.$queryRaw<{id: string}[]>`SELECT id FROM "CommunityControl" WHERE id = 'global' FOR UPDATE`;
  if (!rows.length) throw new Error("Community controls unavailable");
}
export async function communityConsentState(clerkId: string, verified: boolean) {
  const [user, control] = await Promise.all([
    prisma.user.findUnique({where: {clerkId}, select: {communityConsent: true}}),
    prisma.communityControl.findUnique({where: {id: "global"}}),
  ]);
  const choice = user?.communityConsent;
  return {enabled: consentCurrent(choice), needsReview: !!choice?.grantedAt && !choice.withdrawnAt && !consentCurrent(choice), purgePending: choice?.purgePending ?? false,
    canEnable: collectionOpen(control) && verified, collectionPaused: !collectionOpen(control), verified, noticeVersion: COMMUNITY_NOTICE_VERSION,
    agreedVersion: choice?.noticeVersion ?? null, grantedAt: choice?.grantedAt ?? null, withdrawnAt: choice?.withdrawnAt ?? null};
}
export async function grantCommunityConsent(identity: {id: string; email: string; name: string | null}) {
  return prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const control = await tx.communityControl.findUnique({where: {id: "global"}});
    if (!collectionOpen(control)) return {status: 409, message: "Community sharing is not open. Your data remains private."};
    const user = await tx.user.upsert({where: {clerkId: identity.id}, update: {}, create: {clerkId: identity.id, email: identity.email, name: identity.name}, select: {id: true, communityConsent: true}});
    if (user.communityConsent?.purgePending) return {status: 409, message: "Finish withdrawing your previous contribution before enabling sharing again."};
    if (consentCurrent(user.communityConsent)) return {status: 200};
    // A scope/version change never reuses an old contribution or consent revision.
    await tx.communityContribution.deleteMany({where: {userId: user.id}});
    await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
    await tx.communityConsent.upsert({where: {userId: user.id}, create: {userId: user.id, noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: new Date()},
      update: {noticeVersion: COMMUNITY_NOTICE_VERSION, grantedAt: new Date(), withdrawnAt: null, purgePending: false, revision: {increment: 1}}});
    return {status: 200};
  });
}
// Commit revocation and epoch invalidation first. If physical cleanup fails, old snapshots
// remain invalid and the durable purgePending flag prevents recollection/re-enrolment.
export async function withdrawCommunityConsent(clerkId: string) {
  const userId = await prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const user = await tx.user.findUnique({where: {clerkId}, select: {id: true, communityConsent: true}});
    if (!user) return null;
    if (user.communityConsent?.withdrawnAt && user.communityConsent.purgePending) return {id: user.id, revision: user.communityConsent.revision};
    const contributions = await tx.communityContribution.count({where: {userId: user.id}});
    if (!user.communityConsent?.grantedAt && !contributions) return null;
    if (user.communityConsent?.withdrawnAt && !contributions) return null;
    const now = new Date();
    await tx.communityConsent.upsert({where: {userId: user.id}, create: {userId: user.id, noticeVersion: COMMUNITY_NOTICE_VERSION, withdrawnAt: now, purgePending: true},
      update: {withdrawnAt: now, purgePending: true, revision: {increment: 1}}});
    await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
    return {id: user.id, revision: (user.communityConsent?.revision ?? 0) + 1};
  });
  if (userId === null) return;
  await prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const current = await tx.communityConsent.findUnique({where: {userId: userId.id}});
    if (!current?.withdrawnAt || current.revision !== userId.revision) return;
    await tx.communityContribution.deleteMany({where: {userId: userId.id}});
    await tx.communityConsent.updateMany({where: {userId: userId.id, revision: userId.revision, withdrawnAt: {not: null}}, data: {purgePending: false}});
  });
}
export async function deleteAccountData(clerkId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockCommunity(tx);
      const user = await tx.user.findUnique({where: {clerkId}, select: {id: true}});
      if (!user) return {count: 0};
      await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
      return tx.user.deleteMany({where: {clerkId}}); // cascades private data, consent and contributions atomically
    });
  } catch (error) {
    // If account deletion fails, still attempt durable withdrawal before the caller reports failure.
    await withdrawCommunityConsent(clerkId).catch(() => undefined);
    throw error;
  }
}
