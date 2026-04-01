import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const GP = {
  create: "gp_create_game",
  delete: "gp_delete_game",
  setup: "gp_setup_channels",
} as const;

const TITLE = "Panel Game Config";

export const gamesPanelTitleKeyword = (): string => TITLE;

export const buildGamesPanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(TITLE)
    .setDescription(
      "Kelola game config dari Discord.\n" +
        "• Create Game\n" +
        "• Edit Game\n" +
        "• Delete Game\n" +
        "• Setup Channel Game (buat category + channel default)"
    );

export const buildGamesPanelRows = () => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(GP.create)
      .setLabel("Create Game")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(GP.delete)
      .setLabel("Delete Game")
      .setStyle(ButtonStyle.Danger)
  ),
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(GP.setup)
      .setLabel("Load Template")
      .setStyle(ButtonStyle.Primary)
  ),
];
