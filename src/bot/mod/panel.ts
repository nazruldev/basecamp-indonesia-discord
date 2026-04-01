import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  UserSelectMenuBuilder,
} from "discord.js";

export const MOD = {
  userPick: "mod_user_pick",
  kick: "mod_kick",
  ban: "mod_ban",
  timeout: "mod_timeout",
  nick: "mod_nick",
  unban: "mod_unban",
} as const;

const TITLE = "Panel Moderator";

export const modPanelTitleKeyword = (): string => TITLE;

export const buildModPanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(TITLE)
    .setDescription(
      "Pilih user target dulu, lalu gunakan tombol aksi.\n" +
        "Aksi sensitif (Kick/Ban/Timeout/Nickname) memerlukan permission moderator."
    );

export const buildModPanelRows = () => [
  new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(MOD.userPick)
      .setPlaceholder("Pilih user target moderator")
      .setMinValues(1)
      .setMaxValues(1)
  ),
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MOD.timeout)
      .setLabel("Timeout")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MOD.nick)
      .setLabel("Ganti Nickname")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MOD.kick)
      .setLabel("Kick")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(MOD.ban)
      .setLabel("Ban")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(MOD.unban)
      .setLabel("Unban by ID")
      .setStyle(ButtonStyle.Secondary)
  ),
];
