/**
 * Phase 1.1 + 1.3 + 1.4 — the engine orchestrator.
 *
 * Pipeline (comp_gap_model.recommendation_logic, generalised to the D-009 objective):
 *   0. Resolve every roster name; degrade gracefully on masked/unknown/ambiguous (1.4, D-012).
 *   1. Tag enemy threats; resolve conditionals against team+pool reachable mechanisms (1.3).
 *   2. Tag our comp coverage; detect archetype; compute gap weights.
 *   3. Enumerate LEGAL candidates from the comfort pool under the 2-2-2 role queue (D-012):
 *        - pick mode: candidate role must have an open slot.
 *        - swap mode: candidate replaces a SAME-ROLE teammate (≤1 change).
 *   4. Score every candidate EXHAUSTIVELY with the objective (NOT greedy); take the max.
 *   5. Emit Pick | Swap | Hold — Hold if no legal candidate clears min_confident_score (D-006).
 *
 * Never crashes on bad input; never silently under-covers (every skipped name produces a note).
 */
import {
  loadKb,
  resolveName,
  type LoadedKb,
  type CanonicalKey,
  type Role,
} from "./load.js";
import { tagThreats, threatWeight, type RawThreat } from "./threats.js";
import { coverageCounts, detectArchetype, gapWeights } from "./comp.js";
import { mechanismsProvidedBy, resolveConditionals } from "./conditional.js";
import { scoreCandidate } from "./objective.js";
import type {
  EngineInput,
  EngineMode,
  EngineNote,
  EngineResult,
  Suggestion,
  WeightedThreat,
  FunctionCoverage,
} from "./types.js";

const ROLE_CAP: Record<Role, number> = { Vanguard: 2, Duelist: 2, Strategist: 2 };
const TEAM_SIZE = 6;

let cached: LoadedKb | null = null;
/** Load + validate the KBs once (the engine refuses to run on drifted data). */
export function getKb(): LoadedKb {
  if (!cached) cached = loadKb();
  return cached;
}

/** Resolve a raw roster, collecting canonical keys + notes for everything we couldn't tag. */
function resolveRoster(
  raw: string[],
  side: "enemy" | "team",
  kb: LoadedKb,
  notes: EngineNote[],
): { keys: CanonicalKey[]; slotsUsed: number } {
  const keys: CanonicalKey[] = [];
  let slotsUsed = 0;
  for (const name of raw) {
    const r = resolveName(name, kb);
    slotsUsed++; // every listed slot counts toward roster size, even if untaggable (D-012/1.4)
    switch (r.status) {
      case "ok":
        keys.push(r.key);
        break;
      case "masked":
        notes.push({ level: "info", message: `${side}: a masked slot (*****) — counted but not tagged.` });
        break;
      case "ambiguous":
        notes.push({
          level: "warn",
          message: `${side}: "${r.raw}" is ambiguous (role-split, unresolved pre-GEP-spike) — counted but not tagged (A3/Q-001).`,
        });
        break;
      case "unknown":
        notes.push({
          level: "warn",
          message: `${side}: "${r.raw}" did not resolve to a known hero — counted but not tagged.`,
        });
        break;
    }
  }
  return { keys, slotsUsed };
}

/** Current provider count per role for our team (resolved keys only). */
function roleCounts(teamKeys: CanonicalKey[], kb: LoadedKb): Record<Role, number> {
  const c: Record<Role, number> = { Vanguard: 0, Duelist: 0, Strategist: 0 };
  for (const h of teamKeys) {
    const role = kb.roleOf.get(h);
    if (role) c[role]++;
  }
  return c;
}

/** Does any role still have an open slot, given the FULL roster size (resolved + untagged)? */
function hasOpenSlot(teamSlotsUsed: number): boolean {
  return teamSlotsUsed < TEAM_SIZE;
}

interface Candidate {
  hero: CanonicalKey;
  /** non-undefined in swap mode: the same-role teammate replaced. */
  replaces?: CanonicalKey;
  /** the team AFTER applying this candidate (for coverage/gap recomputation). */
  resultingTeam: CanonicalKey[];
}

/**
 * Enumerate legal candidates from the comfort pool under the 2-2-2 queue (D-012).
 *  - pick mode: hero's role must have a free slot AND not already be on the team.
 *  - swap mode: hero replaces a same-role teammate the user does NOT currently play as the same hero.
 */
function legalCandidates(
  mode: EngineMode,
  poolKeys: CanonicalKey[],
  teamKeys: CanonicalKey[],
  teamSlotsUsed: number,
  kb: LoadedKb,
): Candidate[] {
  const onTeam = new Set(teamKeys);
  const counts = roleCounts(teamKeys, kb);
  const out: Candidate[] = [];

  for (const hero of poolKeys) {
    if (onTeam.has(hero)) continue; // already picked — not a new recommendation
    const role = kb.roleOf.get(hero);
    if (!role) continue;

    if (mode === "pick") {
      // legal iff the role still has an open slot AND the roster has an open slot overall
      if (counts[role] < ROLE_CAP[role] && hasOpenSlot(teamSlotsUsed)) {
        out.push({ hero, resultingTeam: [...teamKeys, hero] });
      }
    } else {
      // swap: replace a SAME-ROLE teammate (keeps the queue legal; ≤1 change)
      for (const out_ of teamKeys) {
        if (kb.roleOf.get(out_) !== role) continue;
        if (out_ === hero) continue;
        out.push({
          hero,
          replaces: out_,
          resultingTeam: [...teamKeys.filter((h) => h !== out_), hero],
        });
      }
    }
  }
  return out;
}

/** Infer mode if the caller didn't specify: open roster slot => pick, else swap. */
function inferMode(input: EngineInput, teamSlotsUsed: number): EngineMode {
  if (input.mode) return input.mode;
  return hasOpenSlot(teamSlotsUsed) ? "pick" : "swap";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Run the engine. Pure function of (input, KB) — deterministic, no side effects, never throws on
 * bad roster input (it degrades to Hold with notes).
 */
export function recommend(input: EngineInput, kb: LoadedKb = getKb()): EngineResult {
  const notes: EngineNote[] = [];

  const enemy = resolveRoster(input.enemy, "enemy", kb, notes);
  const team = resolveRoster(input.team, "team", kb, notes);
  // masked slots the caller told us about but didn't list as names:
  for (let i = 0; i < (input.maskedCount ?? 0); i++) {
    notes.push({ level: "info", message: "enemy: a masked slot (*****) reported via maskedCount." });
  }

  const poolRes = input.comfortPool
    .map((n) => resolveName(n, kb))
    .filter((r): r is { status: "ok"; key: CanonicalKey } => r.status === "ok");
  const poolKeys = poolRes.map((r) => r.key);
  if (poolKeys.length === 0) {
    notes.push({ level: "warn", message: "Comfort pool resolved to zero known heroes — cannot recommend." });
  }

  const mode = inferMode(input, team.slotsUsed);

  // ---- 1. threats + conditional resolution (1.3) --------------------------------
  const threats: RawThreat[] = tagThreats(enemy.keys, kb);
  const reachable = mechanismsProvidedBy([...team.keys, ...poolKeys], kb);
  resolveConditionals(threats, reachable);
  const enemyKeys = new Set(enemy.keys);

  // ---- 2. our coverage + archetype + base gaps ----------------------------------
  const baseCounts = coverageCounts(team.keys, kb);
  const archetype = detectArchetype(baseCounts, kb);

  // ---- 3+4. enumerate legal candidates; score exhaustively ----------------------
  const candidates = legalCandidates(mode, poolKeys, team.keys, team.slotsUsed, kb);

  const scored = candidates.map((c) => {
    // Archetype is read from the resulting comp (so the candidate's own role is reflected).
    const arche = detectArchetype(coverageCounts(c.resultingTeam, kb), kb);
    // "Before" = the comp WITHOUT the candidate. For a swap this is the team minus the OUTGOING
    // hero, so any function the outgoing hero uniquely provided re-opens as a gap and the candidate
    // is scored on the NET change (it only re-earns it if its own kit re-fills it). For a pick,
    // "before" is just the current team. This is exactly resultingTeam minus the candidate.
    const teamWithoutCandidate = c.resultingTeam.filter((h) => h !== c.hero);
    const gapsBefore = gapWeights(coverageCounts(teamWithoutCandidate, kb), arche, kb);
    const s = scoreCandidate(c.hero, { kb, threats, gaps: gapsBefore, enemyKeys, archetype: arche });
    return { c, s };
  });

  scored.sort((a, b) => b.s.breakdown.total - a.s.breakdown.total);

  const ranked = scored.map(({ c, s }) => ({
    hero: c.hero,
    score: round2(s.breakdown.total),
    ...(c.replaces ? { replaces: c.replaces } : {}),
  }));

  // ---- 5. emit Pick | Swap | Hold (D-006) ---------------------------------------
  const minScore = Number(
    (kb.weights.objective_formula as Record<string, unknown>).min_confident_score ?? 0.5,
  );

  let suggestion: Suggestion;
  const best = scored[0];
  if (poolKeys.length === 0) {
    suggestion = { kind: "hold", reason: "No known heroes in your comfort pool to recommend from." };
  } else if (candidates.length === 0) {
    suggestion = {
      kind: "hold",
      reason:
        mode === "pick"
          ? "No comfort-pool hero fits an open role slot (2-2-2 queue full or pool already picked)."
          : "No same-role swap available from your comfort pool.",
    };
  } else if (!best || best.s.breakdown.total < minScore) {
    suggestion = {
      kind: "hold",
      reason: `Best available option scores below the confidence gate (${minScore}); holding rather than forcing a marginal change.`,
      bestScore: best ? round2(best.s.breakdown.total) : undefined,
    };
  } else {
    const conf = confidenceFrom(best.s.breakdown.total, scored[1]?.s.breakdown.total, minScore);
    const rationale = buildRationale(best.c.hero, best.s, kb);
    if (mode === "pick") {
      suggestion = {
        kind: "pick",
        hero: best.c.hero,
        confidence: conf,
        rationale,
        closesFunctions: best.s.closedFunctions,
        answersThreats: best.s.answeredThreats,
        breakdown: roundBreakdown(best.s.breakdown),
      };
    } else {
      suggestion = {
        kind: "swap",
        hero: best.c.hero,
        replaces: best.c.replaces!,
        confidence: conf,
        rationale,
        closesFunctions: best.s.closedFunctions,
        answersThreats: best.s.answeredThreats,
        breakdown: roundBreakdown(best.s.breakdown),
      };
    }
  }

  // ---- build the read for the post-game coach -----------------------------------
  const weightedThreats: WeightedThreat[] = threats.map((t) => ({
    hero: t.hero,
    weight: round2(threatWeight(t, kb)),
    counterability: t.counterability,
    conditionalCovered: t.conditionalCovered,
    covered: best ? best.s.answeredThreats.includes(t.hero) : false,
  }));

  const finalCounts = coverageCounts(
    suggestion.kind === "pick" || suggestion.kind === "swap"
      ? applySuggestion(team.keys, suggestion)
      : team.keys,
    kb,
  );
  const finalGaps = gapWeights(finalCounts, archetype, kb);
  const coverage: FunctionCoverage[] = [...kb.compFunctions.keys()].map((fn) => {
    const g = finalGaps.get(fn)!;
    return {
      fn,
      ideal: g.ideal,
      providers: g.providers,
      shortfall: Math.max(0, g.ideal - g.providers),
      gapWeight: round2(g.gapWeight),
    };
  });

  return { suggestion, mode, archetype, threats: weightedThreats, coverage, ranked, notes };
}

function applySuggestion(teamKeys: CanonicalKey[], s: Suggestion): CanonicalKey[] {
  if (s.kind === "pick") return [...teamKeys, s.hero];
  if (s.kind === "swap") return [...teamKeys.filter((h) => h !== s.replaces), s.hero];
  return teamKeys;
}

/** Confidence: how decisively the best beat the gate + the runner-up. Bounded 0.5..0.99. */
function confidenceFrom(best: number, runnerUp: number | undefined, minScore: number): number {
  const overGate = best - minScore;
  const margin = runnerUp === undefined ? overGate : best - runnerUp;
  // simple bounded blend; rounded for display per conventions.
  const raw = 0.5 + Math.min(0.49, (overGate * 0.15 + margin * 0.1));
  return round2(Math.max(0.5, Math.min(0.99, raw)));
}

function roundBreakdown(b: import("./types.js").ScoreBreakdown): import("./types.js").ScoreBreakdown {
  return {
    threatCovered: round2(b.threatCovered),
    functionFilled: round2(b.functionFilled),
    introducedVulnerability: round2(b.introducedVulnerability),
    clash: round2(b.clash),
    redundancy: round2(b.redundancy),
    total: round2(b.total),
  };
}

/** Self-directed coaching one-liner — never an enemy scoreboard / "shut down X" (D-008 framing). */
function buildRationale(
  hero: CanonicalKey,
  s: ReturnType<typeof scoreCandidate>,
  kb: LoadedKb,
): string {
  const name = kb.displayOf.get(hero) ?? hero;
  const parts: string[] = [];
  if (s.closedFunctions.length) {
    const labels = s.closedFunctions.map((f) => kb.compFunctions.get(f)?.label ?? f);
    parts.push(`fills your comp's ${labels.join(" + ")} gap`);
  }
  if (s.answeredThreats.length) {
    const names = s.answeredThreats.map((h) => kb.displayOf.get(h) ?? h);
    parts.push(`answers ${names.join(", ")}`);
  }
  if (parts.length === 0) parts.push("is the best-fitting option from your pool");
  return `${name} ${parts.join(" and ")}.`;
}
