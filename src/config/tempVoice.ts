import { readGameConfigFile } from "@/config/gameConfig.js";

const getDynamicTempHubIds = (): string[] => {
  try {
    const parsed = readGameConfigFile();
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
