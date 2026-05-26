export const warns = new Map<string, { reason: string; date: Date }[]>();
export const vocTime = new Map<string, number>();
export const vocJoin = new Map<string, number>();
export const tempBans = new Map<string, ReturnType<typeof setTimeout>>();
export const mutes = new Map<string, ReturnType<typeof setTimeout>>();

// Invite tracking
// inviteCache[guildId][code] = { uses, inviterId }
export const inviteCache = new Map<string, Map<string, { uses: number; inviterId: string }>>();
// Nombre d'invitations réussies par inviteur: inviteCount[inviterId] = count
export const inviteCount = new Map<string, number>();
// Anti-doublon: qui a invité chaque membre. invitedBy[memberId] = inviterId
export const invitedBy = new Map<string, string>();

export type GiveawayCondition =
  | { type: "none" }
  | { type: "role"; roleId: string; roleName: string }
  | { type: "account_age"; days: number }
  | { type: "invites"; count: number };

export const giveaways = new Map<string, {
  channelId: string;
  messageId: string;
  guildId: string;
  winners: number;
  reward: string;
  endTime: number;
  condition: GiveawayCondition;
  entrants: Set<string>;
}>();

export const RANK_ROLES: { hours: number; name: string }[] = [
  { hours: 5, name: "novice" },
  { hours: 10, name: "expérimenter" },
  { hours: 30, name: "expert" },
  { hours: 75, name: "king jr" },
  { hours: 100, name: "king" },
];

export const WARN_LIMIT = 3;
export const PREFIX = "+";
export const BOT_START_HOUR = 7;
export const BOT_END_HOUR = 21;
export const TIMEZONE = "Europe/Paris";
