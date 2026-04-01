import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const TICKET = {
  openReport: "ticket_open_report",
  openFeedback: "ticket_open_feedback",
  close: "ticket_close",
  reportModal: "ticket_modal_report",
  feedbackModal: "ticket_modal_feedback",
  reportUserId: "ticket_report_user_id",
  reportReason: "ticket_report_reason",
  reportProof: "ticket_report_proof",
  feedbackCategory: "ticket_feedback_category",
  feedbackText: "ticket_feedback_text",
} as const;

const REPORT_TITLE = "Panel Report User";
const FEEDBACK_TITLE = "Panel Feedback Server";

export const reportPanelTitleKeyword = (): string => REPORT_TITLE;
export const feedbackPanelTitleKeyword = (): string => FEEDBACK_TITLE;

export const buildReportPanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(REPORT_TITLE)
    .setDescription(
      "Klik tombol di bawah untuk membuat ticket report user.\n" +
        "Gunakan fitur ini hanya untuk laporan yang valid."
    );

export const buildFeedbackPanelEmbed = () =>
  new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(FEEDBACK_TITLE)
    .setDescription(
      "Klik tombol di bawah untuk mengirim feedback server.\n" +
        "Masukan kamu membantu perbaikan komunitas."
    );

export const buildReportPanelRows = () => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET.openReport)
      .setLabel("Buat Report User")
      .setStyle(ButtonStyle.Danger)
  ),
];

export const buildFeedbackPanelRows = () => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET.openFeedback)
      .setLabel("Kirim Feedback")
      .setStyle(ButtonStyle.Success)
  ),
];

export const buildCloseTicketRows = () => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET.close)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Secondary)
  ),
];

