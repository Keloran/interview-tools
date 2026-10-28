import {readFile} from "node:fs/promises";
import {z} from "zod";
import prisma from "../lib/prisma";
import {employerReviewSchema, reviewCommunityEmployer, quarantineContributor} from "../lib/communityEmployer";
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--reviewed-file") throw new Error("Use --reviewed-file with an operator-reviewed JSON file");
  const input: unknown = JSON.parse(await readFile(process.argv[3], "utf8"));
  const quarantine = z.object({type: z.literal("contributor"), clerkId: z.string().min(1), quarantined: z.boolean(), confirmReviewed: z.literal(true)}).safeParse(input);
  if (quarantine.success) await quarantineContributor(quarantine.data.clerkId, quarantine.data.quarantined);
  else await reviewCommunityEmployer(employerReviewSchema.parse(input));
  console.log("Community review recorded."); // never print private identifiers or source records
}
main().catch(() => {console.error("Community review failed. Check the input and database privately."); process.exitCode = 1;}).finally(() => prisma.$disconnect());
