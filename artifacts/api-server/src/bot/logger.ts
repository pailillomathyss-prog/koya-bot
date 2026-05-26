import { EmbedBuilder, TextChannel, Guild, ColorResolvable } from "discord.js";
import { client } from "./index";

export const logChannels = new Map<string, string>();

export async function sendLog(guild: Guild, options: {
  action: string;
  color: ColorResolvable;
  moderator: { id: string; tag: string };
  target?: { id: string; tag: string };
  reason?: string;
  duration?: string;
  extra?: Record<string, string>;
}) {
  const channelId = logChannels.get(guild.id);
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(options.color)
    .setTitle(`📋 ${options.action}`)
    .setTimestamp();

  if (options.target) {
    embed.addFields({ name: "Membre", value: `<@${options.target.id}> (${options.target.tag})`, inline: true });
  }

  embed.addFields({ name: "Modérateur", value: `<@${options.moderator.id}> (${options.moderator.tag})`, inline: true });

  if (options.duration) {
    embed.addFields({ name: "Durée", value: options.duration, inline: true });
  }

  if (options.reason) {
    embed.addFields({ name: "Raison", value: options.reason });
  }

  if (options.extra) {
    for (const [name, value] of Object.entries(options.extra)) {
      embed.addFields({ name, value, inline: true });
    }
  }

  await channel.send({ embeds: [embed] }).catch(() => null);
}
