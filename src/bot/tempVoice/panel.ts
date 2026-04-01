import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const TV = {
  rename: "tv_rename",
  limit: "tv_limit",
  privacy: "tv_privacy",
  region: "tv_region",
  bitrate: "tv_bitrate",
  trust: "tv_trust",
  untrust: "tv_untrust",
  block: "tv_block",
  unblock: "tv_unblock",
  kick: "tv_kick",
  transfer: "tv_transfer",
  claim: "tv_claim",
  delete: "tv_delete",
} as const;

const PANEL_TITLE = "Kontrol voice sementara";

export const buildTempVoicePanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Masuk ke **voice room** hasil hub, lalu pakai tombol di sini.\n\n" +
        "Setiap kali **pemilik** masuk lagi ke room ini, bot mengirim **panel baru** (yang lama untuk room ini dihapus) supaya mudah ditemukan.\n\n" +
        "**Nama** · **Limit** · **Privacy** · **Region** · **Bitrate** · **Trust/Untrust/Block/Unblock** · **Kick** · **Transfer** · **Claim** · **Hapus**"
    );

export const panelTitleKeyword = (): string => PANEL_TITLE;

const row = (buttons: ButtonBuilder[]) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

export const buildTempVoicePanelRows = () => {
  const b = (
    id: string,
    label: string,
    style = ButtonStyle.Secondary
  ): ButtonBuilder =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

  return [
    row([
      b(TV.rename, "Nama"),
      b(TV.limit, "Limit"),
      b(TV.privacy, "Privacy"),
      b(TV.region, "Region"),
      b(TV.bitrate, "Bitrate"),
    ]),
    row([
      b(TV.trust, "Trust"),
      b(TV.untrust, "Untrust"),
      b(TV.block, "Block"),
      b(TV.unblock, "Unblock"),
      b(TV.kick, "Kick"),
    ]),
    row([
      b(TV.transfer, "Transfer"),
      b(TV.claim, "Claim"),
      b(TV.delete, "Hapus", ButtonStyle.Danger),
    ]),
  ];
};
