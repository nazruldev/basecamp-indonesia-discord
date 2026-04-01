import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const UP = {
  pickGame: "up_pick_game",
  checkLevel: "up_check_level",
  changeNick: "up_change_nick",
  gameSelect: "up_game_select",
  nickModal: "up_nick_modal",
  nickField: "up_nick_field",
} as const;

const TITLE = "Panel User";

export const userPanelTitleKeyword = (): string => TITLE;

export const buildUserPanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(TITLE)
    .setDescription(
      "Gunakan panel ini untuk mengatur akunmu:\n" +
        "• Pilih/Edit Game\n" +
        "• Cek Level\n" +
        "• Ganti Nickname"
    );

export const buildUserPanelRows = () => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(UP.pickGame)
      .setLabel("Pilih / Edit Game")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(UP.checkLevel)
      .setLabel("Cek Level Saya")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(UP.changeNick)
      .setLabel("Ganti Nickname")
      .setStyle(ButtonStyle.Secondary)
  ),
];
