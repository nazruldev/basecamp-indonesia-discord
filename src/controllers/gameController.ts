import { DiscordAPIError } from "@discordjs/rest";
import {
  MessageFlags,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  DOB_FIELD,
  IGN_FIELD,
  REGISTER_FINISH_PREFIX,
  buildDobIgnModal,
  buildEphemeralGameSelectRow,
} from "@/components/gameRegisterModal.js";
import { readGameConfigFile } from "@/config/gameConfig.js";
import { assignGameRoles } from "@/services/roleService.js";
import { parseBirthDate } from "@/utils/birthDate.js";

const failMessage = "❌ Gagal memproses pendaftaran.";

const failMessagePermission =
  "❌ Bot tidak punya izin mengatur role. Naikkan role bot di atas role game dan nyalakan **Manage Roles**.";
const DEFAULT_GUEST_ROLE_ID = "1488751521368641608";

const labelsLine = (keys: string[], gameConfig: Record<string, { label: string }>) =>
  keys
    .map((k) => gameConfig[k]?.label ?? k)
    .join(", ");

async function sendDashboardRegisterNotification(params: {
  guild: NonNullable<ModalSubmitInteraction["guild"]>;
  userId: string;
  ign: string;
  dob: string;
  pickedLabels: string;
}): Promise<void> {
  const dashboardChannelId = process.env.DASHBOARD_CHANNEL_ID?.trim();
  if (!dashboardChannelId) return;

  const ch = await params.guild.channels.fetch(dashboardChannelId).catch(() => null);
  if (!ch?.isSendable()) return;

  await ch
    .send(
      `📥 Member baru register: <@${params.userId}>\n` +
        `• IGN: **${params.ign}**\n` +
        `• DOB: **${params.dob}**\n` +
        `• Game: **${params.pickedLabels}**`
    )
    .catch(() => {});
}

/** Setuju syarat → pesan pribadi berisi dropdown game (bukan di modal). */
export const handleAcceptTerms = async (interaction: ButtonInteraction) => {
  try {
    await interaction.reply({
      content:
        "**Pilih game** di menu di bawah (bisa lebih dari satu). Setelah itu form **tanggal lahir** & **nama in-game** akan terbuka.",
      components: [buildEphemeralGameSelectRow()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ Tidak bisa melanjutkan. Coba lagi.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

/** Pilih game dari ephemeral → buka modal DOB + IGN. */
export const handleEphemeralGamePick = async (
  interaction: StringSelectMenuInteraction
) => {
  const keys = [...new Set(interaction.values)];
  const gameConfig = readGameConfigFile();
  for (const k of keys) {
    if (!gameConfig[k]) {
      await interaction.reply({
        content: "❌ Pilihan game tidak valid.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  try {
    await interaction.showModal(buildDobIgnModal(keys));
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ Form tidak bisa dibuka. Coba lagi dari **Saya setuju**.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

/** Submit modal → role, nick, kunci channel */
export const handleRegistrationModal = async (
  interaction: ModalSubmitInteraction
) => {
  if (!interaction.customId.startsWith(REGISTER_FINISH_PREFIX)) return;

  const keysRaw = interaction.customId
    .slice(REGISTER_FINISH_PREFIX.length)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const gameKeys = [...new Set(keysRaw)];
  const guild = interaction.guild;
  const gameConfig = readGameConfigFile();

  if (!gameKeys.length || !guild) {
    await interaction.reply({
      content: "❌ Data tidak valid.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  for (const k of gameKeys) {
    if (!gameConfig[k]) {
      await interaction.reply({
        content: "❌ Data tidak valid.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const dobRaw = interaction.fields.getTextInputValue(DOB_FIELD).trim();
  const ign = interaction.fields.getTextInputValue(IGN_FIELD).trim();

  const dob = parseBirthDate(dobRaw);
  if (!dob) {
    await interaction.reply({
      content:
        "❌ Tanggal lahir tidak valid. Gunakan **DD-MM-YYYY** (contoh: 15-08-2000).",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ign.length < 2) {
    await interaction.reply({
      content: "❌ Nama in-game terlalu pendek.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pickedLabels = labelsLine(gameKeys, gameConfig);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const notes: string[] = [];
    const member = await guild.members.fetch(interaction.user.id);
    await assignGameRoles(member, gameKeys);
    const guestRoleId =
      process.env.DEFAULT_GUEST_ROLE_ID?.trim() || DEFAULT_GUEST_ROLE_ID;
    if (guestRoleId) {
      await member.roles.add(guestRoleId).catch(() => {
        notes.push(
          "⚠️ Role default guest belum bisa ditambahkan (cek role ID/izin bot/hierarki)."
        );
      });
    }

    console.info(
      `[game-register] user=${interaction.user.tag} games=${gameKeys.join("+")} dob=${dob} ign=${ign}`
    );

    let nickOk = false;

    try {
      await member.setNickname(ign.slice(0, 32), "Daftar game");
      nickOk = true;
    } catch {
      notes.push(
        "⚠️ **Nickname server** tidak berubah (izin *Manage Nicknames*, hierarki role, atau kamu owner)."
      );
    }

    let menuLocked = false;
    const menuChannelId = process.env.DISCORD_MENU_CHANNEL_ID;
    if (menuChannelId) {
      try {
        const menuCh = await guild.channels.fetch(menuChannelId);
        if (menuCh && "permissionOverwrites" in menuCh && menuCh.permissionOverwrites) {
          await menuCh.permissionOverwrites.edit(member.id, {
            ViewChannel: false,
          });
          menuLocked = true;
        }
      } catch {
        notes.push(
          "⚠️ Channel pendaftaran belum bisa dikunci untuk akunmu (izin bot)."
        );
      }
    }

    await interaction.editReply({
      content:
        `✅ **${pickedLabels}**\n` +
        `• Nama in-game: **${ign}**\n` +
        `• Tanggal lahir: **${dob}**\n` +
        `• Role sudah diberikan.\n` +
        (nickOk ? `• Nickname server disesuaikan.\n` : "") +
        (menuLocked ? `• Kamu tidak lagi melihat channel pendaftaran ini.\n` : "") +
        (notes.length > 0 ? `\n${notes.join("\n")}` : ""),
    });

    await sendDashboardRegisterNotification({
      guild,
      userId: interaction.user.id,
      ign,
      dob,
      pickedLabels,
    });

    await interaction.message?.delete().catch(() => {});
  } catch (err) {
    console.error(err);

    const isPerm =
      err instanceof DiscordAPIError && err.code === 50_013;
    await interaction.editReply({
      content:
        (isPerm ? failMessagePermission : failMessage) +
        "\n\nTekan lagi **Saya setuju — buka formulir** di pesan syarat di channel setelah masalah diperbaiki.",
    });
  }
};
