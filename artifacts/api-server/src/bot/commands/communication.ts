import { Message, EmbedBuilder, TextChannel } from "discord.js";
import { errorEmbed, hasModAccess } from "../utils";

export async function handleAnnounce(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "MentionEveryone")) return;

  let targetChannel: TextChannel = message.channel as TextChannel;
  let textArgs = args;

  if (args[0]?.startsWith("<#")) {
    const channelId = args[0].replace(/[<#>]/g, "");
    const found = message.guild?.channels.cache.get(channelId) as TextChannel | undefined;
    if (found) {
      targetChannel = found;
      textArgs = args.slice(1);
    }
  }

  const text = textArgs.join(" ");
  if (!text) return message.reply({ embeds: [errorEmbed("Fournis un texte pour l'annonce.")] });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Annonce")
    .setDescription(text)
    .setFooter({ text: `Annoncé par ${message.author.tag}` })
    .setTimestamp();

  await targetChannel.send({ content: "@everyone", embeds: [embed] });
  if (targetChannel.id !== message.channel.id) {
    message.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Annonce envoyée dans <#${targetChannel.id}>.`)] });
  }
}
