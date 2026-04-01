import { handleGamesInteraction } from "@/bot/games/handleGamesInteraction.js";
import { handleModInteraction } from "@/bot/mod/handleModInteraction.js";
import { handleLevelInteraction } from "@/bot/leveling/handleLevelInteraction.js";
import { handleTicketInteraction } from "@/bot/ticket/handleTicketInteraction.js";
import { handleUserPanelInteraction } from "@/bot/user/handleUserPanelInteraction.js";
import { handleTempVoiceInteraction } from "@/bot/tempVoice/handleTempVoiceInteraction.js";
import { selectGameInteraction } from "@/bot/interactions/selectGame.js";
import type { Interaction } from "discord.js";

export default async (interaction: Interaction) => {
  if (await handleUserPanelInteraction(interaction)) return;
  if (await handleGamesInteraction(interaction)) return;
  if (await handleModInteraction(interaction)) return;
  if (await handleLevelInteraction(interaction)) return;
  if (await handleTicketInteraction(interaction)) return;
  if (await handleTempVoiceInteraction(interaction)) return;
  await selectGameInteraction(interaction);
};
