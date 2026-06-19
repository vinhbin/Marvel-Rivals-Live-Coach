# Rivals Coach — Plan & Coordination

> Living working doc. Opened first every session; updated on every status change.
> Authoritative for task ownership, status, decisions, and contracts.

**What / deadline:** GEP-only Overwolf coaching overlay for Marvel Rivals (game `24890`) — reads
the live roster, recommends a single pick/swap/hold from the user's comfort pool. **No hard
deadline** (personal / unlisted build).
**Repo:** local (`c:\Users\Binep\Marvel-Rivals-Live-Coach`) — no remote yet.
**Team:** solo (vinhbin).
**Goal:** "done" = the engine gives advice the dev trusts in their own ranked games, surfaced
glanceably live and in depth post-game — without ever crossing the compliance boundary.

---

## Sources of truth (priority order)

When two artifacts disagree, the higher one wins. Fix the LOWER artifact to match.

1. `~/.claude` persistent memory + **`CLAUDE.md`** (constitution + non-negotiable compliance) — durable rules
2. **The canonical registry** (`data/registry.*`, built in Phase 0) — single source of truth for hero keys, `character_id`, aliases, mechanism vocab, function vocab
3. `docs/design.md` — full system design
4. **This file (`PLAN.md`)** — task ownership, status, decisions, contracts
5. `docs/decision-log.md` — every locked decision with rationale
6. `data/*.json` — the KBs: `counter_kb`, `comp_gap_model`, `macro_reader`, patch overlay (must validate against the registry)
7. `README.md` — public front door (do not mirror this plan into it)

> Note the registry sits ABOVE the JSON KBs: a KB that disagrees with the registry is the bug.

---

## Status snapshot (APPEND a new dated block on top each session; never overwrite the last one)

### 2026-06-19 (Phase 2 COMPLETE) — post-game coach shipped; first engine consumer is live + tested

- ✅ **Phase 2.1 done.** `src/postgame/` is a pure **projection** of the engine's `EngineResult`
  into a `PostGameReport` (design §6 mode 2): full **matchup table**, complete **ranked alternatives**
  ("what you could've swapped to"), and **pool gaps** ("what to add"). No new engine logic, no live
  concerns. `npm run typecheck`, `npm run validate`, and `npm test` (56/56) all green.
- ✅ **Scope locked with the user (3 choices), all lowest-risk / engine-aligned:**
  (1) **single finished-roster snapshot** (no match-timeline — that needs the Phase 3 GEP spike,
  gated by Q-001/Q-006); (2) **analysis module only**, no React (UI is a thin later step,
  interleaved with Phase 5); (3) **full ranked alternatives + pool-gap analysis**, not just the top
  pick. Recorded in `docs/plans/2026-06-19-postgame-coach-design.md` (committed).
- ✅ **Compliance inherited for free + independently reviewed.** The module only reads engine output
  + the public KB, so a ban is unrepresentable (D-006) and no enemy stat is touched (D-007/D-008). A
  dedicated compliance reviewer returned **CLEAN** across all 5 guardrails; framing stays
  self-directed ("your pool can't answer X / you could've played Y").
- ✅ **D-005 discipline mirrored.** `test/postgame.test.ts` = hand-judged matchup assertions (reusing
  the game-validated golden rosters) + property invariants (headline === engine suggestion;
  poolGap ⇔ unanswered matchup row; alternatives mirror `ranked`; every alt ∈ pool; no ban field
  serialized) + a 40-seed degraded-input fuzz (never throws).
- ✅ **Parallel review caught two real bugs, both TDD-fixed before commit (review working as designed):**
  (a) `alternatives[].closesFunctions` was read off `result.coverage`, which is the POST-suggestion
  comp — so the winner had already zeroed its own shortfalls and the column was blank for every
  candidate; now recomputed **per-candidate** against the comp without that candidate (mirrors the
  engine). (b) a pool hero already fielded was offered under `couldHaveAnswered` ("play the hero you
  already play"); now on-team heroes are excluded. Added a winner↔headline consistency invariant +
  an on-team-exclusion test (the regression guards).
- ✅ **Engine surface widened (export-only, no logic change):** `resolveName`,
  `mechanismsProvidedBy`, and supporting types re-exported from `src/engine/index.js` so postgame
  stays on the PUBLIC surface. Golden fixtures stayed green throughout (16/16).
- 🟢 **Next: Phase 3 — GEP data spike.** Q-005 (native vs ow-electron) now re-triggers at this
  Phase 2→3 boundary (deferred decision, owner = YOU). Q-001 (enemy `character_name` timing) + Q-006
  (`kill_feed` attribution) need a REAL match (Simulator can't answer them). Core C3 (post-game
  coach) is now MET — the trustworthy, compliant core exists end-to-end on hand-entered rosters.

### 2026-06-19 (Phase 1 data review) — dev-validated the engine oracle; Phase 2 cleared to start

- ✅ **Dev game-knowledge review of the Phase 1 oracle** (the D-005 soft risk: fixtures + tags encode the agent's read, not the dev's). Outcome: **data was sound** — all 8 golden fixtures and the fixture-driving `hero_functions` tags confirmed by the dev, with two refinements committed (`test(fixtures):`):
  - Fixture 4 (Gambit vs triple-support): tightened "Magneto OR Punisher" → **expect Magneto** (dev: his `ult_turnaround` denies Gambit's ult AND cancels the enemy healer ult; Punisher only farms/pokes). Engine already ranked Magneto first.
  - Fixture 5 (flyers): recorded the dev note that **any hitscan answers flyers**; verified the engine surfaces the wider pool via the hitscan→anti_flyer crosswalk (Jean Grey ranks just below Hela/Punisher on partial credit — dev confirmed she's a notch below a dedicated hitscan, so NO declared anti_flyer tag added). The crosswalk-partial design is doing exactly what it should.
  - Tags confirmed: Luna IS a real anti-dive (freeze + 1v1), Mantis/Thing/Punisher/Ultron/Scarlet Witch/Mr Fantastic/Human Torch all correct. Weights: dev deferred numeric tuning to the engine (tune against live output).
- 🟡 **Partial review (acceptable).** Only the ~10 fixture-driving + Phase-0-corrected tags were dev-checked individually; the other ~42 heroes' `hero_functions` are zod-CONSISTENT but not individually dev-verified for COMPLETENESS. Acceptable risk: a wrong/incomplete tag now surfaces as visibly bad advice in the post-game coach (Phase 2), which IS the review surface. Revisit opportunistically as real matches expose tags.
- ✅ **Phase 2 readiness: CLEARED.** The oracle the post-game coach will display is dev-trusted. Dev chose **full review now + full post-game review scope** (PLAN.md 2.1 / design §6 mode 2).

### 2026-06-19 (Phase 1 COMPLETE) — engine + golden fixtures green; critical path cleared

- ✅ **Phase 1 done (1.1–1.4).** `src/engine/` is a plain-TS constrained-objective engine (D-009, NOT greedy set-cover) over the validated KBs; emits `Pick | Swap | Hold` (D-006). `npm run typecheck`, `npm run validate`, and `npm test` (16/16) all green.
- ✅ **1.1 core** — load+validate KBs (engine refuses drifted data), threat tagging + weighting, comp coverage/archetype/gap weighting, the D-009 per-candidate objective, exhaustive search over the comfort pool under the 2-2-2 role queue (D-012). Swap is scored on NET change (debits the outgoing hero's vacated role).
- ✅ **1.3 conditional resolution** — a `conditional` enemy is "answered" only if team∪pool delivers a mechanism in its `countered_by`.
- ✅ **1.4 graceful degradation** — masked/unknown/ambiguous (incl. Deadpool A3) names count toward roster size, are skipped for tagging, and each surfaces a note; sub-gate best → Hold; never throws (proven by a fuzz invariant).
- ✅ **1.2 golden fixtures + invariants (D-005)** — 8 hand-judged rosters → expected suggestion, plus 8 property invariants (never-a-ban, pick∈pool, 2-2-2 respected, swap never reduces covered-threat-weight, mechanism∈vocab, A4 parity, never-throws). **Building the engine surfaced + fixed two real bugs before fixtures (function-fill over-credit 11→3 via declared/crosswalk split + cap; swap net-change), and the fuzz caught a third (over-strict role-slot assertion).** This is D-005 working as designed.
- ✅ **Pre-deliver checklist items 2–5 now pass** (was only #1 after Phase 0). Only #6 (README compliance one-liner) outstanding — README not written yet.
- 🟢 **Next: Phase 2 — post-game coach** (first consumer of the engine; lowest-risk, no live edge cases). Q-005 (platform) re-triggers at the Phase 2→3 boundary; Q-001/Q-006 (GEP timing, kill-feed) still need a real match. Weights tuning (the deferred 🟡 from Phase 0) is now judgeable against live engine output + the golden fixtures.

### 2026-06-19 (Phase 1 start) — engine semantics settled (D-012); building 1.1→1.4→1.3→1.2

- ✅ **Three engine design choices locked with the user before any code (D-012).** Plan left them open; resolved per the "no silent assumption" discipline:
  - **Role queue: enforce 2-2-2** (≤2 Vanguard / 2 Duelist / 2 Strategist). Instantiates the objective's "legal role slot" hard constraint. Pick candidate legal only if its role slot is open; Swap candidate must replace a same-role teammate. Reinforces D-009 (no 3-DPS throw).
  - **Deadpool (A3): graceful skip pre-spike.** Bare `"Deadpool"` counts toward roster size but is skipped for threat/function tagging (can't pick a variant from one GEP name); surfaces a note. Bounded by Q-001.
  - **Modes: both Pick (draft) + Swap (mid-match)** from day one, one shared D-009 objective; `Hold` below `min_confident_score`.
- ✅ `introduced_vulnerability` needs no new decision — D-009 already fixes the reading (candidate's own `countered_by` ∩ enemy roster).
- 🟡 **Building now:** 1.1 engine core → 1.4 graceful Hold → 1.3 conditional resolution → 1.2 golden fixtures (D-005). Doc commit (`docs(plan)` + `docs(log)`) precedes the `feat(engine)` commits per the coordination protocol.

### 2026-06-19 (Phase 0 data review) — dev validated the hand-assigned tags; engine cleared to start

- ✅ **Dev game-knowledge review of Phase 0's hand-assigned data** (the soft risk flagged at Phase 0 close: zod proves the tags are *consistent*, not *correct* — golden fixtures can't catch a plausible-but-wrong tag, so the human had to). Corrections committed (`fix(data):`), validate + typecheck green:
  - Human Torch `dive_flank,zone_wall` → `range_poke` (ranged flyer, not a diver).
  - Mr Fantastic `dive_flank` → `frontline_space` (plays like a tank / big-body).
  - Scarlet Witch `dive_flank,burst_pick` → `burst_pick,anti_dive_peel` (deletes targets AND answers dives; not a diver).
  - Ultron `sustain_healing,range_poke` → `range_poke,sustain_healing` (damage+heal, not a sustain bot).
  - crosswalk `zone_denial` `[zone_wall,anti_dive_peel]` → `[zone_wall]` (zoning = space denial, not peel).
  - Jeff unchanged — dev confirmed the ult (swallow) is the meaningful threat, so `ult_denial_defensive` stays.
- 🟡 **Partial review.** Surface 1 (hero_functions tags) reviewed in full. STILL UNREVIEWED before/with the engine: two crosswalk rows the agent flagged as shaky (`hard_cc`→`[anti_dive_peel,burst_pick]`, `flat_damage`→`[dive_flank,burst_pick]`) and all of `weights.json` (threat-priority ordering + `min_confident_score=0.5`). **Decision: defer weights tuning until the engine runs** — numbers are best judged against live output + golden fixtures, not in the abstract. They're plain JSON, trivially changeable, re-validated on edit.
- ✅ **Phase 1 readiness: CLEARED.** All hard deps (`0.*`) met; the data the engine consumes is now dev-trusted. Next: **Phase 1.1 engine core** (D-009 constrained objective + exhaustive search), then 1.4 graceful Hold, 1.3 conditional resolution, 1.2 golden fixtures (D-005, the trust oracle).

### 2026-06-19 (Phase 0) — Data-Contract Hardening COMPLETE; `npm run validate` green

- ✅ **Phase 0 done (0.1–0.7).** All seven sub-tasks shipped; `npm run validate` and `npm run typecheck` both pass.
- ✅ **0.1 `data/registry.json`** — canonical registry: 52 heroes (character_id + display + gep_character_name + role + aliases), 63-entry alias index. Resolves A2 (`Gan`→Jean Grey), flags A3 (3 Deadpool keys → one GEP `Deadpool` name) in `unresolved_gep_collisions`. `character_id` is an INTERNAL id; the GEP numeric id mapping is deferred to the GEP spike (Q-001).
- ✅ **0.2 mechanism vocab reconciled** — A1 fixed: 13 declared / 32 used → **closed 24-token vocab** by moderate collapse (**D-011**, user-chosen). 10 edges rewritten to canonical tokens; zero unknown tokens (zod-enforced).
- ✅ **0.3 `data/crosswalk.json`** — mechanism↔comp-function join (the "third KB" the council caught); total over the 24-token vocab; 3 per-duel mechanics map to `[]` on purpose.
- ✅ **0.4 `data/weights.json`** — counterability→weight, trend→multiplier (neutral until patch overlay/Q-002), raise/lower→delta, objective penalties; **threat-weight + D-009 objective formulas written down**. No magic numbers in engine code.
- ✅ **0.5 ban machinery stripped** (D-004) — `ban_logic`/`ban_value_numeric`/`ban_note` quarantined to `_archival_do_not_use`; ban-value PROSE scrubbed from all hero notes; validator asserts zero ban fields/prose in the runtime path.
- ✅ **0.6 zod schemas + `npm run validate`** — per-KB schemas key off the registry vocab; cross-file invariants enforce A1, A2, A4 parity, D-004/D-006 no-ban, and 0.7 inverse-consistency. `.strict()` makes a stray ban field a parse error.
- ✅ **0.7 `provides_mechanisms`** added per hero (inverse of `countered_by`, same validated vocab); validator checks it's the consistent inverse.
- ✅ **A4 parity closed** — added `hero_functions` for the 10 missing heroes (Angela, Emma Frost, Black Widow, Human Torch, Iron Fist, Magik, Mr Fantastic, Scarlet Witch, Jeff, Ultron); Deadpool split allow-listed pending GEP role disambiguation.
- ✅ Project scaffolded: `package.json` (tsx + zod + typescript), `tsconfig.json`, `src/schema/`.
- Decision added: **D-011**. Next: **Phase 1 — engine + golden fixtures** (the critical path; D-009 constrained-objective core, gated by D-005 fixtures). Q-005 (platform) still deferred to the Phase 2→3 boundary.

### 2026-06-19 (later) — Layer A research folded in + macro_reader (4th KB) integrated

- ✅ Layer A Phase 1+4 research workflow finished. **Independently confirmed all 4 data bugs against the files** (A1 mechanism vocab 13-vs-32; A2 "Gan"; A3 Deadpool split; A4 13 heroes missing from `hero_functions`) and confirmed the **compliance posture against Overwolf's official GEP page** (enemy dmg/healing absent; `ult_charge` teammate-only per changelog v292.1.1; 3 prohibitions on the dev page).
- ✅ This serves as **Phase 5 gap analysis** — it surfaced objections the council didn't: greedy set-cover recommends **throw picks** → **D-009** (constrained objective + exhaustive search, supersedes the set-cover assumption); the JarodWellinghoff scaffold is wrong (use `overwolf/events-sample-app`); the **GEP Simulator can't test timing** (Q-001 needs a real match); native-vs-ow-electron is a real user decision (**Q-005**).
- ✅ Integrated `data/macro_reader.json` (4th KB, live "play" layer) — **D-008**, SAFE-WITH-FRAMING-CONSTRAINT. Adds Phase 6 + Q-006 (kill_feed killer attribution).
- ✅ Compliance reframed: "compliant-by-current-schema + discipline," residual ban risk LOW-not-zero (**D-007**).
- 🟡 **One decision needs YOU: Q-005 native vs ow-electron** (blocks Overwolf scaffolding, not the engine).
- Decisions added: D-007…D-010. Next: your Q-005 call, then start Phase 0 (canonical registry).

### 2026-06-19 — Layer A complete (murder-board), repo scaffolded

- ✅ Layer A Phase 2 murder-board (llm-council TECHNICAL, 7+5 agents) — concept SURVIVES; verdict drove a new **Phase 0: Data-Contract Hardening** before engine code. Transcript: `council-transcript-20260619-0238.md`.
- ✅ Concept locked (D-001), no pivot. Decisions D-001…D-006 logged.
- ✅ Repo scaffolded: `data/` (KBs moved here), `docs/` (design + methodology + decision-log), PLAN.md.
- 🟡 Layer A Phase 1+4 research (competitor sweep + adversarial fact-check) — agents done, structured synthesis finalizing; findings land in **Open Questions** + decision log next session.
- ⬜ Layer A Phase 5 gap analysis — pending research fold-in.
- ⬜ Phase 0 (data-contract hardening) — not started; it is the unblocker for everything.
- Day 1. Next milestone: fold research → run gap analysis → start Phase 0 (the canonical registry).

<!-- Older snapshots stay below this one. The stack IS your project history. -->

---

## Status dashboard

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⛔ blocked · ✂️ cut
Solo build — Owner column is "me" throughout; it stays so the format is ready if a 2nd person joins.

### Phase 0 — Data-Contract Hardening  (the unblocker — NEW, from the murder-board)

| # | Component | File(s) | Owner | Status | Deps | Notes / acceptance |
|---|-----------|---------|-------|--------|------|--------------------|
| 0.1 | Canonical registry: hero key + `character_id` + display-name aliases + closed mechanism vocab + function vocab | `data/registry.json` (+ TS loader) | me | ✅ | - | DONE. 52 heroes, 63-alias index. `Gan`→Jean (A2), Deadpool collision flagged (A3), display names set. `character_id`=internal; GEP id deferred to Q-001 (D-002) |
| 0.2 | Reconcile `mechanism_vocab` to actual usage (13 declared vs 32 used) | `data/counter_kb.json`, registry | me | ✅ | 0.1 | DONE. Closed 24-token vocab via moderate collapse (D-011); 10 edges rewritten; zod enforces ZERO unknown tokens |
| 0.3 | Mechanism ↔ comp-function crosswalk (the "third KB" the council caught) | `data/crosswalk.json` | me | ✅ | 0.1 | DONE. Total over the 24-token vocab; counter mode ↔ comp-gap mode join (`grounding`↔`anti_flyer_grounding`) |
| 0.4 | Numeric weights: `trend`→multiplier, `counterability`→weight, `raise/lower`→delta; write the threat-weight formula down | registry / patch overlay schema | me | ✅ | 0.1 | DONE. `data/weights.json`; threat-weight + D-009 objective formulas written out; trend neutral until Q-002 (D-002, D-009) |
| 0.5 | Strip ban machinery from runtime path (`ban_logic`, `ban_value_numeric`, `ban_note`) | `data/counter_kb.json` | me | ✅ | 0.1 | DONE. Quarantined to `_archival_do_not_use`; ban prose scrubbed from notes; validator asserts zero ban in runtime path (D-004) |
| 0.6 | zod schemas for all KBs + registry; CI-style validate script | `src/schema/*.ts` | me | ✅ | 0.1–0.5 | DONE. `npm run validate` GREEN + `npm run typecheck` clean. Enforces A1, A2, A4 parity, D-004/D-006 no-ban, 0.7 inverse |
| 0.7 | Add `provides_mechanisms` per hero (inverse of `countered_by`, same validated vocab) | registry / `counter_kb.json` | me | ✅ | 0.1, 0.2 | DONE. Per-hero `provides_mechanisms`; validator checks it's the consistent inverse of `countered_by` (research refinement #5) |

### Phase 1 — Engine + golden fixtures  (critical path)

| # | Component | File(s) | Owner | Status | Deps | Notes / acceptance |
|---|-----------|---------|-------|--------|------|--------------------|
| 1.1 | TS engine: tag enemy threats, check coverage, compute gaps, recommend from comfort pool | `src/engine/*.ts` | me | ✅ | 0.* | DONE. Constrained-objective exhaustive search (D-009); output `Pick \| Swap \| Hold` (D-006); both pick+swap modes (D-012). 2-2-2 role queue enforced |
| 1.2 | Golden-fixture test set (~6–10 hand-entered rosters → expected suggestion) | `test/fixtures/*.ts`, `test/engine.test.ts` | me | ✅ | 1.1 | DONE. 8 golden fixtures + 8 property invariants (D-005, refinement #7); `npm test` green (16/16). Fuzz caught a real over-strict assertion bug |
| 1.3 | Conditional-counterability resolution (Moon Knight / Wolverine / Jeff need a deliverable mechanism from the pool) | `src/engine/conditional.ts` | me | ✅ | 1.1, 0.3 | DONE. Conditional covered iff (team∪pool) provides a mechanism in the hero's `countered_by`; covered/uncovered weight from `conditional_resolution` |
| 1.4 | Graceful degradation: unknown `character_name`, masked names, partial roster, no-good-suggestion → `Hold` | `src/engine/*.ts` | me | ✅ | 1.1 | DONE. Unknown/masked/ambiguous count toward roster size, skipped for tagging, each surfaced as a note; never throws; Hold below the confidence gate. Verified by fuzz invariant |

### Phase 2 — Post-game coach (first consumer of the engine)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|-----------|---------|-------|--------|------|-------|
| 2.1 | Post-game review: full matchup table, what you could've swapped to, pool gaps | `src/postgame/*.ts` (UI deferred) | me | ✅ | 1.* | DONE. Pure projection of `EngineResult` → `PostGameReport` (matchup + full ranked alternatives + pool gaps). Single-snapshot, analysis-only (no React). 56/56 tests; compliance review CLEAN; 2 review bugs TDD-fixed. Design: `docs/plans/2026-06-19-postgame-coach-design.md` |

### Phase 3 — GEP data spike (live plumbing)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|-----------|---------|-------|--------|------|-------|
| 3.1 | Confirm enemy roster + `selected_character` flow in the GEP Simulator; resolve `character_name` populate timing | spike notebook | me | ⬜ | 1.* | **Gated by Q-001.** Key off `character_id`/`character_name`, track by `uid` |
| 3.2 | Swap detection: diff enemy `character_name` set → emit `swap(old,new,side)` into engine | `src/gep/*.ts` | me | ⬜ | 3.1 | - |

### Phase 4 — Patch overlay sync  (the hidden swamp — protect with buffer)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|-----------|---------|-------|--------|------|-------|
| 4.1 | Sync per-patch win/ban rates into the overlay; seed from design §5 | `data/patch_overlay.json` | me | ⬜ | 0.4 | **Gated by Q-002 (stat-API ToS/key/limits).** Until then, hand-maintain the §5 qualitative seed |

### Phase 5 — Live glanceable overlay  (hardest UX — last)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|-----------|---------|-------|--------|------|-------|
| 5.1 | Glanceable HUD: one-line swap + uncovered-threat icon row; fires on swap + round_start | `src/overlay/*.tsx` | me | ⬜ | 3.*, 1.* | Design §6 mode 1; near-silent by default |

### Phase 6 — Macro / event-stream reader (the live "play" layer — D-008)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|-----------|---------|-------|--------|------|-------|
| 6.1 | Stagger/tempo read (#3): your-team death clustering + teammate `ult_charge` tempo windows | `src/macro/tempo.ts` | me | ⬜ | 3.* | Build FIRST among macro reads — pure your-side data, compliant-by-construction, no gating unknown. Can prototype on recorded/synthetic streams |
| 6.2 | Personal-nemesis read (#1) + team-threat read (#2) | `src/macro/threats.ts` | me | ⬜ | 6.1, **Q-006** | **GATED** on confirming `kill_feed` killer attribution. Kill tally is an INTERNAL trigger only; output is self-directed coaching, never an enemy scoreboard (D-008 framing rule) |
| 6.3 | First-death trend (post-game): who died first per fight + to which enemy hero | `src/macro/firstdeath.ts` | me | ⬜ | 6.1 | Post-game mode; aggregates over match |

---

## Phase Build Order Notes

- **Unblocker: Phase 0.** Nothing else can be trusted until the data contracts are sound — the registry is the foundation every layer imports. Get it green, get out.
- **Critical path: Phase 1 (engine + fixtures).** Everything downstream consumes the engine; the golden fixtures are what let us *know* it's good. A slip here slips everything. Protect it.
- **Convergence point: Phase 3.1 (GEP spike).** First time live data meets the engine. NOTE: the GEP **Simulator cannot answer Q-001** (it needs the game running and only confirms schema, not timing) — Q-001 + Q-006 must be tested in a **real match**. If the `character_name` timing unknown (Q-001) makes draft-time advice impossible, the live product narrows to mid-match/post-lock — fallback is to lean harder on the post-game coach (Phase 2).
- **Highest-risk phase: Phase 4 (patch sync).** Several unproven externals at once (API ToS, rate limits, key). Buffer goes right after it. Until Q-002 is resolved, do NOT block on the API — hand-maintain the §5 seed.
- **Phases 5 & 6 are both "live consumers" — sequence them last and interleave.** Phase 6.1 (tempo) is the safest live read and a good first live-plumbing target once the GEP spike (Phase 3) lands; Phase 5 (glanceable overlay) is the hardest UX. No new engine features in either — only surfacing an already-trusted engine. Phase 6.2 (nemesis/threat) is gated on Q-006.

---

## Coordination Protocol

Solo build, so the multi-person locking is light — but the discipline that matters even solo:

1. **Atomic doc commits.** A status/decision change in PLAN.md or decision-log.md is its own commit, never bundled with code. `docs(plan):` / `docs(log):`.
2. **Conventional Commits + reference decisions by ID.** `feat(engine): set-cover core (D-001, D-006)`, `fix(data): reconcile mechanism vocab (D-002)`.
3. **Push after every commit** once a remote exists (none yet — first commit is local).
4. **No silent contract change.** Anything in Shared Contracts changes only with a `CONTRACT:` commit prefix and a decision-log entry.
5. **No git hooks** — manual discipline only, so process never blocks a hotfix.
6. (If a 2nd person joins) flip your row to 🟡 with a timestamp + commit PLAN.md only before starting; stale-lock TTL = 24h for a no-deadline build.

---

## Shared Contracts

> Don't drift these without a `CONTRACT:` commit prefix + a decision-log entry.

| Contract | Owner | Consumer | Definition |
|----------|-------|----------|------------|
| Canonical hero key | registry (0.1) | every KB + engine + GEP join | `character_id` (number) is the join key; `character_name` + aliases resolve to it. Track players by `uid`. |
| Mechanism vocab | registry (0.1) | counter_kb, crosswalk, engine | Closed set; zod rejects any token not in it. |
| Comp-function vocab | registry (0.1) | comp_gap_model, crosswalk, engine | Closed set (`frontline_space`, `anti_dive_peel`, …). |
| Engine output | engine (1.1) | post-game UI, live overlay | `type Suggestion = Pick \| Swap \| Hold` — **no `Ban` variant exists** (D-006). Carries a confidence. |
| Engine objective | engine (1.1) | — | Single constrained score per candidate swap; **exhaustive** over comfort pool, NOT greedy set-cover (D-009): `+threat +function −introduced_vulnerability −clash −redundancy`, hard-constrained to pool ∩ legal slot ∩ ≤1 change. |
| Role-slot legality | engine (1.1) | engine candidate filter | **2-2-2 role queue (D-012):** ≤2 Vanguard / 2 Duelist / 2 Strategist. Pick candidate legal iff its role has an open slot; Swap candidate must replace a **same-role** teammate. Role from registry. |
| Unresolvable hero | engine (1.1) | engine + degradation (1.4) | A roster name that doesn't resolve to a single canonical key (notably bare `"Deadpool"`, A3) counts toward roster size but is **skipped** for threat/function tagging; engine surfaces a note. Bounded by Q-001 (D-012). |
| `provides_mechanisms` | registry/KB (0.x) | engine conditional resolution | Per-hero inverse of `countered_by`. Conditional coverage = needed-mechanisms ∩ pool-provided-mechanisms (research refinement #5). |
| Threat weight | registry/overlay (0.4) | engine | `weight = f(counterability, patch_trend)` — formula written in 0.4; no magic numbers in engine code. |
| GEP roster fields consumed | gep (3.x) | engine | ONLY: `character_name`, `character_id`, `team`, `is_teammate`, `uid`, `is_alive`, K/D/A, `is_local`. Never read/derive enemy dmg/healing or enemy `ult_charge`. **Never DERIVE a prohibited fact from permitted fields** (e.g. enemy ult timing from K/D cadence — D-007). |
| Macro-read output | macro (6.x) | overlay, post-game | Kill tallies are **internal trigger signals only**; user-facing output is self-directed coaching (your play / a swap from your pool) — **never an enemy scoreboard, never "shut down enemy X"** (D-008 framing rule). |

---

## Scope tiering

**Core (ship-blockers, must be high quality):**
1. **C1** Phase 0 registry + validated KBs (everything depends on it).
2. **C2** Set-cover engine that passes the golden fixtures (D-005) and emits `Pick \| Swap \| Hold`.
3. **C3** Post-game coach over hand-entered/recorded rosters (the trustworthy, compliant core). ✅ **MET** (Phase 2.1).

**Stretch (lower bar; cut without ceremony if Core slips):**
- **S1** Live GEP swap detection · **S2** Live glanceable overlay · **S3** Automated patch-overlay API sync · **S4** ult-combo table + HUD detection · **S5** playstyle inference from public most-played heroes · **S6** macro stagger/tempo read (Phase 6.1) · **S7** personal-nemesis + team-threat reads (Phase 6.2, gated on Q-006).

**Banked / deferred upside (NOT in scope now — from the Expansionist, parked deliberately):**
- Game-agnostic role-coverage kernel (swap JSONs → coach another hero shooter).
- Post-game match logs as a labeled dataset to auto-tune patch weights (data flywheel).

**Cut-triggers (pre-decided):** if the engine can't beat the golden fixtures, fix the data/engine before ANY live work. If Q-001 (GEP timing) blocks draft-time advice, cut live draft mode and ship the post-game coach + mid-match swap only. If Q-002 (stat-API ToS) is unresolved, S3 stays cut and the patch overlay is hand-maintained from §5.

Every cut is logged in `docs/decision-log.md`. No silent removal.

---

## Decisions (locked)

> Reference by D-### in commits/code. Full rationale: `docs/decision-log.md`.

- **D-001 (2026-06-19):** Concept locked — GEP-only pool-aware comp-gap coach, engine-first, personal build. No pivot.
- **D-002 (2026-06-19):** Insert Phase 0 Data-Contract Hardening (canonical registry + crosswalk + numeric weights) before engine code.
- **D-003 (2026-06-19):** Build order is engine-first on hand-entered rosters; GEP spike is NOT first.
- **D-004 (2026-06-19):** Strip ban machinery (`ban_value`/`ban_logic`/`ban_note`) from the engine runtime path.
- **D-005 (2026-06-19):** Golden-fixture test set is the oracle for "good advice"; gates patch edits. (Research refinement #7: also enforce property invariants — never-a-ban, every pick ∈ pool, a swap never reduces covered-threat-weight, every mechanism ∈ vocab, both KBs cover the same hero set.)
- **D-006 (2026-06-19):** Engine output type is `Pick | Swap | Hold` — no ban is representable.
- **D-007 (2026-06-19):** Compliance is "compliant-by-current-schema + discipline," NOT by-construction; never derive a prohibited fact from permitted fields; re-audit on every GEP update. Residual ban risk LOW-not-zero.
- **D-008 (2026-06-19):** Integrate `macro_reader.json` (4th KB); reads gated (Q-006) + framing-constrained (kill tally = internal trigger only, self-directed coaching only).
- **D-009 (2026-06-19):** Engine is a single constrained objective + exhaustive search, NOT greedy set-cover (kills throw-picks). Supersedes the set-cover assumption in D-002.
- **D-010 (2026-06-19):** Platform choice (native vs ow-electron) is an OPEN user decision (Q-005); don't default to native; blocks Overwolf scaffolding only, not the engine.
- **D-011 (2026-06-19):** Mechanism vocab reconciled by moderate collapse to a closed 24-token set; merge map in the registry. (Logged at Phase 0; listed here for completeness.)
- **D-012 (2026-06-19):** Phase 1 engine semantics — enforce 2-2-2 role queue (legal-slot constraint), graceful-skip the unresolved Deadpool name pre-spike, support both Pick and Swap modes from day one.

---

## Open Questions

> Decisions that block work. Resolve by research or by asking; never proceed on a silent assumption.

- [ ] **Q-001 — When does enemy `character_name` first populate via GEP?** Draft / round_start / first-contact is **undocumented** (design §3). Gates Phase 3 and whether live advice is draft-time or mid-match only. **Must be tested in a REAL match — the GEP Simulator only confirms schema, not timing (research-refuted). Owner: me.**
- [ ] **Q-002 — Stat/asset API ToS, rate limits, `x-api-key`, commercial/redistribution rights** (marvelrivalsapi.com). Gates Phase 4 (patch sync) + emblem assets. **Irrelevant for personal use per CLAUDE.md, but confirm before any sharing. Owner: me.**
- [x] **Q-003 — Layer A research synthesis fold-in.** ✅ DONE 2026-06-19: confirmed data bugs A1-A4 + compliance vs official GEP page; refuted JarodWellinghoff scaffold / Simulator-tests-timing / compliant-by-construction. Folded into D-007..D-010 + this snapshot.
- [ ] **Q-004 — Is the single-expert VOD counter KB good enough, and how is staleness handled?** Council + research flagged edge-count-as-signal bias + single-correlated-source. Mitigation: per-edge provenance + confidence tag (research refinement #8), `valid_for_patch` stamp, validate against own games. **Owner: me (revisit after golden fixtures exist).**
- [ ] **Q-005 — Overwolf NATIVE vs ow-electron? — DEFERRED by decision (2026-06-19).** User chose to decide after the engine is proven (post Phase 1). Re-trigger at the Phase 2→3 boundary. ow-electron avoids the native "no private apps" wall + free hosting; native is lighter but needs email whitelisting + blocks private apps; GEP API differs (costly to switch). **Does NOT block Phase 0/1. Owner: YOU (revisit before Phase 3).**
- [ ] **Q-006 — Does GEP `kill_feed` attribute the KILLER (character_name / mappable uid) next to the victim?** Gates macro reads #1/#2 (Phase 6.2); read #3 (tempo) ships regardless. **Test in the same real-match spike as Q-001. Owner: me.**

---

## Pre-deliver checklist (start now, grow all build)

"Deliver" here = trust it in your own ranked games. All must pass:

1. [x] Every KB validates against the registry with zero unknown tokens (`npm run validate` green). ✅ Phase 0.
2. [x] Engine passes 100% of the golden fixtures (D-005). ✅ Phase 1 — `npm test` 16/16 (8 golden + 8 invariants).
3. [x] Engine output type cannot represent a ban; grep confirms no ban field is serialized (D-006). ✅ No `Ban` variant in the union; a runtime invariant asserts no `ban`/`"kind":"ban"` is serialized over all fixtures + fuzz; engine-source grep is clean.
4. [x] Engine consumes ONLY the whitelisted GEP fields (Shared Contracts) — no enemy dmg/healing/ult_charge anywhere. ✅ Engine keys off canonical hero keys + static KB tiers only; grep confirms no `ult_charge`/enemy-stat reference. (Re-confirm at the GEP spike when live fields are wired — D-007.)
5. [x] Graceful `Hold` on unknown/masked/partial rosters — no crash, no silent under-cover. ✅ Phase 1.4; verified by the never-throws fuzz invariant.
6. [ ] Compliance one-liner visible in README: "GEP-only, no injection, no confidential data." (README not written yet.)

---

_Last updated: 2026-06-19 (Phase 2 complete — post-game coach shipped; C3 met; next = Phase 3 GEP spike) by me._
