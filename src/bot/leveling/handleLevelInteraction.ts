import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type Interaction,
} from "discord.js";
import { LV } from "@/bot/leveling/panel.js";
import { getLevelPanelChannelId } from "@/config/leveling.js";
import { renderLevelCard } from "@/bot/leveling/view.js";
import { setLevelData, setXpData } from "@/services/levelService.js";

const SET_LEVEL_MODAL = "lv_set_level_modal";
const SET_XP_MODAL = "lv_set_xp_modal";
const FIELD_USER_ID = "lv_user_id";
const FIELD_LEVEL = "lv_level";
const FIELD_XP = "lv_xp";

const LEVEL_PANEL_REPLY_TTL_MS = Math.max(
  1000,
  Number(process.env.REPLY_TTL_MS ?? "6000")
);

const scheduleDeleteReply = (interaction: Interaction): void => {
  if (!("deleteReply" in interaction)) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, LEVEL_PANEL_REPLY_TTL_MS);
};

export async function handleLevelInteraction(
  interaction: Interaction
): Promise<boolean> {
  const panelChannelId = getLevelPanelChannelId();

  if (interaction.isUserSelectMenu() && interaction.customId === LV.checkUserPick) {
    if (!interaction.guildId) return true;
    const targetId = interaction.values[0];
    if (!targetId) {
      await interaction.reply({ content: "User tidak valid.", flags: MessageFlags.Ephemeral });
      scheduleDeleteReply(interaction);
      return true;
    }
    const member = await interaction.guild?.members.fetch(targetId).catch(() => null);
    const username = member?.user.username ?? "Unknown User";
    const text = await renderLevelCard(interaction.guildId, targetId, username);
    await interaction.update({ content: text, components: [] });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId !== SET_LEVEL_MODAL && interaction.customId !== SET_XP_MODAL) {
      return false;
    }
    if (!interaction.guildId) return true;

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!isAdmin) {
      await interaction.reply({
        content: "Butuh permission **Manage Server** untuk aksi ini.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      return true;
    }

    const userId = interaction.fields.getTextInputValue(FIELD_USER_ID).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({
        content: "User ID tidak valid.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      return true;
    }

    if (interaction.customId === SET_LEVEL_MODAL) {
      const levelRaw = interaction.fields.getTextInputValue(FIELD_LEVEL).trim();
      const xpRaw = interaction.fields.getTextInputValue(FIELD_XP).trim();
      const level = Number(levelRaw);
      const xp = Number(xpRaw || "0");
      if (!Number.isInteger(level) || level < 1 || !Number.isFinite(xp) || xp < 0) {
        await interaction.reply({
          content: "Input tidak valid. Level minimal 1, XP minimal 0.",
          flags: MessageFlags.Ephemeral,
        });
        scheduleDeleteReply(interaction);
        return true;
      }
      const next = await setLevelData(interaction.guildId, userId, level, xp);
      await interaction.reply({
        content: `✅ User \`${userId}\` di-set ke level **${next.level}** XP **${next.xp}**.`,
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      return true;
    }

    const xpRaw = interaction.fields.getTextInputValue(FIELD_XP).trim();
    const xp = Number(xpRaw);
    if (!Number.isFinite(xp) || xp < 0) {
      await interaction.reply({
        content: "XP harus angka >= 0.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      return true;
    }
    const next = await setXpData(interaction.guildId, userId, xp);
    await interaction.reply({
      content: `✅ XP user \`${userId}\` di-set ke **${next.xp}** (level **${next.level}**).`,
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (!interaction.isButton()) return false;
  const buttonIds = new Set<string>([
    LV.checkMe,
    LV.checkUser,
    LV.setLevel,
    LV.setXp,
  ]);
  if (!buttonIds.has(interaction.customId)) {
    return false;
  }

  if (!panelChannelId || interaction.channelId !== panelChannelId) {
    await interaction.reply({
      content: "Panel ini bukan di channel panel leveling yang aktif.",
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: "Gunakan panel ini di server.",
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (interaction.customId === LV.checkMe) {
    const text = await renderLevelCard(
      interaction.guildId,
      interaction.user.id,
      interaction.user.username
    );
    await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (interaction.customId === LV.checkUser) {
    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(LV.checkUserPick)
        .setPlaceholder("Pilih user untuk dicek")
        .setMinValues(1)
        .setMaxValues(1)
    );
    await interaction.reply({
      content: "Pilih user yang ingin dicek level-nya.",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isAdmin) {
    await interaction.reply({
      content: "Butuh permission **Manage Server** untuk aksi ini.",
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (interaction.customId === LV.setLevel) {
    const modal = new ModalBuilder().setCustomId(SET_LEVEL_MODAL).setTitle("Set Level User");
    const userIdInput = new TextInputBuilder()
      .setCustomId(FIELD_USER_ID)
      .setLabel("User ID")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Contoh: 123456789012345678");
    const levelInput = new TextInputBuilder()
      .setCustomId(FIELD_LEVEL)
      .setLabel("Level")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Contoh: 10");
    const xpInput = new TextInputBuilder()
      .setCustomId(FIELD_XP)
      .setLabel("XP di level ini (opsional, default 0)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("Contoh: 50");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(levelInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(xpInput)
    );
    await interaction.showModal(modal);
    return true;
  }

  const modal = new ModalBuilder().setCustomId(SET_XP_MODAL).setTitle("Set XP User");
  const userIdInput = new TextInputBuilder()
    .setCustomId(FIELD_USER_ID)
    .setLabel("User ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Contoh: 123456789012345678");
  const xpInput = new TextInputBuilder()
    .setCustomId(FIELD_XP)
    .setLabel("XP")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Contoh: 80");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(xpInput)
  );
  await interaction.showModal(modal);
  return true;
}
