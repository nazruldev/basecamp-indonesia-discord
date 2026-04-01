import type { Client } from "discord.js";
import {
  buildGamesPanelEmbed,
  buildGamesPanelRows,
  gamesPanelTitleKeyword,
} from "@/bot/games/panel.js";

export async function syncGamesPanel(
  client: Client,
  panelChannelId: string
): Promise<void> {
  const ch = await client.channels.fetch(panelChannelId).catch(() => null);
  if (!ch?.isSendable()) {
    console.error("[games] GAMES_PANEL_CHANNEL_ID tidak bisa dikirimi pesan.");
    return;
  }

  const embed = buildGamesPanelEmbed();
  const rows = buildGamesPanelRows();
  const title = gamesPanelTitleKeyword();
  const recent = await ch.messages.fetch({ limit: 30 });
  const existing = recent.find(
    (m) => m.author.id === client.user?.id && m.embeds[0]?.title === title
  );

  const panelMessage = existing
    ? await existing.edit({ embeds: [embed], components: rows })
    : await ch.send({ embeds: [embed], components: rows });

  if (!panelMessage.pinned) {
    await panelMessage.pin("Keep games panel accessible").catch(() => {});
  }

  const keepId = existing?.id;
  const dupes = recent.filter(
    (m) =>
      m.author.id === client.user?.id &&
      m.embeds[0]?.title === title &&
      m.id !== keepId
  );
  for (const [, msg] of dupes) await msg.delete().catch(() => {});
}
