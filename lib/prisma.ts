import { PrismaClient } from "@/app/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Use Prisma Accelerate only when the DATABASE_URL uses an Accelerate-compatible scheme.
// Otherwise, fall back to the standard client to avoid P6001 (invalid datasource URL) locally.
const shouldUseAccelerate = (() => {
  const url = process.env.DATABASE_URL || "";
  return url.startsWith("prisma://") || url.startsWith("prisma+postgres://");
})();

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  (shouldUseAccelerate
    ? new PrismaClient({
      log: ['query']
    }).$extends(withAccelerate())
    : new PrismaClient({
      log: ['query']
    }));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;