export const getReportPanelChannelId = (): string | null => {
  const id = process.env.REPORT_PANEL_CHANNEL_ID?.trim();
  return id || null;
};

export const getFeedbackPanelChannelId = (): string | null => {
  const id = process.env.FEEDBACK_PANEL_CHANNEL_ID?.trim();
  return id || null;
};

export const getTicketCategoryId = (): string | null => {
  const id = process.env.TICKET_CATEGORY_ID?.trim();
  return id || null;
};

export const getTicketLogChannelId = (): string | null => {
  const id = process.env.TICKET_LOG_CHANNEL_ID?.trim();
  return id || null;
};

export const getTicketStaffRoleIds = (): Set<string> => {
  const raw = process.env.TICKET_STAFF_ROLE_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
};

