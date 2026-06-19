/**
 * Phase 3 — GEP ingestion (platform-neutral slice) test suite.
 *
 * Three modules + the LOAD-BEARING compliance invariant:
 *  1. schema  — strip-to-whitelist: extra/prohibited fields (ult_charge, enemy-stat-shaped keys)
 *               NEVER survive a parse. This is the compliance boundary (D-007).
 *  2. swaps   — diff enemy character_name by uid; masked->named is a REVEAL not a swap.
 *  3. adapter — split team/enemy by is_teammate; produce an EngineInput that the engine accepts.
 *  + fuzz     — garbage payloads never crash the schema->swaps->adapter->engine pipeline.
 *
 * Everything here runs WITHOUT a live game (synthetic payloads). Q-001/Q-006 timing is out of
 * scope — that needs a real match (docs/gep-spike-protocol.md).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseRosterUpdate } from "../src/gep/schema.js";
import type { GepRoster } from "../src/gep/schema.js";
import { detectSwaps } from "../src/gep/swaps.js";
import { toEngineInput } from "../src/gep/adapter.js";
import { recommend } from "../src/engine/index.js";

const WHITELIST = new Set([
  "character_name",
  "character_id",
  "team",
  "is_teammate",
  "uid",
  "is_alive",
  "kills",
  "deaths",
  "assists",
  "is_local",
]);

/** A raw GEP roster player as it might arrive, padded with fields we must NOT consume. */
function rawPlayer(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: "u1",
    character_name: "Gambit",
    character_id: 1001,
    team: "0",
    is_teammate: false,
    is_alive: true,
    kills: 3,
    deaths: 1,
    assists: 2,
    is_local: false,
    // --- fields the boundary MUST strip (compliance / drift) ---
    ult_charge: 87, // teammate-only; prohibited to consume (ult inference, D-007)
    damage: 99999, // enemy confidential stat shape (#1) — must never survive
    healing: 4242,
    some_future_gep_field: "whatever", // version drift (§3 gotcha) — tolerated, dropped
    elo_score: 1234,
    is_disconnected: false,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// 1. SCHEMA — strip-to-whitelist (the load-bearing compliance test)
// ---------------------------------------------------------------------------

test("schema strips every non-whitelisted field (ult_charge, damage, healing, drift) at the boundary", () => {
  const roster = parseRosterUpdate({ players: [rawPlayer(), rawPlayer({ uid: "u2", is_teammate: true })] });
  assert.equal(roster.players.length, 2);
  for (const p of roster.players) {
    for (const key of Object.keys(p)) {
      assert.ok(WHITELIST.has(key), `prohibited/extra key "${key}" survived the boundary`);
    }
    assert.ok(!("ult_charge" in p), "ult_charge must never reach the engine");
    assert.ok(!("damage" in p), "enemy damage must never reach the engine");
    assert.ok(!("healing" in p), "enemy healing must never reach the engine");
  }
});

test("schema keeps the whitelisted values intact", () => {
  const roster = parseRosterUpdate({ players: [rawPlayer({ character_name: "Hela", uid: "x" })] });
  const p = roster.players[0]!;
  assert.equal(p.character_name, "Hela");
  assert.equal(p.uid, "x");
  assert.equal(p.is_teammate, false);
});

test("schema tolerates missing K/D/A and masked names (early / D3+ payloads)", () => {
  const roster = parseRosterUpdate({
    players: [{ uid: "u1", character_name: "*****", team: "1", is_teammate: false }],
  });
  assert.equal(roster.players.length, 1);
  assert.equal(roster.players[0]!.character_name, "*****");
});

test("schema throws on a structurally unusable payload (not a players array)", () => {
  assert.throws(() => parseRosterUpdate({ nope: true }));
  assert.throws(() => parseRosterUpdate(null));
  assert.throws(() => parseRosterUpdate({ players: "not-an-array" }));
});

test("schema coerces a numeric uid to string and accepts an empty roster", () => {
  const roster = parseRosterUpdate({ players: [{ uid: 12345, character_name: "Hela" }] });
  assert.equal(roster.players[0]!.uid, "12345");
  assert.deepEqual(parseRosterUpdate({ players: [] }).players, []);
});

// ---------------------------------------------------------------------------
// 2. SWAPS — diff by uid; masked->named is a reveal, not a swap
// ---------------------------------------------------------------------------

const r = (players: Array<Partial<{ uid: string; character_name: string; is_teammate: boolean }>>): GepRoster =>
  parseRosterUpdate({
    players: players.map((p) => ({
      uid: p.uid ?? "u",
      character_name: p.character_name ?? "*****",
      team: "1",
      is_teammate: p.is_teammate ?? false,
    })),
  });

test("a same-uid character_name change on the enemy side is a swap", () => {
  const prev = r([{ uid: "e1", character_name: "Gambit" }]);
  const next = r([{ uid: "e1", character_name: "Hela" }]);
  const swaps = detectSwaps(prev, next);
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]!.out, "Gambit");
  assert.equal(swaps[0]!.in, "Hela");
});

test("masked -> named is a REVEAL, not a swap (Q-001 first-population case)", () => {
  const prev = r([{ uid: "e1", character_name: "*****" }]);
  const next = r([{ uid: "e1", character_name: "Gambit" }]);
  assert.equal(detectSwaps(prev, next).length, 0);
});

test("no change yields no swaps; join/leave yields no swaps", () => {
  const a = r([{ uid: "e1", character_name: "Gambit" }]);
  assert.equal(detectSwaps(a, a).length, 0);
  const grew = r([{ uid: "e1", character_name: "Gambit" }, { uid: "e2", character_name: "Hela" }]);
  assert.equal(detectSwaps(a, grew).length, 0, "a new uid is a join, not a swap");
});

test("swaps are tracked by uid even when roster order shuffles", () => {
  const prev = r([{ uid: "e1", character_name: "Gambit" }, { uid: "e2", character_name: "Luna" }]);
  const next = r([{ uid: "e2", character_name: "Luna" }, { uid: "e1", character_name: "Thing" }]);
  const swaps = detectSwaps(prev, next);
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]!.out, "Gambit");
  assert.equal(swaps[0]!.in, "Thing");
});

test("prev=null (first update ever) yields no swaps", () => {
  assert.equal(detectSwaps(null, r([{ uid: "e1", character_name: "Gambit" }])).length, 0);
});

test("named -> masked is ignored (not a swap)", () => {
  const prev = r([{ uid: "e1", character_name: "Gambit" }]);
  const next = r([{ uid: "e1", character_name: "*****" }]);
  assert.equal(detectSwaps(prev, next).length, 0);
});

test("untrackable (empty) uids never produce phantom swaps", () => {
  // Two un-id'd players collapse to uid "" at the schema boundary; diffing them would fabricate
  // swaps (last-write-wins in a uid map). Untrackable uids must be skipped, not invented.
  const prev = parseRosterUpdate({
    players: [
      { character_name: "Gambit", team: "1", is_teammate: false },
      { character_name: "Hela", team: "1", is_teammate: false },
    ],
  });
  const next = parseRosterUpdate({
    players: [
      { character_name: "Gambit", team: "1", is_teammate: false },
      { character_name: "Thing", team: "1", is_teammate: false },
    ],
  });
  assert.equal(detectSwaps(prev, next).length, 0, "no phantom swaps from empty-uid collisions");
});

test("duplicate uids within a snapshot never produce phantom swaps", () => {
  const prev = r([{ uid: "e1", character_name: "Gambit" }, { uid: "e1", character_name: "Hela" }]);
  const next = r([{ uid: "e1", character_name: "Thing" }, { uid: "e1", character_name: "Luna" }]);
  assert.equal(detectSwaps(prev, next).length, 0, "ambiguous duplicate uid must not fabricate a swap");
});

// ---------------------------------------------------------------------------
// 3. ADAPTER — split team/enemy; produce an engine-acceptable EngineInput
// ---------------------------------------------------------------------------

test("adapter splits enemies vs teammates by is_teammate and feeds the engine", () => {
  const roster = parseRosterUpdate({
    players: [
      rawPlayer({ uid: "me", character_name: "Hela", is_teammate: true, is_local: true }),
      rawPlayer({ uid: "t2", character_name: "Doctor Strange", is_teammate: true }),
      rawPlayer({ uid: "e1", character_name: "Gambit", is_teammate: false }),
      rawPlayer({ uid: "e2", character_name: "Luna", is_teammate: false }),
    ],
  });
  const input = toEngineInput(roster, ["Magneto", "Punisher"]);
  assert.ok(input.enemy.includes("Gambit"));
  assert.ok(input.enemy.includes("Luna"));
  assert.ok(input.team.includes("Hela"));
  assert.ok(input.team.includes("Doctor Strange"));
  assert.ok(!input.enemy.includes("Hela"), "a teammate must not appear on the enemy side");
  // and it round-trips through the engine without throwing
  assert.doesNotThrow(() => recommend(input));
});

test("adapter counts masked enemies without naming them", () => {
  const roster = parseRosterUpdate({
    players: [
      rawPlayer({ uid: "e1", character_name: "*****", is_teammate: false }),
      rawPlayer({ uid: "e2", character_name: "Gambit", is_teammate: false }),
      rawPlayer({ uid: "me", character_name: "Hela", is_teammate: true, is_local: true }),
    ],
  });
  const input = toEngineInput(roster, ["Magneto"]);
  // the masked enemy is represented so roster size is right, but not as a fake name
  const named = input.enemy.filter((n) => n !== "*****" && n.trim() !== "");
  assert.ok(named.includes("Gambit"));
  const result = recommend(input);
  assert.ok(Array.isArray(result.notes));
});

test("an all-masked enemy side still yields a usable engine result (no crash)", () => {
  const roster = parseRosterUpdate({
    players: [
      rawPlayer({ uid: "e1", character_name: "*****", is_teammate: false }),
      rawPlayer({ uid: "e2", character_name: "*****", is_teammate: false }),
      rawPlayer({ uid: "me", character_name: "Hela", is_teammate: true, is_local: true }),
    ],
  });
  const input = toEngineInput(roster, ["Magneto", "Punisher"]);
  const result = recommend(input);
  assert.ok(["pick", "swap", "hold"].includes(result.suggestion.kind));
});

test("adapter honors a forced mode and keeps the local player on our side", () => {
  const roster = parseRosterUpdate({
    players: [
      // local player reported WITHOUT is_teammate (the is_local-only case) — must still be ours.
      rawPlayer({ uid: "me", character_name: "Hela", is_teammate: false, is_local: true }),
      rawPlayer({ uid: "e1", character_name: "Gambit", is_teammate: false }),
    ],
  });
  const input = toEngineInput(roster, ["Magneto"], { mode: "swap" });
  assert.equal(input.mode, "swap");
  assert.ok(input.team.includes("Hela"), "the local player belongs on our side");
  assert.ok(!input.enemy.includes("Hela"));
});

// ---------------------------------------------------------------------------
// 4. FUZZ — the full pipeline never crashes on garbage
// ---------------------------------------------------------------------------

test("schema -> swaps -> adapter -> engine never throws on noisy payloads", () => {
  const namePool = ["Gambit", "Luna", "*****", "Hela", "NotAHero", ""];
  let prev: GepRoster | null = null;
  for (let seed = 0; seed < 40; seed++) {
    const n = (seed % 6) + 1;
    const players = Array.from({ length: n }, (_, i) => ({
      uid: `u${(seed + i) % 4}`,
      character_name: namePool[(seed * 3 + i) % namePool.length],
      team: String(i % 2),
      is_teammate: (seed + i) % 2 === 0,
      is_local: i === 0,
      ult_charge: seed, // must be stripped every time
      damage: seed * 100,
    }));
    assert.doesNotThrow(() => {
      const roster = parseRosterUpdate({ players });
      // compliance holds under fuzz too
      for (const p of roster.players) {
        assert.ok(!("ult_charge" in p) && !("damage" in p));
      }
      detectSwaps(prev, roster);
      const input = toEngineInput(roster, ["Magneto", "Punisher", "Thing"]);
      recommend(input);
      prev = roster;
    }, `seed ${seed} threw`);
  }
});
