import { Client, TextChannel } from "discord.js";
import { loadLastSeen, saveLastSeen } from "./lastSeenStore";
import { getMutedRole } from "./utils";
import { sendLog } from "./logger";

const LINK_REGEX = /https?:\/\/[^\s]+/i;

/** Convertit un timestamp ms en snowflake Discord (utilisé pour fetch after:) */
function tsToSnowflake(ts: number): string {
  return ((BigInt(ts - 1420070400000) << 22n)).toString();
}

export async function runCatchUp(client: Client) {
  const lastSeen = loadLastSeen();
  // Sauvegarde immédiatement le timestamp actuel pour la prochaine fois
  saveLastSeen();

  if (!lastSeen) return; // Premier démarrage, pas d'historique à rattraper

  const absence = Math.round((Date.now() - lastSeen) / 1000 / 60);
  if (absence < 1) return; // Redémarrage trop rapide, rien à rattraper

  for (const guild of client.guilds.cache.values()) {
    const mutedRole = await getMutedRole(guild);
    if (!mutedRole) continue;

    const textChannels = guild.channels.cache.filter(
      (c): c is TextChannel => c.isTextBased() && !c.isDMBased()
    );

    for (const channel of textChannels.values()) {
      try {
        const messages = await channel.messages.fetch({
          limit: 100,
          after: tsToSnowflake(lastSeen),
        });

        for (const msg of messages.values()) {
          if (msg.author.bot) continue;
          if (!LINK_REGEX.test(msg.content)) continue;

          const member = await guild.members.fetch(msg.author.id).catch(() => null);
          if (!member) continue;
          if (member.permissions.has("ManageMessages")) continue;

          // Supprime le message (fonctionne même rétroactivement si < 14 jours)
          await msg.delete().catch(() => null);

          // Mute 15 min
          await member.roles.add(mutedRole).catch(() => null);
          setTimeout(() => member.roles.remove(mutedRole).catch(() => null), 15 * 60 * 1000);

          sendLog(guild, {
            action: "🔗 Anti-lien (rattrapage absence)",
            color: 0xfee75c,
            moderator: { id: client.user!.id, tag: "KOYA'GESTION (Auto)" },
            target: { id: msg.author.id, tag: msg.author.tag },
            extra: {
              "Salon": `<#${channel.id}>`,
              "Message posté": `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`,
              "Absence du bot": `${absence} min`,
            },
          });
        }
      } catch {
        // Salon inaccessible, on passe
      }
    }
  }
}
