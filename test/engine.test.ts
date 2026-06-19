/**
 * Phase 1.2 — engine test suite (D-005).
 *
 * Two layers:
 *  1. GOLDEN FIXTURES — hand-judged (roster -> expected suggestion). The trust oracle.
 *  2. PROPERTY INVARIANTS — must hold for EVERY fixture + a fuzz of random rosters (refinement #7):
 *       - never a ban (no `kind: "ban"`, no ban field serialized)
 *       - every recommended hero is in the comfort pool
 *       - every recommended hero fills a LEGAL role slot (2-2-2, D-012)
 *       - a swap never reduces total covered-threat-weight vs. holding
 *       - every mechanism the engine touches is in the registry vocab
 *       - both KBs cover the same hero set (A4)
 *       - the engine never throws on degraded input
 *
 * Run: `npm test` (node:test via tsx — no extra dependency, keeps the stack lean).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { recommend, getKb } from "../src/engine/index.js";
import type { EngineInput, EngineResult, Suggestion } from "../src/engine/index.js";
import { GOLDEN } from "./fixtures/golden.js";

const kb = getKb();

/** Canonical-key resolver mirror for assertions (pool membership is checked on canonical keys). */
function resolvePool(names: string[]): Set<string> {
  const out = new Set<string>();
  for (const n of names) {
    const lower = n.trim().toLowerCase();
    if (kb.roleOf.has(n.trim())) out.add(n.trim());
    else {
      const canon = (kb.registry.alias_index as Record<string, string>)[lower];
      if (canon) out.add(canon);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. GOLDEN FIXTURES
// ---------------------------------------------------------------------------
for (const fx of GOLDEN) {
  test(`golden: ${fx.name}`, () => {
    const r = recommend(fx.input);
    const s = r.suggestion;
    assert.equal(s.kind, fx.expect.kind, `expected ${fx.expect.kind}, got ${s.kind} (${JSON.stringify(s)})`);

    if (fx.expect.kind === "pick" && s.kind === "pick") {
      if (fx.expect.hero) assert.equal(s.hero, fx.expect.hero);
      if (fx.expect.acceptableHeroes)
        assert.ok(fx.expect.acceptableHeroes.includes(s.hero), `${s.hero} not in ${fx.expect.acceptableHeroes}`);
    }
    if (fx.expect.kind === "swap" && s.kind === "swap") {
      if (fx.expect.hero) assert.equal(s.hero, fx.expect.hero);
      if (fx.expect.replaces) assert.equal(s.replaces, fx.expect.replaces);
      if (fx.expect.acceptableHeroes)
        assert.ok(fx.expect.acceptableHeroes.includes(s.hero), `${s.hero} not in ${fx.expect.acceptableHeroes}`);
    }
  });
}

// ---------------------------------------------------------------------------
// 2. PROPERTY INVARIANTS — over the golden fixtures + a deterministic fuzz set.
// ---------------------------------------------------------------------------

/** A deterministic pseudo-random roster generator (no Math.random — reproducible). */
function fuzzInputs(): EngineInput[] {
  const heroes = [...kb.roleOf.keys()];
  const inputs: EngineInput[] = [];
  // Linear-congruential so the fuzz set is identical every run.
  let seed = 12345;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = <T>(arr: T[], n: number) => {
    const copy = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
    return out;
  };
  for (let i = 0; i < 40; i++) {
    const enemy = pick(heroes, 1 + Math.floor(rand() * 6));
    const team = pick(heroes, Math.floor(rand() * 6));
    const comfortPool = pick(heroes, 1 + Math.floor(rand() * 5));
    inputs.push({ enemy, team, comfortPool, mode: rand() > 0.5 ? "pick" : "swap" });
  }
  // Plus a few deliberately nasty degraded inputs.
  inputs.push({ enemy: ["*****", "Deadpool", "Garbage"], team: [], comfortPool: ["Luna"] });
  inputs.push({ enemy: [], team: [], comfortPool: [] });
  inputs.push({ enemy: ["Gambit"], team: ["Luna", "Mantis", "Hela", "Hawkeye", "Doctor Strange", "Hulk"], comfortPool: ["Thing"], mode: "swap" });
  return inputs;
}

const ALL_INPUTS: EngineInput[] = [...GOLDEN.map((f) => f.input), ...fuzzInputs()];

/** Total weight of enemy threats currently COVERED in a result (for the swap-monotonicity check). */
function coveredThreatWeight(r: EngineResult): number {
  return r.threats.filter((t) => t.covered).reduce((sum, t) => sum + t.weight, 0);
}

test("invariant: engine never throws on any input (incl. degraded)", () => {
  for (const input of ALL_INPUTS) {
    assert.doesNotThrow(() => recommend(input), `threw on ${JSON.stringify(input)}`);
  }
});

test("invariant: no ban is ever representable or serialized (D-006)", () => {
  for (const input of ALL_INPUTS) {
    const r = recommend(input);
    // type-level: kind is only pick|swap|hold; check at runtime too in case of future drift.
    assert.ok(["pick", "swap", "hold"].includes(r.suggestion.kind), `unexpected kind ${r.suggestion.kind}`);
    const blob = JSON.stringify(r);
    assert.ok(!/"ban[_a-z]*"\s*:/i.test(blob), `ban field serialized in result: ${blob.slice(0, 200)}`);
    assert.ok(!/"kind"\s*:\s*"ban"/i.test(blob), "ban suggestion kind serialized");
  }
});

test("invariant: every recommended hero is in the comfort pool", () => {
  for (const input of ALL_INPUTS) {
    const r = recommend(input);
    if (r.suggestion.kind === "hold") continue;
    const pool = resolvePool(input.comfortPool);
    assert.ok(pool.has(r.suggestion.hero), `recommended ${r.suggestion.hero} not in pool ${[...pool]}`);
  }
});

test("invariant: a recommended pick/swap respects the 2-2-2 role queue (D-012)", () => {
  // The engine's contract is that ITS change is legal — a pick must not push its OWN role over the
  // cap, and a swap must be same-role (so no role count moves at all). It cannot retroactively fix
  // an already-illegal input team (the live game enforces the queue, so that won't occur in
  // practice), so we assert the engine never makes a role's count WORSE, and never exceeds the cap
  // for a role that was legal before.
  const cap: Record<RoleName, number> = { Vanguard: 2, Duelist: 2, Strategist: 2 };
  const ROLES: RoleName[] = ["Vanguard", "Duelist", "Strategist"];
  for (const input of ALL_INPUTS) {
    const r = recommend(input);
    if (r.suggestion.kind === "hold") continue;

    const teamKeys = input.team.map((n) => resolveOne(n)).filter((k): k is string => !!k);
    const role = (h: string) => kb.roleOf.get(h) as RoleName;
    const before = countRoles(teamKeys);

    if (r.suggestion.kind === "pick") {
      const pickedRole = role(r.suggestion.hero);
      const after = countRoles([...teamKeys, r.suggestion.hero]);
      // The picked role must not exceed its cap as a result of the pick...
      assert.ok(
        after[pickedRole] <= cap[pickedRole],
        `pick ${r.suggestion.hero} pushes ${pickedRole} to ${after[pickedRole]} (> ${cap[pickedRole]})`,
      );
      // ...and no role count is made worse than it already was.
      for (const ro of ROLES) {
        assert.ok(after[ro] <= Math.max(before[ro], cap[ro]), `pick worsened ${ro}`);
      }
    } else {
      // Swap must be same-role as the hero it replaces (role counts unchanged => stays legal).
      assert.equal(
        role(r.suggestion.hero),
        role(r.suggestion.replaces),
        `swap ${r.suggestion.replaces}->${r.suggestion.hero} crosses roles`,
      );
    }
  }
});

test("invariant: a swap never REDUCES covered-threat-weight vs. doing nothing", () => {
  for (const input of ALL_INPUTS) {
    const r = recommend(input);
    if (r.suggestion.kind !== "swap") continue;
    // Covered-threat-weight under the CURRENT team (no change).
    const before = coveredThreatWeight(recommend({ ...input, comfortPool: [] }));
    const after = coveredThreatWeight(r);
    assert.ok(
      after >= before - 1e-9,
      `swap reduced covered threat weight ${before} -> ${after} for ${JSON.stringify(input)}`,
    );
  }
});

test("invariant: every mechanism the engine references is in the registry vocab (A1)", () => {
  for (const [, info] of kb.counter) {
    for (const m of info.provides_mechanisms) assert.ok(kb.mechanismVocab.has(m), `unknown provides mechanism ${m}`);
    for (const e of info.countered_by) assert.ok(kb.mechanismVocab.has(e.mechanism), `unknown counter mechanism ${e.mechanism}`);
  }
  for (const [m, fns] of kb.mechanismToFunction) {
    assert.ok(kb.mechanismVocab.has(m), `crosswalk key ${m} not in vocab`);
    for (const f of fns) assert.ok(kb.functionVocab.has(f), `crosswalk target ${f} not in function vocab`);
  }
});

test("invariant: counter_kb and comp_gap cover the same hero set (A4, Deadpool split excepted)", () => {
  const counterHeroes = new Set(kb.counter.keys());
  const compHeroes = new Set(kb.functionsOf.keys());
  for (const h of counterHeroes) {
    if (h.startsWith("Deadpool_")) continue; // A3 allow-list
    assert.ok(compHeroes.has(h), `${h} in counter_kb but missing hero_functions`);
  }
  for (const h of compHeroes) assert.ok(counterHeroes.has(h), `${h} in hero_functions but missing counter_kb`);
});

test("invariant: confidence is in [0,1] and only on actionable suggestions", () => {
  for (const input of ALL_INPUTS) {
    const s: Suggestion = recommend(input).suggestion;
    if (s.kind === "hold") continue;
    assert.ok(s.confidence >= 0 && s.confidence <= 1, `confidence out of range: ${s.confidence}`);
  }
});

// --- small helpers shared by the role-slot invariant -----------------------
function resolveOne(name: string): string | null {
  const t = name.trim();
  if (kb.roleOf.has(t)) return t;
  const canon = (kb.registry.alias_index as Record<string, string>)[t.toLowerCase()];
  return canon && kb.roleOf.has(canon) ? canon : null;
}
type RoleName = "Vanguard" | "Duelist" | "Strategist";
function countRoles(heroes: string[]): Record<RoleName, number> {
  const c: Record<RoleName, number> = { Vanguard: 0, Duelist: 0, Strategist: 0 };
  for (const h of heroes) {
    const role = kb.roleOf.get(h);
    if (role) c[role] += 1;
  }
  return c;
}
