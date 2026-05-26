import { Message, EmbedBuilder, TextChannel } from "discord.js";
import { logChannels } from "../logger";
import { successEmbed, errorEmbed, hasModAccess, ADMIN_ROLE_NAME } from "../utils";

export async function handleSetLogChannel(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "Administrator")) {
    return message.reply({ embeds: [errorEmbed("Tu dois être Administrateur ou avoir le rôle **👑 koya's** pour utiliser cette commande.")] });
  }

  const channel = message.mentions.channels.first() as TextChannel | undefined;
  if (!channel) {
    return message.reply({ embeds: [errorEmbed("Mentionne un salon. Ex: `+setlog #logs`")] });
  }

  logChannels.set(message.guild!.id, channel.id);

  message.reply({ embeds: [successEmbed(`Salon de logs défini sur <#${channel.id}>. Toutes les actions de modération y seront enregistrées.`)] });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📋 KOYA'GESTION — Logs activés")
    .setDescription("Ce salon recevra tous les logs de modération : bans, kicks, mutes, warns, clear, etc.")
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

export async function handleHelp(message: Message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: "KOYA'GESTION", iconURL: message.client.user?.displayAvatarURL() })
    .setTitle("📋 Commandes disponibles")
    .addFields(
      {
        name: "🔨 Modération",
        value: [
          "`+ban @user [raison]` — Bannir",
          "`+unban [ID]` — Débannir",
          "`+tempban @user [durée] [raison]` — Ban temporaire",
          "`+kick @user [raison]` — Expulser",
          "`+mute @user [durée] [raison]` — Muter",
          "`+demute @user` — Démuter",
          "`+demuteall` — Démuter tout le monde",
          "`+warn @user [raison]` — Avertir (3 = ban auto)",
          "`+unwarn @user` — Retirer un warn",
          "`+warns @user` — Voir les warns",
          "`+clear [1-100]` — Supprimer des messages",
          "`+slowmode [sec]` — Mode lent",
          "`+unslowmode` — Désactiver mode lent",
          "`+lock` — Verrouiller le salon",
          "`+unlock` — Déverrouiller le salon",
        ].join("\n"),
      },
      {
        name: "📢 Communication",
        value: [
          "`+announce [texte]` — Annonce @everyone",
          "`+announce #salon [texte]` — Annonce dans un salon ciblé",
        ].join("\n"),
      },
      {
        name: "🎉 Événements",
        value: [
          "`+giveaway [durée] [gagnants] [lot]` — Lancer un giveaway (max 7j)",
          "**Conditions dans le lot :** `@role` · `invites:2` · `compte:30`",
          "Ex: `+giveaway 2h 1 Nitro` · `+giveaway 7j 3 @Membre 10€`",
          "`+dmgiveaway` — Renvoyer le MP du giveaway actif à tous les membres",
        ].join("\n"),
      },
      {
        name: "🎭 Rôles",
        value: [
          "`+rank @user @role` — Donner/retirer un rôle",
          "`+derank @user @role` — Retirer un rôle",
          "`+checkroles` — Vérifier les rôles vocaux",
          "`+updateroles` — Mettre à jour tous les rôles",
        ].join("\n"),
      },
      {
        name: "ℹ️ Informations",
        value: [
          "`+userinfo [@user]` — Fiche d'un membre",
          "`+serverinfo` — Infos du serveur",
          "`+avatar [@user]` — Afficher l'avatar",
          "`+voctime [@user]` — Temps vocal",
          "`+settime @user [heures]` — Définir le temps vocal",
          "`+ping` — Latence du bot",
          "`+invites [@user]` — Invitations d'un membre",
          "`+invitetop` — Classement des invitations (top 10)",
          "`+syncinvites` — Recalculer les invitations depuis Discord",
        ].join("\n"),
      },
      {
        name: "⚙️ Configuration",
        value: "`+setlog #salon` — Définir le salon de logs",
      },
      {
        name: "🤖 Automatique",
        value: [
          "Anti-lien — Supprime les liens et mute 15 min",
          "Rôles vocaux — Attribués automatiquement",
          "Horaires — Actif de 7h à 21h (Paris)",
        ].join("\n"),
      },
      {
        name: "🏅 Rangs vocaux",
        value: "@novice (5h) → @expérimenter (10h) → @expert (30h) → @king jr (75h) → @king (100h)",
      },
      {
        name: "🔑 Accès",
        value: `Le rôle **${ADMIN_ROLE_NAME}** peut utiliser toutes les commandes.`,
      },
    )
    .setFooter({ text: "Préfixe: + | KOYA'GESTION" })
    .setTimestamp();

  message.reply({ embeds: [embed] });
}
