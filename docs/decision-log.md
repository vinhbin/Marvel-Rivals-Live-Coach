# Rivals Coach — Decision Log

Every locked decision with rationale + date + scope. Newest first.
Reference entries by `D-###` in commits and code comments. Do not re-litigate a logged
decision without escalation.

---

## 2026-06-21  D-013: Team-ups are a SEASON-VOLATILE synergy layer — log + scope, do NOT add to the static KBs yet

**Decision.** Marvel Rivals **team-ups** (a hero gaining an ability/buff from a specific teammate,
changing per season) are a real, in-scope feature for the coach — but they are **NOT** added to the
durable static KBs (`counter_kb.json` / `comp_gap_model.json`) now. They are logged as a planned
feature (Q-007) and built later as their own **season-stamped synergy layer**, most naturally as
part of the unwritten ult-combo / synergy phase. Until that layer + an engine term to consume it
exist, no team-up data is authored.

**Rationale.** Three reasons not to rush it:
1. **Architecture says quarantine volatility.** CLAUDE.md: "Mechanics live in the static KBs
   (durable); strength lives in the patch overlay (volatile, synced per patch); never hardcode
   'hero X is strong'." Team-ups change every season — they are volatile, like the patch overlay,
   and must NOT pollute the durable counter/comp files.
2. **No engine consumer exists.** The engine does counter-coverage + comp-gap only; it has no
   synergy/team-up scoring term. `ult_combo_table.json` (the natural consumer) is still a stub.
   Authoring team-up data today = dead data that drifts out of sync before anything reads it.
3. **It needs its own design pass.** Team-ups have structure (buffer→receiver, effect, passive vs
   ult-combo, `valid_for_season`) — a new schema + vocab + an objective term. That's a phase, not a
   batch edit; it deserves brainstorming → decision-log treatment like every other layer got.

**Scope.** Captures the feature so it isn't forgotten; blocks nothing currently in flight. The
durable KBs stay clean. Revisit when the ult-combo/synergy phase is designed.

**Cross-references.** CLAUDE.md "Architecture (4 layers)" + ult_combo_table TODO; PLAN.md Q-007;
design §9 (ult-combo table). Open: where it lives (patch overlay vs a new `team_up_table.json`),
its schema, and which engine term scores it.

---

## 2026-06-19  D-012: Phase 1 engine semantics — 2-2-2 role queue, Deadpool graceful-skip, both Pick+Swap modes

**Decision.** Three implementation choices for the Phase 1 engine, settled with the user before
coding:

1. **Role queue = enforce 2-2-2.** The objective's "legal role slot" hard constraint is
   instantiated as the current Marvel Rivals ranked default: at most 2 Vanguard / 2 Duelist /
   2 Strategist. A comfort-pool hero is a legal **Pick** candidate only if its role still has an
   open slot; a legal **Swap** candidate must replace a *same-role* teammate (so the swap is
   role-queue-neutral). Role comes from the registry (every hero is tagged Vanguard/Duelist/
   Strategist). This is what prevents the engine from ever recommending a 3-DPS / 0-healer throw —
   the same pathology D-009 targets, now also enforced as a hard constraint, not left to penalties
   alone. (Not a config flag yet; open-queue support is a trivial later relaxation if MR changes.)

2. **Deadpool (A3) = graceful skip, pre-spike.** Because GEP emits one `"Deadpool"` string for
   three role-split registry keys and disambiguation is unresolved (Q-001), the engine treats a
   bare `"Deadpool"` as an **unresolvable hero**: it still counts toward roster size (so role-slot
   and roster-completeness math stay correct) but is **skipped** for threat-tagging (enemy side)
   and function-tagging (our side), and the engine surfaces a note. No guessing a variant. This is
   the most honest behavior until Q-001/A3 resolves role disambiguation in a real match. Folds into
   the same graceful-degradation path as unknown/masked names (Phase 1.4).

3. **Modes = both Pick (draft) and Swap (mid-match) from day one.** Both share the single D-009
   objective. Pick mode: open slots / no current comp → best legal add from pool. Swap mode: full
   comp → best single ≤1-change same-role swap from pool. `Hold` when no candidate clears
   `min_confident_score`. Building both now (vs. Pick-first) is required because Swap is the
   live-overlay's primary job (Phase 5) and the golden fixtures (D-005) must cover both.

**Rationale.** Each is a behavior-shaping choice the plan left open, and PLAN.md's discipline is
"never proceed on a silent assumption." 2-2-2 keeps recommendations legal-for-ranked and reinforces
D-009. Deadpool-skip avoids fabricating a variant the data can't yet justify. Both-modes matches the
engine contract (`Pick | Swap | Hold`, D-006) and the spec's draft-vs-mid-match split.
`introduced_vulnerability` needs no new decision — D-009 already fixes its reading (candidate's own
`countered_by` ∩ enemy roster).

**Scope.** Phase 1 engine (1.1–1.4). The 2-2-2 cap and same-role swap rule are new entries under
PLAN.md Shared Contracts (Engine objective). Deadpool-skip is bounded by Q-001 — revisit when the
GEP spike resolves role disambiguation.

**Cross-references.** weights.json `objective_formula.hard_constraints`; D-006, D-009; PLAN.md
Phase 1, Shared Contracts, Q-001/A3.

---

## 2026-06-19  D-011: Mechanism vocab reconciled by MODERATE COLLAPSE to a closed 24-token set

**Decision.** Phase 0 fixed the A1 bug (13 declared vs 32 used mechanism tokens) by **moderate
collapse**, not adopt-as-used and not minimal merge. The canonical closed `mechanism_vocab` is
**24 tokens** (`data/registry.json`). Eight synonym aliases are merged into a canonical token via
`mechanism_merge_map`; the edges in `counter_kb.json` were rewritten to the canonical form (10
edge rewrites). The declared-but-unused `percent_damage` was DROPPED and the real-usage
`flat_damage` kept (4 edges) — a deliberate divergence from the audit's suggested rename.

Merges (alias → canonical): `range_advantage`→`range_poke`, `space_denial`→`zone_denial`,
`ult_zone`→`zone_denial`, `chase`→`mobility_dive`, `contest`→`contest_vertical`,
`go_over`→`contest_vertical`, `ult_counter`→`ult_turnaround`, `ult_punish`→`ult_turnaround`.
Promoted as genuinely-new mechanics: `mark`, `brawl`, `cooldown_force`, `support_deny`,
`kill_through_ult`, `survive_onslaught`, `zone_denial`, `contest_vertical`, `ult_turnaround`,
`clone_pressure`, `prolonged_hitbox`.

**Rationale.** User chose moderate collapse over minimal (≈28 tokens, more crosswalk edges) and
adopt-as-used (32 tokens, synonym debt deferred). Collapsing obvious synonyms gives the 0.3
crosswalk a clean mechanism→function join and keeps the engine objective (D-009) from
double-counting near-duplicate coverage; genuinely distinct mechanics are preserved so nuance
isn't lost. Three tokens (`mark`, `clone_pressure`, `prolonged_hitbox`) map to zero comp-functions
in the crosswalk on purpose — they are per-duel tactics, not comp roles.

**Scope.** The closed mechanism vocab is a Shared Contract; changes require a `CONTRACT:` commit.
`provides_mechanisms` (0.7) and the crosswalk (0.3) are built on this 24-token set.

**Cross-references.** PLAN.md 0.2, Shared Contracts (Mechanism vocab); registry
`mechanism_merge_map`; supersedes the raw 13-token `mechanism_vocab` in the pre-Phase-0
`counter_kb.json`.

---

## 2026-06-19  D-010: Platform choice (Overwolf native vs ow-electron) is an OPEN user decision — do not default to native

**Decision.** Do NOT scaffold yet. The Layer A research refuted the assumption that native is
the obvious choice. For a personal/unlisted build, `ow-electron` avoids the native "no private
apps" approval wall (native requires email whitelisting before any local run and blocks private
apps) and lets you host/share freely; native is lighter-weight for a glanceable overlay. The GEP
consumer API **differs** between them (`overwolf.games.events` vs the ow-electron GEP package),
so switching later is costly. **This is a tradeoff for the user to decide, not the agent.**
Parked as Q-005.

**Rationale.** Refinement #10 from the research synthesis. The design doc §9 leaned native
("native is confirmed today"); the research surfaced that the approval wall + private-app block
materially affect a personal build, and the API divergence makes the choice expensive to defer.

**Scope.** Blocks Phase 3+ (any Overwolf scaffolding). Does NOT block Phase 0/1 (the engine is
platform-agnostic plain TS — build it regardless).

**Resolution (2026-06-19): DEFER.** User chose to decide after the engine is proven (post Phase 1)
rather than commit now. The engine needs no platform; deciding later avoids a premature,
costly-to-reverse choice and front-loads the highest-value work. Q-005 stays OPEN, re-triggered at
the Phase 2→3 boundary.

**Cross-references.** design.md §9; PLAN.md Q-005; research synthesis refinement #10.

---

## 2026-06-19  D-009: Replace dual greedy set-cover with a single constrained objective + exhaustive search

**Decision.** The engine is NOT greedy set-cover. It scores every candidate swap from the
comfort pool with a single objective: `+covered_threat_weight +filled_comp_function_weight
−introduced_vulnerability −clash_penalty −redundancy_penalty`, subject to hard constraints
(∈ comfort pool, legal role slot, ≤1 change in live mode), and picks the max. With ~52 heroes
and a small comfort pool this is a trivial **exhaustive** search — no greedy approximation.
`introduced_vulnerability` cross-references the candidate's OWN `countered_by` against the enemy
comp, so the engine never recommends a pick whose counters are already on the enemy roster
without flagging it.

**Rationale.** The research's `highest_risk` finding: greedy set-cover maximizes
threats-covered-per-pick *blind to comp coherence* — it will "spam 'pick Thing' because Thing
covers the most nodes," recommending throw picks the user can't execute or that lose to the rest
of the enemy comp. This **supersedes the implicit "set-cover is the right primitive" assumption
in D-002**: the join + weights from Phase 0 still stand, but the optimization is a constrained
objective, not greedy cover. Pool membership ≠ proficiency — gate candidates on an
execution/proficiency score too.

**Scope.** The engine's optimization core (Phase 1). Phase 0's registry/crosswalk/weights are
unchanged inputs.

**Alternatives considered.** Greedy set-cover (CLAUDE.md / design §4) — rejected: throw-pick
pathology, no coherence awareness. Exhaustive is cheap at this scale.

**Cross-references.** research synthesis `highest_risk` + refinement #6; supersedes the
algorithm assumption in D-002; CLAUDE.md "Engine contract" (the "weighted set-cover" language
should be read as "weighted constrained selection").

---

## 2026-06-19  D-008: Integrate macro_reader.json (4th KB) as the live "play" layer; reads gated + framing-constrained

**Decision.** Adopt `data/macro_reader.json` as the 4th knowledge base — a macro/event-stream
reader producing three coaching reads from the live GEP stream: (1) personal nemesis, (2) team
threat, (3) stagger/tempo. Sequencing: read #3 (stagger/tempo) is built FIRST among the macro
reads (pure your-side data, compliant-by-construction, no gating unknown); reads #1/#2 are gated
on confirming `kill_feed` killer attribution (Q-006). Compliance verdict:
**SAFE-WITH-FRAMING-CONSTRAINT** — the kill-feed input is public/GEP-sourced, but a per-enemy
kill tally IS a derived enemy stat, so the engine treats it as an **internal trigger signal
only** and renders ONLY self-directed coaching (advice about YOUR play / a swap from YOUR pool),
never an enemy scoreboard and never an "enemy-targeting / shut down hero X" instruction.

**Rationale.** Adversarial vetting (2026-06-19) against CLAUDE.md + design §0/§3. The reads
reposition the product toward self-improvement coaching — a safer compliance posture AND a
genuinely unoccupied niche (the research confirms competitors coach the draft, not the fight).
`ult_charge` is teammate-only in three doc places, so the tempo read cannot cross prohibition #3.

**Scope.** A live-event consumer → sits in the GEP/live phases (3+), behind the engine. Read #3
can be prototyped on recorded/synthetic event streams earlier.

**Cross-references.** data/macro_reader.json; CLAUDE.md guardrails; design §0/§3/§6/§7; PLAN.md
Q-006; new framing constraint belongs in design §0's keep/kill table.

---

## 2026-06-19  D-007: Compliance posture is "compliant-by-current-schema + discipline," NOT "by-construction"; residual ban risk LOW but not zero

**Decision.** Correct the project's compliance framing. The phrase "compliant-by-construction"
(design §0) is downgraded to **"compliant-by-current-schema PLUS discipline."** Three disciplines
are load-bearing, not automatic: (a) never DERIVE a prohibited fact from permitted fields (e.g.
estimating enemy ult timing from enemy K/D cadence reconstructs prohibition #3); (b) the
schema-envelope property only holds for the *current* documented GEP schema — **re-audit on every
GEP update**; (c) `banned_characters` is exposed for both teams, so the pick/swap-only rule is the
necessary control, not a nicety.

**Rationale.** Research refuted #4 + #3 + #8. Confirmed AGAINST Overwolf's official GEP page:
enemy damage/healing absent; `ult_charge` teammate-only (changelog v292.1.1 "Disabled ult_charge
in roster for enemy players"); the 3 prohibitions stated on Overwolf's own dev page; Blitz banned
for injection + the 3 feature categories. BUT: NetEase's May 2026 "Zero Tolerance on Cheats" bans
"illicit third-party tools" with NO carve-out for GEP/read-only/counter-pick tools, and no primary
source either ALLOWS or PROHIBITS counter-pick advice. Blitz users got amnesty (no bans) if they
stopped, but genuine multi-year account bans DID happen for other process-*injecting* software
(SteelSeries GG + Process Hacker) — confirming GEP-only/no-injection is the *survivable*
architecture. Residual personal-build ban risk: **LOW (GEP avoids the injection signature that
drives permabans) but not provably zero, no written safe-harbor.**

**Scope.** Compliance framing across all docs; the never-derive discipline becomes an engine
invariant (a test, not a convention — see D-005/refinement #7).

**Cross-references.** design §0; research confirmed_claims + refuted #3/#4/#8; CLAUDE.md
guardrails. The "GEP-only counter advice is TABLE STAKES not a moat" market finding (Counterwatch
is a sophisticated incumbent) is recorded here too — irrelevant to a personal build's go/no-go,
but honest: the pool-aware + comp-gap-set-cover intersection IS the unoccupied wedge.

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

> **Update 2026-06-19:** Research REFUTED two scaffolding assumptions, both of which strengthen
> engine-first: (1) the GEP **Simulator cannot answer the `character_name` timing question** — it
> requires the game running and only confirms *schema*, not *timing*; Q-001 must be verified in a
> **real match**, not the Simulator. (2) The `JarodWellinghoff/marvel-rivals-tracker` scaffold
> (design §9) is a 1-day, no-React, webpack skeleton — the OPPOSITE of the mandated React+Vite
> stack; use `overwolf/events-sample-app` as reference instead. Neither touches Phase 0/1 (the
> engine is platform-agnostic), confirming it's right to build the engine before any of this.

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

> **Update 2026-06-19:** Layer A research independently confirmed all four data bugs against the
> files (A1: 13 declared vs 32 used mechanisms; A2: "Gan"; A3: Deadpool split + comp_gap has zero
> Deadpool entries; A4: 13 KB heroes missing from `hero_functions`). It added that the engine
> needs a `provides_mechanisms` field per hero (inverse of `countered_by`) so conditional
> coverage = (mechanisms the conditional needs) ∩ (mechanisms the pool provides). **The
> "weighted set-cover" optimization assumption here is superseded by D-009** (constrained
> objective + exhaustive search, to kill greedy throw-picks); Phase 0's registry/crosswalk/
> weights are unchanged.

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
