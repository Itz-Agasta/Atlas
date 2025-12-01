import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DB_READ_URL;
if (!connectionString) {
  throw new Error("DB URL required");
}

let processedConnectionString = connectionString as string;
if (connectionString.includes("postgres:postgres@supabase_db_")) {
  const url = new URL(connectionString);
  url.hostname = url.hostname.split("_")[1];
  processedConnectionString = url.href;
}

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(processedConnectionString, { prepare: false });
export const db = drizzle(client);
