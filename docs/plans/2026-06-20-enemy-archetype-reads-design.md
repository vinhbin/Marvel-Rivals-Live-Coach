# Enemy-Archetype + Anti-Meta Reads — Design

**Date:** 2026-06-20
**Status:** designed, building
**Decisions referenced:** D-006 (no-ban output), D-008 (self-directed framing), D-009 (objective).

---

## 1. What this is

A **strategy-level read** of the ENEMY comp, added to the post-game report: detect the enemy's
archetype (dive / brawl / poke / triple-support) and surface a self-directed anti-meta note
("Enemy is triple-support — they out-sustain you; prioritize anti-heal / ult-denial / dive their
backline").

**Inform-only (locked with user):** it does NOT change the engine's pick/swap recommendation. It's
advice text alongside the existing output. Transparent, verifiable against game sense, and it leaves
the golden fixtures untouched (no objective change). If the reads prove good, a later step can let
them nudge gap weights — explicitly out of scope now.

Compliance: it's a read of the enemy's PUBLIC comp composition → self-directed advice about what
YOU should prioritize. No ban, no enemy scoreboard, no confidential data (D-006/D-008).

## 2. Detection

Reuse the existing generic `detectArchetype(counts, kb)` — it already maps a function-count
distribution to an archetype. Apply it to the ENEMY roster's tagged functions (same `functionsOf`
the team side uses).

- **dive / brawl / poke** — existing `playstyle_modifiers` triggers, unchanged.
- **triple-support** — NEW. Defined as `>=3 sustain_healing` providers. Add it to
  `comp_gap_model.json playstyle_modifiers` so it's data, not code. Its `raise` (for OUR side) =
  `[anti_heal, ult_denial_defensive, dive_flank]` — the counter to a heal-stack.
- **battery** — explicitly skipped (needs a synergy/ult model we don't have).

Because detection is shared, the enemy can match multiple-eligible — keep the existing
"first trigger that fires wins" order, but order matters: put triple-support before brawl (a
heal-stack often also satisfies brawl). Document the precedence.

## 3. The anti-meta read (data-driven, not hardcoded prose)

Each archetype gets a `counter_read` string in `playstyle_modifiers` (new field), e.g.:
- triple-support → "They out-sustain you — prioritize anti-heal, ult-denial, and diving their backline."
- dive → "They'll collapse your backline — value peel and a CC-immune frontline."
- poke → "They win from range — close distance / break sightlines; bring dive or a shield."
- brawl → "Sustained close fights — anti-heal and zone control swing the mirror."

The engine reads the string from the KB (no inlined prose in code — same discipline as everywhere).
Self-directed by construction.

## 4. Surface

Add to `PostGameReport`:
```ts
enemyArchetype: string | null;
enemyRead: string | null;   // the counter_read for that archetype, or null
```
CLI: a new "── ENEMY STRATEGY ──" line near the top of the report
("Enemy archetype: triple-support — <counter_read>"). Skipped cleanly when null.

## 5. Testing (TDD)

- triple-support enemy (3 healers) → `enemyArchetype === "triple-support"`, `enemyRead` non-empty.
- dive enemy (3 divers) → "dive" + its read.
- a mixed/unclassifiable enemy → `enemyArchetype === null`, `enemyRead === null` (no crash).
- masked/partial enemy → still null, never throws.
- the read string is always one we put in the KB (no hardcoded prose).
- existing golden fixtures unchanged (inform-only ⇒ recommendation identical).

## 6. Out of scope
- Changing the recommendation (inform-only now).
- "battery" / synergy detection (no ult-economy model).
- Live in-fight reads (that's Phase 6 macro, gated).
