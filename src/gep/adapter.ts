/**
 * Phase 3.2 — GEP → EngineInput adapter (the platform-neutral seam).
 *
 * Shapes a validated GEP roster into the engine's EngineInput. It ONLY shapes — it does not tag,
 * score, or resolve hero names: the engine already does alias resolution + graceful degradation of
 * masked/unknown/ambiguous names (D-012 / Phase 1.4), so we hand it raw character_names.
 *
 * Split rule: by `is_teammate` (NOT the `team` string, which is side-relative). Our side = teammates
 * (incl. the local player); the enemy side = everyone else. Masked enemies are passed through as
 * their masked token so the engine counts them toward roster size without inventing a name.
 *
 * Platform-neutral: nothing here imports a native-Overwolf or ow-electron API (Q-005 still open).
 * The platform-specific listener is a later shim that produces the GepRoster this consumes.
 */
import { sideOf, type GepRoster } from "./schema.js";
import type { EngineInput, EngineMode } from "../engine/index.js";

export interface AdapterOptions {
  /** Force the engine mode; otherwise the engine infers it from open roster slots. */
  mode?: EngineMode;
}

/**
 * Build an EngineInput from a roster snapshot + the user's comfort pool.
 * Teammates (incl. local) → team; everyone else → enemy. Raw names go straight to the engine.
 */
export function toEngineInput(
  roster: GepRoster,
  comfortPool: string[],
  opts: AdapterOptions = {},
): EngineInput {
  const enemy: string[] = [];
  const team: string[] = [];

  // Split by the SHARED sideOf rule (so swaps + adapter never disagree on a player's side).
  // Names are pushed verbatim, masked tokens included: each slot must count toward roster size, and
  // the engine's resolveName handles masked/unknown/ambiguous. Marvel Rivals forbids duplicate
  // heroes per side, so we don't dedup named slots — a repeat would be a transient draft artifact.
  for (const p of roster.players) {
    (sideOf(p) === "team" ? team : enemy).push(p.character_name);
  }

  return {
    enemy,
    team,
    comfortPool,
    ...(opts.mode ? { mode: opts.mode } : {}),
  };
}
