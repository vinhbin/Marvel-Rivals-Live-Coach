/**
 * Phase 2/CLI — pure format + parse helpers for the manual-input coach (no Overwolf, no game).
 *
 * Only the PURE pieces are unit-tested here: parsing a comma-separated roster line into names, and
 * rendering a PostGameReport / Suggestion into the plain-text the CLI prints. The stdin shell
 * (src/cli/coach.ts) is thin I/O and is exercised by hand, not here.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseNames, formatReport, formatHeadline } from "../src/cli/format.js";
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
// formatHeadline — the one-line call
// ---------------------------------------------------------------------------

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
