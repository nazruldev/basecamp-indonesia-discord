import type { Client } from "discord.js";
import {
  buildModPanelEmbed,
  buildModPanelRows,
  modPanelTitleKeyword,
} from "@/bot/mod/panel.js";

export async function syncModPanel(
  client: Client,
  panelChannelId: string
): Promise<void> {
  const ch = await client.channels.fetch(panelChannelId).catch(() => null);
  if (!ch?.isSendable()) {
    console.error("[mod] MOD_PANEL_CHANNEL_ID tidak bisa dikirimi pesan.");
    return;
  }

  const embed = buildModPanelEmbed();
  const rows = buildModPanelRows();
  const title = modPanelTitleKeyword();

  const recent = await ch.messages.fetch({ limit: 30 });
  const existing = recent.find(
    (m) => m.author.id === client.user?.id && m.embeds[0]?.title === title
  );

  if (existing) {
    await existing.edit({ embeds: [embed], components: rows });
  } else {
    await ch.send({ embeds: [embed], components: rows });
  }

  const keepId = existing?.id;
  const dupes = recent.filter(
    (m) =>
      m.author.id === client.user?.id &&
      m.embeds[0]?.title === title &&
      m.id !== keepId
  );
  for (const [, msg] of dupes) {
    await msg.delete().catch(() => {});
  }
}
