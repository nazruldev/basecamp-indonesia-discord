import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = resolve(process.cwd(), "data");
const dbPath = resolve(dataDir, "app.db");

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS levels (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS levels_daily (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      gained INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS game_config (
      game_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      role_id TEXT NOT NULL,
      category_id TEXT,
      temp_hub_id TEXT
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
  `);
}

function tableCount(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
  return row.c;
}

function migrateJsonIfNeeded() {
  if (tableCount("levels") === 0) {
    const p = resolve(dataDir, "levels.json");
    if (existsSync(p)) {
      try {
        const obj = JSON.parse(readFileSync(p, "utf8")) as Record<
          string,
          Record<string, { level: number; xp: number }>
        >;
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO levels (guild_id, user_id, level, xp) VALUES (?, ?, ?, ?)"
        );
        for (const [gid, users] of Object.entries(obj)) {
          for (const [uid, rec] of Object.entries(users)) {
            stmt.run(gid, uid, Math.max(1, rec.level || 1), Math.max(0, rec.xp || 0));
          }
        }
      } catch {
        // ignore invalid legacy file
      }
    }
  }

  if (tableCount("levels_daily") === 0) {
    const p = resolve(dataDir, "levels-daily.json");
    if (existsSync(p)) {
      try {
        const obj = JSON.parse(readFileSync(p, "utf8")) as Record<
          string,
          Record<string, { day: string; gained: number }>
        >;
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO levels_daily (guild_id, user_id, day, gained) VALUES (?, ?, ?, ?)"
        );
        for (const [gid, users] of Object.entries(obj)) {
          for (const [uid, rec] of Object.entries(users)) {
            stmt.run(gid, uid, rec.day || "", Math.max(0, rec.gained || 0));
          }
        }
      } catch {
        // ignore invalid legacy file
      }
    }
  }

  if (tableCount("game_config") === 0) {
    const p = resolve(dataDir, "game-config.json");
    if (existsSync(p)) {
      try {
        const obj = JSON.parse(readFileSync(p, "utf8")) as Record<
          string,
          { label: string; roleId: string; categoryId?: string; tempHubId?: string }
        >;
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO game_config (game_key, label, role_id, category_id, temp_hub_id) VALUES (?, ?, ?, ?, ?)"
        );
        for (const [k, v] of Object.entries(obj)) {
          if (!v?.label || !v?.roleId) continue;
          stmt.run(k, v.label, v.roleId, v.categoryId ?? null, v.tempHubId ?? null);
        }
      } catch {
        // ignore invalid legacy file
      }
    }
  }

  const menuStateKey = "game_menu_message_state";
  const hasMenu = db
    .prepare("SELECT 1 as ok FROM kv_store WHERE k = ? LIMIT 1")
    .get(menuStateKey) as { ok: 1 } | undefined;
  if (!hasMenu) {
    const p = resolve(dataDir, "game-menu-message.json");
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, "utf8");
        JSON.parse(raw);
        db.prepare("INSERT OR REPLACE INTO kv_store (k, v) VALUES (?, ?)").run(menuStateKey, raw);
      } catch {
        // ignore invalid legacy file
      }
    }
  }
}

initSchema();
migrateJsonIfNeeded();

export function getDb(): DatabaseSync {
  return db;
}
