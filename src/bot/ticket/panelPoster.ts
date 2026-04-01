import type { Client } from "discord.js";
import {
  buildFeedbackPanelEmbed,
  buildFeedbackPanelRows,
  buildReportPanelEmbed,
  buildReportPanelRows,
  feedbackPanelTitleKeyword,
  reportPanelTitleKeyword,
} from "@/bot/ticket/panel.js";

async function syncSinglePanel(
  client: Client,
  channelId: string,
  title: string,
  mode: "report" | "feedback"
): Promise<void> {
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch?.isSendable()) return;

  const embed = mode === "report" ? buildReportPanelEmbed() : buildFeedbackPanelEmbed();
  const rows = mode === "report" ? buildReportPanelRows() : buildFeedbackPanelRows();

  const recent = await ch.messages.fetch({ limit: 30 });
  const existing = recent.find(
    (m) => m.author.id === client.user?.id && m.embeds[0]?.title === title
  );

  const panelMessage = existing
    ? await existing.edit({ embeds: [embed], components: rows })
    : await ch.send({ embeds: [embed], components: rows });

  if (!panelMessage.pinned) {
    await panelMessage.pin("Keep ticket panel accessible").catch(() => {});
  }

  const keepId = panelMessage.id;
  const dupes = recent.filter(
    (m) =>
      m.author.id === client.user?.id &&
      m.embeds[0]?.title === title &&
      m.id !== keepId
  );
  for (const [, msg] of dupes) await msg.delete().catch(() => {});
}

export async function syncReportPanel(client: Client, channelId: string): Promise<void> {
  await syncSinglePanel(client, channelId, reportPanelTitleKeyword(), "report");
}

export async function syncFeedbackPanel(client: Client, channelId: string): Promise<void> {
  await syncSinglePanel(client, channelId, feedbackPanelTitleKeyword(), "feedback");
}

