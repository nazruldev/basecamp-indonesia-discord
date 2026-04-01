import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { readGameConfigFile } from "@/config/gameConfig.js";

/** Select game di pesan ephemeral (bukan di modal). */
export const EPHEMERAL_PICK_GAMES_ID = "register_pick_games";

/** Prefix customId modal selesai: `reg_fin:key1,key2` */
export const REGISTER_FINISH_PREFIX = "reg_fin:";

export const DOB_FIELD = "birth_date";
export const IGN_FIELD = "ingame_name";

/** Dropdown multi-select untuk langkah setelah setuju syarat. */
export const buildEphemeralGameSelectRow = () => {
  const gameConfig = readGameConfigFile();
  const entries = Object.entries(gameConfig);
  const maxPick = Math.min(entries.length, 25);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(EPHEMERAL_PICK_GAMES_ID)
    .setPlaceholder("Pilih satu atau lebih game")
    .setMinValues(1)
    .setMaxValues(maxPick)
    .addOptions(
      entries.map(([key, game]) => ({
        label: game.label,
        value: key,
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
};

/** Modal hanya tanggal lahir + IGN; game sudah dipilih lewat select. */
export const buildDobIgnModal = (gameKeys: string[]) => {
  const keys = [...new Set(gameKeys)];
  const customId = `${REGISTER_FINISH_PREFIX}${keys.join(",")}`;

  if (customId.length > 100) {
    throw new Error("Terlalu banyak game untuk satu pendaftaran.");
  }

  const dob = new TextInputBuilder()
    .setCustomId(DOB_FIELD)
    .setLabel("Tanggal lahir")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("DD-MM-YYYY")
    .setRequired(true)
    .setMinLength(8)
    .setMaxLength(10);

  const ign = new TextInputBuilder()
    .setCustomId(IGN_FIELD)
    .setLabel("Nama samaran / in-game")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Nama yang dipakai di game")
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);


  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(`Lengkapi data pendaftaran Anda`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(dob),
      new ActionRowBuilder<TextInputBuilder>().addComponents(ign)
    );
};
