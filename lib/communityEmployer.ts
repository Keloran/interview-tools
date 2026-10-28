import {z} from "zod";
import prisma from "@/lib/prisma";
import {lockCommunity} from "@/lib/communityConsent";
import {employerNameKey} from "@/lib/communityAggregation";

export const employerLinkSchema = z.union([z.object({employerId: z.string().uuid(), confirm: z.literal(true)}), z.object({employerId: z.null()})]);
export const employerPublicSelect = {id: true, name: true, domain: true, jurisdiction: true} as const;
export const employerLinkSelect = {id: true, userId: true, communityEmployerId: true, communityEmployerConfirmedAt: true, communityEmployerChangedAt: true, communityEmployerIdentity: true,
  company: {select: {name: true}}, clientCompany: true, viaRecruiter: true, communityEmployer: {select: employerPublicSelect}} as const;
export async function linkCommunityEmployer(clerkId: string, id: number, employerId: string | null, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const app = await tx.application.findFirst({where: {id, user: {clerkId}}, select: employerLinkSelect});
    if (!app) return {status: 404, message: "Application not found"};
    const identity = employerNameKey(app.clientCompany || app.company.name);
    if (employerId && app.viaRecruiter && !app.clientCompany?.trim()) return {status: 400, message: "Record the end client before confirming an employer"};
    if (employerId) {
      const employer = await tx.communityEmployer.findFirst({where: {id: employerId, reviewedAt: {not: null}, suppressedAt: null}, select: {id: true}});
      if (!employer) return {status: 404, message: "Reviewed employer not found"};
    }
    if (app.communityEmployerId === employerId && (!employerId || app.communityEmployerIdentity === identity)) return {status: 200};
    if (employerId && app.communityEmployerChangedAt && now.getTime() - app.communityEmployerChangedAt.getTime() < 86400000) return {status: 429, message: "Employer confirmations can change once per day. Removing a link is always available."};
    if (app.communityEmployerId) {
      const removed = await tx.communityContribution.deleteMany({where: {userId: app.userId, employerId: app.communityEmployerId}});
      if (removed.count) await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
    }
    await tx.application.updateMany({where: {id, user: {clerkId}}, data: {communityEmployerId: employerId, communityEmployerConfirmedAt: employerId ? now : null,
      communityEmployerChangedAt: now, communityEmployerIdentity: employerId ? identity : null}});
    return {status: 200};
  });
}
export const employerReviewSchema = z.object({id: z.string().uuid().optional(), name: z.string().trim().min(1).max(200), domain: z.string().trim().min(1).max(253), jurisdiction: z.string().trim().min(1).max(100),
  aliases: z.array(z.string().trim().min(1).max(200)).max(50).default([]), confirmReviewed: z.literal(true), reviewCohort: z.boolean().default(false), suppressed: z.boolean().optional()});
export async function reviewCommunityEmployer(input: z.infer<typeof employerReviewSchema>, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const data = {name: input.name, domain: input.domain, jurisdiction: input.jurisdiction, aliases: [...new Set([input.name, ...input.aliases].map(employerNameKey))], reviewedAt: now,
      ...(input.reviewCohort ? {cohortReviewedAt: now} : {}), ...(input.suppressed !== undefined ? {suppressedAt: input.suppressed ? now : null} : {})};
    const employer = input.id ? await tx.communityEmployer.update({where: {id: input.id}, data}) : await tx.communityEmployer.create({data});
    if (input.id) await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
    return employer.id;
  });
}
export async function quarantineContributor(clerkId: string, quarantined: boolean, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockCommunity(tx);
    const result = await tx.communityConsent.updateMany({where: {user: {clerkId}}, data: {quarantinedAt: quarantined ? now : null}});
    if (quarantined) await tx.communityContribution.deleteMany({where: {user: {clerkId}}});
    if (result.count) await tx.communityControl.update({where: {id: "global"}, data: {revocationEpoch: {increment: 1}}});
  });
}
