import {
  ComponentType,
  type Client,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import { ACCEPT_TERMS_CUSTOM_ID } from "@/components/registrationChannel.js";
import { getDb } from "@/services/db.js";

const STATE_KEY = "game_menu_message_state";
const db = getDb();

type StoredMenu = { channelId: string; messageId: string };

export async function readMenuMessageState(): Promise<StoredMenu | null> {
  try {
    const row = db
      .prepare("SELECT v FROM kv_store WHERE k = ?")
      .get(STATE_KEY) as { v: string } | undefined;
    if (!row?.v) return null;
    const raw = row.v;
    const data = JSON.parse(raw) as StoredMenu;
    if (
      typeof data?.channelId === "string" &&
      typeof data?.messageId === "string"
    ) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveMenuMessageState(stored: StoredMenu): Promise<void> {
  db.prepare("INSERT OR REPLACE INTO kv_store (k, v) VALUES (?, ?)").run(
    STATE_KEY,
    JSON.stringify(stored)
  );
}

function messageIsTermsMenu(msg: Message): boolean {
  for (const row of msg.components) {
    if (row.type !== ComponentType.ActionRow) continue;
    for (const comp of row.components) {
      if ("customId" in comp && typeof comp.customId === "string") {
        if (comp.customId === ACCEPT_TERMS_CUSTOM_ID) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Hapus pesan syarat/menu lama sebelum kirim yang baru. */
export async function removePreviousGameMenuMessages(
  client: Client,
  channel: GuildTextBasedChannel,
  botUserId: string
): Promise<void> {
  const stored = await readMenuMessageState();
  if (stored) {
    try {
      const ch =
        stored.channelId === channel.id
          ? channel
          : await client.channels.fetch(stored.channelId);
      if (ch?.isTextBased() && "messages" in ch) {
        const prev = await ch.messages.fetch(stored.messageId).catch(() => null);
        await prev?.delete().catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  const recent = await channel.messages.fetch({ limit: 100 });
  for (const msg of recent.values()) {
    if (msg.author.id !== botUserId) continue;
    if (!messageIsTermsMenu(msg)) continue;
    await msg.delete().catch(() => {});
  }
}
