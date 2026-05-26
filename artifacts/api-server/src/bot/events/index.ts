import { Client, Message, VoiceState, Interaction } from "discord.js";
import { handleMessageCreate } from "./messageCreate";
import { handleVoiceStateUpdate } from "./voiceState";
import { handleInteraction } from "./interaction";
import { logger } from "../../lib/logger";

// Déduplication : évite de traiter le même message 2 fois (instances multiples)
const processedMessages = new Set<string>();
function isDuplicate(id: string): boolean {
  if (processedMessages.has(id)) return true;
  processedMessages.add(id);
  // Nettoyer après 10 secondes pour ne pas saturer la mémoire
  setTimeout(() => processedMessages.delete(id), 10_000);
  return false;
}

export function registerEvents(client: Client) {
  client.once("ready", () => {
    logger.info(`Bot connecté en tant que ${client.user?.tag}`);
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (isDuplicate(message.id)) return;
    await handleMessageCreate(message);
  });

  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    await handleVoiceStateUpdate(oldState, newState);
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    await handleInteraction(interaction);
  });
}
