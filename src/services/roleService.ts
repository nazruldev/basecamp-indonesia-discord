import { GuildMember } from "discord.js";
import { readGameConfigFile } from "@/config/gameConfig.js";

const gameRoleMap = () =>
  Object.fromEntries(
    Object.entries(readGameConfigFile()).map(([key, val]) => [key, val.roleId])
  );

/** Satu game (kompatibel lama). */
export const assignGameRole = async (
  member: GuildMember,
  selectedGame: string
) => {
  return assignGameRoles(member, [selectedGame]);
};

/** Beberapa game: hapus semua role game config, lalu tambah semua yang dipilih. */
export const assignGameRoles = async (
  member: GuildMember,
  selectedGames: string[]
) => {
  const roleMap = gameRoleMap();
  const keys = [...new Set(selectedGames)];

  for (const k of keys) {
    if (!roleMap[k]) throw new Error("Game tidak valid");
  }

  await member.roles.remove(Object.values(roleMap));
  if (keys.length > 0) {
    const roleIds = keys.map((k) => roleMap[k]!);
    await member.roles.add(roleIds);
  }

  return keys;
};