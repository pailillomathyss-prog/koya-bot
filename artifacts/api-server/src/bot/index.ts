import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { logger } from "../lib/logger";
import { registerEvents } from "./events";
import { registerInviteEvents } from "./events/inviteTracker";
import { loadCommands } from "./commands";
import { restoreGiveaways } from "./giveawayStore";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

(client as any).commands = new Collection();

export async function startBot() {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.error("DISCORD_TOKEN is not set. Bot will not start.");
    return;
  }

  await loadCommands(client);
  registerEvents(client);
  registerInviteEvents(client);

  await client.login(token);
  logger.info("Discord bot logged in.");

  client.once("ready", async () => {
    await restoreGiveaways(client);
  });
}
