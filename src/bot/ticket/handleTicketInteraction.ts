import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
  type Interaction,
  type OverwriteResolvable,
} from "discord.js";
import {
  TICKET,
  buildCloseTicketRows,
} from "@/bot/ticket/panel.js";
import {
  getFeedbackPanelChannelId,
  getReportPanelChannelId,
  getTicketCategoryId,
  getTicketLogChannelId,
  getTicketStaffRoleIds,
} from "@/config/ticket.js";
import { sendServerLog } from "@/services/serverLogService.js";

const REPLY_TTL_MS = Math.max(1000, Number(process.env.REPLY_TTL_MS ?? "6000"));
const MARK_REPORT = "[ticket:report]";
const MARK_FEEDBACK = "[ticket:feedback]";

const scheduleDeleteReply = (interaction: Interaction): void => {
  if (!("deleteReply" in interaction)) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, REPLY_TTL_MS);
};

async function sendTicketLog(interaction: Interaction, message: string): Promise<void> {
  await sendServerLog(interaction.client, message);

  const ticketLogId = getTicketLogChannelId();
  if (ticketLogId) {
    const ch = await interaction.client.channels.fetch(ticketLogId).catch(() => null);
    if (ch?.isSendable()) await ch.send(message).catch(() => {});
  }
}

function canAccessTicket(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const staffIds = getTicketStaffRoleIds();
  if (staffIds.size === 0) return false;
  return member.roles.cache.some((r) => staffIds.has(r.id));
}

function safeName(input: string): string {
  const normalized = input.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(0, 40) || "user";
}

async function findExistingTicket(
  interaction: Interaction,
  userId: string,
  marker: string
): Promise<TextChannel | null> {
  if (!interaction.inGuild() || !interaction.guild) return null;
  const channels = await interaction.guild.channels.fetch();
  for (const [, channel] of channels) {
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    if (!channel.topic) continue;
    if (!channel.topic.includes(`owner:${userId}`)) continue;
    if (!channel.topic.includes(marker)) continue;
    return channel;
  }
  return null;
}

async function createTicketChannel(
  interaction: Interaction,
  kind: "report" | "feedback",
  owner: GuildMember,
  details: string
): Promise<TextChannel | null> {
  if (!interaction.inGuild() || !interaction.guild) return null;
  const guild = interaction.guild;
  const marker = kind === "report" ? MARK_REPORT : MARK_FEEDBACK;
  const existing = await findExistingTicket(interaction, owner.id, marker);
  if (existing) return existing;

  const staffRoleIds = getTicketStaffRoleIds();
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: owner.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];
  for (const roleId of staffRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const categoryId = getTicketCategoryId();
  const createOptions: {
    name: string;
    type: ChannelType.GuildText;
    topic: string;
    permissionOverwrites: OverwriteResolvable[];
    reason: string;
    parent?: string;
  } = {
    name: `${kind}-${safeName(owner.displayName)}`,
    type: ChannelType.GuildText,
    topic: `${marker} owner:${owner.id}`,
    permissionOverwrites: overwrites,
    reason: `Create ${kind} ticket by ${owner.user.tag}`,
  };
  if (categoryId) createOptions.parent = categoryId;

  const channel = await guild.channels
    .create(createOptions)
    .catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;

  await channel.send({
    content:
      `🎫 Ticket ${kind === "report" ? "report user" : "feedback"} dari ${owner}\n\n` +
      `${details}\n\n` +
      "Staff/pembuat bisa tekan tombol untuk menutup ticket.",
    components: buildCloseTicketRows(),
  });
  return channel;
}

export async function handleTicketInteraction(interaction: Interaction): Promise<boolean> {
  const reportPanelId = getReportPanelChannelId();
  const feedbackPanelId = getFeedbackPanelChannelId();

  if (interaction.isButton()) {
    if (interaction.customId === TICKET.openReport) {
      if (!reportPanelId || interaction.channelId !== reportPanelId) return true;
      const modal = new ModalBuilder().setCustomId(TICKET.reportModal).setTitle("Report User");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(TICKET.reportUserId)
            .setLabel("User ID / @mention target")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(TICKET.reportReason)
            .setLabel("Alasan report")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(TICKET.reportProof)
            .setLabel("Bukti (opsional: link/screenshot)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(500)
        )
      );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === TICKET.openFeedback) {
      if (!feedbackPanelId || interaction.channelId !== feedbackPanelId) return true;
      const modal = new ModalBuilder()
        .setCustomId(TICKET.feedbackModal)
        .setTitle("Feedback Server");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(TICKET.feedbackCategory)
            .setLabel("Kategori (saran/bug/event/staff/dll)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(TICKET.feedbackText)
            .setLabel("Isi feedback")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1500)
        )
      );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === TICKET.close) {
      if (!interaction.inGuild() || !interaction.guild) return true;
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) return true;
      const member = interaction.member as GuildMember;
      const channel = interaction.channel;
      const ownerMatch = channel.topic?.match(/owner:(\d{17,20})/);
      const ownerId = ownerMatch?.[1] ?? null;
      const isOwner = ownerId === member.id;
      if (!isOwner && !canAccessTicket(member)) {
        await interaction.reply({
          content: "Kamu tidak punya izin menutup ticket ini.",
          flags: MessageFlags.Ephemeral,
        });
        scheduleDeleteReply(interaction);
        return true;
      }
      await interaction.reply({
        content: "✅ Ticket akan ditutup dalam 3 detik.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      await sendTicketLog(
        interaction,
        `🧾 Ticket ditutup | channel: #${channel.name} | oleh: ${interaction.user}`
      );
      setTimeout(() => {
        channel.delete("Ticket closed from panel").catch(() => {});
      }, 3000);
      return true;
    }
  }

  if (!interaction.isModalSubmit()) return false;

  if (interaction.customId === TICKET.reportModal) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild() || !interaction.guild) return true;
    const owner = interaction.member as GuildMember;

    const rawTarget = interaction.fields.getTextInputValue(TICKET.reportUserId).trim();
    const targetId = rawTarget.replace(/[<@!>]/g, "");
    const reason = interaction.fields.getTextInputValue(TICKET.reportReason).trim();
    const proof = interaction.fields.getTextInputValue(TICKET.reportProof).trim();
    const content =
      `• Pelapor: ${interaction.user}\n` +
      `• Target: ${/^\d{17,20}$/.test(targetId) ? `<@${targetId}> (\`${targetId}\`)` : rawTarget}\n` +
      `• Alasan: ${reason}\n` +
      `• Bukti: ${proof || "-"}`;

    const ticket = await createTicketChannel(interaction, "report", owner, content);
    if (!ticket) {
      await interaction.editReply("Gagal membuat ticket report. Cek permission bot/category.");
      scheduleDeleteReply(interaction);
      return true;
    }
    await interaction.editReply(`✅ Ticket report tersedia di ${ticket}.`);
    scheduleDeleteReply(interaction);
    await sendTicketLog(
      interaction,
      `🚨 Ticket report dibuat | user: ${interaction.user} | channel: ${ticket}`
    );
    return true;
  }

  if (interaction.customId === TICKET.feedbackModal) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild() || !interaction.guild) return true;
    const owner = interaction.member as GuildMember;

    const category = interaction.fields.getTextInputValue(TICKET.feedbackCategory).trim();
    const text = interaction.fields.getTextInputValue(TICKET.feedbackText).trim();
    const content =
      `• Pengirim: ${interaction.user}\n` +
      `• Kategori: ${category}\n` +
      `• Feedback: ${text}`;

    const ticket = await createTicketChannel(interaction, "feedback", owner, content);
    if (!ticket) {
      await interaction.editReply("Gagal membuat ticket feedback. Cek permission bot/category.");
      scheduleDeleteReply(interaction);
      return true;
    }
    await interaction.editReply(`✅ Ticket feedback tersedia di ${ticket}.`);
    scheduleDeleteReply(interaction);
    await sendTicketLog(
      interaction,
      `💡 Ticket feedback dibuat | user: ${interaction.user} | channel: ${ticket}`
    );
    return true;
  }

  return false;
}

