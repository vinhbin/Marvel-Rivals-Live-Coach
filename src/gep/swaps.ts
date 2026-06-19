/**
 * Phase 3.2 — roster diff / swap detection (pure, platform-neutral).
 *
 * Diffs two consecutive GEP roster snapshots and emits the hero swaps. Tracked by `uid`, NEVER by
 * roster index (Conventions: index is a dynamic 0–11 slot). Design §3: "diff the enemy side's
 * character_name set on each update; emit swap(old, new, side)".
 *
 * Reveal vs swap (the Q-001 subtlety): a `*****`/empty → real-name transition is a REVEAL (first
 * population of a name we couldn't see), NOT a swap — it emits nothing. Only a real-name → different
 * real-name change on the same uid is a swap. A named → masked transition (rare) is ignored. A uid
 * appearing/disappearing is a join/leave, not a swap.
 *
 * Untrackable uids are SKIPPED, never diffed: an empty uid (the schema's fallback for a player GEP
 * reported without one) and any uid that appears more than once in a snapshot are ambiguous — we
 * cannot reliably match the same player across snapshots, so we emit nothing rather than fabricate a
 * phantom swap (a phantom swap would drive a bogus re-pick suggestion — the worst failure mode).
 */
import { isMaskedName } from "../engine/index.js";
import { sideOf, type GepRoster, type GepRosterPlayer, type Side } from "./schema.js";

export type { Side } from "./schema.js";

export interface SwapEvent {
  side: Side;
  uid: string;
  /** The hero this uid was on before. */
  out: string;
  /** The hero this uid is on now. */
  in: string;
}

/** A name we can actually compare (not masked, not empty). */
const isNamed = (name: string): boolean => !isMaskedName(name);

/** Index players by uid, EXCLUDING empty uids and any uid that occurs more than once (untrackable). */
function trackableByUid(players: GepRosterPlayer[]): Map<string, GepRosterPlayer> {
  const seen = new Map<string, GepRosterPlayer>();
  const dup = new Set<string>();
  for (const p of players) {
    if (p.uid === "") continue; // no id — cannot be tracked across snapshots
    if (seen.has(p.uid)) dup.add(p.uid);
    seen.set(p.uid, p);
  }
  for (const d of dup) seen.delete(d); // a duplicated uid is ambiguous — drop it entirely
  return seen;
}

/**
 * Emit a SwapEvent for every trackable uid whose (named) character_name changed between `prev` and
 * `next`. prev=null (the first update we ever see) yields nothing.
 */
export function detectSwaps(prev: GepRoster | null, next: GepRoster): SwapEvent[] {
  if (!prev) return [];

  const before = trackableByUid(prev.players);
  const after = trackableByUid(next.players);

  const swaps: SwapEvent[] = [];
  for (const [uid, now] of after) {
    const was = before.get(uid);
    if (!was) continue; // join — not a swap
    // Only a real-name -> different real-name change counts. Masked on either end => reveal/ignore.
    if (!isNamed(was.character_name) || !isNamed(now.character_name)) continue;
    if (was.character_name === now.character_name) continue;
    swaps.push({
      side: sideOf(now),
      uid,
      out: was.character_name,
      in: now.character_name,
    });
  }
  return swaps;
}
