import type { Interaction } from "discord.js";
import { ACCEPT_TERMS_CUSTOM_ID } from "@/components/registrationChannel.js";
import {
  EPHEMERAL_PICK_GAMES_ID,
  REGISTER_FINISH_PREFIX,
} from "@/components/gameRegisterModal.js";
import {
  handleAcceptTerms,
  handleEphemeralGamePick,
  handleRegistrationModal,
} from "@/controllers/gameController.js";

export const selectGameInteraction = async (interaction: Interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === ACCEPT_TERMS_CUSTOM_ID) {
      await handleAcceptTerms(interaction);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === EPHEMERAL_PICK_GAMES_ID) {
      await handleEphemeralGamePick(interaction);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith(REGISTER_FINISH_PREFIX)) {
      await handleRegistrationModal(interaction);
    }
  }
};
