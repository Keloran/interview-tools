import {PrismaClient} from "@/app/generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// ponytail: max 5 connections is plenty for one small instance; raise if requests queue on the pool
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 }),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;