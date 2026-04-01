import { DiscordAPIError } from "@discordjs/rest";
import { Client, Events, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import interactionCreate from "@/bot/events/interactionCreate.js";
import messageCreate from "@/bot/events/messageCreate.js";
import voiceStateUpdate from "@/bot/events/voiceStateUpdate.js";
import { syncGamesPanel } from "@/bot/games/panelPoster.js";
import { syncLevelPanel } from "@/bot/leveling/panelPoster.js";
import { syncModPanel } from "@/bot/mod/panelPoster.js";
import { syncFeedbackPanel, syncReportPanel } from "@/bot/ticket/panelPoster.js";
import { syncUserPanel } from "@/bot/user/panelPoster.js";
import { removePreviousGameMenuMessages, saveMenuMessageState } from "@/bot/menuMessageCleanup.js";
import {
  getLevelCheckChannelId,
  getLevelPanelChannelId,
  getLevelUpChannelId,
  getXpAllowedChannelIds,
  getXpDailyCap,
} from "@/config/leveling.js";
import {
  getGamesAllowedRoleIds,
  getGamesPanelChannelId,
} from "@/config/gamesPanel.js";
import { getModAllowedRoleIds, getModPanelChannelId } from "@/config/modPanel.js";
import { getTempVoiceHubIds } from "@/config/tempVoice.js";
import {
  getFeedbackPanelChannelId,
  getReportPanelChannelId,
  getTicketCategoryId,
} from "@/config/ticket.js";
import { getUserPanelChannelId } from "@/config/userPanel.js";

dotenv.config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("interactionCreate", interactionCreate);
client.on("voiceStateUpdate", voiceStateUpdate);
client.on("messageCreate", messageCreate);

export const startBot = async () => {
  await client.login(process.env.DISCORD_TOKEN);
};

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Bot ready: ${c.user.tag}`);

  const hubs = getTempVoiceHubIds();
  if (hubs.size === 0) {
    console.warn(
      "[tempvoice] Set TEMPVOICE_HUB_IDS (ID channel voice hub, pisah koma) untuk mengaktifkan room sementara."
    );
  }

  const panelCh = process.env.TEMPVOICE_PANEL_CHANNEL_ID?.trim();
  if (!panelCh) {
    console.warn(
      "[tempvoice] Set TEMPVOICE_PANEL_CHANNEL_ID — panel dikirim saat pemilik masuk / kembali ke room temp."
    );
  }

  if (!getLevelCheckChannelId()) {
    console.warn(
      "[leveling] Set LEVEL_CHECK_CHANNEL_ID untuk channel cek level (!level / !rank)."
    );
  }
  if (!getLevelPanelChannelId()) {
    console.warn(
      "[leveling] Set LEVEL_PANEL_CHANNEL_ID (atau LEVEL_PANEL_CAHNNEL_ID) untuk panel tombol leveling."
    );
  }
  if (!getLevelUpChannelId()) {
    console.warn(
      "[leveling] Set LEVELUP_CHANNEL_ID untuk notifikasi naik level."
    );
  }
  if (getXpAllowedChannelIds().size === 0) {
    console.warn(
      "[leveling] XP_ALLOWED_CHANNEL_IDS kosong: XP akan dihitung dari semua channel teks."
    );
  }
  console.info(`[leveling] Batas XP harian per user: ${getXpDailyCap()}`);

  const levelPanelChannel = getLevelPanelChannelId();
  if (levelPanelChannel) {
    await syncLevelPanel(c, levelPanelChannel).catch((e) =>
      console.error("[leveling] Gagal memasang panel level:", e)
    );
  }

  const modPanelChannel = getModPanelChannelId();
  if (!modPanelChannel) {
    console.warn("[mod] Set MOD_PANEL_CHANNEL_ID untuk panel moderator.");
  }
  if (getModAllowedRoleIds().size === 0) {
    console.warn(
      "[mod] MOD_ALLOWED_ROLE_IDS kosong. Hanya user dengan Manage Server yang dapat akses panel moderator."
    );
  }
  if (modPanelChannel) {
    await syncModPanel(c, modPanelChannel).catch((e) =>
      console.error("[mod] Gagal memasang panel moderator:", e)
    );
  }

  const gamesPanelChannel = getGamesPanelChannelId();
  if (!gamesPanelChannel) {
    console.warn("[games] Set GAMES_PANEL_CHANNEL_ID untuk panel game config.");
  }
  if (getGamesAllowedRoleIds().size === 0) {
    console.warn(
      "[games] GAMES_ALLOWED_ROLE_IDS kosong. Hanya user dengan Manage Server yang bisa pakai panel game."
    );
  }
  if (gamesPanelChannel) {
    await syncGamesPanel(c, gamesPanelChannel).catch((e) =>
      console.error("[games] Gagal memasang panel game:", e)
    );
  }

  const userPanelChannel = getUserPanelChannelId();
  if (!userPanelChannel) {
    console.warn("[user-panel] Set USER_PANEL_CHANNEL_ID untuk panel user.");
  } else {
    await syncUserPanel(c, userPanelChannel).catch((e) =>
      console.error("[user-panel] Gagal memasang panel user:", e)
    );
  }

  const reportPanelChannel = getReportPanelChannelId();
  const feedbackPanelChannel = getFeedbackPanelChannelId();
  const ticketCategoryId = getTicketCategoryId();
  if (!reportPanelChannel) {
    console.warn("[ticket] Set REPORT_PANEL_CHANNEL_ID untuk panel report.");
  } else {
    await syncReportPanel(c, reportPanelChannel).catch((e) =>
      console.error("[ticket] Gagal memasang panel report:", e)
    );
  }
  if (!feedbackPanelChannel) {
    console.warn("[ticket] Set FEEDBACK_PANEL_CHANNEL_ID untuk panel feedback.");
  } else {
    await syncFeedbackPanel(c, feedbackPanelChannel).catch((e) =>
      console.error("[ticket] Gagal memasang panel feedback:", e)
    );
  }
  if (!ticketCategoryId) {
    console.warn(
      "[ticket] Set TICKET_CATEGORY_ID untuk parent category ticket report/feedback."
    );
  }

  const menuChannelId = process.env.DISCORD_MENU_CHANNEL_ID?.trim();
  if (!menuChannelId) {
    console.warn(
      "Set DISCORD_MENU_CHANNEL_ID in .env to post the registration message."
    );
    return;
  }

  try {
    const guildId = process.env.GUILD_ID;
    let channel;

    if (guildId) {
      const guild = await c.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        console.error(
          "[Game menu] GUILD_ID tidak valid atau bot belum di-invite ke server itu. Sesuaikan GUILD_ID (Copy Server ID) dan invite bot."
        );
        return;
      }
      try {
        channel = await guild.channels.fetch(menuChannelId);
      } catch (inner: unknown) {
        if (inner instanceof DiscordAPIError && inner.code === 10_003) {
          console.error(
            "[Game menu] Channel ID tidak ada di server GUILD_ID ini. Salin DISCORD_MENU_CHANNEL_ID dari channel di server yang sama dengan GUILD_ID."
          );
          return;
        }
        throw inner;
      }
    } else {
      channel = await c.channels.fetch(menuChannelId);
    }

    if (!channel) return;
    if (!channel.isSendable()) return;
    if (!("guild" in channel) || !channel.guild) return;

    const { buildTermsChannelPayload } = await import(
      "@/components/registrationChannel.js"
    );

    await removePreviousGameMenuMessages(c, channel, c.user.id);

    const sent = await channel.send(buildTermsChannelPayload());

    await saveMenuMessageState({
      channelId: channel.id,
      messageId: sent.id,
    });
  } catch (err: unknown) {
    console.error(
      "\n[Game menu] Ready = bot terhubung ke Discord. 50001 Missing Access = REST API menolak akses ke channel itu (bukan bug startup).\n" +
        "Cek: bot di-invite ke server channel tersebut, DISCORD_MENU_CHANNEL_ID benar (Developer Mode → Copy Channel ID), role bot punya View Channel + Send Messages.\n"
    );
    if (err instanceof DiscordAPIError && err.code === 50001) {
      const list = c.guilds.cache.map((g) => `${g.name} (${g.id})`);
      console.info(
        list.length > 0
          ? `Server yang bot ikut: ${list.join(" | ")}`
          : "Bot belum tergabung di guild manapun."
      );
    }
    console.error(err);
  }
});