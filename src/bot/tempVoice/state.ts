/** channelId → owner userId */
export const tempVoiceOwners = new Map<string, string>();

/** voice channel id → id pesan panel kontrol di channel teks */
export const tempVoicePanelMessageIds = new Map<string, string>();

export const tempVoiceCreationLocks = new Set<string>();

export const countRoomsForUser = (userId: string): number =>
  [...tempVoiceOwners.values()].filter((o) => o === userId).length;
