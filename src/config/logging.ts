export const getServerLogChannelId = (): string | null => {
  const id = process.env.LOG_SERVER_ID?.trim();
  return id || null;
};
