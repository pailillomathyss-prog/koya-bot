import { VoiceState } from "discord.js";
import { vocTime, vocJoin } from "../data";
import { updateVocRoles } from "../utils";

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  if (!oldState.channelId && newState.channelId) {
    vocJoin.set(member.id, Date.now());
  } else if (oldState.channelId && !newState.channelId) {
    const joinTime = vocJoin.get(member.id);
    if (joinTime) {
      const elapsed = Math.floor((Date.now() - joinTime) / 1000);
      const prev = vocTime.get(member.id) ?? 0;
      vocTime.set(member.id, prev + elapsed);
      vocJoin.delete(member.id);
      await updateVocRoles(member);
    }
  }
}
