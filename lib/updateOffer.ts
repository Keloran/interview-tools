import prisma from "@/lib/prisma";
import {isOpenOffer, offerApplicationSelect, OfferMutation} from "@/lib/offers";
import {orderedStages} from "@/lib/timeline";

export async function updateOffer(clerkId: string, id: number, input: OfferMutation) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.interview.findFirst({where: {id, application: {user: {clerkId}}}, select: {applicationId: true}});
    if (!owned) return {status: 404};
    await tx.$queryRaw`SELECT a.id FROM "Application" a JOIN "User" u ON u.id = a."userId" WHERE a.id = ${owned.applicationId} AND u."clerkId" = ${clerkId} FOR UPDATE OF a`;
    const application = await tx.application.findFirst({where: {id: owned.applicationId, user: {clerkId}}, select: offerApplicationSelect});
    if (!application) return {status: 404};
    const current = orderedStages(application.interviews).at(-1);
    if (!current || current.id !== id || !isOpenOffer(current.stage.stage, current.outcome)) return {status: 409};
    const result = await tx.interview.updateMany({where: {id, applicationId: application.id, updated_at: current.updated_at}, data: {
      ...(input.deadline !== undefined ? {deadline: input.deadline === null ? null : new Date(`${input.deadline}T00:00:00.000Z`), date: null} : {}),
      ...(input.decision ? {outcome: input.decision} : {}),
    }});
    return {status: result.count ? 200 : 409};
  });
}
