import { getDb } from "@/services/db.js";

type DailyRec = {
  day: string;
  gained: number;
};

const db = getDb();

const todayKey = (): string => new Date().toISOString().slice(0, 10);

export const consumeDailyXpBudget = async (
  guildId: string,
  userId: string,
  requestedXp: number,
  dailyCap: number
): Promise<number> => {
  const req = Math.max(0, Math.floor(requestedXp));
  if (req <= 0 || dailyCap <= 0) return 0;

  const day = todayKey();
  const cur = db
    .prepare("SELECT day, gained FROM levels_daily WHERE guild_id = ? AND user_id = ?")
    .get(guildId, userId) as DailyRec | undefined;
  const rec: DailyRec =
    cur && cur.day === day ? cur : { day, gained: 0 };

  const left = Math.max(0, dailyCap - rec.gained);
  const allowed = Math.min(req, left);
  rec.gained += allowed;
  db.prepare(
    "INSERT OR REPLACE INTO levels_daily (guild_id, user_id, day, gained) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, rec.day, rec.gained);
  return allowed;
};
