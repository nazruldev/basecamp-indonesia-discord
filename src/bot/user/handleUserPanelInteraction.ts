import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
  type Interaction,
} from "discord.js";
import { UP } from "@/bot/user/panel.js";
import { readGameConfigFile } from "@/config/gameConfig.js";
import { getDefaultGuestRoleId, getUserPanelChannelId } from "@/config/userPanel.js";
import { assignGameRoles } from "@/services/roleService.js";
import { renderLevelCard } from "@/bot/leveling/view.js";

const activeGamePromptByUser = new Map<string, string>();
const USER_PANEL_DISMISS_MS = Math.max(
  1000,
  Number(process.env.REPLY_TTL_MS ?? "6000")
);

async function clearActiveGamePrompt(interaction: Interaction): Promise<void> {
  const prevId = activeGamePromptByUser.get(interaction.user.id);
  if (!prevId) return;
  if ("webhook" in interaction) {
    await interaction.webhook.deleteMessage(prevId).catch(() => {});
  }
  activeGamePromptByUser.delete(interaction.user.id);
}

function scheduleDismissCurrentReply(interaction: Interaction): void {
  if (!("deleteReply" in interaction)) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, USER_PANEL_DISMISS_MS);
}

export async function handleUserPanelInteraction(interaction: Interaction): Promise<boolean> {
  const panelChannelId = getUserPanelChannelId();
  if (!panelChannelId) return false;

  if (interaction.isStringSelectMenu() && interaction.customId === UP.gameSelect) {
    if (!interaction.inGuild() || !interaction.guildId || !interaction.guild) return true;
    await interaction.deferUpdate().catch(() => {});
    const member = interaction.member as GuildMember;
    const cfg = readGameConfigFile();
    const keys = [...new Set(interaction.values)];
    for (const k of keys) {
      if (!cfg[k]) {
        await interaction.followUp({
          content: "Pilihan game tidak valid.",
          flags: MessageFlags.Ephemeral,
        });
        scheduleDismissCurrentReply(interaction);
        return true;
      }
    }

    let failed = false;
    await assignGameRoles(member, keys).catch(async () => {
      failed = true;
      await interaction.followUp({
        content: "Gagal update role game. Cek izin Manage Roles.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDismissCurrentReply(interaction);
    });
    if (!failed) {
      const guestRole = getDefaultGuestRoleId();
      if (guestRole) await member.roles.add(guestRole).catch(() => {});

      // Sinkronkan akses category per-user agar sesuai checklist game.
      // Selected => allow, unselected => deny (supaya tidak nyangkut akses lama).
      for (const [gameKey, game] of Object.entries(cfg)) {
        if (!game.categoryId) continue;
        const category = await interaction.guild.channels.fetch(game.categoryId).catch(() => null);
        if (!category || category.type !== 4) continue; // GuildCategory

        const selected = keys.includes(gameKey);
        await category.permissionOverwrites
          .edit(member.id, selected ? { ViewChannel: true, Connect: true } : { ViewChannel: false, Connect: false })
          .catch(() => {});
      }

      await interaction.followUp({
        content: `✅ Game kamu sudah diupdate: ${keys
          .map((k) => cfg[k]?.label ?? k)
          .join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      activeGamePromptByUser.delete(interaction.user.id);
      scheduleDismissCurrentReply(interaction);
    }
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === UP.nickModal) {
    if (!interaction.inGuild() || !interaction.guild) return true;
    const member = interaction.member as GuildMember;
    const nick = interaction.fields.getTextInputValue(UP.nickField).trim();
    if (nick.length < 2) {
      await interaction.reply({
        content: "Nickname minimal 2 karakter.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    await member.setNickname(nick.slice(0, 32), "User panel change nickname").catch(async () => {
      await interaction.reply({
        content: "Gagal ganti nickname. Cek izin bot/hierarki role.",
        flags: MessageFlags.Ephemeral,
      });
    });
    if (!interaction.replied) {
      await interaction.reply({
        content: `✅ Nickname diubah jadi \`${nick.slice(0, 32)}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      const dashboardChannelId = process.env.DASHBOARD_CHANNEL_ID?.trim();
      if (dashboardChannelId && interaction.guild) {
        const dash = await interaction.client.channels.fetch(dashboardChannelId).catch(() => null);
        if (dash?.isSendable()) {
          await dash
            .send(
              `📝 User update nickname\n` +
                `• User: ${interaction.user}\n` +
                `• Nickname baru: **${nick.slice(0, 32)}**`
            )
            .catch(() => {});
        }
      }
    }
    return true;
  }

  if (!interaction.isButton()) return false;
  const ids = new Set<string>([UP.pickGame, UP.checkLevel, UP.changeNick]);
  if (!ids.has(interaction.customId)) return false;
  if (interaction.channelId !== panelChannelId) return true;
  if (!interaction.inGuild() || !interaction.guildId) return true;
  const member = interaction.member as GuildMember;

  if (interaction.customId !== UP.pickGame) {
    await clearActiveGamePrompt(interaction);
  }

  if (interaction.customId === UP.pickGame) {
    const cfg = readGameConfigFile();
    const entries = Object.entries(cfg);
    if (entries.length === 0) {
      await interaction.reply({
        content: "Belum ada game terdaftar.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(UP.gameSelect)
        .setPlaceholder("Pilih satu atau lebih game")
        .setMinValues(1)
        .setMaxValues(Math.min(entries.length, 25))
        .addOptions(
          entries.map(([k, v]) => ({
            label: v.label,
            value: k,
            default: member.roles.cache.has(v.roleId),
          }))
        )
    );
    await interaction.reply({
      content: "Pilih game yang kamu mainkan.",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    const reply = await interaction.fetchReply().catch(() => null);
    if (reply) activeGamePromptByUser.set(interaction.user.id, reply.id);
    return true;
  }

  if (interaction.customId === UP.checkLevel) {
    const text = await renderLevelCard(
      interaction.guildId,
      interaction.user.id,
      interaction.user.username
    );
    await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    return true;
  }

  const input = new TextInputBuilder()
    .setCustomId(UP.nickField)
    .setLabel("Nickname baru")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);
  const modal = new ModalBuilder()
    .setCustomId(UP.nickModal)
    .setTitle("Ganti Nickname")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
  return true;
}
