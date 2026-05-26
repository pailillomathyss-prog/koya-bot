import { Client } from "discord.js";

export async function loadCommands(client: Client) {
  (client as any).commands = new Map();
}
