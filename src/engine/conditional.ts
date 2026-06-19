/**
 * Phase 1.3 — conditional-counterability resolution.
 *
 * Some enemy heroes (Moon Knight, Spider-Man, Squirrel Girl, Wolverine, Jeff — counterability
 * "conditional") are only "answered" if OUR side can deliver one of the specific mechanisms that
 * beats them. Shared Contract: conditional coverage = (mechanisms in the hero's countered_by) ∩
 * (mechanisms our pool provides), via each hero's provides_mechanisms (0.7).
 *
 * A conditional threat the pool CAN answer drops to conditional_resolution.covered_weight; one it
 * cannot answer escalates to .uncovered_weight (treated as effectively unanswered) — weights.json.
 *
 * "Our side that can deliver the mechanism" = the union of provides_mechanisms over our current
 * team PLUS the comfort pool — because a conditional is coverable if we *could* bring the answer,
 * which is exactly the engine's job to recommend.
 */
import type { LoadedKb, CanonicalKey, MechanismKey } from "./load.js";
import type { RawThreat } from "./threats.js";

/** Union of mechanisms a set of our heroes provides (from counter_kb provides_mechanisms). */
export function mechanismsProvidedBy(heroes: CanonicalKey[], kb: LoadedKb): Set<MechanismKey> {
  const out = new Set<MechanismKey>();
  for (const hero of heroes) {
    for (const m of kb.counter.get(hero)?.provides_mechanisms ?? []) out.add(m);
  }
  return out;
}

/**
 * Decide, for each conditional threat, whether our reachable mechanisms cover it, and stamp
 * `conditionalCovered` on the threat in place. `reachable` should be the mechanisms our team +
 * comfort pool can deliver.
 */
export function resolveConditionals(
  threats: RawThreat[],
  reachable: Set<MechanismKey>,
): void {
  for (const t of threats) {
    if (t.counterability !== "conditional") continue;
    t.conditionalCovered = [...t.answeredBy].some((m) => reachable.has(m));
  }
}
