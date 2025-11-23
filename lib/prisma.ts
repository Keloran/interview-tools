import {PrismaClient} from "@/app/generated/prisma/client";
import {env} from "prisma/config"
import {PrismaPg} from "@prisma/adapter-pg"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: env("DATABASE_URL")
})

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;