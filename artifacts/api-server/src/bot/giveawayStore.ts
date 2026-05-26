import { Client, TextChannel, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { giveaways, GiveawayCondition } from "./data";
import { endGiveaway } from "./commands/giveaway";
import { buildGiveawayEmbed } from "./commands/giveaway";

const STORE_PATH = "/tmp/koya_giveaways.json";

interface StoredGiveaway {
  channelId: string;
  messageId: string;
  guildId: string;
  winners: number;
  reward: string;
  endTime: number;
  condition: GiveawayCondition;
  entrants: string[];
  host: string;
}

export function saveGiveaways() {
  const data: StoredGiveaway[] = [];
  for (const [, g] of giveaways) {
    data.push({
      channelId: g.channelId,
      messageId: g.messageId,
      guildId: g.guildId,
      winners: g.winners,
      reward: g.reward,
      endTime: g.endTime,
      condition: g.condition,
      entrants: [...g.entrants],
      host: (g as any).host ?? "?",
    });
  }
  try {
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

export async function restoreGiveaways(client: Client) {
  if (!existsSync(STORE_PATH)) return;

  let data: StoredGiveaway[] = [];
  try {
    data = JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return;
  }

  const now = Date.now();

  for (const g of data) {
    // Ignorer les giveaways déjà expirés
    if (g.endTime <= now) {
      // Terminer sans réécrire (il aurait dû se terminer pendant le downtime)
      await endExpiredGiveaway(client, g);
      continue;
    }

    // Remettre en mémoire
    giveaways.set(g.messageId, {
      channelId: g.channelId,
      messageId: g.messageId,
      guildId: g.guildId,
      winners: g.winners,
      reward: g.reward,
      endTime: g.endTime,
      condition: g.condition,
      entrants: new Set(g.entrants),
    });

    // Remettre le bouton + mettre à jour l'embed sur le message
    const remaining = g.endTime - now;
    try {
      const channel = client.channels.cache.get(g.channelId) as TextChannel;
      if (channel) {
        const msg = await channel.messages.fetch(g.messageId).catch(() => null);
        if (msg) {
          const embed = buildGiveawayEmbed({
            reward: g.reward,
            winners: g.winners,
            endTime: g.endTime,
            condition: g.condition,
            host: g.host,
            entrantsCount: g.entrants.length,
          });
          const button = new ButtonBuilder()
            .setCustomId("giveaway_enter")
            .setLabel("🎉 Participer")
            .setStyle(ButtonStyle.Primary);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
          await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
        }
      }
    } catch {}

    // Reprogrammer la fin
    setTimeout(() => endGiveaway(g.messageId), remaining);
  }

  saveGiveaways();
}

async function endExpiredGiveaway(client: Client, g: StoredGiveaway) {
  try {
    const channel = client.channels.cache.get(g.channelId) as TextChannel;
    if (!channel) return;
    const msg = await channel.messages.fetch(g.messageId).catch(() => null);
    if (!msg) return;

    const entrantsArr = g.entrants;
    const winnerIds = [...entrantsArr].sort(() => Math.random() - 0.5).slice(0, g.winners);

    const embed = new EmbedBuilder()
      .setColor(winnerIds.length > 0 ? 0x57f287 : 0xed4245)
      .setTitle("🎉 GIVEAWAY TERMINÉ 🎉")
      .addFields(
        { name: "🏆 Lot", value: g.reward },
        { name: "👥 Participants", value: `${entrantsArr.length}` },
        {
          name: winnerIds.length > 0 ? "🎊 Gagnant(s)" : "😞 Résultat",
          value: winnerIds.length > 0 ? winnerIds.map(id => `<@${id}>`).join(", ") : "Aucun participant.",
        },
      )
      .setTimestamp();

    await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
    if (winnerIds.length > 0) {
      channel.send(`🎉 Félicitations ${winnerIds.map(id => `<@${id}>`).join(", ")} ! Vous avez gagné **${g.reward}** !`);
    }
  } catch {}
}
