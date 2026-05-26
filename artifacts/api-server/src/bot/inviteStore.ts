import { readFileSync, writeFileSync, existsSync } from "fs";
import { inviteCount, invitedBy } from "./data";

const COUNT_PATH = "/tmp/koya_invites.json";

interface StoredInvites {
  counts: Record<string, number>;   // inviterId -> nb d'invitations
  invitedBy: Record<string, string>; // memberId -> inviterId (anti-doublon)
}

export function saveInvites() {
  const data: StoredInvites = {
    counts: Object.fromEntries(inviteCount),
    invitedBy: Object.fromEntries(invitedBy),
  };
  try {
    writeFileSync(COUNT_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

export function loadInvites() {
  if (!existsSync(COUNT_PATH)) return;
  try {
    const data: StoredInvites = JSON.parse(readFileSync(COUNT_PATH, "utf-8"));
    for (const [k, v] of Object.entries(data.counts ?? {})) inviteCount.set(k, v);
    for (const [k, v] of Object.entries(data.invitedBy ?? {})) invitedBy.set(k, v);
  } catch {}
}
