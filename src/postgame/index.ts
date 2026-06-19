/**
 * Phase 2.1 — the post-game coach (design §6 mode 2; first consumer of the engine).
 *
 * Pure projection: run the engine, then reshape its result into a PostGameReport. No new engine
 * logic, no live concerns (single finished-roster snapshot). Stays on the engine's PUBLIC surface
 * (recommend + resolveName + mechanismsProvidedBy) so it can't drift into internals.
 *
 * The one subtlety (see design §3): the engine's WeightedThreat.covered means "covered by the
 * WINNING candidate" — the live reading. Post-game needs two different, snapshot-true facts that we
 * recompute directly from the KB:
 *   - answeredByCurrentComp: does the CURRENT team deliver a mechanism in the threat's countered_by?
 *   - couldHaveAnswered:     which POOL heroes deliver such a mechanism (named, per hero)?
 * A threat answered by neither is a poolGap.
 */
import {
  recommend,
  resolveName,
  mechanismsProvidedBy,
  getKb,
  type EngineInput,
  type LoadedKb,
  type CanonicalKey,
  type MechanismKey,
} from "../engine/index.js";
import type {
  CompFunctionKey,
} from "../engine/index.js";
import type {
  PostGameReport,
  MatchupRow,
  AlternativeRow,
  PoolGap,
  ThreatAnswer,
} from "./types.js";

export type {
  PostGameReport,
  MatchupRow,
  AlternativeRow,
  PoolGap,
  ThreatAnswer,
} from "./types.js";

/** Resolve a raw roster to the canonical keys the engine would tag (dropping masked/unknown/ambiguous). */
function resolvedKeys(raw: string[], kb: LoadedKb): CanonicalKey[] {
  const keys: CanonicalKey[] = [];
  for (const name of raw) {
    const r = resolveName(name, kb);
    if (r.status === "ok") keys.push(r.key);
  }
  return keys;
}

/** The mechanisms in a threat's countered_by that a given provider-mechanism set delivers. */
function answeringMechanisms(
  threat: CanonicalKey,
  provided: Set<MechanismKey>,
  kb: LoadedKb,
): MechanismKey[] {
  const info = kb.counter.get(threat);
  if (!info) return [];
  const needed = new Set(info.countered_by.map((e) => e.mechanism));
  return [...needed].filter((m) => provided.has(m));
}

const displayOf = (key: CanonicalKey, kb: LoadedKb): string => kb.displayOf.get(key) ?? key;

/** Comp functions a `team` is short on (providers < ideal) — provider count from functionsOf. */
function shortFunctions(team: CanonicalKey[], kb: LoadedKb): Set<CompFunctionKey> {
  const counts = new Map<CompFunctionKey, number>();
  for (const h of team) for (const fn of kb.functionsOf.get(h) ?? []) {
    counts.set(fn, (counts.get(fn) ?? 0) + 1);
  }
  const short = new Set<CompFunctionKey>();
  for (const [fn, def] of kb.compFunctions) {
    if ((counts.get(fn) ?? 0) < def.ideal) short.add(fn);
  }
  return short;
}

/**
 * Build a post-game review for one finished matchup. Pure function of (input, kb); never throws
 * (inherits the engine's graceful degradation — bad rosters surface as `notes`).
 */
export function analyzePostGame(input: EngineInput, kb: LoadedKb = getKb()): PostGameReport {
  const result = recommend(input, kb);

  const teamKeys = resolvedKeys(input.team, kb);
  const onTeam = new Set(teamKeys);
  // Distinct, known pool heroes NOT already fielded — the heroes a swap/pick could actually bring
  // (a hero you already play is not a "could have answered with" suggestion).
  const poolKeys = [...new Set(resolvedKeys(input.comfortPool, kb))].filter((h) => !onTeam.has(h));

  const teamMechanisms = mechanismsProvidedBy(teamKeys, kb);
  // Per-pool-hero mechanism set, computed once (reused across every threat row).
  const poolMechanisms = new Map(poolKeys.map((h) => [h, mechanismsProvidedBy([h], kb)] as const));

  // ---- matchup table ------------------------------------------------------------
  // Recompute coverage directly from the KB — do NOT reuse WeightedThreat.covered (that's the
  // winning-candidate reading, not the snapshot reading we need here).
  const matchup: MatchupRow[] = result.threats.map((t) => {
    const answeredByCurrentComp = answeringMechanisms(t.hero, teamMechanisms, kb).length > 0;

    const couldHaveAnswered: ThreatAnswer[] = [];
    for (const ph of poolKeys) {
      const via = answeringMechanisms(t.hero, poolMechanisms.get(ph)!, kb);
      if (via.length > 0) {
        couldHaveAnswered.push({ hero: ph, displayName: displayOf(ph, kb), viaMechanisms: via });
      }
    }

    return {
      hero: t.hero,
      displayName: displayOf(t.hero, kb),
      weight: t.weight,
      counterability: t.counterability,
      // NOTE: conditionalCovered (from the engine) is computed against team + pool reachable
      // mechanisms (Phase 1.3), whereas answeredByCurrentComp is team-ONLY. So a conditional can be
      // conditionalCovered:true / answeredByCurrentComp:false — the pool could answer it; the
      // fielded comp doesn't. Both are intended; do not "reconcile" them.
      conditionalCovered: t.conditionalCovered,
      answeredByCurrentComp,
      couldHaveAnswered,
    };
  });

  // ---- pool gaps ("what to add") ------------------------------------------------
  // A threat neither the current comp NOR any pool hero answers — nothing you own touches it.
  const poolGaps: PoolGap[] = matchup
    .filter((row) => !row.answeredByCurrentComp && row.couldHaveAnswered.length === 0)
    .map((row) => ({
      hero: row.hero,
      displayName: row.displayName,
      weight: row.weight,
      neededMechanisms: [
        ...new Set((kb.counter.get(row.hero)?.countered_by ?? []).map((e) => e.mechanism)),
      ],
    }));

  // ---- alternatives (the full ranked option space) ------------------------------
  // Annotate each ranked candidate with what it answers / closes, recomputed from the KB so the
  // post-game view shows the whole field, not just the engine's single headline pick.
  //
  // closesFunctions is computed PER CANDIDATE against the comp WITHOUT that candidate (mirroring the
  // engine's per-candidate scoring). It must NOT be read off result.coverage — that is the
  // post-suggestion comp, so the winner has already zeroed its own shortfalls there, which would
  // blank closesFunctions for every alternative (including the winner).
  const enemyThreatKeys = result.threats.map((t) => t.hero);
  const alternatives: AlternativeRow[] = result.ranked.map((r) => {
    const provided = mechanismsProvidedBy([r.hero], kb);
    const answersThreats = enemyThreatKeys.filter(
      (e) => answeringMechanisms(e, provided, kb).length > 0,
    );
    // "Before" = the comp this candidate would join: in swap mode the team minus the replaced hero;
    // in pick mode the current team. The candidate closes a function it provides AND that comp lacks.
    const compBefore = r.replaces ? teamKeys.filter((h) => h !== r.replaces) : teamKeys;
    const shortBefore = shortFunctions(compBefore, kb);
    const closesFunctions = (kb.functionsOf.get(r.hero) ?? []).filter((fn) => shortBefore.has(fn));
    return {
      hero: r.hero,
      displayName: displayOf(r.hero, kb),
      score: r.score,
      ...(r.replaces ? { replaces: r.replaces } : {}),
      answersThreats,
      closesFunctions,
    };
  });

  return {
    meta: {
      mode: result.mode,
      archetype: result.archetype,
      teamSize: input.team.length,
      poolSize: poolKeys.length,
    },
    headline: result.suggestion,
    matchup,
    alternatives,
    poolGaps,
    notes: result.notes,
  };
}
