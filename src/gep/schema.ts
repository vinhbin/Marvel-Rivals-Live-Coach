/**
 * Phase 3.1 — GEP roster-payload schema (the COMPLIANCE BOUNDARY, D-007).
 *
 * The Overwolf GEP `roster_xx` payload carries fields the engine may NEVER consume — notably
 * `ult_charge` (teammate-only; consuming it edges toward prohibited ult inference) and whatever a
 * future GEP version adds. Strategy (user decision, 2026-06-19): STRIP TO A WHITELIST.
 *
 *   - Input is parsed LOOSELY (extra/unknown fields tolerated) so a GEP version bump never crashes
 *     ingestion (§3 "version gotcha" is real).
 *   - Output is NARROW: only the whitelisted Shared-Contract fields. `ult_charge`, enemy-stat-shaped
 *     keys, and everything else are DROPPED here — the engine literally cannot see them. This is
 *     compliance-by-construction, not by-discipline.
 *
 * Whitelist (Shared Contracts, PLAN.md): character_name, character_id, team, is_teammate, uid,
 * is_alive, kills, deaths, assists, is_local. (No enemy damage/healing — absent from GEP by design;
 * `ult_charge` deliberately excluded.)
 */
import { z } from "zod";

/** The ONLY GEP roster fields the engine is allowed to see. */
export interface GepRosterPlayer {
  uid: string;
  character_name: string;
  character_id?: number;
  /** Side string as GEP reports it (side-relative; the adapter splits on is_teammate, not this). */
  team?: string;
  is_teammate?: boolean;
  is_local?: boolean;
  is_alive?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
}

export interface GepRoster {
  players: GepRosterPlayer[];
}

/** Which side of the match a player is on. */
export type Side = "team" | "enemy";

/**
 * The SINGLE side-classification rule, shared by swaps + adapter so they can never disagree:
 * a player is ours iff they are a teammate OR the local player. Everyone else is the enemy.
 * (`is_local` is included because GEP may report the local player without is_teammate — confirmed
 * one way or the other by the Q-001 real-match spike; the inclusive rule is the safe default.)
 */
export function sideOf(p: GepRosterPlayer): Side {
  return p.is_teammate === true || p.is_local === true ? "team" : "enemy";
}

/**
 * Loose-in schema: `.passthrough()` tolerates any extra GEP field without error, then `.transform`
 * projects to the whitelist so nothing extra survives. uid is coerced to string (GEP may send
 * number-ish ids); character_name defaults to "" (treated as masked downstream).
 */
const RawPlayerSchema = z
  .object({
    uid: z.union([z.string(), z.number()]).optional(),
    character_name: z.string().optional(),
    character_id: z.number().optional(),
    team: z.union([z.string(), z.number()]).optional(),
    is_teammate: z.boolean().optional(),
    is_local: z.boolean().optional(),
    is_alive: z.boolean().optional(),
    kills: z.number().optional(),
    deaths: z.number().optional(),
    assists: z.number().optional(),
  })
  .passthrough()
  .transform((p): GepRosterPlayer => {
    // Explicit projection = the whitelist. Anything not named here is dropped.
    const out: GepRosterPlayer = {
      uid: p.uid === undefined ? "" : String(p.uid),
      character_name: p.character_name ?? "",
    };
    if (p.character_id !== undefined) out.character_id = p.character_id;
    if (p.team !== undefined) out.team = String(p.team);
    if (p.is_teammate !== undefined) out.is_teammate = p.is_teammate;
    if (p.is_local !== undefined) out.is_local = p.is_local;
    if (p.is_alive !== undefined) out.is_alive = p.is_alive;
    if (p.kills !== undefined) out.kills = p.kills;
    if (p.deaths !== undefined) out.deaths = p.deaths;
    if (p.assists !== undefined) out.assists = p.assists;
    return out;
  });

const RosterSchema = z
  .object({
    players: z.array(RawPlayerSchema),
  })
  .transform((r): GepRoster => ({ players: r.players }));

/**
 * Parse a raw GEP roster update into the narrow, whitelisted GepRoster.
 * - Tolerates unknown/extra fields (version drift) and missing optionals (early/masked payloads).
 * - Throws (zod) only on a structurally unusable payload (not an object / players not an array).
 * - GUARANTEE: no key outside the whitelist appears on any output player.
 */
export function parseRosterUpdate(raw: unknown): GepRoster {
  return RosterSchema.parse(raw);
}
