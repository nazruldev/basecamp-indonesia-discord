import { getLevel, xpToNextLevel } from "@/services/levelService.js";

const progressBar = (value: number, max: number, size = 14): string => {
  if (max <= 0) return "░".repeat(size);
  const ratio = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * size);
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, size - filled))}`;
};

export async function renderLevelCard(
  guildId: string,
  userId: string,
  username: string
): Promise<string> {
  const data = await getLevel(guildId, userId);
  const needed = 100 + data.level * 40;
  const left = xpToNextLevel(data.level, data.xp);
  const bar = progressBar(data.xp, needed);

  return (
    `**${username}**\n` +
    `Level: **${data.level}**\n` +
    `XP: **${data.xp}/${needed}**\n` +
    `${bar}\n` +
    `Sisa ke level berikutnya: **${left} XP**`
  );
}
