/**
 * Phase 1.1 — the D-009 constrained objective, scored for ONE candidate.
 *
 * score(candidate) =
 *     + Σ threat_weight(enemy threats this candidate newly covers)
 *     + Σ function gap weight this candidate fills (direct functions + crosswalk credit from its mechanisms)
 *     − introduced_vulnerability * (candidate's own countered_by heroes present on the enemy roster)
 *     − clash_penalty            * (candidate clashes with the detected archetype)
 *     − redundancy_penalty       * (candidate over-provides an already-saturated function)
 *
 * Every constant is read from weights.json (objective_penalties, function_gap_weight). The search
 * over candidates is EXHAUSTIVE (engine.ts) — this just scores one. NOT greedy set-cover (D-009).
 *
 * A candidate "covers" a threat iff it provides a mechanism in that threat's answeredBy set. It
 * "fills" a function gap iff it provides that function directly, OR via a crosswalk mechanism it
 * brings. We only credit gap weight up to the remaining shortfall (no double counting), and we
 * only credit a threat once.
 */
import type { LoadedKb, CanonicalKey, MechanismKey, CompFunctionKey } from "./load.js";
import type { RawThreat } from "./threats.js";
import { threatWeight } from "./threats.js";
import type { GapInfo } from "./comp.js";
import type { ScoreBreakdown } from "./types.js";

export interface CandidateScore {
  breakdown: ScoreBreakdown;
  answeredThreats: CanonicalKey[];
  closedFunctions: CompFunctionKey[];
}

/**
 * Functions a candidate provides, split by strength of signal:
 *  - declared  : the hero's hero_functions — the roles it MEANINGFULLY fills (comp_gap_model).
 *  - crosswalk : functions reached ONLY via its provides_mechanisms (a weaker, secondary signal —
 *    "this hero's kit touches that role" — used as a tie-break bonus, NOT full provider credit).
 *
 * Splitting them is what stops a single pick from claiming full credit for 4-5 unrelated gaps
 * (the double-counting D-009 warns against): a healer is not your anti-flyer just because her kit
 * has a hitscan mechanism that crosswalks to anti_flyer_grounding.
 */
export function effectiveFunctions(
  hero: CanonicalKey,
  kb: LoadedKb,
): { declared: Set<CompFunctionKey>; crosswalk: Set<CompFunctionKey> } {
  const declared = new Set<CompFunctionKey>(kb.functionsOf.get(hero) ?? []);
  const crosswalk = new Set<CompFunctionKey>();
  for (const m of kb.counter.get(hero)?.provides_mechanisms ?? []) {
    for (const f of kb.mechanismToFunction.get(m) ?? []) {
      if (!declared.has(f)) crosswalk.add(f);
    }
  }
  return { declared, crosswalk };
}

export function scoreCandidate(
  hero: CanonicalKey,
  ctx: {
    kb: LoadedKb;
    threats: RawThreat[];
    /** gap weights for the comp AFTER conceptually adding the candidate's role slot. */
    gaps: Map<CompFunctionKey, GapInfo>;
    enemyKeys: Set<CanonicalKey>;
    archetype: string | null;
  },
): CandidateScore {
  const { kb, threats, gaps, enemyKeys, archetype } = ctx;
  const pen = kb.weights.objective_penalties;

  const provided = new Set<MechanismKey>(kb.counter.get(hero)?.provides_mechanisms ?? []);
  const { declared, crosswalk } = effectiveFunctions(hero, kb);
  const fgw = kb.weights.function_gap_weight as Record<string, number>;
  const crosswalkFraction = fgw.crosswalk_credit_fraction ?? 0.34;
  const fillCap = fgw.per_candidate_fill_cap ?? Infinity;

  // + threats covered (each threat counted once, at its resolved weight)
  let threatCovered = 0;
  const answeredThreats: CanonicalKey[] = [];
  for (const t of threats) {
    if ([...t.answeredBy].some((m) => provided.has(m))) {
      threatCovered += threatWeight(t, kb);
      answeredThreats.push(t.hero);
    }
  }

  // + function gaps filled. A DECLARED function earns the full archetype-weighted gap priority
  // (the hero meaningfully fills that role); a CROSSWALK-only function earns a discounted fraction
  // (its kit merely touches the role). Each function credited at most once, and only up to its
  // remaining shortfall. The per-candidate total is capped so one pick can't bank many gaps at once.
  let functionFilled = 0;
  const closedFunctions: CompFunctionKey[] = [];
  const creditFn = (fn: CompFunctionKey, fraction: number, isDeclared: boolean) => {
    const gap = gaps.get(fn);
    if (!gap || gap.gapWeight <= 0) return;
    const base = gap.priorityWeight > 0 ? gap.priorityWeight : gap.gapWeight;
    functionFilled += base * fraction;
    if (isDeclared) closedFunctions.push(fn); // only declared roles are surfaced as "closes this gap"
  };
  for (const fn of declared) creditFn(fn, 1, true);
  for (const fn of crosswalk) creditFn(fn, crosswalkFraction, false);
  functionFilled = Math.min(functionFilled, fillCap);

  // − introduced vulnerability: candidate's own counters already on the enemy roster (D-009)
  let introduced = 0;
  for (const edge of kb.counter.get(hero)?.countered_by ?? []) {
    if (enemyKeys.has(edge.hero)) {
      introduced = pen.introduced_vulnerability;
      break; // a single flag; presence is what matters, not how many
    }
  }

  // − clash: candidate's DECLARED role is one the archetype LOWERS (e.g. a static poke pick in a
  // dive comp). Checked on declared roles only — a crosswalk touch isn't a real archetype clash.
  let clash = 0;
  if (archetype) {
    const ps = kb.playstyle.find((p) => p.name === archetype);
    if (ps && ps.lower.some((f) => declared.has(f))) clash = pen.clash_penalty;
  }

  // − redundancy: the candidate's DECLARED role is already at/over its ideal provider count (so this
  // pick adds a saturated role instead of closing a gap). Crosswalk touches don't count as redundant.
  let redundancy = 0;
  for (const fn of declared) {
    const gap = gaps.get(fn);
    if (gap && gap.gapWeight === 0 && gap.providers >= gap.ideal && gap.ideal >= 1) {
      redundancy = pen.redundancy_penalty;
      break;
    }
  }

  const total = threatCovered + functionFilled - introduced - clash - redundancy;
  return {
    breakdown: { threatCovered, functionFilled, introducedVulnerability: introduced, clash, redundancy, total },
    answeredThreats,
    closedFunctions,
  };
}
