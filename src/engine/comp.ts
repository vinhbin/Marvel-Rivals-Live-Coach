/**
 * Phase 1.1 — comp-function coverage, archetype detection, gap weighting.
 *
 * Implements comp_gap_model.recommendation_logic steps 1-4: tag our team's functions, aggregate
 * provider counts, detect the archetype via playstyle_modifiers, apply the raise/lower deltas, and
 * compute a weight for each remaining gap. All numbers come from weights.json (function_gap_weight,
 * playstyle_delta) — none are inlined.
 *
 * Uses only OUR-side picks (canonical keys). No enemy data here.
 */
import type { LoadedKb, CanonicalKey, CompFunctionKey } from "./load.js";

/** Provider counts per comp function for a given set of our heroes. */
export function coverageCounts(
  teamKeys: CanonicalKey[],
  kb: LoadedKb,
): Map<CompFunctionKey, number> {
  const counts = new Map<CompFunctionKey, number>();
  for (const fn of kb.functionVocab) counts.set(fn, 0);
  for (const hero of teamKeys) {
    for (const fn of kb.functionsOf.get(hero) ?? []) {
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    }
  }
  return counts;
}

/** Detect the comp archetype (dive/brawl/poke/…) from the provider distribution; null if none fires. */
export function detectArchetype(
  counts: Map<CompFunctionKey, number>,
  kb: LoadedKb,
): string | null {
  for (const ps of kb.playstyle) {
    if (ps.triggers.length === 0) continue;
    const allHold = ps.triggers.every((t) => {
      const have = counts.get(t.fn) ?? 0;
      return t.op === ">=" ? have >= t.count : have < t.count;
    });
    if (allHold) return ps.name;
  }
  return null;
}

/**
 * Per-function gap priority weight for the CURRENT comp (before any candidate is added).
 *
 * base = max(0, ideal - providers) * per_missing_provider
 *      + (ideal>=1 && providers==0 ? critical_zero_provider_bonus : 0)
 * then archetype raise/lower deltas are applied (playstyle_delta) to the function's priority.
 *
 * Returns a map function -> { ideal, providers, gapWeight, priorityWeight }.
 *  - gapWeight    : weight attributable to the missing providers (what a candidate can fill).
 *  - priorityWeight: gapWeight after archetype re-weighting — used to compare gaps to each other.
 */
export interface GapInfo {
  ideal: number;
  providers: number;
  gapWeight: number;
  priorityWeight: number;
}

export function gapWeights(
  counts: Map<CompFunctionKey, number>,
  archetype: string | null,
  kb: LoadedKb,
): Map<CompFunctionKey, GapInfo> {
  const fgw = kb.weights.function_gap_weight as Record<string, number>;
  const perMissing = fgw.per_missing_provider ?? 1;
  const criticalBonus = fgw.critical_zero_provider_bonus ?? 0;
  const { raise: raiseDelta, lower: lowerDelta } = kb.weights.playstyle_delta;

  const raised = new Set<CompFunctionKey>();
  const lowered = new Set<CompFunctionKey>();
  if (archetype) {
    const ps = kb.playstyle.find((p) => p.name === archetype);
    ps?.raise.forEach((f) => raised.add(f));
    ps?.lower.forEach((f) => lowered.add(f));
  }

  const out = new Map<CompFunctionKey, GapInfo>();
  for (const [fn, def] of kb.compFunctions) {
    const providers = counts.get(fn) ?? 0;
    const shortfall = Math.max(0, def.ideal - providers);
    let gapWeight = shortfall * perMissing;
    if (def.ideal >= 1 && providers === 0) gapWeight += criticalBonus;

    let priorityWeight = gapWeight;
    if (gapWeight > 0) {
      if (raised.has(fn)) priorityWeight += raiseDelta;
      if (lowered.has(fn)) priorityWeight += lowerDelta;
      priorityWeight = Math.max(0, priorityWeight);
    }
    out.set(fn, { ideal: def.ideal, providers, gapWeight, priorityWeight });
  }
  return out;
}
