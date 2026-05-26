import { Message, EmbedBuilder, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder, Role } from "discord.js";
import { giveaways, GiveawayCondition } from "../data";
import { parseDuration, errorEmbed, hasModAccess } from "../utils";
import { client } from "../index";
import { saveGiveaways } from "../giveawayStore";

const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function conditionLabel(condition: GiveawayCondition): string {
  if (condition.type === "none") return "Aucune — tout le monde peut participer";
  if (condition.type === "role") return `Avoir le rôle <@&${condition.roleId}>`;
  if (condition.type === "account_age") return `Compte Discord âgé de **${condition.days}j** minimum`;
  if (condition.type === "invites") return `Avoir invité **${condition.count} membre(s)** minimum`;
  return "Aucune";
}

// Détecte automatiquement si le lot contient un @rôle → devient la condition
function extractConditionFromLot(args: string[], message: Message): { condition: GiveawayCondition; reward: string } {
  const roleMention = args.find(a => /^<@&\d+>$/.test(a));
  if (roleMention) {
    const roleId = roleMention.replace(/[<@&>]/g, "");
    const role = message.guild?.roles.cache.get(roleId);
    const reward = args.filter(a => a !== roleMention).join(" ");
    if (role) {
      return {
        condition: { type: "role", roleId: role.id, roleName: role.name },
        reward: reward || roleMention,
      };
    }
  }
  return { condition: { type: "none" }, reward: args.join(" ") };
}

export async function handleGiveaway(message: Message, args: string[]) {
  if (!hasModAccess(message.member!, "ManageGuild")) return;

  // Syntaxe : +giveaway [durée] [gagnants] [lot]
  // Le lot peut contenir un @rôle (condition auto) et/ou du texte (prix)
  // Ex: +giveaway 2h 1 Nitro
  // Ex: +giveaway 7j 3 @Membre 10€ Paypal
  // Ex: +giveaway 24h 1 invites:2 Jeu Steam
  // Ex: +giveaway 1j 2 compte:30 PS5

  if (args.length < 3) {
    return message.reply({
      embeds: [errorEmbed(
        "**Usage :** `+giveaway [durée] [gagnants] [lot]`\n\n" +
        "**Durée :** max 7 jours → `30m` `2h` `7j`\n" +
        "**Gagnants :** nombre de gagnants → `1` `3`\n" +
        "**Lot :** ce que les gagnants remportent\n\n" +
        "**Conditions automatiques dans le lot :**\n" +
        "• `@rôle` → réservé aux membres ayant ce rôle\n" +
        "• `invites:2` → avoir invité 2+ membres\n" +
        "• `compte:30` → compte Discord de 30+ jours\n\n" +
        "**Exemples :**\n" +
        "`+giveaway 2h 1 Nitro Classic`\n" +
        "`+giveaway 7j 3 @Membre 10€ Paypal`\n" +
        "`+giveaway 1j 1 invites:2 Jeu Steam`"
      )],
    });
  }

  const durationStr = args[0];
  const winnersRaw = parseInt(args[1]);
  const lotArgs = args.slice(2);

  if (isNaN(winnersRaw) || winnersRaw < 1) {
    return message.reply({ embeds: [errorEmbed("Le nombre de gagnants doit être au moins 1.")] });
  }

  const ms = parseDuration(durationStr);
  if (!ms) return message.reply({ embeds: [errorEmbed("Durée invalide. Exemples : `10m`, `2h`, `7j`")] });
  if (ms > MAX_DURATION_MS) return message.reply({ embeds: [errorEmbed("La durée maximale est de **7 jours**.")] });

  // Détecter les conditions spéciales dans le lot
  let condition: GiveawayCondition = { type: "none" };
  let rewardArgs = [...lotArgs];

  // Chercher invites:X ou compte:X en premier dans le lot
  const specialIdx = rewardArgs.findIndex(a => /^invites?:\d+$/i.test(a) || /^compte:\d+$/i.test(a));
  if (specialIdx !== -1) {
    const token = rewardArgs[specialIdx];
    const invMatch = token.match(/^invites?:(\d+)$/i);
    const ageMatch = token.match(/^compte:(\d+)$/i);
    if (invMatch) condition = { type: "invites", count: parseInt(invMatch[1]) };
    if (ageMatch) condition = { type: "account_age", days: parseInt(ageMatch[1]) };
    rewardArgs.splice(specialIdx, 1);
  } else {
    // Sinon chercher un @rôle
    const extracted = extractConditionFromLot(rewardArgs, message);
    condition = extracted.condition;
    rewardArgs = extracted.reward.split(" ").filter(Boolean);
  }

  const reward = rewardArgs.join(" ");
  if (!reward) return message.reply({ embeds: [errorEmbed("Indique le lot du giveaway.")] });

  const endTime = Date.now() + ms;
  const embed = buildGiveawayEmbed({
    reward,
    winners: winnersRaw,
    endTime,
    condition,
    host: message.author.tag,
    entrantsCount: 0,
  });

  const button = new ButtonBuilder()
    .setCustomId("giveaway_enter")
    .setLabel("🎉 Participer")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  const msg = await (message.channel as TextChannel).send({ embeds: [embed], components: [row] });

  const entry = {
    channelId: message.channel.id,
    messageId: msg.id,
    guildId: message.guild!.id,
    winners: winnersRaw,
    reward,
    endTime,
    condition,
    entrants: new Set<string>(),
    host: message.author.tag,
  };
  giveaways.set(msg.id, entry);
  saveGiveaways();

  message.delete().catch(() => null);
  setTimeout(() => endGiveaway(msg.id), ms);

  // Envoyer un MP à tous les membres du serveur
  sendGiveawayDMs(message, reward, condition, endTime, msg.url);
}

async function sendGiveawayDMs(
  message: Message,
  reward: string,
  condition: GiveawayCondition,
  endTime: number,
  giveawayUrl: string,
) {
  const guild = message.guild!;

  // Charger tous les membres (y compris ceux pas encore en cache)
  let members;
  try {
    members = await guild.members.fetch();
  } catch {
    return;
  }

  const targets = members.filter(m => !m.user.bot);

  const dmEmbed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🎉 Un giveaway vient d'être lancé !")
    .setDescription(`Un giveaway est en cours sur **${guild.name}** !`)
    .addFields(
      { name: "🏆 Lot", value: reward, inline: false },
      { name: "✅ Condition", value: conditionLabel(condition), inline: false },
      { name: "⏰ Se termine", value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: "Clique sur le bouton dans le salon pour participer !" })
    .setTimestamp();

  let sent = 0;
  let failed = 0;

  for (const member of targets.values()) {
    try {
      await member.send({ embeds: [dmEmbed] });
      sent++;
    } catch {
      // L'utilisateur a les DMs désactivés — on passe
      failed++;
    }
    // Petite pause entre chaque DM pour éviter le rate-limit Discord
    await new Promise(r => setTimeout(r, 500));
  }

  // Confirmer dans le salon original (message éphémère visible uniquement par le modérateur)
  message.channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`📨 MP envoyés : **${sent}** membres notifiés, **${failed}** ont les DMs désactivés.`)],
  }).then(m => setTimeout(() => m.delete().catch(() => null), 8000));
}

export function buildGiveawayEmbed(opts: {
  reward: string;
  winners: number;
  endTime: number;
  condition: GiveawayCondition;
  host: string;
  entrantsCount: number;
}) {
  const winnerText = opts.winners === 1 ? "1 gagnant" : `${opts.winners} gagnants`;
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🎉 GIVEAWAY 🎉")
    .addFields(
      { name: "🏆 Lot", value: opts.reward, inline: false },
      { name: "👑 Gagnant(s)", value: winnerText, inline: true },
      { name: "⏰ Fin", value: `<t:${Math.floor(opts.endTime / 1000)}:R>`, inline: true },
      { name: "✅ Condition", value: conditionLabel(opts.condition), inline: false },
      { name: "👥 Participants", value: `${opts.entrantsCount}`, inline: true },
    )
    .setFooter({ text: `Organisé par ${opts.host}` })
    .setTimestamp();
}

export async function handleDmGiveaway(message: Message) {
  if (!hasModAccess(message.member!, "ManageGuild")) return;

  // Trouver les giveaways actifs sur ce serveur
  const activeGiveaways = [...giveaways.values()].filter(g => g.guildId === message.guild!.id);

  if (activeGiveaways.length === 0) {
    return message.reply({ embeds: [errorEmbed("Aucun giveaway actif sur ce serveur en ce moment.")] });
  }

  // Prendre le giveaway le plus récent (endTime le plus loin)
  const g = activeGiveaways.sort((a, b) => b.endTime - a.endTime)[0];

  const status = await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription("⏳ Envoi des MPs en cours...")],
  });

  let members;
  try {
    members = await message.guild!.members.fetch();
  } catch {
    return status.edit({ embeds: [errorEmbed("Impossible de récupérer les membres.")] });
  }

  const targets = members.filter(m => !m.user.bot);

  const dmEmbed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🎉 Un giveaway est en cours !")
    .setDescription(`Ne rate pas le giveaway actif sur **${message.guild!.name}** !`)
    .addFields(
      { name: "🏆 Lot", value: g.reward, inline: false },
      { name: "✅ Condition", value: conditionLabel(g.condition), inline: false },
      { name: "⏰ Se termine", value: `<t:${Math.floor(g.endTime / 1000)}:R>`, inline: true },
      { name: "👥 Participants", value: `${g.entrants.size}`, inline: true },
    )
    .setFooter({ text: "Clique sur le bouton dans le salon pour participer !" })
    .setTimestamp();

  let sent = 0;
  let failed = 0;

  for (const member of targets.values()) {
    try {
      await member.send({ embeds: [dmEmbed] });
      sent++;
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await status.edit({
    embeds: [new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("📨 MPs envoyés !")
      .addFields(
        { name: "✅ Envoyés", value: `${sent}`, inline: true },
        { name: "❌ DMs désactivés", value: `${failed}`, inline: true },
      )],
  });
}

export async function endGiveaway(messageId: string) {
  const data = giveaways.get(messageId);
  if (!data) return;
  giveaways.delete(messageId);
  saveGiveaways();

  const channel = client.channels.cache.get(data.channelId) as TextChannel;
  if (!channel) return;

  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return;

  const entrantsArr = [...data.entrants];
  const winnerIds = entrantsArr.sort(() => Math.random() - 0.5).slice(0, data.winners);

  const winnerText = winnerIds.length > 0 ? winnerIds.map(id => `<@${id}>`).join(", ") : "Aucun participant.";
  const embed = new EmbedBuilder()
    .setColor(winnerIds.length > 0 ? 0x57f287 : 0xed4245)
    .setTitle("🎉 GIVEAWAY TERMINÉ 🎉")
    .addFields(
      { name: "🏆 Lot", value: data.reward },
      { name: "👥 Participants", value: `${entrantsArr.length}` },
      { name: winnerIds.length > 0 ? "🎊 Gagnant(s)" : "😞 Résultat", value: winnerText },
    )
    .setTimestamp();

  await msg.edit({ embeds: [embed], components: [] });

  if (winnerIds.length > 0) {
    channel.send(`🎉 Félicitations ${winnerIds.map(id => `<@${id}>`).join(", ")} ! Vous avez gagné **${data.reward}** !`);
  }
}
