import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const LV = {
  checkMe: "lv_check_me",
  checkUser: "lv_check_user",
  setLevel: "lv_set_level",
  setXp: "lv_set_xp",
  checkUserPick: "lv_check_user_pick",
} as const;

const LEVEL_PANEL_TITLE = "Panel Level";

export const levelPanelTitleKeyword = (): string => LEVEL_PANEL_TITLE;

export const buildLevelPanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(LEVEL_PANEL_TITLE)
    .setDescription(
      "Panel leveling:\n" +
        "• Cek level saya\n" +
        "• Cek level user lain\n" +
        "• Set level\n" +
        "• Set XP\n\n" +
        "Ketik `!level` / `!rank` di channel cek level jika diperlukan."
    );

export const buildLevelPanelRows = () => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(LV.checkMe)
      .setLabel("Cek Level Saya")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(LV.checkUser)
      .setLabel("Cek Level User")
      .setStyle(ButtonStyle.Secondary)
  ),
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(LV.setLevel)
      .setLabel("Set Level")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(LV.setXp)
      .setLabel("Set XP")
      .setStyle(ButtonStyle.Success)
  ),
];
