import type { Client } from "discord.js";
import {
  buildUserPanelEmbed,
  buildUserPanelRows,
  userPanelTitleKeyword,
} from "@/bot/user/panel.js";

export async function syncUserPanel(
  client: Client,
  panelChannelId: string
): Promise<void> {
  const ch = await client.channels.fetch(panelChannelId).catch(() => null);
  if (!ch?.isSendable()) {
    console.error("[user-panel] USER_PANEL_CHANNEL_ID tidak bisa dikirimi pesan.");
    return;
  }

  const embed = buildUserPanelEmbed();
  const rows = buildUserPanelRows();
  const title = userPanelTitleKeyword();
  const recent = await ch.messages.fetch({ limit: 30 });
  const existing = recent.find(
    (m) => m.author.id === client.user?.id && m.embeds[0]?.title === title
  );

  const panelMessage = existing
    ? await existing.edit({ embeds: [embed], components: rows })
    : await ch.send({ embeds: [embed], components: rows });

  if (!panelMessage.pinned) {
    await panelMessage.pin("Keep user panel accessible").catch(() => {});
  }

  const dupes = recent.filter(
    (m) =>
      m.author.id === client.user?.id &&
      m.embeds[0]?.title === title &&
      m.id !== panelMessage.id
  );
  for (const [, msg] of dupes) await msg.delete().catch(() => {});
}
