import { Interaction, GuildMember, Guild } from "discord.js";
import { giveaways, GiveawayCondition } from "../data";
import { buildGiveawayEmbed } from "../commands/giveaway";
import { saveGiveaways } from "../giveawayStore";

/** Compte les invitations d'un membre directement depuis Discord (historique complet) */
async function getLiveInviteCount(guild: Guild, userId: string): Promise<number> {
  try {
    const invites = await guild.invites.fetch();
    return invites
      .filter(i => i.inviterId === userId)
      .reduce((sum, i) => sum + (i.uses ?? 0), 0);
  } catch {
    return 0;
  }
}

async function checkCondition(member: GuildMember, condition: GiveawayCondition): Promise<string | null> {
  if (condition.type === "none") return null;

  if (condition.type === "role") {
    if (!member.roles.cache.has(condition.roleId)) {
      return `Tu dois avoir le rôle **${condition.roleName}** pour participer.`;
    }
    return null;
  }

  if (condition.type === "account_age") {
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    if (ageDays < condition.days) {
      return `Ton compte Discord doit avoir au moins **${condition.days} jour(s)** (le tien en a ${ageDays}).`;
    }
    return null;
  }

  if (condition.type === "invites") {
    // Lecture directe depuis Discord → compte toutes les invitations (y compris avant le bot)
    const realCount = await getLiveInviteCount(member.guild, member.id);
    if (realCount < condition.count) {
      return `Tu dois avoir invité au moins **${condition.count} membre(s)** via tes liens d'invitation (tu en as invité **${realCount}** au total).`;
    }
    return null;
  }

  return null;
}

export async function handleInteraction(interaction: Interaction) {
  if (!interaction.isButton()) return;

  if (interaction.customId === "giveaway_enter") {
    const data = giveaways.get(interaction.message.id);
    if (!data) {
      return interaction.reply({ content: "❌ Ce giveaway est terminé.", ephemeral: true });
    }

    if (data.entrants.has(interaction.user.id)) {
      return interaction.reply({ content: "Tu participes déjà à ce giveaway ! 🎉", ephemeral: true });
    }

    // Defer pour éviter le timeout pendant la vérification Discord API
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    const conditionError = await checkCondition(member, data.condition);
    if (conditionError) {
      return interaction.editReply({ content: `❌ **Condition non remplie :** ${conditionError}` });
    }

    data.entrants.add(interaction.user.id);
    saveGiveaways();

    const embed = buildGiveawayEmbed({
      reward: data.reward,
      winners: data.winners,
      endTime: data.endTime,
      condition: data.condition,
      host: interaction.message.embeds[0]?.footer?.text?.replace("Organisé par ", "") ?? "?",
      entrantsCount: data.entrants.size,
    });
    await interaction.message.edit({ embeds: [embed] }).catch(() => null);

    return interaction.editReply({
      content: `✅ Tu es inscrit au giveaway ! **${data.entrants.size}** participant(s) jusqu'ici.`,
    });
  }
}
