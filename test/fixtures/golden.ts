/**
 * Phase 1.2 — golden fixtures (D-005): hand-entered (roster + comfort pool) -> expected suggestion,
 * judged correct by game knowledge. This is the trust ORACLE: "the engine works" means "it passes
 * these." They also gate every future patch-overlay / weights edit (snapshot regression).
 *
 * Each fixture asserts the WHAT (kind + hero + maybe replaces), not the exact score — scores are an
 * implementation detail that weights tuning is allowed to move; the recommendation is the contract.
 * Where two answers are genuinely co-correct (a true tie in the data), `acceptableHeroes` lists both.
 */
import type { EngineInput } from "../../src/engine/index.js";

export interface GoldenFixture {
  name: string;
  /** Why this is the right answer — the human judgment D-005 is about. */
  rationale: string;
  input: EngineInput;
  expect:
    | { kind: "pick"; hero?: string; acceptableHeroes?: string[] }
    | { kind: "swap"; hero?: string; replaces?: string; acceptableHeroes?: string[] }
    | { kind: "hold" };
}

export const GOLDEN: GoldenFixture[] = [
  {
    name: "dive comp with no healer picks the support that also has a defensive ult",
    rationale:
      "Team is 1 tank + 2 dive DPS with ZERO strategists. The single biggest gap is sustain. Both " +
      "Luna and Mantis fill it; Luna wins because she also brings a defensive ult the dive comp wants " +
      "and answers the enemy Human Torch (hitscan). A healer here is non-negotiable.",
    input: {
      enemy: ["Human Torch", "Iron Man", "Gambit", "Hulk"],
      team: ["Spider-Man", "Black Panther", "Doctor Strange"],
      comfortPool: ["Luna", "Punisher", "Hela", "Mantis"],
      mode: "pick",
    },
    expect: { kind: "pick", hero: "Luna" },
  },
  {
    name: "poke comp getting dived swaps a duplicate into the anti-dive answer hero",
    rationale:
      "Three poke DPS + Doctor Strange is dive-bait against an enemy with Spider-Man + Black Panther + " +
      "Venom. Thing is THE anti-dive answer; swapping the redundant 2nd frontline (Doctor Strange, same " +
      "role) for Thing closes the peel hole without breaking the role queue.",
    input: {
      enemy: ["Spider-Man", "Black Panther", "Venom", "Luna", "Mantis", "Doctor Strange"],
      team: ["Hela", "Hawkeye", "Punisher", "Doctor Strange", "Luna", "Mantis"],
      comfortPool: ["Thing", "Peni Parker", "Namor"],
      mode: "swap",
    },
    expect: { kind: "swap", hero: "Thing", replaces: "Doctor Strange" },
  },
  {
    name: "conditional threat (Wolverine) is answered when the pool brings a cc-immune body",
    rationale:
      "Wolverine is counterability=conditional: only truly answered by a CC-immune body (Thing / Devil " +
      "Dinosaur). The pool has both and the team needs frontline, so either is co-correct. The point is " +
      "the engine recommends one of the real answers, not a non-answer.",
    input: {
      enemy: ["Wolverine", "Luna", "Mantis"],
      team: ["Hela", "Punisher", "Luna"],
      comfortPool: ["Thing", "Devil Dinosaur"],
      mode: "pick",
    },
    expect: { kind: "pick", acceptableHeroes: ["Thing", "Devil Dinosaur"] },
  },
  {
    name: "Gambit (low counterability, highest threat) into triple-support steers to Magneto",
    rationale:
      "Gambit is the top-tier threat (counterability=low => weight 1.0). Against a support-heavy enemy " +
      "(Gambit + Luna + Doctor Strange), Magneto is the clear pick over Punisher (dev-confirmed): his " +
      "ult_turnaround both denies Gambit's ult AND can cancel the enemy healer ult, while Punisher only " +
      "farms/poke-pressures. The engine ranks Magneto first.",
    input: {
      enemy: ["Gambit", "Luna", "Doctor Strange"],
      team: ["Hela", "Spider-Man"],
      comfortPool: ["Magneto", "Punisher"],
      mode: "pick",
    },
    expect: { kind: "pick", hero: "Magneto" },
  },
  {
    name: "permaflyer enemy steers the pick toward grounding/hitscan",
    rationale:
      "Human Torch + Storm + Iron Man is a flyer-heavy enemy. The comp lacks anti-flyer grounding. " +
      "Punisher (hitscan, anti_flyer_grounding declared) is the right answer over Mantis (a 2nd healer " +
      "the team doesn't yet need as urgently as grounding). Dev note: ANY hitscan answers flyers — the " +
      "engine surfaces the wider pool correctly (e.g. Jean Grey ranks just below via her hitscan " +
      "crosswalk; Hela ties Punisher). A dedicated hitscan DPS is the cleaner answer, hence Punisher here.",
    input: {
      enemy: ["Human Torch", "Storm", "Iron Man", "Luna"],
      team: ["Doctor Strange", "Hulk", "Luna"],
      comfortPool: ["Punisher", "Mantis"],
      mode: "pick",
    },
    expect: { kind: "pick", hero: "Punisher" },
  },
  {
    name: "no useful change available -> Hold rather than force a marginal swap",
    rationale:
      "Full comp, and the only pool option is Rocket — swapping one healer (Luna/Mantis) for another " +
      "healer closes no gap and answers no threat, scoring below the confidence gate. The correct, " +
      "compliant behaviour is Hold, never a forced marginal pick (D-006).",
    input: {
      enemy: ["Jean Grey", "Hela"],
      team: ["Doctor Strange", "Luna", "Mantis", "Hela", "Hawkeye", "Punisher"],
      comfortPool: ["Rocket"],
      mode: "swap",
    },
    expect: { kind: "hold" },
  },
  {
    name: "empty/garbage pool -> Hold (never crash, never invent a hero)",
    rationale:
      "If the comfort pool resolves to zero known heroes, there is nothing to recommend. The engine must " +
      "Hold gracefully, not throw and not fabricate a pick (1.4).",
    input: {
      enemy: ["Gambit", "Luna"],
      team: ["Hela", "Doctor Strange"],
      comfortPool: ["NotARealHero", "?????"],
      mode: "pick",
    },
    expect: { kind: "hold" },
  },
  {
    name: "an UNCOVERED conditional must not read as a max-tier threat (unknown != dangerous)",
    rationale:
      "Spider-Man is counterability=conditional, answered only by survive_onslaught / cc_immune_body — " +
      "which neither the team nor the pool can deliver, so he stays UNCOVERED. The fix (weights.json) " +
      "makes an uncovered conditional score 0.6 (moderate, == 'medium'), NOT 1.0 (the 'low'/hardest " +
      "tier). Because Spider-Man is genuinely unanswerable here, the engine must NOT be dragged toward " +
      "chasing him; it should answer the threat the pool CAN handle — Storm (flyer) via Punisher " +
      "(grounding/hitscan), which also fills the comp's poke+grounding gap. Regression guard: under the " +
      "old uncovered_weight=1.0 an unanswerable Spider-Man dominated the objective and steered the pick. " +
      "Spider-Man correctly surfaces as a POOL GAP (add an answer), never as a forced/max threat.",
    input: {
      enemy: ["Spider-Man", "Storm", "Luna"],
      team: ["Doctor Strange", "Hulk", "Luna"],
      comfortPool: ["Punisher", "Mantis"],
      mode: "pick",
    },
    expect: { kind: "pick", hero: "Punisher" },
  },
  {
    name: "role queue is respected: a full DPS line cannot take another duelist",
    rationale:
      "Team already has 2 duelists (Hela, Hawkeye). The pool's only duelist (Psylocke) is illegal under " +
      "2-2-2 in pick mode; the legal pick is the strategist Luna, who also fills the missing healer. " +
      "This is the D-012 / D-009 throw-pick guard in action.",
    input: {
      enemy: ["Spider-Man", "Venom"],
      team: ["Hela", "Hawkeye", "Doctor Strange"],
      comfortPool: ["Psylocke", "Luna"],
      mode: "pick",
    },
    expect: { kind: "pick", hero: "Luna" },
  },
];
