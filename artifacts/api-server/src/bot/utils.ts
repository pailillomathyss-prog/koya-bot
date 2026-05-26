import { Guild, GuildMember, Role, EmbedBuilder, TextChannel, PermissionResolvable } from "discord.js";
import { RANK_ROLES, vocTime } from "./data";

export const ADMIN_ROLE_NAME = "👑 koya's";

export function hasModAccess(member: GuildMember, permission?: PermissionResolvable): boolean {
  const hasRole = member.roles.cache.some(
    (r) => r.name.toLowerCase() === ADMIN_ROLE_NAME.toLowerCase()
  );
  if (hasRole) return true;
  if (permission) return member.permissions.has(permission);
  return false;
}

export function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d|j)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000, j: 86400000 };
  return val * multipliers[unit];
}

export function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.floor(ms / 86400000)}j`;
}

export function successEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x57f287).setDescription(`✅ ${description}`);
}

export function errorEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${description}`);
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(description);
}

export async function getMutedRole(guild: Guild): Promise<Role | null> {
  let role = guild.roles.cache.find((r) => r.name === "Muted");
  if (!role) {
    role = await guild.roles.create({
      name: "Muted",
      permissions: [],
      reason: "Muted role for bot",
    });
    for (const channel of guild.channels.cache.values()) {
      await (channel as TextChannel).permissionOverwrites?.edit(role, {
        SendMessages: false,
        Speak: false,
        AddReactions: false,
      }).catch(() => {});
    }
  }
  return role;
}

export async function updateVocRoles(member: GuildMember): Promise<void> {
  const hours = (vocTime.get(member.id) ?? 0) / 3600;
  for (const rank of [...RANK_ROLES].reverse()) {
    const role = member.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === rank.name.toLowerCase()
    );
    if (!role) continue;
    if (hours >= rank.hours) {
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
      }
      break;
    } else {
      await member.roles.remove(role).catch(() => {});
    }
  }
}

export function isActiveParis(): boolean {
  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const hour = paris.getHours();
  return hour >= 7 && hour < 21;
}
