import type { Client } from "discord.js";
import {
  buildLevelPanelEmbed,
  buildLevelPanelRows,
  levelPanelTitleKeyword,
} from "@/bot/leveling/panel.js";

export async function syncLevelPanel(
  client: Client,
  panelChannelId: string
): Promise<void> {
  const ch = await client.channels.fetch(panelChannelId).catch(() => null);
  if (!ch?.isSendable()) {
    console.error("[leveling] LEVEL_PANEL_CHANNEL_ID tidak bisa dikirimi pesan.");
    return;
  }

  const embed = buildLevelPanelEmbed();
  const rows = buildLevelPanelRows();
  const title = levelPanelTitleKeyword();

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
