import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

if (process.env.APP_DB_ENV === "staging") {
  // eslint-disable-next-line no-console
  console.log("[Subbie HQ] Database target: STAGING — this server is NOT talking to production data.");
}
