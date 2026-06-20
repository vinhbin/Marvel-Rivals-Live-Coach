/**
 * Hand-built test scenarios for the manual coach — run them all with `npm run scenarios`.
 *
 * These are realistic full drafts (not edge cases) so you can eyeball ADVICE QUALITY across the main
 * comp archetypes without grinding real games. Each has a `name` + `tests` note describing the
 * situation and what a good recommendation would look like, so you can judge the engine's call.
 *
 * Names use display names / aliases (resolved by the engine). Add your own scenarios freely — copy a
 * block, change the rosters. This is NOT a pass/fail test (that's test/*.test.ts); it's a viewer.
 */
import type { EngineInput } from "../src/engine/index.js";

export interface Scenario {
  name: string;
  /** What this draft is probing + what a sensible answer looks like (your judgment oracle). */
  tests: string;
  input: EngineInput;
}

export const SCENARIOS: Scenario[] = [
  {
    name: "Enemy dive, you have no peel",
    tests:
      "Enemy is a classic dive (Spider-Man + Black Panther + Venom). Your backline (Hawkeye/Luna) is " +
      "exposed. A good call brings an anti-dive answer from the pool (Thing / Peni) over a 2nd DPS.",
    input: {
      enemy: ["Venom", "Spider-Man", "Black Panther", "Hela", "Luna", "Mantis"],
      team: ["Doctor Strange", "Hawkeye", "Punisher", "Storm", "Luna", "Mantis"],
      comfortPool: ["Thing", "Peni Parker", "Namor", "Hela"],
      mode: "swap",
    },
  },
  {
    name: "Flyer-heavy enemy, you lack grounding",
    tests:
      "Human Torch + Storm + Iron Man are airborne. A good call brings hitscan/grounding (Hawkeye / " +
      "Punisher / Hela) rather than more melee.",
    input: {
      enemy: ["Magneto", "Human Torch", "Storm", "Iron Man", "Luna", "Mantis"],
      team: ["Doctor Strange", "Thing", "Wolverine", "Magik", "Luna", "Mantis"],
      comfortPool: ["Hawkeye", "Punisher", "Hela", "Storm"],
      mode: "swap",
    },
  },
  {
    name: "Triple-support enemy (poke war)",
    tests:
      "Enemy stacks sustain (Luna + Mantis + Cloak and Dagger). You need ult-denial / burst to break " +
      "the heal wall — Magneto's ult denial or a burst pick beats just out-poking them.",
    input: {
      enemy: ["Groot", "Magneto", "Gambit", "Luna", "Mantis", "Cloak and Dagger"],
      team: ["Doctor Strange", "Thing", "Hawkeye", "Punisher", "Luna"],
      comfortPool: ["Magneto", "Psylocke", "Punisher", "Star-Lord"],
      mode: "pick",
    },
  },
  {
    name: "Draft: open slot, no healer yet",
    tests:
      "Pick mode, you have 1 tank + 2 DPS and ZERO strategists. Sustain is the glaring gap — a good " +
      "call is the healer in your pool (Luna/Mantis), not a 3rd DPS.",
    input: {
      enemy: ["Hulk", "Iron Man", "Gambit", "Hela"],
      team: ["Thing", "Spider-Man", "Hawkeye"],
      comfortPool: ["Luna", "Mantis", "Psylocke", "Hela"],
      mode: "pick",
    },
  },
  {
    name: "Gambit + Devil Dinosaur (two low-counterability threats)",
    tests:
      "Both are high-threat / hard to counter. A good call finds a single pool hero that answers both " +
      "if possible (range poke / ult denial), or the highest-value single answer.",
    input: {
      enemy: ["Devil Dinosaur", "Gambit", "Wolverine", "Luna", "Mantis", "Groot"],
      team: ["Doctor Strange", "Magneto", "Hela", "Spider-Man", "Luna", "Mantis"],
      comfortPool: ["Punisher", "Thing", "Hawkeye", "Magneto"],
      mode: "swap",
    },
  },
  {
    name: "Conditional threat (Wolverine) — pool brings the answer",
    tests:
      "Wolverine is only truly answered by a CC-immune body (Thing / Devil Dinosaur). The pool has " +
      "both — a good call brings one of them, not a non-answer.",
    input: {
      enemy: ["Wolverine", "Magneto", "Hela", "Luna", "Mantis"],
      team: ["Doctor Strange", "Hawkeye", "Punisher", "Luna"],
      comfortPool: ["Thing", "Devil Dinosaur", "Psylocke"],
      mode: "pick",
    },
  },
  {
    name: "Conditional threat — pool CANNOT answer it",
    tests:
      "Same Wolverine, but the pool has no CC-immune body. A good call does the best it can elsewhere " +
      "and the report should show Wolverine as a POOL GAP (what to add) — not a fake answer.",
    input: {
      enemy: ["Wolverine", "Magneto", "Hela", "Luna", "Mantis"],
      team: ["Doctor Strange", "Hawkeye", "Punisher", "Luna"],
      comfortPool: ["Mantis", "Rocket Raccoon", "Cloak and Dagger"],
      mode: "pick",
    },
  },
  {
    name: "Solid comp, marginal pool → should HOLD",
    tests:
      "Your comp already covers the enemy well; the only pool option is a sideways healer swap that " +
      "closes nothing. A good call is HOLD, not a forced marginal change.",
    input: {
      enemy: ["Jean Grey", "Hela", "Doctor Strange"],
      team: ["Magneto", "Thing", "Hawkeye", "Punisher", "Luna", "Mantis"],
      comfortPool: ["Rocket Raccoon"],
      mode: "swap",
    },
  },
  {
    name: "Role queue full of DPS — only a legal role helps",
    tests:
      "Team already has 2 duelists. Pick mode; the pool's duelist is ILLEGAL under 2-2-2, so the legal " +
      "(and needed) pick is the strategist. Tests the throw-pick guard.",
    input: {
      enemy: ["Spider-Man", "Venom", "Hela", "Luna"],
      team: ["Hela", "Hawkeye", "Doctor Strange"],
      comfortPool: ["Psylocke", "Luna"],
      mode: "pick",
    },
  },
  {
    name: "Mirror-ish brawl, broad pool",
    tests:
      "Even brawl with a wide pool. Tests that the engine picks the best marginal upgrade (close a real " +
      "gap / answer the scariest enemy) rather than thrashing. Good to compare alternatives' scores.",
    input: {
      enemy: ["Hulk", "Thor", "Punisher", "Hela", "Luna", "Adam Warlock"],
      team: ["Magneto", "Groot", "Hela", "Punisher", "Luna", "Mantis"],
      comfortPool: ["Thing", "Hawkeye", "Star-Lord", "Cloak and Dagger", "Invisible Woman"],
      mode: "swap",
    },
  },
];
