import type { Client } from "discord.js";
import { getServerLogChannelId } from "@/config/logging.js";

export async function sendServerLog(client: Client, message: string): Promise<void> {
  const channelId = getServerLogChannelId();
  if (!channelId) return;
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch?.isSendable()) return;
  await ch.send(message).catch(() => {});
}
