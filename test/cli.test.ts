/**
 * Phase 2/CLI — pure format + parse helpers for the manual-input coach (no Overwolf, no game).
 *
 * Only the PURE pieces are unit-tested here: parsing a comma-separated roster line into names, and
 * rendering a PostGameReport / Suggestion into the plain-text the CLI prints. The stdin shell
 * (src/cli/coach.ts) is thin I/O and is exercised by hand, not here.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseNames, formatReport, formatHeadline, formatGlance, resolvePoolSource } from "../src/cli/format.js";
import { analyzePostGame } from "../src/postgame/index.js";
import type { EngineInput } from "../src/engine/index.js";

// ---------------------------------------------------------------------------
// parseNames — comma-separated input -> trimmed, non-empty names
// ---------------------------------------------------------------------------

test("parseNames splits on commas and trims, dropping empties", () => {
  assert.deepEqual(parseNames("Gambit, Luna ,Hela"), ["Gambit", "Luna", "Hela"]);
  assert.deepEqual(parseNames("  Thing  "), ["Thing"]);
  assert.deepEqual(parseNames(""), []);
  assert.deepEqual(parseNames("Gambit,,Luna, "), ["Gambit", "Luna"]);
});

// ---------------------------------------------------------------------------
// resolvePoolSource — typed pool > saved pool > all-heroes fallback
// ---------------------------------------------------------------------------

test("resolvePoolSource: a typed pool overrides the saved pool", () => {
  const r = resolvePoolSource(["Hela"], ["Punisher", "Hulk"], ["Hela", "Punisher", "Hulk", "Luna"]);
  assert.deepEqual(r.pool, ["Hela"]);
  assert.equal(r.usingAllHeroes, false);
  assert.equal(r.source, "typed");
});

test("resolvePoolSource: no typed pool falls back to the saved pool", () => {
  const r = resolvePoolSource([], ["Punisher", "Hulk"], ["Hela", "Punisher", "Hulk", "Luna"]);
  assert.deepEqual(r.pool, ["Punisher", "Hulk"]);
  assert.equal(r.usingAllHeroes, false);
  assert.equal(r.source, "saved");
});

test("resolvePoolSource: no typed AND no saved pool falls back to ALL heroes (with the flag set)", () => {
  const all = ["Hela", "Punisher", "Hulk", "Luna"];
  const r = resolvePoolSource([], [], all);
  assert.deepEqual(r.pool, all);
  assert.equal(r.usingAllHeroes, true);
  assert.equal(r.source, "all");
});

test("formatHeadline renders a pick with the hero name and the rationale", () => {
  const input: EngineInput = {
    enemy: ["Gambit", "Luna", "Doctor Strange"],
    team: ["Hela", "Spider-Man"],
    comfortPool: ["Magneto", "Punisher"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const line = formatHeadline(report.headline);
  assert.match(line, /PICK/i);
  if (report.headline.kind === "pick") {
    assert.ok(line.includes(report.headline.hero), "headline line names the recommended hero");
  }
});

test("formatHeadline renders a hold with its reason and never invents a hero", () => {
  const line = formatHeadline({ kind: "hold", reason: "below the confidence gate" });
  assert.match(line, /HOLD/i);
  assert.match(line, /below the confidence gate/);
});

// ---------------------------------------------------------------------------
// formatReport — the full post-game text
// ---------------------------------------------------------------------------

test("formatReport includes the headline, a matchup section, and a pool-gaps section", () => {
  const input: EngineInput = {
    enemy: ["Human Torch", "Storm", "Iron Man", "Luna"],
    team: ["Doctor Strange", "Hulk", "Luna"],
    comfortPool: ["Punisher", "Mantis"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const text = formatReport(report);
  assert.match(text, /matchup/i, "has a matchup section");
  assert.match(text, /pool gap/i, "has a pool-gaps section");
  assert.match(text, /alternativ/i, "has an alternatives section");
  // a known enemy from the input shows up by display name
  assert.ok(text.includes("Storm"), "lists an enemy threat");
});

test("formatReport never serializes a ban (D-006 inherited) and surfaces degraded-input notes", () => {
  const input: EngineInput = {
    enemy: ["Gambit", "*****", "NotAHero"],
    team: ["Hela"],
    comfortPool: ["Magneto"],
    mode: "pick",
  };
  const report = analyzePostGame(input);
  const text = formatReport(report);
  assert.ok(!/\bban\b/i.test(text) || /never.*ban|no.*ban/i.test(text), "no stray ban output");
  // the unknown + masked names produced engine notes — the CLI must show them, not swallow them
  assert.match(text, /note/i, "degraded-input notes are surfaced");
});

test("formatReport never throws on a degraded report", () => {
  const input: EngineInput = { enemy: ["*****"], team: [], comfortPool: ["NotAHero"], mode: "pick" };
  const report = analyzePostGame(input);
  assert.doesNotThrow(() => formatReport(report));
});

// ---------------------------------------------------------------------------
// formatGlance — the mid-game one-liner (action + why + top open threat)
// ---------------------------------------------------------------------------

test("formatGlance: leads with the action and names the worst still-open threat", () => {
  // Brawl-ish comp; Jeff (uncovered conditional) is the threat the current comp can't answer.
  const input: EngineInput = {
    enemy: ["Devil Dinosaur", "Hawkeye", "Jeff"],
    team: ["Devil Dinosaur", "Emma Frost", "Magneto", "Punisher", "Luna", "Mantis"],
    comfortPool: ["Hulk", "Doctor Strange"],
    mode: "swap",
  };
  const report = analyzePostGame(input);
  const glance = formatGlance(report);
  assert.match(glance, /^▶/, "starts with the glance marker");
  // It must name the recommended action (pick/swap/hold) — mirror the headline kind.
  assert.match(glance, /SWAP|PICK|HOLD/);
  // Jeff is an uncovered conditional with no current-comp answer => it is the 'still open' threat.
  assert.match(glance, /still open: Jeff/);
  assert.match(glance, /flat_damage/, "shows what the open threat needs");
});

test("formatGlance: omits the 'still open' line when the current comp answers everything", () => {
  // Team already includes Thing (anti-dive answer); a single weak enemy is fully covered.
  const input: EngineInput = {
    enemy: ["Black Panther"],
    team: ["Thing", "Hela", "Luna", "Mantis", "Hulk", "Punisher"],
    comfortPool: ["Magneto"],
    mode: "swap",
  };
  const glance = formatGlance(analyzePostGame(input));
  assert.ok(!/still open/.test(glance), "no open-threat line when nothing is open");
});

test("formatGlance: a threat the RECOMMENDATION answers is NOT shown as 'still open' (no self-contradiction)", () => {
  // Current comp doesn't answer Luna, but the recommended swap (White Fox) does. The glance must not
  // say "swap to White Fox … but Luna still open" — White Fox IS the Luna answer.
  const input: EngineInput = {
    enemy: ["Doctor Strange", "Hulk", "Iron Man", "Scarlet Witch", "Invisible Woman", "Luna"],
    team: ["Hawkeye", "Cloak and Dagger", "Gambit", "Magneto"],
    comfortPool: ["White Fox", "Punisher", "Hulk", "Doctor Strange"],
    mode: "swap",
  };
  const report = analyzePostGame(input);
  // Sanity: the recommendation is a swap into a hero that answers Luna.
  assert.equal(report.headline.kind, "swap");
  if (report.headline.kind === "swap") {
    assert.ok(report.headline.answersThreats.includes("Luna"), "precondition: the rec answers Luna");
  }
  const glance = formatGlance(report);
  assert.ok(!/still open: Luna/.test(glance), "Luna is closed by the rec, so not 'still open'");
});

test("formatGlance never throws on a degraded report", () => {
  const report = analyzePostGame({ enemy: ["*****"], team: [], comfortPool: ["NotAHero"], mode: "pick" });
  assert.doesNotThrow(() => formatGlance(report));
});
