export const getModPanelChannelId = (): string | null => {
  const id = process.env.MOD_PANEL_CHANNEL_ID?.trim();
  return id || null;
};

export const getModLogChannelId = (): string | null => {
  const id = process.env.LOG_SERVER_ID?.trim();
  return id || null;
};

export const getModAllowedRoleIds = (): Set<string> => {
  const raw = process.env.MOD_ALLOWED_ROLE_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
};
