import { readFileSync, writeFileSync } from "fs";

const FILE = "/tmp/koya_last_seen.json";

export function loadLastSeen(): number {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf-8"));
    return data.ts ?? 0;
  } catch {
    return 0;
  }
}

export function saveLastSeen(): void {
  try {
    writeFileSync(FILE, JSON.stringify({ ts: Date.now() }), "utf-8");
  } catch {}
}
