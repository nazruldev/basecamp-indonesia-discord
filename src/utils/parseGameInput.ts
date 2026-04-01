import { gameConfig } from "@/config/gameConfig.js";

export type ParseGamesResult =
  | { ok: true; keys: string[] }
  | { ok: false; message: string };

/** Pisahkan dengan koma/titik koma; cocokkan ke key atau label (abaikan besar kecil). */
export const parseGamesFromUserInput = (raw: string): ParseGamesResult => {
  const tokens = raw
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.length) {
    return { ok: false, message: "Isi minimal satu game." };
  }

  const entries = Object.entries(gameConfig);
  const keys: string[] = [];

  for (const token of tokens) {
    let found: string | undefined;
    for (const [key, g] of entries) {
      if (key.toLowerCase() === token || g.label.toLowerCase() === token) {
        found = key;
        break;
      }
    }
    if (!found) {
      return {
        ok: false,
        message: `Game tidak dikenal: **${token}**. Gunakan nama atau singkatan dari daftar di placeholder.`,
      };
    }
    keys.push(found);
  }

  return { ok: true, keys: [...new Set(keys)] };
};
