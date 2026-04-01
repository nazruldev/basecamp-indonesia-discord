import type { Client } from "discord.js";
import {
  buildTempVoicePanelEmbed,
  buildTempVoicePanelRows,
  panelTitleKeyword,
} from "@/bot/tempVoice/panel.js";
import {
  tempVoiceOwners,
  tempVoicePanelMessageIds,
} from "@/bot/tempVoice/state.js";

function panelChannelId(): string | undefined {
  return process.env.TEMPVOICE_PANEL_CHANNEL_ID?.trim() || undefined;
}

async function fetchPanelChannel(client: Client) {
  const panelChId = panelChannelId();
  if (!panelChId) return null;
  const ch = await client.channels.fetch(panelChId).catch(() => null);
  return ch?.isSendable() ? ch : null;
}

/** Hapus pesan panel yang tercatat untuk room ini (misalnya sebelum hapus channel voice). */
export async function clearTempVoicePanelForRoom(
  client: Client,
  voiceChannelId: string
): Promise<void> {
  tempVoicePanelMessageIds.delete(voiceChannelId);
}

/**
 * Hapus pesan panel untuk room temp lain milik user ini (kecuali room yang baru dibuat).
 * Dipanggil setelah buat channel baru dari hub supaya channel teks tidak penuh panel lama.
 */
export async function deleteOtherTempVoicePanelsForOwner(
  client: Client,
  ownerId: string,
  keepVoiceChannelId: string
): Promise<void> {
  const toClear = [...tempVoicePanelMessageIds.keys()].filter(
    (vcId) =>
      vcId !== keepVoiceChannelId && tempVoiceOwners.get(vcId) === ownerId
  );
  for (const vcId of toClear) {
    await clearTempVoicePanelForRoom(client, vcId);
  }
}

/**
 * Hapus panel lama untuk room ini, kirim panel baru (paling bawah channel).
 * Dipanggil saat pemilik masuk / kembali ke voice room sementara.
 */
export async function refreshTempVoicePanelForRoom(
  client: Client,
  voiceChannelId: string
): Promise<void> {
  const panelChId = panelChannelId();
  if (!panelChId) {
    console.warn(
      "[tempvoice] Set TEMPVOICE_PANEL_CHANNEL_ID agar panel kontrol bisa dikirim saat masuk room."
    );
    return;
  }

  const ch = await fetchPanelChannel(client);
  if (!ch) {
    console.error(
      "[tempvoice] TEMPVOICE_PANEL_CHANNEL_ID tidak bisa dikirimi pesan."
    );
    return;
  }

  const embed = buildTempVoicePanelEmbed();
  const rows = buildTempVoicePanelRows();
  const title = panelTitleKeyword();
  const recent = await ch.messages.fetch({ limit: 30 });
  const existing = recent.find(
    (m) => m.author.id === client.user?.id && m.embeds[0]?.title === title
  );

  const panelMessage = existing
    ? await existing.edit({ embeds: [embed], components: rows })
    : await ch.send({ embeds: [embed], components: rows });

  if (!panelMessage.pinned) {
    await panelMessage.pin("Keep tempvoice panel accessible").catch(() => {});
  }

  const dupes = recent.filter(
    (m) =>
      m.author.id === client.user?.id &&
      m.embeds[0]?.title === title &&
      m.id !== panelMessage.id
  );
  for (const [, msg] of dupes) {
    await msg.delete().catch(() => {});
  }

  tempVoicePanelMessageIds.set(voiceChannelId, panelMessage.id);
}
