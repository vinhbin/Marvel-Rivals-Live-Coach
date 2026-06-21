/**
 * Phase 2.1 — post-game coach test suite (D-005 discipline, mirrored).
 *
 * Two layers, same as the engine suite:
 *  1. HAND-JUDGED assertions over real matchups (reusing the golden rosters — already game-validated).
 *  2. PROPERTY INVARIANTS over every golden fixture + a fuzz:
 *       - the report headline IS exactly recommend()'s suggestion (projection, not re-derivation)
 *       - every poolGap hero also appears in matchup with empty couldHaveAnswered AND
 *         answeredByCurrentComp === false (internal consistency)
 *       - alternatives mirror the engine ranked list; every alternative hero ∈ comfort pool
 *       - no ban field is serialized anywhere in the report (D-006 inherited)
 *       - never throws on degraded input (masked / unknown / empty pool) — fuzz
 *
 * Run via `npm test` (wired alongside engine.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { recommend, getKb } from "../src/engine/index.js";
import type { EngineInput } from "../src/engine/index.js";
import { analyzePostGame } from "../src/postgame/index.js";
import type { PostGameReport } from "../src/postgame/index.js";
import { GOLDEN } from "./fixtures/golden.js";

const kb = getKb();

/** Canonical-key resolver mirror for assertions (matches the engine's alias resolution). */
function resolveKey(name: string): string | null {
  const t = name.trim();
  if (kb.roleOf.has(t)) return t;
  const canon = (kb.registry.alias_index as Record<string, string>)[t.toLowerCase()];
  return canon ?? null;
}

// ---------------------------------------------------------------------------
// 1. HAND-JUDGED assertions over real matchups
// ---------------------------------------------------------------------------

test("compHealth: an all-DPS team reports 0 tank / 0 support and CRITICAL sustain + frontline gaps", () => {
  const input: EngineInput = {
    enemy: ["Gambit", "Luna"],
    team: ["Hela", "Hawkeye", "Punisher"], // 3 Duelists, no Vanguard, no Strategist
    comfortPool: ["Luna", "Hulk"],
    mode: "pick",
  };
  const { compHealth } = analyzePostGame(input);
  assert.deepEqual(compHealth.roleCounts, { Vanguard: 0, Duelist: 3, Strategist: 0 });
  assert.equal(compHealth.unresolved, 0);
  const shortKeys = compHealth.shortfalls.map((s) => s.fn);
  assert.ok(shortKeys.includes("sustain_healing"), "no healer => sustain_healing is short");
  assert.ok(shortKeys.includes("frontline_space"), "no tank => frontline_space is short");
  // The two roles the comp completely lacks must be flagged critical (0 providers).
  const sustain = compHealth.shortfalls.find((s) => s.fn === "sustain_healing")!;
  const frontline = compHealth.shortfalls.find((s) => s.fn === "frontline_space")!;
  assert.equal(sustain.critical, true);
  assert.equal(frontline.critical, true);
  assert.equal(sustain.providers, 0);
  // Critical gaps sort to the front.
  assert.equal(compHealth.shortfalls[0]!.critical, true);
});

test("compHealth: unresolved roster slots are counted, not silently dropped", () => {
  const input: EngineInput = {
    enemy: ["Gambit"],
    team: ["Hulk", "garbagehero", "*****"], // 1 resolves, 2 do not
    comfortPool: ["Luna"],
    mode: "pick",
  };
  const { compHealth } = analyzePostGame(input);
  assert.equal(compHealth.roleCounts.Vanguard, 1, "Hulk resolves as the one tank");
  assert.equal(compHealth.unresolved, 2, "the two unresolved names are counted");
});

test("headline mirrors the engine suggestion exactly (projection, not re-derivation)", () => {
  // Fixture 4: Gambit/Luna/Doctor Strange enemy -> engine picks Magneto.
  const input: EngineInput = {
    enemy: ["Gambit", "Luna", "Doctor Strange"],
    team: ["Hela", "Spider-Man"],
    comfortPool: ["Magneto", "Punisher"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  assert.deepEqual(report.headline, recommend(input).suggestion);
});

test("a top-tier threat (Gambit) appears in the matchup table with its weight and counterability", () => {
  const input: EngineInput = {
    enemy: ["Gambit", "Luna", "Doctor Strange"],
    team: ["Hela", "Spider-Man"],
    comfortPool: ["Magneto", "Punisher"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const gambitKey = resolveKey("Gambit")!;
  const row = report.matchup.find((r) => r.hero === gambitKey);
  assert.ok(row, "Gambit must have a matchup row");
  assert.equal(row.counterability, "low"); // top-tier per counter_kb
  assert.ok(row.weight > 0, "weight must be populated");
});

test("a flyer threat the pool can answer (Punisher) shows up under couldHaveAnswered, not poolGaps", () => {
  // Fixture 5: Storm/Iron Man are flyers; Punisher is anti_flyer_grounding hitscan.
  const input: EngineInput = {
    enemy: ["Human Torch", "Storm", "Iron Man", "Luna"],
    team: ["Doctor Strange", "Hulk", "Luna"],
    comfortPool: ["Punisher", "Mantis"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const punisher = resolveKey("Punisher")!;
  const storm = resolveKey("Storm")!;
  const stormRow = report.matchup.find((r) => r.hero === storm);
  assert.ok(stormRow, "Storm must have a matchup row");
  assert.ok(
    stormRow.couldHaveAnswered.some((c) => c.hero === punisher),
    "Punisher (in pool) answers the flyer Storm — must be listed under couldHaveAnswered",
  );
  // ...and therefore Storm is NOT a pool gap.
  assert.ok(
    !report.poolGaps.some((g) => g.hero === storm),
    "Storm is answerable by the pool — must not be a poolGap",
  );
});

test("a threat NOTHING in the pool answers lands in poolGaps with empty couldHaveAnswered", () => {
  // Empty current comp + a single off-role healer (Rocket) whose kit answers none of these
  // low-counterability threats => both threats are true pool gaps (verified against the KB).
  const input: EngineInput = {
    enemy: ["Gambit", "Jean Grey"],
    team: [],
    comfortPool: ["Rocket"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  assert.ok(report.poolGaps.length > 0, "expected at least one pool gap");
  for (const gap of report.poolGaps) {
    const row = report.matchup.find((r) => r.hero === gap.hero);
    assert.ok(row, `pool gap ${gap.hero} must also be a matchup row`);
    assert.equal(row.couldHaveAnswered.length, 0, "a pool gap is answered by NO pool hero");
    assert.equal(row.answeredByCurrentComp, false, "a pool gap is not answered by the current comp");
    assert.ok(gap.neededMechanisms.length > 0, "a tagged threat must list the mechanisms that would answer it");
  }
});

test("detects a triple-support enemy and surfaces a self-directed anti-meta read", () => {
  const input: EngineInput = {
    enemy: ["Groot", "Magneto", "Luna", "Mantis", "Cloak and Dagger"],
    team: ["Doctor Strange", "Thing", "Hawkeye", "Punisher", "Luna"],
    comfortPool: ["Psylocke", "Punisher"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  assert.equal(report.enemyArchetype, "triple-support");
  assert.ok(report.enemyRead && report.enemyRead.length > 0, "an anti-meta read is present");
  // self-directed framing: no "ban"/"shut down enemy" language (D-008)
  assert.ok(!/\bban\b/i.test(report.enemyRead!) && !/shut down/i.test(report.enemyRead!));
});

test("detects a dive enemy archetype", () => {
  const input: EngineInput = {
    enemy: ["Spider-Man", "Black Panther", "Wolverine", "Luna", "Mantis"],
    team: ["Doctor Strange", "Hawkeye", "Luna"],
    comfortPool: ["Thing", "Peni Parker"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  assert.equal(report.enemyArchetype, "dive");
  assert.ok(report.enemyRead && report.enemyRead.length > 0);
});

test("an unclassifiable / sparse enemy yields a null archetype + null read (no crash)", () => {
  const input: EngineInput = {
    enemy: ["Gambit"],
    team: ["Hela"],
    comfortPool: ["Magneto"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  assert.equal(report.enemyArchetype, null);
  assert.equal(report.enemyRead, null);
});

test("the anti-meta read is always one defined in the KB (no hardcoded prose)", () => {
  const kbReads = new Set(
    kb.playstyle.map((p) => p.counterRead).filter((r): r is string => typeof r === "string"),
  );
  const input: EngineInput = {
    enemy: ["Groot", "Magneto", "Luna", "Mantis", "Cloak and Dagger"],
    team: ["Doctor Strange", "Thing"],
    comfortPool: ["Psylocke"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  assert.ok(report.enemyRead === null || kbReads.has(report.enemyRead), "read comes from the KB");
});

test("each matchup row lists ALL counter heroes regardless of pool (incl. ones you don't own)", () => {
  // Black Panther is countered_by Thing/Thor/Hulk/Invisible Woman in the KB. The pool here has none
  // of those — so couldHaveAnswered is empty, but `counters` must still surface the full set.
  const input: EngineInput = {
    enemy: ["Black Panther"],
    team: ["Hela"],
    comfortPool: ["Hela"], // no Black Panther counter in the pool
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const row = report.matchup.find((r) => r.displayName === "Black Panther");
  assert.ok(row, "Black Panther has a matchup row");
  const counterNames = row.counters.map((c) => c.displayName);
  assert.ok(counterNames.includes("Thing"), `Thing should be a listed counter (got ${counterNames})`);
  assert.ok(counterNames.length >= 2, "multiple counters listed");
  // and these are listed even though none are in the pool
  assert.equal(row.couldHaveAnswered.length, 0, "none of the counters are in this pool");
});

test("alternatives mirror the engine's full ranked list (not just the top pick)", () => {
  const input: EngineInput = {
    enemy: ["Human Torch", "Iron Man", "Gambit", "Hulk"],
    team: ["Spider-Man", "Black Panther", "Doctor Strange"],
    comfortPool: ["Luna", "Punisher", "Hela", "Mantis"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const ranked = recommend(input).ranked;
  assert.equal(report.alternatives.length, ranked.length);
  assert.ok(report.alternatives.length > 1, "this matchup has more than one legal candidate");
  assert.deepEqual(
    report.alternatives.map((a) => a.hero),
    ranked.map((r) => r.hero),
  );
});

test("the winning hero's alternatives row agrees with the headline (closesFunctions + answersThreats)", () => {
  // Internal consistency: each alternative's closes/answers must reflect THAT candidate's own
  // contribution to the original comp — so the winner's row must match the headline pick. (Bug:
  // computing it from the post-suggestion coverage zeroes the winner's own gaps for everyone.)
  const input: EngineInput = {
    enemy: ["Human Torch", "Storm", "Iron Man", "Luna"],
    team: ["Doctor Strange", "Hulk", "Luna"],
    comfortPool: ["Punisher", "Mantis"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const headline = report.headline;
  assert.equal(headline.kind, "pick");
  if (headline.kind !== "pick") return;
  const winnerRow = report.alternatives.find((a) => a.hero === headline.hero);
  assert.ok(winnerRow, "winner must appear in alternatives");
  assert.deepEqual(
    [...winnerRow.closesFunctions].sort(),
    [...headline.closesFunctions].sort(),
    "winner's alternatives closesFunctions must equal the headline's",
  );
  assert.deepEqual(
    [...winnerRow.answersThreats].sort(),
    [...headline.answersThreats].sort(),
    "winner's alternatives answersThreats must equal the headline's",
  );
  // and the winning pick actually closes at least one function in this matchup (no-healer-ish gap).
  assert.ok(winnerRow.closesFunctions.length > 0, "winner should close a real gap here");
});

test("couldHaveAnswered excludes heroes already on the team (no 'play the hero you already field')", () => {
  // Punisher is BOTH fielded and in the pool. Storm (flyer) is answered by Punisher's grounding,
  // so answeredByCurrentComp is true — but Punisher must NOT also be offered as a could-have.
  const input: EngineInput = {
    enemy: ["Storm", "Luna"],
    team: ["Doctor Strange", "Hulk", "Punisher"],
    comfortPool: ["Punisher", "Mantis"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const storm = resolveKey("Storm")!;
  const punisher = resolveKey("Punisher")!;
  const row = report.matchup.find((r) => r.hero === storm)!;
  assert.equal(row.answeredByCurrentComp, true, "fielded Punisher already answers Storm");
  assert.ok(
    !row.couldHaveAnswered.some((c) => c.hero === punisher),
    "a hero already on the team must not appear under couldHaveAnswered",
  );
});

// ---------------------------------------------------------------------------
// 2. PROPERTY INVARIANTS — over every golden fixture
// ---------------------------------------------------------------------------

function poolKeys(input: EngineInput): Set<string> {
  const out = new Set<string>();
  for (const n of input.comfortPool) {
    const k = resolveKey(n);
    if (k) out.add(k);
  }
  return out;
}

for (const fx of GOLDEN) {
  test(`invariant[${fx.name}]: headline === engine suggestion`, () => {
    const report = analyzePostGame(fx.input);
    assert.deepEqual(report.headline, recommend(fx.input).suggestion);
  });

  test(`invariant[${fx.name}]: poolGap <=> matchup row with no answer (internal consistency)`, () => {
    const report = analyzePostGame(fx.input);
    for (const gap of report.poolGaps) {
      const row = report.matchup.find((r) => r.hero === gap.hero);
      assert.ok(row, `gap ${gap.hero} has a matchup row`);
      assert.equal(row.couldHaveAnswered.length, 0);
      assert.equal(row.answeredByCurrentComp, false);
    }
  });

  test(`invariant[${fx.name}]: every alternative hero is in the comfort pool`, () => {
    const report = analyzePostGame(fx.input);
    const pool = poolKeys(fx.input);
    for (const alt of report.alternatives) {
      assert.ok(pool.has(alt.hero), `${alt.hero} must be in the comfort pool`);
    }
  });

  test(`invariant[${fx.name}]: no ban field anywhere in the serialized report (D-006)`, () => {
    const report = analyzePostGame(fx.input);
    const json = JSON.stringify(report);
    assert.ok(!/"kind"\s*:\s*"ban"/.test(json), "no ban suggestion");
    assert.ok(!/\bban_value\b|\bban_logic\b|\bban_note\b|\bbanned_characters\b/.test(json), "no ban field");
  });
}

// ---------------------------------------------------------------------------
// 3. FUZZ — never throws on degraded input
// ---------------------------------------------------------------------------

test("never throws on degraded input (masked / unknown / empty pool / partial roster)", () => {
  const names = ["Gambit", "Luna", "*****", "NotAHero", "", "Hela", "Doctor Strange", "Thing"];
  const pick = (n: number, seed: number): string[] =>
    Array.from({ length: n }, (_, i) => names[(seed * 7 + i * 3) % names.length]!);
  for (let seed = 0; seed < 40; seed++) {
    const input: EngineInput = {
      enemy: pick((seed % 6) + 1, seed),
      team: pick(seed % 7, seed + 1),
      comfortPool: pick(seed % 4, seed + 2),
      maskedCount: seed % 3,
    };
    let report: PostGameReport | undefined;
    assert.doesNotThrow(() => {
      report = analyzePostGame(input);
    }, `seed ${seed} threw`);
    assert.ok(report, `seed ${seed} produced a report`);
    assert.ok(Array.isArray(report!.matchup));
    assert.ok(Array.isArray(report!.poolGaps));
    assert.ok(Array.isArray(report!.alternatives));
  }
});
