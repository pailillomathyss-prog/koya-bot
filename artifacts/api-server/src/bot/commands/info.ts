import { Message, EmbedBuilder, Guild } from "discord.js";
import { vocTime } from "../data";
import { errorEmbed, hasModAccess } from "../utils";

/** Compte les invitations d'un membre directement depuis Discord (historique complet, sans doublon) */
async function getLiveInviteCount(guild: Guild, userId: string): Promise<number> {
  try {
    const invites = await guild.invites.fetch();
    return invites
      .filter(i => i.inviterId === userId)
      .reduce((sum, i) => sum + (i.uses ?? 0), 0);
  } catch {
    return -1; // permission manquante
  }
}

/** Retourne le classement de tous les membres par invitations (live depuis Discord) */
async function getLiveInviteRanking(guild: Guild): Promise<{ id: string; count: number }[]> {
  try {
    const invites = await guild.invites.fetch();
    const totals = new Map<string, number>();
    for (const invite of invites.values()) {
      if (!invite.inviterId) continue;
      totals.set(invite.inviterId, (totals.get(invite.inviterId) ?? 0) + (invite.uses ?? 0));
    }
    return [...totals.entries()]
      .map(([id, count]) => ({ id, count }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function handleUserInfo(message: Message) {
  const target = message.mentions.members?.first() ?? message.member!;
  const user = target.user;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Fiche de ${user.tag}`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "ID", value: user.id, inline: true },
      { name: "Surnom", value: target.nickname ?? "Aucun", inline: true },
      { name: "Compte créé", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
      { name: "Rejoint le serveur", value: target.joinedAt ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:D>` : "Inconnu", inline: true },
      { name: "Rôles", value: target.roles.cache.filter(r => r.name !== "@everyone").map(r => `<@&${r.id}>`).join(", ") || "Aucun", inline: false },
    )
    .setTimestamp();
  message.reply({ embeds: [embed] });
}

export async function handleServerInfo(message: Message) {
  const guild = message.guild!;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: "ID", value: guild.id, inline: true },
      { name: "Propriétaire", value: `<@${guild.ownerId}>`, inline: true },
      { name: "Membres", value: `${guild.memberCount}`, inline: true },
      { name: "Salons", value: `${guild.channels.cache.size}`, inline: true },
      { name: "Rôles", value: `${guild.roles.cache.size}`, inline: true },
      { name: "Créé le", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
    )
    .setTimestamp();
  message.reply({ embeds: [embed] });
}

export async function handleAvatar(message: Message) {
  const target = message.mentions.members?.first()?.user ?? message.author;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Avatar de ${target.tag}`)
    .setImage(target.displayAvatarURL({ size: 512 }));
  message.reply({ embeds: [embed] });
}

export async function handleVocTime(message: Message) {
  const target = message.mentions.members?.first() ?? message.member!;
  const seconds = vocTime.get(target.id) ?? 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Temps vocal de ${target.user.tag}`)
    .setDescription(`**${hours}h ${minutes}m**`);
  message.reply({ embeds: [embed] });
}

export async function handleSetTime(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "Administrator")) return;
  const target = message.mentions.members?.first();
  const hours = parseFloat(args[1]);
  if (!target || isNaN(hours)) return message.reply({ embeds: [errorEmbed("Usage: +settime @user [heures]")] });
  vocTime.set(target.id, Math.floor(hours * 3600));
  message.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Temps vocal de **${target.user.tag}** défini à **${hours}h**.`)] });
}

export async function handlePing(message: Message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Pong!")
    .addFields(
      { name: "Latence bot", value: `${Date.now() - message.createdTimestamp}ms`, inline: true },
      { name: "API", value: `${message.client.ws.ping}ms`, inline: true },
    );
  message.reply({ embeds: [embed] });
}

export async function handleInvites(message: Message) {
  const target = message.mentions.members?.first() ?? message.member!;
  const status = await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription("⏳ Récupération des invitations...")] });
  const count = await getLiveInviteCount(message.guild!, target.id);

  if (count === -1) {
    return status.edit({ embeds: [errorEmbed("Le bot n'a pas la permission **Gérer le serveur** pour lire les invitations.")] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📨 Invitations de ${target.user.tag}`)
    .setThumbnail(target.user.displayAvatarURL())
    .setDescription(`**${count}** membre(s) invité(s) sur le serveur.\n*(inclut toutes les invitations, même créées avant le bot)*`);
  status.edit({ embeds: [embed] });
}

export async function handleSyncInvites(message: Message) {
  if (!hasModAccess(message.member!, "ManageGuild")) return;
  const status = await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription("⏳ Lecture des invitations depuis Discord...")] });
  const ranking = await getLiveInviteRanking(message.guild!);

  if (ranking.length === 0) {
    return status.edit({ embeds: [errorEmbed("Aucune invitation trouvée ou permission **Gérer le serveur** manquante.")] });
  }

  const total = ranking.reduce((s, e) => s + e.count, 0);
  status.edit({
    embeds: [new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ Invitations lues depuis Discord")
      .setDescription(`**${total}** invitation(s) au total — **${ranking.length}** membre(s) avec des invitations.\n\nUtilise \`+invitetop\` pour voir le classement.`)],
  });
}

export async function handleInviteTop(message: Message) {
  const status = await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription("⏳ Chargement du classement...")] });
  const ranking = await getLiveInviteRanking(message.guild!);

  if (ranking.length === 0) {
    return status.edit({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription("Aucune invitation trouvée. Le bot a-t-il la permission **Gérer le serveur** ?")] });
  }

  const top10 = ranking.slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = top10.map((e, i) => `${medals[i] ?? `**${i + 1}.**`} <@${e.id}> — **${e.count}** invitation(s)`);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📨 Classement des invitations")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Données en temps réel depuis Discord" })
    .setTimestamp();
  status.edit({ embeds: [embed] });
}
