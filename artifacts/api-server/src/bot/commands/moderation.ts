import { Message, TextChannel } from "discord.js";
import { warns, WARN_LIMIT, tempBans, mutes } from "../data";
import { parseDuration, formatDuration, successEmbed, errorEmbed, getMutedRole, hasModAccess } from "../utils";
import { sendLog } from "../logger";

export async function handleBan(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "BanMembers")) return;
  const target = message.mentions.members?.first();
  if (!target) return message.reply({ embeds: [errorEmbed("Mentionne un membre.")] });
  const reason = args.slice(1).join(" ") || "Aucune raison";
  await target.ban({ reason });
  message.reply({ embeds: [successEmbed(`**${target.user.tag}** a été banni. Raison: ${reason}`)] });
  sendLog(message.guild!, { action: "🔨 Ban", color: 0xed4245, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag }, reason });
}

export async function handleUnban(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "BanMembers")) return;
  const id = args[0];
  if (!id) return message.reply({ embeds: [errorEmbed("Fournis un ID utilisateur.")] });
  const banned = await message.guild?.bans.fetch(id).catch(() => null);
  await message.guild?.bans.remove(id).catch(() => null);
  message.reply({ embeds: [successEmbed(`L'utilisateur \`${id}\` a été débanni.`)] });
  sendLog(message.guild!, { action: "✅ Unban", color: 0x57f287, moderator: { id: message.author.id, tag: message.author.tag }, target: { id, tag: banned?.user.tag ?? id } });
}

export async function handleTempBan(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "BanMembers")) return;
  const target = message.mentions.members?.first();
  const durationStr = args[1];
  const reason = args.slice(2).join(" ") || "Aucune raison";
  if (!target || !durationStr) return message.reply({ embeds: [errorEmbed("Usage: +tempban @user [durée] [raison]")] });
  const ms = parseDuration(durationStr);
  if (!ms) return message.reply({ embeds: [errorEmbed("Durée invalide (ex: 10m, 2h, 7d)")] });
  await target.ban({ reason });
  message.reply({ embeds: [successEmbed(`**${target.user.tag}** banni pour ${formatDuration(ms)}. Raison: ${reason}`)] });
  sendLog(message.guild!, { action: "⏱️ Tempban", color: 0xe67e22, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag }, reason, duration: formatDuration(ms) });
  const timer = setTimeout(async () => {
    await message.guild?.bans.remove(target.id).catch(() => null);
    tempBans.delete(target.id);
    sendLog(message.guild!, { action: "✅ Tempban expiré", color: 0x57f287, moderator: { id: message.client.user!.id, tag: message.client.user!.tag }, target: { id: target.id, tag: target.user.tag } });
  }, ms);
  tempBans.set(target.id, timer);
}

export async function handleKick(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "KickMembers")) return;
  const target = message.mentions.members?.first();
  if (!target) return message.reply({ embeds: [errorEmbed("Mentionne un membre.")] });
  const reason = args.slice(1).join(" ") || "Aucune raison";
  await target.kick(reason);
  message.reply({ embeds: [successEmbed(`**${target.user.tag}** a été expulsé. Raison: ${reason}`)] });
  sendLog(message.guild!, { action: "👢 Kick", color: 0xe67e22, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag }, reason });
}

export async function handleMute(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ModerateMembers")) return;
  const target = message.mentions.members?.first();
  const durationStr = args[1];
  const reason = args.slice(2).join(" ") || "Aucune raison";
  if (!target || !durationStr) return message.reply({ embeds: [errorEmbed("Usage: +mute @user [durée] [raison]")] });
  const ms = parseDuration(durationStr);
  if (!ms) return message.reply({ embeds: [errorEmbed("Durée invalide (ex: 10m, 2h, 7d)")] });
  const mutedRole = await getMutedRole(message.guild!);
  if (!mutedRole) return;
  await target.roles.add(mutedRole);
  message.reply({ embeds: [successEmbed(`**${target.user.tag}** muté pour ${formatDuration(ms)}. Raison: ${reason}`)] });
  sendLog(message.guild!, { action: "🔇 Mute", color: 0xfee75c, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag }, reason, duration: formatDuration(ms) });
  const timer = setTimeout(async () => {
    await target.roles.remove(mutedRole).catch(() => null);
    mutes.delete(target.id);
    sendLog(message.guild!, { action: "🔊 Mute expiré", color: 0x57f287, moderator: { id: message.client.user!.id, tag: message.client.user!.tag }, target: { id: target.id, tag: target.user.tag } });
  }, ms);
  mutes.set(target.id, timer);
}

export async function handleDemute(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ModerateMembers")) return;
  const target = message.mentions.members?.first();
  if (!target) return message.reply({ embeds: [errorEmbed("Mentionne un membre.")] });
  const mutedRole = await getMutedRole(message.guild!);
  if (!mutedRole) return;
  await target.roles.remove(mutedRole);
  const timer = mutes.get(target.id);
  if (timer) { clearTimeout(timer); mutes.delete(target.id); }
  message.reply({ embeds: [successEmbed(`**${target.user.tag}** a été démuté.`)] });
  sendLog(message.guild!, { action: "🔊 Demute", color: 0x57f287, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag } });
}

export async function handleDemuteAll(message: Message) {
  if (!hasModAccess(message.member!, "ModerateMembers")) return;
  const mutedRole = await getMutedRole(message.guild!);
  if (!mutedRole) return;
  const mutedMembers = message.guild!.members.cache.filter(m => m.roles.cache.has(mutedRole.id));
  for (const m of mutedMembers.values()) {
    await m.roles.remove(mutedRole).catch(() => null);
    const timer = mutes.get(m.id);
    if (timer) { clearTimeout(timer); mutes.delete(m.id); }
  }
  message.reply({ embeds: [successEmbed(`${mutedMembers.size} membre(s) démuté(s).`)] });
  sendLog(message.guild!, { action: "🔊 Demute All", color: 0x57f287, moderator: { id: message.author.id, tag: message.author.tag }, extra: { "Membres démutés": `${mutedMembers.size}` } });
}

export async function handleWarn(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ModerateMembers")) return;
  const target = message.mentions.members?.first();
  if (!target) return message.reply({ embeds: [errorEmbed("Mentionne un membre.")] });
  const reason = args.slice(1).join(" ") || "Aucune raison";
  const userWarns = warns.get(target.id) ?? [];
  userWarns.push({ reason, date: new Date() });
  warns.set(target.id, userWarns);
  message.reply({ embeds: [successEmbed(`**${target.user.tag}** averti. (${userWarns.length}/${WARN_LIMIT}) Raison: ${reason}`)] });
  sendLog(message.guild!, { action: "⚠️ Warn", color: 0xfee75c, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag }, reason, extra: { "Total warns": `${userWarns.length}/${WARN_LIMIT}` } });
  if (userWarns.length >= WARN_LIMIT) {
    await target.ban({ reason: `${WARN_LIMIT} avertissements atteints` });
    warns.delete(target.id);
    message.channel.send({ embeds: [successEmbed(`**${target.user.tag}** banni après ${WARN_LIMIT} avertissements.`)] });
    sendLog(message.guild!, { action: "🔨 Ban automatique (3 warns)", color: 0xed4245, moderator: { id: message.client.user!.id, tag: "KOYA'GESTION" }, target: { id: target.id, tag: target.user.tag }, reason: "3 avertissements atteints" });
  }
}

export async function handleUnwarn(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ModerateMembers")) return;
  const target = message.mentions.members?.first();
  if (!target) return message.reply({ embeds: [errorEmbed("Mentionne un membre.")] });
  const userWarns = warns.get(target.id) ?? [];
  if (userWarns.length === 0) return message.reply({ embeds: [errorEmbed("Aucun avertissement.")] });
  userWarns.pop();
  warns.set(target.id, userWarns);
  message.reply({ embeds: [successEmbed(`Un avertissement retiré à **${target.user.tag}**. (${userWarns.length}/${WARN_LIMIT})`)] });
  sendLog(message.guild!, { action: "↩️ Unwarn", color: 0x57f287, moderator: { id: message.author.id, tag: message.author.tag }, target: { id: target.id, tag: target.user.tag }, extra: { "Warns restants": `${userWarns.length}/${WARN_LIMIT}` } });
}

export async function handleWarns(message: Message) {
  const target = message.mentions.members?.first() ?? message.member!;
  const userWarns = warns.get(target.id) ?? [];
  if (userWarns.length === 0) return message.reply({ embeds: [errorEmbed(`**${target.user.tag}** n'a aucun avertissement.`)] });
  const { EmbedBuilder } = await import("discord.js");
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`Avertissements de ${target.user.tag}`)
    .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.date.getTime() / 1000)}:R>`).join("\n"));
  message.reply({ embeds: [embed] });
}

export async function handleClear(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ManageMessages")) return;
  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount < 1 || amount > 100) return message.reply({ embeds: [errorEmbed("Indique un nombre entre 1 et 100.")] });
  const deleted = await (message.channel as TextChannel).bulkDelete(amount + 1, true).catch(() => null);
  const count = (deleted?.size ?? 1) - 1;
  const msg = await message.channel.send({ embeds: [successEmbed(`${count} message(s) supprimé(s).`)] });
  setTimeout(() => msg.delete().catch(() => null), 3000);
  sendLog(message.guild!, { action: "🗑️ Clear", color: 0x99aab5, moderator: { id: message.author.id, tag: message.author.tag }, extra: { "Messages supprimés": `${count}`, "Salon": `<#${message.channel.id}>` } });
}

export async function handleSlowmode(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ManageChannels")) return;
  const seconds = parseInt(args[0]);
  if (isNaN(seconds)) return message.reply({ embeds: [errorEmbed("Indique un nombre de secondes.")] });
  await (message.channel as TextChannel).setRateLimitPerUser(seconds);
  message.reply({ embeds: [successEmbed(`Mode lent activé: ${seconds}s.`)] });
  sendLog(message.guild!, { action: "🐢 Slowmode", color: 0x99aab5, moderator: { id: message.author.id, tag: message.author.tag }, extra: { "Durée": `${seconds}s`, "Salon": `<#${message.channel.id}>` } });
}

export async function handleUnslowmode(message: Message) {
  if (!hasModAccess(message.member!, "ManageChannels")) return;
  await (message.channel as TextChannel).setRateLimitPerUser(0);
  message.reply({ embeds: [successEmbed("Mode lent désactivé.")] });
  sendLog(message.guild!, { action: "🐢 Slowmode désactivé", color: 0x99aab5, moderator: { id: message.author.id, tag: message.author.tag }, extra: { "Salon": `<#${message.channel.id}>` } });
}

export async function handleLock(message: Message) {
  if (!hasModAccess(message.member!, "ManageChannels")) return;
  await (message.channel as TextChannel).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: false });
  message.reply({ embeds: [successEmbed("Salon verrouillé.")] });
  sendLog(message.guild!, { action: "🔒 Lock", color: 0xed4245, moderator: { id: message.author.id, tag: message.author.tag }, extra: { "Salon": `<#${message.channel.id}>` } });
}

export async function handleUnlock(message: Message) {
  if (!hasModAccess(message.member!, "ManageChannels")) return;
  await (message.channel as TextChannel).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: null });
  message.reply({ embeds: [successEmbed("Salon déverrouillé.")] });
  sendLog(message.guild!, { action: "🔓 Unlock", color: 0x57f287, moderator: { id: message.author.id, tag: message.author.tag }, extra: { "Salon": `<#${message.channel.id}>` } });
}
