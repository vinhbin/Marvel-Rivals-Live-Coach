/**
 * Phase 1.1 — public engine output contract (D-006).
 *
 * The engine recommends ONE of: a draft-time Pick, a mid-match Swap, or a Hold (no confident
 * suggestion). There is deliberately NO `Ban` variant — a ban is not representable in this type,
 * so a future edit cannot leak one (D-006, CLAUDE.md never-ban guardrail). The internal
 * counterability ranking the objective computes is never surfaced here.
 *
 * Heroes are referenced by canonical registry key (string). The live GEP join (character_id / uid)
 * is resolved upstream before the engine runs (Shared Contracts).
 */

import type { CanonicalKey, CompFunctionKey } from "./load.js";

/** Which side a candidate change applies to / which mode we ran in. */
export type EngineMode = "pick" | "swap";

/** A threat the enemy roster poses, after tagging + weighting (D-009 threat_weight_formula). */
export interface WeightedThreat {
  /** Enemy hero (canonical key) posing the threat. */
  hero: CanonicalKey;
  /** Threat weight = counterability_weight[tier] * patch_trend_multiplier[trend]. */
  weight: number;
  /** Counterability tier from counter_kb (low|medium|high|conditional). */
  counterability: "low" | "medium" | "high" | "conditional";
  /** For a conditional threat: whether OUR pool can deliver a required answer mechanism (1.3). */
  conditionalCovered?: boolean;
  /** Whether THIS candidate covers the threat (provides a mechanism in the threat's countered_by). */
  covered: boolean;
}

/** A comp function and how our (post-candidate) comp covers it vs. its ideal. */
export interface FunctionCoverage {
  fn: CompFunctionKey;
  ideal: number;
  providers: number;
  /** Positive => short of ideal; this is the gap the candidate may close. */
  shortfall: number;
  /** Weight of the remaining gap after the candidate is added (0 if fully covered). */
  gapWeight: number;
}

/** The human-readable + machine-checkable reasons a candidate scored as it did. */
export interface ScoreBreakdown {
  /** Sum of weights of enemy threats this candidate newly covers. */
  threatCovered: number;
  /** Sum of comp-function gap weights this candidate fills (incl. crosswalk credit). */
  functionFilled: number;
  /** −introduced_vulnerability: the candidate's own counters already on the enemy roster (D-009). */
  introducedVulnerability: number;
  /** −clash_penalty: archetype clash (e.g. immobile poke support in a dive comp). */
  clash: number;
  /** −redundancy_penalty: candidate over-provides an already-saturated function. */
  redundancy: number;
  /** The final objective score (sum of the above with signs). */
  total: number;
}

/** Shared fields on any actionable suggestion. */
interface SuggestionBase {
  hero: CanonicalKey;
  /** 0..1 confidence derived from the winning score vs. the field. */
  confidence: number;
  /** One-line, self-directed coaching rationale (never an enemy scoreboard / "shut down X"). */
  rationale: string;
  /** The functions this hero closes a gap in. */
  closesFunctions: CompFunctionKey[];
  /** The enemy threats this hero answers. */
  answersThreats: CanonicalKey[];
  breakdown: ScoreBreakdown;
}

/** Draft-time recommendation: add this hero to an open slot. */
export interface Pick extends SuggestionBase {
  kind: "pick";
}

/** Mid-match recommendation: swap OUT `replaces` (same role) for `hero`. */
export interface Swap extends SuggestionBase {
  kind: "swap";
  /** The same-role teammate to swap out (canonical key). */
  replaces: CanonicalKey;
}

/** No confident recommendation — never force a marginal pick (D-006, SRE finding). */
export interface Hold {
  kind: "hold";
  /** Why we held (below confidence gate, no legal candidate, degraded input, …). */
  reason: string;
  /** The best score we saw, for transparency (may be below the gate). */
  bestScore?: number;
}

export type Suggestion = Pick | Swap | Hold;

/** Notes the engine emits about degraded / skipped input (1.4) — never silently swallowed. */
export interface EngineNote {
  level: "info" | "warn";
  message: string;
}

/** Input to the engine. Hero names may be raw GEP strings / aliases; the engine resolves them. */
export interface EngineInput {
  /** Enemy roster — raw names or canonical keys; resolved + tagged internally. */
  enemy: string[];
  /** Our current team picks (excluding the local player's slot in swap mode, or full in analysis). */
  team: string[];
  /** The heroes the user actually plays (their comfort pool) — candidates come ONLY from here. */
  comfortPool: string[];
  /**
   * "pick"  = draft / an open slot exists → recommend an ADD.
   * "swap"  = full team → recommend a single ≤1-change same-role SWAP.
   * Omitted => inferred from whether the team has an open role slot.
   */
  mode?: EngineMode;
  /**
   * Heroes masked as `*****` (Diamond 3+ pre-round). Listed so the engine can account for roster
   * size without crashing; they contribute nothing to tagging (1.4 / conventions).
   */
  maskedCount?: number;
}

/** Full engine result: the suggestion plus the read that produced it (for the post-game coach). */
export interface EngineResult {
  suggestion: Suggestion;
  mode: EngineMode;
  archetype: string | null;
  threats: WeightedThreat[];
  coverage: FunctionCoverage[];
  /** Every legal candidate's score, descending — internal ranking, NOT a ban list. */
  ranked: Array<{ hero: CanonicalKey; score: number; replaces?: CanonicalKey }>;
  notes: EngineNote[];
}
