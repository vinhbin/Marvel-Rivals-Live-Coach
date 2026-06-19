# Rivals Coach — Decision Log

Every locked decision with rationale + date + scope. Newest first.
Reference entries by `D-###` in commits and code comments. Do not re-litigate a logged
decision without escalation.

---

## 2026-06-19  D-006: Engine output type is `Pick | Swap | Hold` — no ban is representable

**Decision.** The engine's TypeScript output type will be a discriminated union of `Pick`,
`Swap`, and `Hold` (no confident suggestion). There is no `Ban` variant in the type, and the
counterability *ranking* the engine computes internally is never surfaced or exported.

**Rationale.** The council's compliance reviewer made the sharp distinction: never-DISPLAYING a
ban is not enough, because set-cover inherently computes a counterability ordering whose inverse
*is* a ban signal. Making a ban literally unrepresentable in the output type means a future edit
can't accidentally leak one. The `Hold` variant exists because the SRE reviewer flagged that
every advisor assumed the engine always outputs *something* — the safe behavior when no
confident swap exists is to say so, not to force a marginal pick.

**Scope.** The engine's public output contract. Internal scoring may rank heroes; that ranking
stays internal and is never serialized to the overlay or any export.

**Cross-references.** CLAUDE.md never-ban guardrail; council transcript §"never-COMPUTING vs
never-DISPLAYING"; PLAN.md Phase 0 + Shared Contracts.

---

## 2026-06-19  D-005: Add a golden-fixture test set before trusting any suggestion

**Decision.** Before the engine is considered "working," create ~6–10 hand-entered
`(enemy roster + comfort pool → expected good suggestion)` fixtures, judged correct by the
dev's own game knowledge, and assert the engine against them. These also gate every future
patch-overlay edit (snapshot regression).

**Rationale.** Three independent reviewers (Senior-Eng, Junior, Maintainer) flagged that there
is no way to distinguish "correct advice" from "plausible-looking advice," and no way to catch
a patch edit silently breaking old suggestions. The whole *point* of building engine-first on
hand-entered rosters (D-003) is to prove coaching quality — that proof requires a measurable
oracle. Without it, "the engine works" is an unverifiable claim.

**Scope.** Engine validation + patch-sync regression gating. Not a substitute for live testing
later, but the precondition for trusting the engine at all.

**Cross-references.** Build order CLAUDE.md step 1 ("Proves the coaching is actually good
before live plumbing"); council blind-spot §"No golden test fixture".

---

## 2026-06-19  D-004: Strip ban machinery (`ban_value`, `ban_logic`, `ban_note`) from the runtime path

**Decision.** The `ban_logic`, `ban_value_numeric`, and per-hero `ban_note`/`ban_value` fields
in `counter_kb.json` are dead, compliance-adjacent metadata. They will NOT be read by the
engine. They are either deleted or quarantined behind a clearly-labeled `_archival_do_not_use`
key during Phase 0, with a comment pointing at this decision.

**Rationale.** Five advisors flagged these fields contradict the absolute never-ban rule. The
Maintainer's concern is the real one: left in place, a future contributor will mistake dead
ban-scoring for live logic and wire it up. The counterability signal these encode is still
*useful* — but it must feed pick/swap weighting (D-001-shaped), never a ban output.

**Scope.** `data/counter_kb.json` schema + the engine's KB-loading code. The underlying
*counterability* concept survives as an input to threat-weighting; only the ban framing dies.

**Cross-references.** CLAUDE.md never-ban guardrail; D-006; council §"Where the council agrees" #4.

---

## 2026-06-19  D-003: Build order is engine-first on hand-entered rosters; GEP spike is NOT first

**Decision.** First runnable artifact = the TS set-cover engine run against hand-typed
`(enemy roster, comfort pool)` inputs, consuming the validated KBs — NO Overwolf, NO live GEP.
The GEP data spike comes after the engine produces trustworthy advice. This follows CLAUDE.md's
build order over `design.md` §7's "GEP spike first."

**Rationale.** `design.md` §3 admits the enemy `character_name` populate-timing across
draft→round-start→swap is **undocumented**. Leading with GEP means starting on the one task with
no clear first step and an unresolved external dependency. The engine, by contrast, is buildable
day-one: `comp_gap_model.json`'s `recommendation_logic.steps` is a literal 7-step algorithm spec.
Proving the coaching is good is the actual risk; it needs no live data. (Note: `design.md` §7
internally contradicts itself, also calling post-game "lowest risk, build FIRST" — consistent
with engine-first.)

**Scope.** Phase ordering. Live GEP, swap detection, and the overlay UI are explicitly deferred
behind the engine + its golden fixtures.

**Alternatives considered.** GEP-spike-first (design §7) — rejected: blocked on an undocumented
timing unknown. Post-game-coach-first — partially adopted: the post-game review mode is the
natural first *consumer* of the engine and stays near the front, but the engine + data layer
must exist first either way.

**Cross-references.** CLAUDE.md "Build order"; design.md §3, §7; PLAN.md phase table.

---

## 2026-06-19  D-002: Insert "Phase 0 — Data-Contract Hardening" before engine code

**Decision.** Before writing the engine, build a single canonical **registry** (hero canonical
key + `character_id` + display-name aliases + the closed mechanism vocab + the comp-function
vocab) that every data file imports from; a **mechanism ↔ comp-function crosswalk**; and
**numeric weights** (trend→multiplier, counterability→weight, raise/lower→deltas) with the
threat-weight formula written down. Validate the existing JSONs against the registry.

**Rationale.** The council (HIGH confidence) found the data contracts are broken *today* and
this is the #1 engineering risk — above the suspected VOD-quality concern. Five advisors
independently surfaced: a 13-vs-~20 `mechanism_vocab` mismatch, no taxonomy join key, an
impossible hero-name join (`"Gan"`=Jean alias used as a counter; `Deadpool_Tank/DPS/Strat` vs
one GEP name), and absent numeric weights. The Long-Term-Architect's framing was adopted: these
are one disease (no canonical registry; volatile strength in the "durable" layer), not twelve
bugs. One registry makes the whole class unrepresentable.

**Scope.** A new Phase 0 that gates the engine. The registry becomes the source of truth that
sits ABOVE the three JSONs in the sources-of-truth order.

**Alternatives considered.** Patch each bug as encountered during engine work — rejected: the
same bug class returns every patch because nothing structurally prevents drift across four
hand-edited namespaces.

**Cross-references.** council-transcript-20260619-0238.md (full); methodology.md Phase 2;
all of D-004/D-005/D-006 are acceptance criteria for Phase 0.

---

## 2026-06-19  D-001: Concept locked — GEP-only pool-aware comp-gap coach, engine-first, personal build

**Decision.** Build the concept as designed, with no pivot: *a GEP-only Overwolf overlay for
Marvel Rivals that reads the live hero roster and recommends a single pick/swap (or "hold")
drawn from the user's own comfort pool, via one weighted set-cover engine that jointly covers
enemy threats (counter KB) and comp-function gaps (comp-gap model), weighted by a per-patch
strength overlay — surfaced glanceably live and in depth post-game. Coach, not stats tracker.*
Personal/unlisted, solo, TypeScript end-to-end. The murder-board did not find a fatal flaw —
it found a mandatory sequencing change (D-002), not a reason to pivot.

**Rationale.** Compliance is well-architected ("schema is the envelope" makes prohibitions
#1/#3 structural for live data; the never-ban rule is handled by D-004/D-006). The depth wedge
(pool-aware + comp-gap + patch-aware in one set-cover pass) is real and the design doc already
established the competitive lane. The risks are engineering-internal (data contracts, engine
quality) and fixable before code, not existential.

**Scope.** The whole project's north star. Live-mode timing and stat-API ToS remain Open
Questions (PLAN.md) but gate later phases, not the concept.

**Cross-references.** docs/design.md (full system design); CLAUDE.md (constitution);
methodology.md Phase 3.

---

<!--
Use a decision-log entry for: any non-trivial choice (stack, architecture, scope cut, naming),
every scope cut (no silent removal), and the verdict of any council/gap-analysis pass.
Keep entries short but always include the RATIONALE — that is the whole point on a tired day.
-->
