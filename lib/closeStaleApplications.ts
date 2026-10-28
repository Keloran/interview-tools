import prisma from "@/lib/prisma";
import {staleCandidate, staleSelect} from "@/lib/staleApplications";

export async function closeStaleApplications(clerkId: string, ids: number[], days: number) {
  return prisma.$transaction(async (tx) => {
    // Lock parents in ID order. New stages/follow-ups require a parent FK lock,
    // so committed activity is visible before re-checking or occurs after closure.
    await tx.$queryRaw`SELECT a.id FROM "Application" a JOIN "User" u ON u.id = a."userId" WHERE u."clerkId" = ${clerkId} AND a.id = ANY(${ids}::int[]) ORDER BY a.id FOR UPDATE OF a`;
    const applications = await tx.application.findMany({where: {id: {in: ids}, user: {clerkId}}, select: staleSelect});
    const closed: number[] = [], now = Date.now();
    for (const application of applications) {
      const candidate = staleCandidate(application, days, now);
      if (!candidate) continue;
      if (candidate.latestId !== null) {
        const update = await tx.interview.updateMany({where: {id: candidate.latestId, applicationId: application.id, updated_at: new Date(candidate.latestUpdatedAt!)}, data: {outcome: "NO_RESPONSE"}});
        if (!update.count) continue;
      } else {
        const stage = await tx.stage.upsert({where: {stage: "Applied"}, update: {}, create: {stage: "Applied"}});
        const method = await tx.stageMethod.upsert({where: {method: "Phone"}, update: {}, create: {method: "Phone"}});
        await tx.interview.create({data: {applicationId: application.id, stageId: stage.id, stageMethodId: method.id, outcome: "NO_RESPONSE", date: null}});
      }
      closed.push(application.id);
    }
    return {closed, skipped: ids.filter((id) => !closed.includes(id))};
  }, {timeout: 60000});
}
