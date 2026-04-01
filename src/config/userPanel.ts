export const getUserPanelChannelId = (): string | null => {
  const id = process.env.USER_PANEL_CHANNEL_ID?.trim();
  return id || null;
};

export const getDefaultGuestRoleId = (): string => {
  return process.env.DEFAULT_GUEST_ROLE_ID?.trim() || "1488751521368641608";
};
