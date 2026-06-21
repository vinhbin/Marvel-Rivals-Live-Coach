/**
 * Phase 2.1 — post-game coach output contract (design §6 mode 2).
 *
 * A PostGameReport is a PROJECTION of one EngineResult into a review-shaped object: the full
 * matchup table, the complete option space (alternatives), and the pool gaps ("what to add").
 * It introduces no new engine logic and inherits the engine's compliance posture — it only ever
 * reads engine output + the public KB, so it can NEVER produce a ban (D-006) or an enemy
 * scoreboard (D-008). All prose stays self-directed ("your pool can't answer X").
 */
import type {
  CanonicalKey,
  CompFunctionKey,
  Counterability,
  MechanismKey,
  EngineMode,
  EngineNote,
  Suggestion,
} from "../engine/index.js";

/** A pool hero that would have answered a given enemy threat, and how. */
export interface ThreatAnswer {
  hero: CanonicalKey;
  displayName: string;
  /** Mechanisms this hero provides that appear in the threat's countered_by. */
  viaMechanisms: MechanismKey[];
}

/** One enemy hero in the post-game matchup table (design §6: "did you have an answer?"). */
export interface MatchupRow {
  hero: CanonicalKey;
  displayName: string;
  /** Threat weight from the engine (counterability tier × patch trend). Rounded. */
  weight: number;
  counterability: Counterability;
  /** For a conditional threat: whether the team+pool reach gave it coverage (Phase 1.3). */
  conditionalCovered?: boolean;
  /** Did your CURRENT comp (no suggestion applied) already deliver a counter mechanism? */
  answeredByCurrentComp: boolean;
  /** Pool heroes that would have answered this threat (empty => see poolGaps). */
  couldHaveAnswered: ThreatAnswer[];
  /**
   * EVERY hero that counters this threat, regardless of your pool (the enemy's full countered_by set
   * — a self-directed "heroes you could pick/learn to beat this", never a ban / enemy scoreboard).
   * Superset of couldHaveAnswered.
   */
  counters: ThreatAnswer[];
}

/** One row of the full ranked option space (design §6: "what you could've swapped to"). */
export interface AlternativeRow {
  hero: CanonicalKey;
  displayName: string;
  /** The engine's objective score for this candidate (rounded). */
  score: number;
  /** Present in swap mode: the same-role teammate this candidate would replace. */
  replaces?: CanonicalKey;
  /** Enemy threats this candidate answers (recomputed from the public KB). */
  answersThreats: CanonicalKey[];
  /** Comp functions this candidate provides that the comp is short on. */
  closesFunctions: CompFunctionKey[];
}

/** An enemy threat NOTHING in the comfort pool (or current comp) answers — the "what to add" list. */
export interface PoolGap {
  hero: CanonicalKey;
  displayName: string;
  weight: number;
  /** Mechanisms that would answer this threat — i.e. what a hero you'd add needs to provide. */
  neededMechanisms: MechanismKey[];
}

/** One comp-function that the CURRENT team is short of its ideal provider count. */
export interface FunctionShortfall {
  fn: CompFunctionKey;
  label: string;
  ideal: number;
  providers: number;
  /** ideal>=1 && providers==0 — a function the comp completely lacks (the loud one). */
  critical: boolean;
}

/**
 * Standalone read of YOUR comp's structural health — "is this comp even functional?" — independent
 * of the enemy. Role split (2-2-2 sanity) + which comp-functions are below ideal. Computed purely
 * from the resolved team + the registry/comp-model; no enemy data, no engine logic.
 */
export interface CompHealth {
  /** Resolved role counts on our side (Vanguard/Duelist/Strategist => tank/dps/heal-ish). */
  roleCounts: { Vanguard: number; Duelist: number; Strategist: number };
  /** Number of roster slots that did not resolve to a known hero (masked/unknown/ambiguous). */
  unresolved: number;
  /** Functions below their ideal provider count, worst (critical) first. */
  shortfalls: FunctionShortfall[];
}

/** The full post-game review. */
export interface PostGameReport {
  meta: {
    mode: EngineMode;
    archetype: string | null;
    /** Resolved + unresolved roster slots the engine counted on our side. */
    teamSize: number;
    /** Distinct known heroes in the comfort pool. */
    poolSize: number;
  };
  /** Standalone health of YOUR comp (role split + function shortfalls), independent of the enemy. */
  compHealth: CompHealth;
  /** The engine's primary call, unchanged (Pick | Swap | Hold). */
  headline: Suggestion;
  /** The ENEMY comp's detected archetype (dive/brawl/poke/triple-support), or null if none fires. */
  enemyArchetype: string | null;
  /** Self-directed anti-meta read for the enemy archetype (from the KB), or null. INFORM-ONLY —
   *  this does NOT change the recommendation; it's strategy advice alongside it (D-008). */
  enemyRead: string | null;
  matchup: MatchupRow[];
  alternatives: AlternativeRow[];
  poolGaps: PoolGap[];
  /** Degraded-input notes passed straight through from the engine (never swallowed). */
  notes: EngineNote[];
}
