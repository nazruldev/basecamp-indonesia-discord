import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { buildTermsEmbeds } from "@/content/termsEmbed.js";
const channelIntro =
  "Baca **kebijakan privasi & syarat** di embed di bawah. Jika setuju, kamu akan dapat **menu pilih game** (dropdown) secara pribadi, lalu form **tanggal lahir** & **nama in-game**.";

export const buildTermsChannelPayload = () => ({
  content: channelIntro,
  embeds: buildTermsEmbeds(),
  components: [buildTermsAcceptRow()],
});

export const ACCEPT_TERMS_CUSTOM_ID = "accept_terms_register";

export const buildTermsAcceptRow = () =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ACCEPT_TERMS_CUSTOM_ID)
      .setLabel("Saya setuju — buka formulir")
      .setStyle(ButtonStyle.Success)
  );
