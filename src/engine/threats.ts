/**
 * Phase 1.1 — enemy-threat tagging + weighting (D-009 threat_weight_formula).
 *
 * Turns a resolved enemy roster into a list of weighted threats. The base weight is
 * `counterability_weight[tier] * patch_trend_multiplier[trend]` (weights.json). Conditional
 * heroes get their base weight from `conditional_resolution` instead, decided by whether OUR
 * pool can deliver a required answer mechanism — that resolution is computed in conditional.ts
 * and threaded in here (Phase 1.3).
 *
 * Compliance: this consumes ONLY hero identity (canonical key) + the static counter_kb tier.
 * No enemy stats, no ult prediction. The "threat" is pick-priority, never a ban (D-004/D-006).
 */
import type { LoadedKb, CanonicalKey, MechanismKey, Counterability } from "./load.js";

export interface RawThreat {
  hero: CanonicalKey;
  counterability: Counterability;
  /** Mechanisms that answer this hero (union over its countered_by edges). */
  answeredBy: Set<MechanismKey>;
  /** For conditional heroes: set by conditional.ts once the pool is known. */
  conditionalCovered?: boolean;
}

/**
 * Tag each resolved enemy hero into a RawThreat. Patch trend defaults to neutral until the
 * overlay is synced (Q-002), so the trend multiplier is 1.0 for now — but we read it through the
 * weights table so wiring the overlay later changes nothing in the engine.
 */
export function tagThreats(enemyKeys: CanonicalKey[], kb: LoadedKb): RawThreat[] {
  const threats: RawThreat[] = [];
  for (const hero of enemyKeys) {
    const info = kb.counter.get(hero);
    if (!info) continue; // unresolved/unknown handled upstream; defensively skip
    const answeredBy = new Set<MechanismKey>();
    for (const edge of info.countered_by) answeredBy.add(edge.mechanism);
    threats.push({ hero, counterability: info.counterability, answeredBy });
  }
  return threats;
}

/**
 * Base threat weight for a hero (pre-coverage). Conditional heroes resolve via
 * conditional_resolution (covered vs uncovered) per Phase 1.3; everyone else via
 * counterability_weight. Then multiply by the (currently neutral) patch trend.
 */
export function threatWeight(threat: RawThreat, kb: LoadedKb): number {
  const w = kb.weights;
  let base: number;
  if (threat.counterability === "conditional") {
    base = threat.conditionalCovered
      ? w.conditional_resolution.covered_weight
      : w.conditional_resolution.uncovered_weight;
  } else {
    base = w.counterability_weight[threat.counterability];
  }
  // Patch trend is neutral until the overlay syncs (Q-002); read through the table regardless.
  const trend = w.patch_trend_multiplier.neutral;
  const raw = base * trend;
  const { min, max } = w.patch_trend_multiplier.clamp;
  // Clamp only the trend contribution's effect on the base, per weights.json intent.
  return Math.min(Math.max(raw, base * min), base * max);
}
