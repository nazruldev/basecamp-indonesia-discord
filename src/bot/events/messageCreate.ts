import { Events, Message, PermissionFlagsBits } from "discord.js";
import {
  getLevelCheckChannelId,
  getLevelUpChannelId,
  getXpAllowedChannelIds,
  getXpDailyCap,
  getXpCooldownMs,
  getXpMaxPerMessage,
  getXpMinPerMessage,
} from "@/config/leveling.js";
import { addXp, setLevelData } from "@/services/levelService.js";
import { consumeDailyXpBudget } from "@/services/levelDailyService.js";
import { renderLevelCard } from "@/bot/leveling/view.js";

const userCooldown = new Map<string, number>();

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function handleLevelCheckCommand(message: Message): Promise<boolean> {
  const checkChannelId = getLevelCheckChannelId();
  if (!checkChannelId || message.channel.id !== checkChannelId) return false;

  const raw = message.content.trim().toLowerCase();
  if (raw !== "!level" && raw !== "!rank") return false;
  if (!message.guildId) return true;

  const text = await renderLevelCard(
    message.guildId,
    message.author.id,
    message.author.username
  );
  await message.reply(text);
  return true;
}

async function handleSetLevelCommand(message: Message): Promise<boolean> {
  const checkChannelId = getLevelCheckChannelId();
  if (!checkChannelId || message.channel.id !== checkChannelId) return false;
  if (!message.guild || !message.guildId || !message.member) return false;

  const raw = message.content.trim();
  if (!raw.toLowerCase().startsWith("!setlevel")) return false;

  const canManage = message.member.permissions.has(
    PermissionFlagsBits.ManageGuild
  );
  if (!canManage) {
    await message.reply("Kamu butuh permission **Manage Server** untuk pakai command ini.");
    return true;
  }

  const mention = message.mentions.users.first();
  const args = raw.split(/\s+/);
  const levelArg = args[2];
  const xpArg = args[3];

  if (!mention || !levelArg) {
    await message.reply("Format: `!setlevel @user <level> [xp]`");
    return true;
  }

  const level = Number(levelArg);
  const xp = xpArg ? Number(xpArg) : 0;
  if (!Number.isInteger(level) || level < 1) {
    await message.reply("Level harus angka bulat minimal 1.");
    return true;
  }
  if (!Number.isFinite(xp) || xp < 0) {
    await message.reply("XP harus angka >= 0.");
    return true;
  }

  const updated = await setLevelData(message.guildId, mention.id, level, xp);
  await message.reply(
    `✅ Level ${mention} di-set ke **${updated.level}** dengan XP **${updated.xp}**.`
  );
  return true;
}

async function tryGiveXp(message: Message): Promise<void> {
  if (!message.guildId) return;
  if (message.author.bot) return;
  if (!message.inGuild()) return;
  if (!message.channel.isTextBased()) return;
  const allowedChannelIds = getXpAllowedChannelIds();
  if (allowedChannelIds.size > 0 && !allowedChannelIds.has(message.channel.id)) {
    return;
  }

  const cooldown = getXpCooldownMs();
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const last = userCooldown.get(key) ?? 0;
  if (now - last < cooldown) return;
  userCooldown.set(key, now);

  const gain = randomInt(getXpMinPerMessage(), getXpMaxPerMessage());
  const allowed = await consumeDailyXpBudget(
    message.guildId,
    message.author.id,
    gain,
    getXpDailyCap()
  );
  if (allowed <= 0) return;

  const result = await addXp(message.guildId, message.author.id, allowed);
  if (!result.leveledUp) return;

  const levelUpChannelId = getLevelUpChannelId();
  if (!levelUpChannelId) return;

  const ch = await message.client.channels.fetch(levelUpChannelId).catch(() => null);
  if (!ch?.isSendable()) return;

  await ch.send(
    `🎉 ${message.author} naik ke **Level ${result.after.level}**! Keep going!`
  );
}

export default async (message: Message) => {
  if (message.author.bot) return;

  const adminHandled = await handleSetLevelCommand(message);
  if (adminHandled) return;

  const handled = await handleLevelCheckCommand(message);
  if (handled) return;

  await tryGiveXp(message);
};

export const messageCreateEvent = Events.MessageCreate;
