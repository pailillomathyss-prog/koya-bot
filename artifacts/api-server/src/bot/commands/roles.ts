import { Message } from "discord.js";
import { successEmbed, errorEmbed, updateVocRoles, hasModAccess } from "../utils";

export async function handleRank(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ManageRoles")) return;
  const target = message.mentions.members?.first();
  const role = message.mentions.roles.first();
  if (!target || !role) return message.reply({ embeds: [errorEmbed("Usage: +rank @user @role")] });
  if (target.roles.cache.has(role.id)) {
    await target.roles.remove(role);
    message.reply({ embeds: [successEmbed(`Rôle **${role.name}** retiré de **${target.user.tag}**.`)] });
  } else {
    await target.roles.add(role);
    message.reply({ embeds: [successEmbed(`Rôle **${role.name}** donné à **${target.user.tag}**.`)] });
  }
}

export async function handleDerank(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ManageRoles")) return;
  const target = message.mentions.members?.first();
  const role = message.mentions.roles.first();
  if (!target || !role) return message.reply({ embeds: [errorEmbed("Usage: +derank @user @role")] });
  await target.roles.remove(role);
  message.reply({ embeds: [successEmbed(`Rôle **${role.name}** retiré de **${target.user.tag}**.`)] });
}

export async function handleCheckRoles(message: Message) {
  if (!hasModAccess(message.member!, "ManageRoles")) return;
  const members = message.guild?.members.cache.filter(m => !m.user.bot);
  if (!members) return;
  let updated = 0;
  for (const m of members.values()) {
    await updateVocRoles(m);
    updated++;
  }
  message.reply({ embeds: [successEmbed(`Rôles vocaux vérifiés pour ${updated} membre(s).`)] });
}

export async function handleUpdateRoles(message: Message) {
  if (!hasModAccess(message.member!, "ManageRoles")) return;
  const members = message.guild?.members.cache.filter(m => !m.user.bot);
  if (!members) return;
  for (const m of members.values()) await updateVocRoles(m);
  message.reply({ embeds: [successEmbed("Rôles de tous les membres mis à jour.")] });
}
