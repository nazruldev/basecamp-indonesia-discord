const toInt = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
};

export const getLevelCheckChannelId = (): string | null => {
  const id = process.env.LEVEL_CHECK_CHANNEL_ID?.trim();
  return id || null;
};

export const getLevelPanelChannelId = (): string | null => {
  const proper = process.env.LEVEL_PANEL_CHANNEL_ID?.trim();
  if (proper) return proper;
  const typoCompat = process.env.LEVEL_PANEL_CAHNNEL_ID?.trim();
  return typoCompat || null;
};

export const getLevelUpChannelId = (): string | null => {
  const id = process.env.LEVELUP_CHANNEL_ID?.trim();
  return id || null;
};

export const getXpMinPerMessage = (): number =>
  Math.max(1, toInt(process.env.XP_MIN_PER_MESSAGE, 8));

export const getXpMaxPerMessage = (): number =>
  Math.max(getXpMinPerMessage(), toInt(process.env.XP_MAX_PER_MESSAGE, 15));

export const getXpCooldownMs = (): number =>
  Math.max(0, toInt(process.env.XP_COOLDOWN_MS, 60_000));

export const getXpDailyCap = (): number =>
  Math.max(0, toInt(process.env.XP_DAILY_CAP, 50));

export const getXpAllowedChannelIds = (): Set<string> => {
  const raw = process.env.XP_ALLOWED_CHANNEL_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
};
