import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type GameCfg = Record<string, { tempHubId?: string }>;

const gameConfigPath = resolve(process.cwd(), "data", "game-config.json");

const getDynamicTempHubIds = (): string[] => {
  try {
    const raw = readFileSync(gameConfigPath, "utf8");
    const parsed = JSON.parse(raw) as GameCfg;
    return Object.values(parsed)
      .map((v) => v?.tempHubId?.trim())
      .filter((v): v is string => Boolean(v));
  } catch {
    return [];
  }
};

/** ID channel voice “hub” per kategori (pisahkan koma). Hub harus sudah di dalam kategori game. */
export const getTempVoiceHubIds = (): Set<string> => {
  const raw = process.env.TEMPVOICE_HUB_IDS?.trim();
  const envIds = raw
    ? raw
        .split(/[,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const dataIds = getDynamicTempHubIds();
  return new Set([...envIds, ...dataIds]);
};

export const maxTempChannelsPerUser = (): number => {
  const n = Number(process.env.TEMPVOICE_MAX_PER_USER);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 3;
};
