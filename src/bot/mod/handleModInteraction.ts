import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
  type Interaction,
} from "discord.js";
import { MOD } from "@/bot/mod/panel.js";
import { modSelectedTarget } from "@/bot/mod/state.js";
import {
  getModAllowedRoleIds,
  getModLogChannelId,
  getModPanelChannelId,
} from "@/config/modPanel.js";
import { sendServerLog } from "@/services/serverLogService.js";

const MODAL_KICK = "mod_modal_kick";
const MODAL_BAN = "mod_modal_ban";
const MODAL_TIMEOUT = "mod_modal_timeout";
const MODAL_NICK = "mod_modal_nick";
const MODAL_UNBAN = "mod_modal_unban";

const FIELD_REASON = "mod_reason";
const FIELD_TIMEOUT_MINUTES = "mod_timeout_minutes";
const FIELD_NICKNAME = "mod_nickname";
const FIELD_BAN_DELETE_DAYS = "mod_ban_delete_days";
const FIELD_USER_ID = "mod_user_id";

const MOD_PANEL_REPLY_TTL_MS = Math.max(
  1000,
  Number(process.env.REPLY_TTL_MS ?? "6000")
);

const scheduleDeleteReply = (interaction: Interaction): void => {
  if (!("deleteReply" in interaction)) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, MOD_PANEL_REPLY_TTL_MS);
};

function hasModAccess(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const allowedRoles = getModAllowedRoleIds();
  if (allowedRoles.size === 0) return false;
  return member.roles.cache.some((r) => allowedRoles.has(r.id));
}

async function logModAction(
  interaction: Interaction,
  action: string,
  targetUserId: string,
  reason: string
): Promise<void> {
  if (!interaction.guild) return;
  const logChannelId = getModLogChannelId();
  const msg = `🛡️ **${action}** | mod: ${interaction.user} | target: <@${targetUserId}> (\`${targetUserId}\`) | reason: ${reason}`;
  if (logChannelId) {
    const ch = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (ch?.isSendable()) await ch.send(msg).catch(() => {});
  }
  await sendServerLog(interaction.client, msg);

  const dashboardChannelId = process.env.DASHBOARD_CHANNEL_ID?.trim();
  if (dashboardChannelId) {
    const dash = await interaction.client.channels.fetch(dashboardChannelId).catch(() => null);
    if (dash?.isSendable()) {
      await dash
        .send(
          `📢 Moderasi: **${action}**\n` +
            `• Target: <@${targetUserId}>\n` +
            `• Moderator: ${interaction.user}\n` +
            `• Alasan: ${reason}`
        )
        .catch(() => {});
    }
  }
}

async function requireTargetMember(interaction: Interaction): Promise<GuildMember | null> {
  if (!interaction.guild) return null;
  const targetId = modSelectedTarget.get(interaction.user.id);
  if (!targetId) return null;
  return interaction.guild.members.fetch(targetId).catch(() => null);
}

function isRepliable(i: Interaction): i is Interaction & { reply: Function } {
  return "reply" in i;
}

async function failEphemeral(interaction: Interaction, content: string): Promise<void> {
  if (!isRepliable(interaction)) return;
  await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  scheduleDeleteReply(interaction);
}

async function validateCanAct(
  interaction: Interaction,
  target: GuildMember
): Promise<string | null> {
  if (!interaction.inGuild() || !interaction.guild) return "Hanya bisa di server.";
  if (!("member" in interaction) || !interaction.member) return "Member tidak valid.";
  const actor = interaction.member as GuildMember;
  const me = interaction.guild.members.me;
  if (!me) return "Bot member tidak ditemukan.";

  if (!hasModAccess(actor)) return "Kamu tidak punya akses moderator.";
  if (actor.id === target.id) return "Tidak bisa mengeksekusi aksi ke diri sendiri.";
  if (interaction.guild.ownerId === target.id) return "Tidak bisa aksi ke owner server.";
  if (actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return "Target punya role yang sama/lebih tinggi dari kamu.";
  }
  if (me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return "Role bot lebih rendah dari target.";
  }
  return null;
}

export async function handleModInteraction(interaction: Interaction): Promise<boolean> {
  const panelChannelId = getModPanelChannelId();

  if (interaction.isUserSelectMenu() && interaction.customId === MOD.userPick) {
    if (!panelChannelId || interaction.channelId !== panelChannelId) return true;
    const picked = interaction.values[0];
    if (!picked) {
      await interaction.reply({ content: "User tidak valid.", flags: MessageFlags.Ephemeral });
      return true;
    }
    modSelectedTarget.set(interaction.user.id, picked);
    await interaction.reply({
      content: `✅ Target dipilih: <@${picked}>`,
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  if (interaction.isButton()) {
    const ids = new Set<string>([
      MOD.kick,
      MOD.ban,
      MOD.timeout,
      MOD.nick,
      MOD.unban,
    ]);
    if (!ids.has(interaction.customId)) return false;
    if (!panelChannelId || interaction.channelId !== panelChannelId) return true;
    if (!interaction.inGuild() || !interaction.guild) return true;

    const actor = interaction.member as GuildMember;
    if (!hasModAccess(actor)) {
      await interaction.reply({
        content: "Kamu tidak punya akses moderator.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      return true;
    }

    const reasonInput = new TextInputBuilder()
      .setCustomId(FIELD_REASON)
      .setLabel("Alasan")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    if (interaction.customId === MOD.unban) {
      const uid = new TextInputBuilder()
        .setCustomId(FIELD_USER_ID)
        .setLabel("User ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const modal = new ModalBuilder().setCustomId(MODAL_UNBAN).setTitle("Unban User");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(uid),
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
      );
      await interaction.showModal(modal);
      return true;
    }

    const target = await requireTargetMember(interaction);
    if (!target) {
      await interaction.reply({
        content: "Pilih target dulu di menu user.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      return true;
    }
    const err = await validateCanAct(interaction, target);
    if (err) {
      await interaction.reply({ content: err, flags: MessageFlags.Ephemeral });
      scheduleDeleteReply(interaction);
      return true;
    }

    if (interaction.customId === MOD.kick) {
      const modal = new ModalBuilder().setCustomId(MODAL_KICK).setTitle("Kick User");
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
      await interaction.showModal(modal);
      return true;
    }
    if (interaction.customId === MOD.ban) {
      const days = new TextInputBuilder()
        .setCustomId(FIELD_BAN_DELETE_DAYS)
        .setLabel("Hapus pesan berapa hari (0-7)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("0");
      const modal = new ModalBuilder().setCustomId(MODAL_BAN).setTitle("Ban User");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(days)
      );
      await interaction.showModal(modal);
      return true;
    }
    if (interaction.customId === MOD.timeout) {
      const mins = new TextInputBuilder()
        .setCustomId(FIELD_TIMEOUT_MINUTES)
        .setLabel("Durasi timeout (menit)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("10");
      const modal = new ModalBuilder().setCustomId(MODAL_TIMEOUT).setTitle("Timeout User");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(mins),
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
      );
      await interaction.showModal(modal);
      return true;
    }

    const nick = new TextInputBuilder()
      .setCustomId(FIELD_NICKNAME)
      .setLabel("Nickname baru")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(32);
    const modal = new ModalBuilder().setCustomId(MODAL_NICK).setTitle("Ganti Nickname User");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nick),
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );
    await interaction.showModal(modal);
    return true;
  }

  if (!interaction.isModalSubmit()) return false;
  const modalIds = new Set<string>([
    MODAL_KICK,
    MODAL_BAN,
    MODAL_TIMEOUT,
    MODAL_NICK,
    MODAL_UNBAN,
  ]);
  if (!modalIds.has(interaction.customId)) return false;
  if (!interaction.inGuild() || !interaction.guild) return true;

  const actor = interaction.member as GuildMember;
  if (!hasModAccess(actor)) {
    await failEphemeral(interaction, "Kamu tidak punya akses moderator.");
    return true;
  }

  const reason = interaction.fields.getTextInputValue(FIELD_REASON)?.trim() || "No reason";

  if (interaction.customId === MODAL_UNBAN) {
    const userId = interaction.fields.getTextInputValue(FIELD_USER_ID).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      await failEphemeral(interaction, "User ID tidak valid.");
      return true;
    }
    await interaction.guild.members
      .unban(userId, `${reason} | by ${interaction.user.tag}`)
      .catch(async () => failEphemeral(interaction, "Gagal unban user."));
    if (!interaction.replied) {
      await interaction.reply({
        content: `✅ User \`${userId}\` berhasil di-unban.`,
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      await logModAction(interaction, "UNBAN", userId, reason);
    }
    return true;
  }

  const target = await requireTargetMember(interaction);
  if (!target) {
    await failEphemeral(interaction, "Target tidak ditemukan. Pilih ulang user target.");
    return true;
  }
  const err = await validateCanAct(interaction, target);
  if (err) {
    await failEphemeral(interaction, err);
    return true;
  }

  if (interaction.customId === MODAL_KICK) {
    await target.kick(`${reason} | by ${interaction.user.tag}`).catch(async () => {
      await failEphemeral(interaction, "Gagal kick user.");
    });
    if (!interaction.replied) {
      await interaction.reply({
        content: `✅ ${target.user.tag} berhasil di-kick.`,
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      await logModAction(interaction, "KICK", target.id, reason);
    }
    return true;
  }

  if (interaction.customId === MODAL_BAN) {
    const rawDays = interaction.fields.getTextInputValue(FIELD_BAN_DELETE_DAYS)?.trim() || "0";
    const deleteMessageSeconds = Math.max(0, Math.min(7, Number(rawDays) || 0)) * 86_400;
    await target
      .ban({
        reason: `${reason} | by ${interaction.user.tag}`,
        deleteMessageSeconds,
      })
      .catch(async () => failEphemeral(interaction, "Gagal ban user."));
    if (!interaction.replied) {
      await interaction.reply({
        content: `✅ ${target.user.tag} berhasil di-ban.`,
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      await logModAction(interaction, "BAN", target.id, reason);
    }
    return true;
  }

  if (interaction.customId === MODAL_TIMEOUT) {
    const mins = Number(
      interaction.fields.getTextInputValue(FIELD_TIMEOUT_MINUTES).trim()
    );
    if (!Number.isFinite(mins) || mins <= 0) {
      await failEphemeral(interaction, "Durasi timeout harus angka > 0.");
      return true;
    }
    const ms = Math.min(28 * 24 * 60, Math.floor(mins)) * 60_000;
    await target
      .timeout(ms, `${reason} | by ${interaction.user.tag}`)
      .catch(async () => failEphemeral(interaction, "Gagal timeout user."));
    if (!interaction.replied) {
      await interaction.reply({
        content: `✅ ${target.user.tag} di-timeout ${Math.floor(ms / 60_000)} menit.`,
        flags: MessageFlags.Ephemeral,
      });
      scheduleDeleteReply(interaction);
      await logModAction(interaction, "TIMEOUT", target.id, reason);
    }
    return true;
  }

  const newNick = interaction.fields.getTextInputValue(FIELD_NICKNAME).trim();
  await target.setNickname(newNick, `${reason} | by ${interaction.user.tag}`).catch(async () => {
    await failEphemeral(interaction, "Gagal mengganti nickname user.");
  });
  if (!interaction.replied) {
    await interaction.reply({
      content: `✅ Nickname ${target.user.tag} diganti jadi \`${newNick}\`.`,
      flags: MessageFlags.Ephemeral,
    });
    scheduleDeleteReply(interaction);
    await logModAction(interaction, "SET_NICK", target.id, reason);
  }
  return true;
}
