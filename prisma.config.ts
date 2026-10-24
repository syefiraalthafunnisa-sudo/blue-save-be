import "dotenv/config";
import { defineConfig } from "prisma/config";
import "./src/config/databaseUrl";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seeders/reportSeeder.ts",
  },
});
