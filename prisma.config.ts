import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
    datasourceUrl: process.env["DATABASE_URL"]!,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datasource: {
    url: process.env["DATABASE_URL"]!,
    adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
  } as any,
});
