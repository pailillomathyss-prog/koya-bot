import { Message, TextChannel } from "discord.js";
import { PREFIX } from "../data";
import { getMutedRole } from "../utils";
import { sendLog } from "../logger";
import {
  handleBan, handleUnban, handleTempBan, handleKick,
  handleMute, handleDemute, handleDemuteAll,
  handleWarn, handleUnwarn, handleWarns,
  handleClear, handleSlowmode, handleUnslowmode,
  handleLock, handleUnlock,
} from "../commands/moderation";
import { handleAnnounce } from "../commands/communication";
import { handleGiveaway, handleDmGiveaway } from "../commands/giveaway";
import { handleRank, handleDerank, handleCheckRoles, handleUpdateRoles } from "../commands/roles";
import { handleUserInfo, handleServerInfo, handleAvatar, handleVocTime, handleSetTime, handlePing, handleInvites, handleInviteTop, handleSyncInvites } from "../commands/info";
import { handleSetLogChannel, handleHelp } from "../commands/config";

const LINK_REGEX = /https?:\/\/[^\s]+/i;

export async function handleMessageCreate(message: Message) {
  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    switch (command) {
      case "ban":         return handleBan(message, args);
      case "unban":       return handleUnban(message, args);
      case "tempban":     return handleTempBan(message, args);
      case "kick":        return handleKick(message, args);
      case "mute":        return handleMute(message, args);
      case "demute":      return handleDemute(message, args);
      case "demuteall":   return handleDemuteAll(message);
      case "warn":        return handleWarn(message, args);
      case "unwarn":      return handleUnwarn(message, args);
      case "warns":       return handleWarns(message);
      case "clear":       return handleClear(message, args);
      case "slowmode":    return handleSlowmode(message, args);
      case "unslowmode":  return handleUnslowmode(message);
      case "lock":        return handleLock(message);
      case "unlock":      return handleUnlock(message);
      case "announce":    return handleAnnounce(message, args);
      case "giveaway":    return handleGiveaway(message, args);
      case "dmgiveaway":  return handleDmGiveaway(message);
      case "rank":        return handleRank(message, args);
      case "derank":      return handleDerank(message, args);
      case "checkroles":  return handleCheckRoles(message);
      case "updateroles": return handleUpdateRoles(message);
      case "userinfo":    return handleUserInfo(message);
      case "serverinfo":  return handleServerInfo(message);
      case "avatar":      return handleAvatar(message);
      case "voctime":     return handleVocTime(message);
      case "settime":     return handleSetTime(message, args);
      case "ping":        return handlePing(message);
      case "invites":       return handleInvites(message);
      case "invitetop":     return handleInviteTop(message);
      case "syncinvites":   return handleSyncInvites(message);
      case "setlog":      return handleSetLogChannel(message, args);
      case "help":        return handleHelp(message);
    }
    return;
  }

  // Anti-lien : actif h24
  await handleAntiLink(message);
}

async function handleAntiLink(message: Message) {
  if (!LINK_REGEX.test(message.content)) return;
  if (message.member?.permissions.has("ManageMessages")) return;

  await message.delete().catch(() => null);

  const mutedRole = await getMutedRole(message.guild!);
  if (!mutedRole) return;

  await message.member?.roles.add(mutedRole).catch(() => null);

  const warning = await message.channel.send({
    embeds: [{
      color: 0xed4245,
      description: `<@${message.author.id}> Les liens sont interdits ! Tu as été muté 15 minutes.`,
    }],
  });

  sendLog(message.guild!, {
    action: "🔗 Anti-lien (mute 15min)",
    color: 0xfee75c,
    moderator: { id: message.client.user!.id, tag: "KOYA'GESTION (Auto)" },
    target: { id: message.author.id, tag: message.author.tag },
    extra: { "Salon": `<#${message.channel.id}>` },
  });

  setTimeout(async () => {
    await message.member?.roles.remove(mutedRole).catch(() => null);
    warning.delete().catch(() => null);
  }, 15 * 60 * 1000);
}
