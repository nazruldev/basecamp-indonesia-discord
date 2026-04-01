export const getGamesPanelChannelId = (): string | null => {
  const id = process.env.GAMES_PANEL_CHANNEL_ID?.trim();
  return id || null;
};

export const getGamesAllowedRoleIds = (): Set<string> => {
  const raw = process.env.GAMES_ALLOWED_ROLE_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
};
