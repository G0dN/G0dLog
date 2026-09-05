import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { getRuntimeEnv } from "../lib/runtime-env";

type LocalStatement = {
  setReturnArrays(value: boolean): void;
  all(...params: unknown[]): unknown[][];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};

type LocalDatabase = {
  exec(sql: string): void;
  prepare(sql: string): LocalStatement;
};

let localDatabase: LocalDatabase | null = null;
let localDb: DrizzleD1Database<typeof schema> | null = null;

function getLocalDb() {
  if (localDb) return localDb;
  if (typeof process === "undefined") return null;
  const getBuiltinModule = (process as unknown as { getBuiltinModule?: (name: string) => unknown }).getBuiltinModule;
  if (!getBuiltinModule) return null;
  const sqlite = getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => LocalDatabase };
  const fs = getBuiltinModule("node:fs") as { existsSync(path: string): boolean; mkdirSync(path: string, options: { recursive: boolean }): void; readFileSync(path: string, encoding: "utf8"): string };
  const path = getBuiltinModule("node:path") as { resolve(...parts: string[]): string; join(...parts: string[]): string };
  const dataDir = process.env.BLOG_DATA_DIR ?? ".data";
  const resolvedDir = path.resolve(dataDir);
  fs.mkdirSync(resolvedDir, { recursive: true });
  const databasePath = path.join(resolvedDir, "blog.sqlite");
  localDatabase = new sqlite.DatabaseSync(databasePath);
  localDatabase.exec("PRAGMA foreign_keys=ON");
  const versionStatement = localDatabase.prepare("PRAGMA user_version");
  versionStatement.setReturnArrays(true);
  const version = Number((versionStatement.get() as unknown[] | undefined)?.[0] ?? 0);
  if (version < 2) {
    const migrationDir = path.resolve("drizzle");
    const migrationNames = ["0000_abandoned_warhawk.sql", "0001_moaning_blonde_phantom.sql"];
    for (const migrationName of migrationNames) localDatabase.exec(fs.readFileSync(path.join(migrationDir, migrationName), "utf8"));
    localDatabase.exec("PRAGMA user_version=2");
  }
  const callback = async (sql: string, params: unknown[], method: "run" | "all" | "values" | "get") => {
    const statement = localDatabase?.prepare(sql);
    if (!statement) throw new Error("本地数据库未初始化");
    statement.setReturnArrays(true);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    if (method === "get") return { rows: statement.get(...params) as never[] };
    return { rows: statement.all(...params) };
  };
  localDb = drizzleProxy(callback, { schema }) as unknown as DrizzleD1Database<typeof schema>;
  return localDb;
}

export function getDb(): DrizzleD1Database<typeof schema> {
  const env = getRuntimeEnv();
  if (env.DB) return drizzle(env.DB, { schema });
  const local = getLocalDb();
  if (local) return local;
  throw new Error("数据库绑定不可用：本地请确保 Node.js >= 22.13，部署时请配置 D1 DB");
}
