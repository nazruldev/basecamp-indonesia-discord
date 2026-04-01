import { resolve } from "node:path";
import { getDb } from "@/services/db.js";

export type GameConfigItem = {
  label: string;
  roleId: string;
  categoryId?: string;
  tempHubId?: string;
};

export type GameConfigMap = Record<string, GameConfigItem>;

export const gameConfigFilePath = resolve(process.cwd(), "data", "game-config.json");
const db = getDb();

export function readGameConfigFile(): GameConfigMap {
  const rows = db
    .prepare(
      "SELECT game_key, label, role_id, category_id, temp_hub_id FROM game_config ORDER BY game_key ASC"
    )
    .all() as Array<{
    game_key: string;
    label: string;
    role_id: string;
    category_id: string | null;
    temp_hub_id: string | null;
  }>;

  const out: GameConfigMap = {};
  for (const row of rows) {
    if (!row.game_key || !row.label || !row.role_id) continue;
    const item: GameConfigItem = {
      label: row.label,
      roleId: row.role_id,
    };
    if (row.category_id) item.categoryId = row.category_id;
    if (row.temp_hub_id) item.tempHubId = row.temp_hub_id;
    out[row.game_key] = item;
  }
  return out;
}

export async function writeGameConfigFile(next: GameConfigMap): Promise<void> {
  try {
    db.exec("BEGIN");
    db.prepare("DELETE FROM game_config").run();
    const stmt = db.prepare(
      "INSERT INTO game_config (game_key, label, role_id, category_id, temp_hub_id) VALUES (?, ?, ?, ?, ?)"
    );
    for (const [key, val] of Object.entries(next)) {
      if (!key || !val?.label || !val?.roleId) continue;
      stmt.run(
        key,
        val.label,
        val.roleId,
        val.categoryId ?? null,
        val.tempHubId ?? null
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const gameConfig: GameConfigMap = readGameConfigFile();
