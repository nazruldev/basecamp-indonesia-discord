import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type CategoryChannel,
  type GuildMember,
  type Interaction,
} from "discord.js";
import { GP } from "@/bot/games/panel.js";
import { readGameConfigFile, writeGameConfigFile } from "@/config/gameConfig.js";
import {
  getGamesAllowedRoleIds,
  getGamesPanelChannelId,
} from "@/config/gamesPanel.js";
import { sendServerLog } from "@/services/serverLogService.js";

async function sendDashboardLog(interaction: Interaction, message: string): Promise<void> {
  const dashboardChannelId = process.env.DASHBOARD_CHANNEL_ID?.trim();
  if (!dashboardChannelId) return;
  const ch = await interaction.client.channels.fetch(dashboardChannelId).catch(() => null);
  if (!ch?.isSendable()) return;
  await ch.send(message).catch(() => {});
}

const CREATE_MODAL = "gp_modal_create";
const DELETE_MODAL = "gp_modal_delete";

const FIELD_CATEGORY_ID = "gp_category_id";
const FIELD_LABEL = "gp_label";

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

const uniqueKeyFromLabel = (label: string, existing: Record<string, unknown>): string => {
  const base = slugify(label) || "game";
  if (!existing[base]) return base;
  let i = 2;
  while (i < 10_000) {
    const k = `${base}_${i}`;
    if (!existing[k]) return k;
    i += 1;
  }
  return `${base}_${Date.now()}`;
};

const hasGamesAccess = (member: GuildMember): boolean => {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const allowed = getGamesAllowedRoleIds();
  if (allowed.size === 0) return false;
  return member.roles.cache.some((r) => allowed.has(r.id));
};

const PANEL_REPLY_TTL_MS = Math.max(
  1000,
  Number(process.env.REPLY_TTL_MS ?? "6000")
);

const scheduleDeleteReply = (interaction: Interaction): void => {
  if (!("deleteReply" in interaction)) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, PANEL_REPLY_TTL_MS);
};

const findGameByCategoryId = (
  cfg: Record<string, { label: string; roleId: string; categoryId?: string; tempHubId?: string }>,
  categoryId: string,
  guild: GuildMember["guild"]
): [string, { label: string; roleId: string; categoryId?: string; tempHubId?: string }] | undefined => {
  const direct = Object.entries(cfg).find(
    ([, item]) => item.categoryId && item.categoryId === categoryId
  ) as [string, { label: string; roleId: string; categoryId?: string; tempHubId?: string }] | undefined;
  if (direct) return direct;

  const cat = guild.channels.cache.get(categoryId);
  if (!cat || cat.type !== ChannelType.GuildCategory) return undefined;
  return Object.entries(cfg).find(
    ([, item]) => item.label.toLowerCase() === cat.name.toLowerCase()
  ) as [string, { label: string; roleId: string; categoryId?: string; tempHubId?: string }] | undefined;
};

async function ensureGameChannels(
  guild: GuildMember["guild"],
  label: string,
  roleId?: string,
  preferredCategoryId?: string
): Promise<{ categoryId: string; tempHubId: string; createdCategories: number; createdChannels: number }> {
  let createdCategories = 0;
  let createdChannels = 0;

  let category: CategoryChannel | null = null;
  if (preferredCategoryId) {
    const byId = guild.channels.cache.get(preferredCategoryId);
    if (byId && byId.type === ChannelType.GuildCategory) category = byId;
  }
  if (!category) {
    const byName = guild.channels.cache.find(
      (c): c is CategoryChannel => c.type === ChannelType.GuildCategory && c.name === label
    );
    if (byName) category = byName;
  }
  if (!category) {
    category = await guild.channels.create({
      name: label,
      type: ChannelType.GuildCategory,
    });
    createdCategories += 1;
  } else if (category.name !== label) {
    await category.setName(label).catch(() => {});
  }

  await category.permissionOverwrites
    .edit(guild.id, { ViewChannel: false })
    .catch(() => {});
  if (roleId) {
    await category.permissionOverwrites
      .edit(roleId, {
        ViewChannel: true,
        Connect: true,
      })
      .catch(() => {});
  }

  const ensureText = async (name: string) => {
    const exists = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildText &&
        c.parentId === category!.id &&
        c.name === name
    );
    if (exists) return;
    await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category!.id,
    });
    createdChannels += 1;
  };
  const ensureVoice = async (name: string): Promise<string> => {
    const exists = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildVoice &&
        c.parentId === category!.id &&
        c.name === name
    );
    if (exists) return exists.id;
    const created = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: category!.id,
    });
    createdChannels += 1;
    return created.id;
  };

  await ensureText("event");
  await ensureText("chat-umum");
  await ensureText("pengumuman");
  await ensureVoice("ROOM UMUM");
  const tempHubId = await ensureVoice("➕ Buat room");

  return { categoryId: category.id, tempHubId, createdCategories, createdChannels };
}

export async function handleGamesInteraction(interaction: Interaction): Promise<boolean> {
  const panelChannelId = getGamesPanelChannelId();
  if (!panelChannelId) return false;

  if (interaction.isButton()) {
    const ids = new Set<string>([GP.create, GP.delete, GP.setup]);
    if (!ids.has(interaction.customId)) return false;
    if (interaction.channelId !== panelChannelId) return true;
    if (!interaction.inGuild() || !interaction.guild) return true;

    const actor = interaction.member as GuildMember;
    if (!hasGamesAccess(actor)) {
      await interaction.reply({
        content: "Kamu tidak punya akses panel game config.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (interaction.customId === GP.setup) {
      if (!actor.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({
          content: "Butuh permission **Manage Channels** untuk load template channel game.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const cfg = readGameConfigFile();
      let createdCategories = 0;
      let createdChannels = 0;

      for (const [key, item] of Object.entries(cfg)) {
        const made = await ensureGameChannels(interaction.guild, item.label, item.roleId);
        createdCategories += made.createdCategories;
        createdChannels += made.createdChannels;
        item.categoryId = made.categoryId;
        item.tempHubId = made.tempHubId;
        cfg[key] = item;
      }

      await writeGameConfigFile(cfg);
      await sendServerLog(
        interaction.client,
        `🧩 Load template game oleh ${interaction.user} | kategori baru: ${createdCategories} | channel baru: ${createdChannels}`
      );
      await sendDashboardLog(
        interaction,
        `🧩 Sinkronisasi template game telah dijalankan oleh ${interaction.user}.\n` +
          `• Kategori baru: **${createdCategories}**\n` +
          `• Channel baru: **${createdChannels}**`
      );
      await interaction.editReply(
        `✅ Load template selesai.\nKategori baru: **${createdCategories}**\nChannel baru: **${createdChannels}**\nJika sudah ada, otomatis di-skip (tidak double).`
      );
      scheduleDeleteReply(interaction);
      return true;
    }

    const labelInput = new TextInputBuilder()
      .setCustomId(FIELD_LABEL)
      .setLabel("Nama game (label)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Valorant");
    if (interaction.customId === GP.create) {
      const modal = new ModalBuilder().setCustomId(CREATE_MODAL).setTitle("Create Game");
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput));
      await interaction.showModal(modal);
      return true;
    }

    const categoryIdInput = new TextInputBuilder()
      .setCustomId(FIELD_CATEGORY_ID)
      .setLabel("Category ID game yang mau dihapus")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("123456789012345678");
    const deleteModal = new ModalBuilder().setCustomId(DELETE_MODAL).setTitle("Delete Game");
    deleteModal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(categoryIdInput)
    );
    await interaction.showModal(deleteModal);
    return true;
  }

  if (!interaction.isModalSubmit()) return false;
  const modalIds = new Set<string>([CREATE_MODAL, DELETE_MODAL]);
  if (!modalIds.has(interaction.customId)) return false;
  if (interaction.channelId !== panelChannelId) return true;
  if (!interaction.inGuild() || !interaction.guild) return true;

  const actor = interaction.member as GuildMember;
  if (!hasGamesAccess(actor)) {
    await interaction.reply({
      content: "Kamu tidak punya akses panel game config.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const cfg = readGameConfigFile();
  if (interaction.customId === DELETE_MODAL) {
    const categoryId = interaction.fields.getTextInputValue(FIELD_CATEGORY_ID).trim();
    const target = findGameByCategoryId(cfg, categoryId, interaction.guild);
    if (!target) {
      await interaction.editReply({
        content: `Game dengan category ID \`${categoryId}\` tidak ditemukan.`,
      });
      return true;
    }
    const [targetKey, current] = target;

    const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);
    if (category && category.type === ChannelType.GuildCategory) {
      const children = interaction.guild.channels.cache.filter(
        (c) => c.parentId === category.id
      );
      for (const [, ch] of children) {
        await ch.delete("Delete game config category children").catch(() => {});
      }
      await category.delete("Delete game config category").catch(() => {});
    }

    const role = current.roleId
      ? await interaction.guild.roles.fetch(current.roleId).catch(() => null)
      : null;
    if (role) await role.delete("Delete game config role").catch(() => {});
    const fallbackRoleName = `user_${slugify(current.label) || "game"}`;
    const fallbackRole = interaction.guild.roles.cache.find((r) => r.name === fallbackRoleName);
    if (fallbackRole && fallbackRole.id !== role?.id) {
      await fallbackRole.delete("Delete fallback game role").catch(() => {});
    }

    delete cfg[targetKey];
    await writeGameConfigFile(cfg);
    await sendServerLog(
      interaction.client,
      `🗑️ Delete game oleh ${interaction.user} | key: \`${targetKey}\` | category: \`${categoryId}\` | role: \`${current.roleId}\``
    );
    await sendDashboardLog(
      interaction,
      `🗑️ Game **${current.label}** telah dihapus oleh ${interaction.user}.`
    );
    await interaction.editReply({
      content: `✅ Game \`${targetKey}\` dihapus dari config + category + child channels.`,
    });
    scheduleDeleteReply(interaction);
    return true;
  }

  const label = interaction.fields.getTextInputValue(FIELD_LABEL).trim();
  if (!label) {
    await interaction.editReply({ content: "Label game wajib diisi." });
    return true;
  }

  const key = uniqueKeyFromLabel(label, cfg);
  const roleName = `user_${slugify(label) || "game"}`;
  const role = await interaction.guild.roles
    .create({
      name: roleName,
      mentionable: false,
      reason: `Auto role untuk game ${label}`,
    })
    .catch(() => null);
  if (!role) {
    await interaction.editReply({
      content: "Gagal membuat role otomatis. Cek izin Manage Roles dan hierarki role bot.",
    });
    return true;
  }
  const roleId = role.id;

  cfg[key] = {
    ...(cfg[key] ?? {}),
    label,
    roleId,
  };

  let setupInfo = "";
  if (actor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    const made = await ensureGameChannels(interaction.guild, label, roleId);
    cfg[key].categoryId = made.categoryId;
    cfg[key].tempHubId = made.tempHubId;
    setupInfo =
      `\n• Kategori dibuat: **${made.createdCategories}**` +
      `\n• Channel dibuat: **${made.createdChannels}**`;
  } else {
    setupInfo =
      "\n• Channel game belum dibuat otomatis (butuh permission Manage Channels). Klik **Load Template**.";
  }

  await writeGameConfigFile(cfg);
  await sendServerLog(
    interaction.client,
    `✅ Create game oleh ${interaction.user} | key: \`${key}\` | label: **${label}** | role: \`${roleId}\``
  );
  await sendDashboardLog(
    interaction,
    `✅ Game baru telah ditambahkan oleh ${interaction.user}.\n• Nama game: **${label}**`
  );
  await interaction.editReply({
    content:
      `✅ Game \`${key}\` disimpan. Label: **${label}**, Role: \`${roleId}\`` +
      setupInfo,
  });
  scheduleDeleteReply(interaction);
  return true;
}
