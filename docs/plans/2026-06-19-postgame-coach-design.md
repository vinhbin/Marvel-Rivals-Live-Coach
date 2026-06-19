# Post-Game Coach (Phase 2.1) — Design

**Date:** 2026-06-19
**Phase:** 2.1 (first consumer of the engine — design §6 mode 2)
**Status:** designed, building
**Decisions referenced:** D-005 (golden-fixture oracle), D-006 (no-ban output), D-008 (self-directed
framing), D-009 (constrained objective), D-012 (2-2-2 / Deadpool skip).

---

## 1. What this is

A **pure analysis module** in `src/postgame/` that turns one finished matchup into a structured,
serializable `PostGameReport`. It is a *projection* of the existing engine — it runs `recommend()`
and reshapes the result; it adds **no new engine logic and no live concerns**.

Scope decisions (locked with the user 2026-06-19):

- **Input scope:** a SINGLE final-roster snapshot (enemy comp + your comp + your pool). No
  match-timeline / multi-round modeling — that needs the GEP spike (Phase 3) and is gated by
  Q-001/Q-006. Lowest-risk, matches "no live edge cases."
- **Deliverable now:** analysis MODULE + tests only. No React. UI is a thin later step
  (interleaved with Phase 5).
- **"What you could've swapped to":** the engine's FULL ranked candidate list **plus** a pool-gap
  section (threats the whole pool can't answer — the "what to add" advice). Not just the top pick.

### Compliance (inherited for free)

The module only ever reads engine output + the public KB. The engine output is already ban-free
(D-006: no `Ban` variant is representable) and enemy-stat-free (it keys off canonical hero keys +
static tiers only). The report therefore cannot introduce a ban or an enemy scoreboard. All
user-facing prose stays self-directed (D-008): "your pool can't answer X / you could've played Y",
never "shut down enemy X".

---

## 2. Data flow

```
EngineInput ──► recommend() ──► EngineResult
                                     │
                          analyzePostGame(input, kb)
                                     ▼
                              PostGameReport
                                { meta, headline, matchup[], alternatives[], poolGaps[], notes }
```

`analyzePostGame` is a pure function of `(input, kb)`, deterministic, never throws (it inherits the
engine's graceful degradation: degraded rosters surface as `notes`, never crashes).

---

## 3. The report

```ts
interface PostGameReport {
  meta: { mode; archetype; teamSize; poolSize };
  headline: Suggestion;        // the engine's primary call, unchanged (Pick | Swap | Hold)
  matchup: MatchupRow[];       // §6 "full matchup table"
  alternatives: AlternativeRow[]; // §6 "what you could've swapped to" — FULL ranked list
  poolGaps: PoolGap[];         // §6 "your comfort pool gaps"
  notes: EngineNote[];         // degraded-input notes, passed through
}

interface MatchupRow {
  hero; displayName; weight; counterability;
  conditionalCovered?: boolean;
  answeredByCurrentComp: boolean;   // a counter mechanism already on your TEAM (snapshot truth)
  couldHaveAnswered: { hero; displayName; viaMechanisms: string[] }[]; // POOL heroes that answer it
}

interface AlternativeRow {          // one per engine `ranked` entry
  hero; displayName; score; replaces?;
  // light annotation of what it does, recomputed from the public KB
  answersThreats: string[]; closesFunctions: string[];
}

interface PoolGap {                 // a threat NOTHING in the whole pool answers
  hero; displayName; weight; neededMechanisms: string[];
}
```

### The trap: do NOT reuse `WeightedThreat.covered`

`EngineResult.threats[].covered` means "covered by the **winning candidate**" — the live-overlay
reading. The post-game table needs two *different* facts, recomputed directly from the KB:

- `answeredByCurrentComp` = does your CURRENT team (no suggestion applied) already deliver a
  mechanism in the threat's `countered_by`? → `mechanismsProvidedBy(team) ∩ threat.countered_by`.
- `couldHaveAnswered` = which POOL heroes deliver such a mechanism (per hero, so we can name them).
- A `PoolGap` is a threat where `couldHaveAnswered` is empty **and** the current comp didn't answer
  it either — nothing you own touches it.

Conditional threats: `answeredByCurrentComp` uses the same mechanism-intersection rule (a
conditional is "answered now" only if the current comp delivers a required mechanism), consistent
with Phase 1.3.

---

## 4. Engine surface changes (minimal)

The postgame module must stay on the engine's PUBLIC surface — no reaching into internals. Two pure
helpers it needs are currently unexported; widen `src/engine/index.ts` to export:

- `mechanismsProvidedBy(heroes, kb)` (conditional.ts) — pool/team mechanism union.
- `resolveName(raw, kb)` (load.ts) — to resolve raw roster/pool strings to canonical keys
  consistently with the engine.
- the relevant types (`Resolution`, `MechanismKey`, `CompFunctionKey`).

No engine *logic* changes — this is export-widening only, so the golden fixtures stay green.

---

## 5. Testing (D-005 discipline)

Mirror the engine's two-layer approach in `test/postgame.test.ts`:

1. **Golden-ish assertions** over a few hand-judged matchups: e.g. a matchup where the team already
   answers a threat → that row's `answeredByCurrentComp` is true; a threat the pool can't touch →
   it appears in `poolGaps`; the headline equals `recommend()`'s suggestion.
2. **Property invariants:**
   - `headline` is exactly `recommend(input).suggestion` (projection, not re-derivation).
   - every `poolGap` hero also appears in `matchup` with empty `couldHaveAnswered` and
     `answeredByCurrentComp === false` (internal consistency).
   - `alternatives.length === ranked.length`; every alternative hero ∈ comfort pool.
   - no ban field anywhere in the serialized report (D-006 inherited).
   - never throws on degraded input (masked/unknown/empty pool) — fuzz.

Wire `test/postgame.test.ts` into the `test` npm script (currently runs only `engine.test.ts`).

---

## 6. Out of scope (explicitly deferred)

- React/overlay rendering (Phase 5 territory).
- Multi-round / per-fight timeline review (needs Phase 3 GEP data; Q-001/Q-006).
- First-death / nemesis aggregation (Phase 6.3 — macro layer, gated).
- Patch-trend-aware weighting beyond the engine's current neutral default (Q-002).
