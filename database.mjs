import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function openDatabase(dataDir) {
  const url = process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL && !url)
    throw Error("Connect the Turso database before deploying.");
  if (!url) mkdirSync(dataDir, { recursive: true });
  const client = createClient({
    url: url || pathToFileURL(resolve(dataDir, "store.sqlite")).href,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  let migrationTransaction = null;
  const target = () => migrationTransaction || client;
  return {
    remote: !!url,
    prepare(sql) {
      return {
        async get(...args) {
          return (await target().execute({ sql, args })).rows[0];
        },
        async all(...args) {
          return (await target().execute({ sql, args })).rows;
        },
        async run(...args) {
          const r = await target().execute({ sql, args });
          return { changes: r.rowsAffected };
        },
      };
    },
    async exec(sql) {
      if (sql === "BEGIN") {
        migrationTransaction = await client.transaction("write");
        return;
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        try {
          await migrationTransaction[
            sql === "COMMIT" ? "commit" : "rollback"
          ]();
        } finally {
          migrationTransaction.close();
          migrationTransaction = null;
        }
        return;
      }
      await target().executeMultiple(sql);
    },
    async batch(statements) {
      return client.batch(statements, "write");
    },
    close() {
      client.close();
    },
  };
}
