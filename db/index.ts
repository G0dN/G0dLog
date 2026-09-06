import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

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
type AppDatabase = ReturnType<typeof drizzleProxy<typeof schema>>;
let localDb: AppDatabase | null = null;

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
  const migrationDir = path.resolve("drizzle");
  const migrations = [
    [1, "0000_abandoned_warhawk.sql"],
    [2, "0001_moaning_blonde_phantom.sql"],
    [3, "0002_g0dlog_baseline.sql"],
    [4, "0003_media_derivatives.sql"],
    [5, "0004_draft_and_avif.sql"],
  ] as const;
  for (const [targetVersion, migrationName] of migrations) {
    if (version < targetVersion) localDatabase.exec(fs.readFileSync(path.join(migrationDir, migrationName), "utf8"));
  }
  if (version < 5) localDatabase.exec("PRAGMA user_version=5");
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
  localDb = drizzleProxy(callback, { schema });
  return localDb;
}

export function getDb(): AppDatabase {
  const local = getLocalDb();
  if (local) return local;
  throw new Error("SQLite 数据库不可用：请确保 Node.js >= 22.13，并检查 BLOG_DATA_DIR");
}
