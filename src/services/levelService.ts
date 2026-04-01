import { getDb } from "@/services/db.js";

type LevelRecord = {
  xp: number;
  level: number;
};

const db = getDb();

const xpRequiredForNext = (level: number): number => 100 + level * 40;

export const getLevel = async (guildId: string, userId: string): Promise<LevelRecord> => {
  const rec = db
    .prepare("SELECT level, xp FROM levels WHERE guild_id = ? AND user_id = ?")
    .get(guildId, userId) as { level: number; xp: number } | undefined;
  if (rec) return { level: rec.level, xp: rec.xp };
  return { xp: 0, level: 1 };
};

export const addXp = async (
  guildId: string,
  userId: string,
  amount: number
): Promise<{ before: LevelRecord; after: LevelRecord; leveledUp: boolean }> => {
  const current = await getLevel(guildId, userId);
  const before = { ...current };
  current.xp += Math.max(0, Math.floor(amount));

  let leveledUp = false;
  while (current.xp >= xpRequiredForNext(current.level)) {
    current.xp -= xpRequiredForNext(current.level);
    current.level += 1;
    leveledUp = true;
  }

  db.prepare(
    "INSERT OR REPLACE INTO levels (guild_id, user_id, level, xp) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, current.level, current.xp);
  return { before, after: { ...current }, leveledUp };
};

export const setLevelData = async (
  guildId: string,
  userId: string,
  level: number,
  xp = 0
): Promise<LevelRecord> => {
  const safeLevel = Math.max(1, Math.floor(level));
  const maxXpForLevel = xpRequiredForNext(safeLevel) - 1;
  const safeXp = Math.max(0, Math.min(Math.floor(xp), maxXpForLevel));

  const next = { level: safeLevel, xp: safeXp };
  db.prepare(
    "INSERT OR REPLACE INTO levels (guild_id, user_id, level, xp) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, next.level, next.xp);
  return next;
};

export const setXpData = async (
  guildId: string,
  userId: string,
  xp: number
): Promise<LevelRecord> => {
  const current = await getLevel(guildId, userId);
  const maxXpForLevel = xpRequiredForNext(current.level) - 1;
  const safeXp = Math.max(0, Math.min(Math.floor(xp), maxXpForLevel));

  const next = { level: current.level, xp: safeXp };
  db.prepare(
    "INSERT OR REPLACE INTO levels (guild_id, user_id, level, xp) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, next.level, next.xp);
  return next;
};

export const xpToNextLevel = (level: number, currentXp: number): number =>
  Math.max(0, xpRequiredForNext(level) - currentXp);
