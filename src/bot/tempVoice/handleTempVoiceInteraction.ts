import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
  type VoiceBasedChannel,
} from "discord.js";
import { tempVoiceOwners } from "@/bot/tempVoice/state.js";
import { TV } from "@/bot/tempVoice/panel.js";

const RENAME_MODAL = "tv_rename_modal";
const LIMIT_MODAL = "tv_limit_modal";
const RENAME_INPUT = "tv_rename_input";
const LIMIT_INPUT = "tv_limit_input";

const PRIVACY_MENU = "tv_privacy_menu";
const BITRATE_MENU = "tv_bitrate_menu";
const REGION_MENU = "tv_region_menu";
const KICK_MENU = "tv_kick_menu";
const TRANSFER_MENU = "tv_transfer_menu";

const TRUST_PICK = "tv_trust_pick";
const UNTRUST_PICK = "tv_untrust_pick";
const BLOCK_PICK = "tv_block_pick";
const UNBLOCK_PICK = "tv_unblock_pick";

const rateLast = new Map<string, number>();
const rateMs = 900;

function rateOk(userId: string): boolean {
  const now = Date.now();
  const t = rateLast.get(userId) ?? 0;
  if (now - t < rateMs) return false;
  rateLast.set(userId, now);
  return true;
}

function requireVoice(
  interaction: Interaction
): VoiceBasedChannel | null {
  const m = interaction.member;
  if (!m || typeof m !== "object" || !("voice" in m)) return null;
  const ch = (m as { voice: { channel: VoiceBasedChannel | null } }).voice
    .channel;
  return ch;
}

function isTempRoom(channelId: string): boolean {
  return tempVoiceOwners.has(channelId);
}

function isOwner(userId: string, channelId: string): boolean {
  return tempVoiceOwners.get(channelId) === userId;
}

export async function handleTempVoiceInteraction(
  interaction: Interaction
): Promise<boolean> {
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    if (id === RENAME_MODAL || id === LIMIT_MODAL) {
      await handleModal(interaction);
      return true;
    }
    return false;
  }

  if (interaction.isUserSelectMenu()) {
    const id = interaction.customId;
    if (
      [TRUST_PICK, UNTRUST_PICK, BLOCK_PICK, UNBLOCK_PICK].includes(id)
    ) {
      await handleUserPick(interaction);
      return true;
    }
    return false;
  }

  if (interaction.isStringSelectMenu()) {
    const id = interaction.customId;
    if (
      [PRIVACY_MENU, BITRATE_MENU, REGION_MENU, KICK_MENU, TRANSFER_MENU].includes(
        id
      )
    ) {
      await handleStringSelect(interaction);
      return true;
    }
    return false;
  }

  if (!interaction.isButton()) return false;

  const id = interaction.customId;
  if (!id.startsWith("tv_")) return false;

  if (!rateOk(interaction.user.id)) {
    await interaction
      .reply({
        content: "Terlalu cepat, tunggu sebentar.",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return true;
  }

  const voice = requireVoice(interaction);
  if (!voice) {
    await interaction
      .reply({
        content: "Kamu harus berada di **voice channel** (room temp).",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return true;
  }

  if (!isTempRoom(voice.id)) {
    await interaction
      .reply({
        content: "Channel ini bukan **room sementara** bot.",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return true;
  }

  const ownerOnly = id !== TV.claim;
  if (ownerOnly && !isOwner(interaction.user.id, voice.id)) {
    await interaction
      .reply({
        content: "Hanya **pemilik room** yang bisa memakai tombol ini.",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return true;
  }

  if (id === TV.claim) {
    await handleClaim(interaction, voice);
    return true;
  }

  if (id === TV.rename) {
    const input = new TextInputBuilder()
      .setCustomId(RENAME_INPUT)
      .setLabel("Nama channel baru")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100);
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(RENAME_MODAL)
        .setTitle("Ubah nama")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(input)
        )
    );
    return true;
  }

  if (id === TV.limit) {
    const input = new TextInputBuilder()
      .setCustomId(LIMIT_INPUT)
      .setLabel("User limit (0 = tanpa limit)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("0–99")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(LIMIT_MODAL)
        .setTitle("Limit user")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(input)
        )
    );
    return true;
  }

  if (id === TV.delete) {
    tempVoiceOwners.delete(voice.id);
    await voice.delete().catch(() => {});
    await interaction
      .reply({ content: "Room dihapus.", flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return true;
  }

  if (id === TV.privacy) {
    await openEphemeralSelect(interaction, PRIVACY_MENU, "Pilih mode privacy", [
      ["lock", "Kunci (hanya yang sudah ada)"],
      ["unlock", "Buka untuk server"],
      ["invisible", "Sembunyikan dari daftar"],
      ["visible", "Tampilkan di daftar"],
    ]);
    return true;
  }

  if (id === TV.bitrate) {
    const opts = [32, 48, 64, 80, 96].map(
      (k) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${k} kbps`)
          .setValue(String(k * 1000))
    );
    await openEphemeralSelectRaw(
      interaction,
      BITRATE_MENU,
      "Pilih bitrate",
      opts
    );
    return true;
  }

  if (id === TV.region) {
    const regions = [
      "automatic",
      "brazil",
      "hongkong",
      "india",
      "japan",
      "singapore",
      "sydney",
      "us-central",
      "us-east",
      "us-south",
      "us-west",
    ];
    const opts = regions.map((r) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(r.replace(/-/g, " "))
        .setValue(r)
    );
    await openEphemeralSelectRaw(
      interaction,
      REGION_MENU,
      "Pilih region",
      opts
    );
    return true;
  }

  if (id === TV.kick || id === TV.transfer) {
    const members = [...voice.members.values()].filter(
      (m) => m.id !== interaction.user.id
    );
    if (!members.length) {
      await interaction.reply({
        content: "Tidak ada user lain di channel.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const opts = members.slice(0, 25).map((m) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(m.user.username)
        .setValue(m.id)
    );
    await openEphemeralSelectRaw(
      interaction,
      id === TV.kick ? KICK_MENU : TRANSFER_MENU,
      id === TV.kick ? "Kick siapa?" : "Transfer ke?",
      opts
    );
    return true;
  }

  if (id === TV.trust) {
    await openUserPick(interaction, TRUST_PICK, "Pilih user untuk **trust**");
    return true;
  }
  if (id === TV.untrust) {
    await openUserPick(interaction, UNTRUST_PICK, "Pilih user (untrust)");
    return true;
  }
  if (id === TV.block) {
    await openUserPick(interaction, BLOCK_PICK, "Pilih user untuk **block**");
    return true;
  }
  if (id === TV.unblock) {
    await openUserPick(interaction, UNBLOCK_PICK, "Pilih user (unblock)");
    return true;
  }

  return true;
}

async function openEphemeralSelect(
  interaction: ButtonInteraction,
  customId: string,
  placeholder: string,
  options: [string, string][]
) {
  const opts = options.map(([v, l]) =>
    new StringSelectMenuOptionBuilder().setLabel(l).setValue(v)
  );
  await openEphemeralSelectRaw(interaction, customId, placeholder, opts);
}

async function openEphemeralSelectRaw(
  interaction: ButtonInteraction,
  customId: string,
  placeholder: string,
  options: StringSelectMenuOptionBuilder[]
) {
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder.slice(0, 100))
      .addOptions(options)
  );

  await interaction.reply({
    content: "Pilih opsi di bawah.",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function openUserPick(
  interaction: ButtonInteraction,
  customId: string,
  content: string
) {
  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder("Pilih user")
      .setMinValues(1)
      .setMaxValues(1)
  );

  await interaction.reply({
    content,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleModal(interaction: ModalSubmitInteraction) {
  const voice = requireVoice(interaction);
  if (!voice || !isTempRoom(voice.id) || !isOwner(interaction.user.id, voice.id)) {
    await interaction.reply({
      content: "Tidak valid.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    if (interaction.customId === RENAME_MODAL) {
      const name = interaction.fields.getTextInputValue(RENAME_INPUT).trim();
      if (name.length)
        await voice.setName(name.slice(0, 100));
      await interaction.reply({
        content: "✅ Nama diperbarui.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (interaction.customId === LIMIT_MODAL) {
      const raw = interaction.fields.getTextInputValue(LIMIT_INPUT).trim();
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        await interaction.reply({
          content: "Limit harus 0–99.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await voice.setUserLimit(n);
      await interaction.reply({
        content: "✅ Limit diperbarui.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch {
    await interaction.reply({
      content: "❌ Gagal mengubah channel.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleStringSelect(interaction: StringSelectMenuInteraction) {
  const voice = requireVoice(interaction);
  if (!voice || !isTempRoom(voice.id) || !isOwner(interaction.user.id, voice.id)) {
    await interaction.reply({
      content: "Tidak valid.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = voice.guild;
  const ownerId = tempVoiceOwners.get(voice.id)!;
  const val = interaction.values[0] ?? "";
  if (!val) {
    await interaction.reply({
      content: "Pilihan kosong.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    if (interaction.customId === PRIVACY_MENU) {
      if (val === "lock") {
        await voice.permissionOverwrites.edit(guild.id, {
          Connect: false,
        });
        await voice.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
        });
      } else if (val === "unlock") {
        await voice.permissionOverwrites.edit(guild.id, {
          Connect: null,
          ViewChannel: null,
        });
      } else if (val === "invisible") {
        await voice.permissionOverwrites.edit(guild.id, {
          ViewChannel: false,
        });
        await voice.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          Connect: true,
        });
      } else if (val === "visible") {
        await voice.permissionOverwrites.edit(guild.id, {
          ViewChannel: null,
        });
      }
      await interaction.update({
        content: "✅ Privacy diperbarui.",
        components: [],
      });
      return;
    }

    if (interaction.customId === BITRATE_MENU) {
      const b = Number(val);
      await voice.setBitrate(b);
      await interaction.update({
        content: "✅ Bitrate diperbarui.",
        components: [],
      });
      return;
    }

    if (interaction.customId === REGION_MENU) {
      const region: string | null = val === "automatic" ? null : val;
      await voice.setRTCRegion(region);
      await interaction.update({
        content: "✅ Region diperbarui.",
        components: [],
      });
      return;
    }

    if (interaction.customId === KICK_MENU) {
      const mem = await guild.members.fetch(val).catch(() => null);
      await mem?.voice.disconnect().catch(() => {});
      await interaction.update({
        content: "✅ User dikeluarkan dari voice.",
        components: [],
      });
      return;
    }

    if (interaction.customId === TRANSFER_MENU) {
      tempVoiceOwners.set(voice.id, val);
      await interaction.update({
        content: "✅ Pemilik room dipindahkan.",
        components: [],
      });
    }
  } catch {
    await interaction
      .update({
        content: "❌ Gagal.",
        components: [],
      })
      .catch(() => {});
  }
}

async function handleUserPick(interaction: UserSelectMenuInteraction) {
  const voice = requireVoice(interaction);
  if (!voice || !isTempRoom(voice.id) || !isOwner(interaction.user.id, voice.id)) {
    await interaction.reply({
      content: "Tidak valid.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetId = interaction.values[0];
  if (!targetId) {
    await interaction.reply({
      content: "Tidak ada user.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const id = interaction.customId;
    if (id === TRUST_PICK) {
      await voice.permissionOverwrites.edit(targetId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
      });
    } else if (id === UNTRUST_PICK) {
      await voice.permissionOverwrites.delete(targetId).catch(() => {});
    } else if (id === BLOCK_PICK) {
      await voice.permissionOverwrites.edit(targetId, {
        Connect: false,
        ViewChannel: false,
      });
    } else if (id === UNBLOCK_PICK) {
      await voice.permissionOverwrites.delete(targetId).catch(() => {});
    }
    await interaction.update({
      content: "✅ Izin user diperbarui.",
      components: [],
    });
  } catch {
    await interaction
      .reply({
        content: "❌ Gagal mengubah izin.",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
}

async function handleClaim(
  interaction: ButtonInteraction,
  voice: VoiceBasedChannel
) {
  if (!isTempRoom(voice.id)) {
    await interaction.reply({
      content: "Bukan room temp.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cur = tempVoiceOwners.get(voice.id)!;
  const ownerStillThere = voice.members.has(cur);

  if (ownerStillThere && cur !== interaction.user.id) {
    await interaction.reply({
      content: "Pemilik masih di room.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  tempVoiceOwners.set(voice.id, interaction.user.id);
  await interaction.reply({
    content: "✅ Kamu sekarang pemilik room.",
    flags: MessageFlags.Ephemeral,
  });
}
