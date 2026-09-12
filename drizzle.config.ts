import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit corre fuera de Next, que es quien normalmente carga `.env.local`.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "./src/server/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
