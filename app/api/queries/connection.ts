import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    instance = drizzle(env.databaseUrl, {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}


export async function closeDb(): Promise<void> {
  if (!instance) return;
  const client = (instance as unknown as { $client?: { end?: () => Promise<void> } }).$client;
  if (client?.end) await client.end();
}
