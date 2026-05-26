import { Client, Guild, GuildMember, Invite } from "discord.js";
import { inviteCache, inviteCount, invitedBy } from "../data";
import { saveInvites, loadInvites } from "../inviteStore";
import { logger } from "../../lib/logger";

async function hasManageGuild(guild: Guild): Promise<boolean> {
  const botMember = guild.members.cache.get(guild.client.user!.id)
    ?? await guild.members.fetch(guild.client.user!.id).catch(() => null);
  return botMember?.permissions.has("ManageGuild") ?? false;
}

export async function cacheGuildInvites(guild: Guild): Promise<boolean> {
  if (!(await hasManageGuild(guild))) {
    logger.warn(`[InviteTracker] Pas la permission 'Gérer le serveur' sur ${guild.name}`);
    return false;
  }
  try {
    const invites = await guild.invites.fetch();
    const map = new Map<string, { uses: number; inviterId: string }>();
    for (const invite of invites.values()) {
      if (invite.inviterId) {
        map.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId });
      }
    }
    inviteCache.set(guild.id, map);
    logger.info(`[InviteTracker] ${map.size} invitation(s) en cache — ${guild.name}`);
    return true;
  } catch (err) {
    logger.error(`[InviteTracker] Erreur cache ${guild.name}: ${err}`);
    return false;
  }
}

/**
 * Recalcule les comptes d'invitations depuis Discord (uses de chaque code).
 * Utilisé par +syncinvites et au démarrage si besoin.
 */
export async function syncInviteCountsFromApi(guild: Guild): Promise<boolean> {
  if (!(await hasManageGuild(guild))) return false;
  try {
    const invites = await guild.invites.fetch();
    // Recalcul propre: somme des uses par inviteur
    const freshCounts = new Map<string, number>();
    const map = new Map<string, { uses: number; inviterId: string }>();

    for (const invite of invites.values()) {
      if (!invite.inviterId) continue;
      const uses = invite.uses ?? 0;
      map.set(invite.code, { uses, inviterId: invite.inviterId });
      freshCounts.set(invite.inviterId, (freshCounts.get(invite.inviterId) ?? 0) + uses);
    }

    inviteCache.set(guild.id, map);

    // Mettre à jour inviteCount uniquement avec les nouvelles valeurs calculées
    for (const [id, count] of freshCounts) {
      inviteCount.set(id, count);
    }

    saveInvites();
    logger.info(`[InviteTracker] Sync complète — ${guild.name}: ${freshCounts.size} membres avec invitations`);
    return true;
  } catch (err) {
    logger.error(`[InviteTracker] Erreur sync ${guild.name}: ${err}`);
    return false;
  }
}

export function registerInviteEvents(client: Client) {
  // Charger les données persistées au démarrage
  loadInvites();

  client.once("ready", async () => {
    for (const guild of client.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }
  });

  client.on("guildCreate", async (guild: Guild) => {
    await cacheGuildInvites(guild);
  });

  client.on("inviteCreate", async (invite: Invite) => {
    if (!invite.guild || !invite.inviterId) return;
    const map = inviteCache.get(invite.guild.id) ?? new Map();
    map.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId });
    inviteCache.set(invite.guild.id, map);
  });

  client.on("inviteDelete", async (invite: Invite) => {
    if (!invite.guild) return;
    const map = inviteCache.get(invite.guild.id);
    if (map) map.delete(invite.code);
  });

  client.on("guildMemberAdd", async (member: GuildMember) => {
    const guild = member.guild;
    const cached = inviteCache.get(guild.id);

    if (!cached) {
      await cacheGuildInvites(guild);
      return;
    }

    try {
      const newInvites = await guild.invites.fetch();
      let foundInviterId: string | null = null;

      for (const invite of newInvites.values()) {
        const old = cached.get(invite.code);
        const newUses = invite.uses ?? 0;

        if (old && newUses > old.uses) {
          foundInviterId = old.inviterId;

          // Anti-doublon : si ce membre avait déjà été invité par quelqu'un,
          // on décrémente l'ancien inviteur avant d'incrémenter le nouveau
          const previousInviter = invitedBy.get(member.id);
          if (previousInviter && previousInviter !== foundInviterId) {
            const prev = inviteCount.get(previousInviter) ?? 0;
            if (prev > 0) inviteCount.set(previousInviter, prev - 1);
          }

          if (!previousInviter || previousInviter !== foundInviterId) {
            // Enregistrer qui a invité ce membre
            invitedBy.set(member.id, foundInviterId);
            // Incrémenter le compteur de l'inviteur
            const current = inviteCount.get(foundInviterId) ?? 0;
            inviteCount.set(foundInviterId, current + 1);
            logger.info(`[InviteTracker] ${member.user.tag} invité par ${foundInviterId} (total: ${current + 1})`);
          } else {
            logger.info(`[InviteTracker] ${member.user.tag} a rejoint de nouveau via le même inviteur — pas de double comptage`);
          }

          // Mettre à jour le cache de ce code
          cached.set(invite.code, { uses: newUses, inviterId: foundInviterId });
          break;
        }
      }

      if (!foundInviterId) {
        logger.info(`[InviteTracker] ${member.user.tag} a rejoint sans invitation trackée (lien vanity/discovery)`);
      }

      // Rafraîchir tout le cache
      for (const invite of newInvites.values()) {
        if (invite.inviterId) {
          cached.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId });
        }
      }
      inviteCache.set(guild.id, cached);
      saveInvites();
    } catch (err) {
      logger.error(`[InviteTracker] Erreur guildMemberAdd: ${err}`);
    }
  });

  // Si un membre quitte, on garde son invitedBy pour l'anti-doublon
  // mais on ne décrémente PAS (l'invite a bien eu lieu)
}
