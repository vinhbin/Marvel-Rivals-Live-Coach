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
| 0.1 | Canonical registry: hero key + `character_id` + display-name aliases + closed mechanism vocab + function vocab | `data/registry.json` (+ TS loader) | me | ⬜ | - | Single source of truth. Resolves `Gan`→Jean, `Deadpool_Tank/DPS/Strat`→id+role, Jeff/Bucky/Mr Fantastic display names (D-002) |
| 0.2 | Reconcile `mechanism_vocab` to actual usage (13 declared vs ~20+ used) | `data/counter_kb.json`, registry | me | ⬜ | 0.1 | zod validates KB against registry vocab with ZERO unknown tokens |
| 0.3 | Mechanism ↔ comp-function crosswalk (the "third KB" the council caught) | `data/crosswalk.json` | me | ⬜ | 0.1 | Lets counter mode and comp-gap mode actually join (`anti_flyer_grounding`↔`grounding`) |
| 0.4 | Numeric weights: `trend`→multiplier, `counterability`→weight, `raise/lower`→delta; write the threat-weight formula down | registry / patch overlay schema | me | ⬜ | 0.1 | Makes the constrained objective computable (D-002, D-009) |
| 0.5 | Strip ban machinery from runtime path (`ban_logic`, `ban_value_numeric`, `ban_note`) | `data/counter_kb.json` | me | ⬜ | 0.1 | Quarantined/deleted; engine never reads it (D-004) |
| 0.6 | zod schemas for all KBs + registry; CI-style validate script | `src/schema/*.ts` | me | ⬜ | 0.1–0.5 | `npm run validate` fails on any drift — enforces hero-set parity across both KBs (A4) + zero unknown mechanisms (A1) |
| 0.7 | Add `provides_mechanisms` per hero (inverse of `countered_by`, same validated vocab) | registry / `counter_kb.json` | me | ⬜ | 0.1, 0.2 | Enables conditional coverage = needed ∩ pool-provided (research refinement #5) |

### Phase 1 — Engine + golden fixtures  (critical path)

| # | Component | File(s) | Owner | Status | Deps | Notes / acceptance |
|---|-----------|---------|-------|--------|------|--------------------|
| 1.1 | TS set-cover engine: tag enemy threats, check coverage, compute gaps, recommend from comfort pool | `src/engine/*.ts` | me | ⬜ | 0.* | Implements `comp_gap_model` `recommendation_logic.steps`; output type `Pick \| Swap \| Hold` (D-006) |
| 1.2 | Golden-fixture test set (~6–10 hand-entered rosters → expected suggestion) | `test/fixtures/*.ts` | me | ⬜ | 1.1 | Measurable oracle for "good advice" (D-005); gates patch edits |
| 1.3 | Conditional-counterability resolution (Moon Knight / Wolverine / Jeff need a deliverable mechanism from the pool) | `src/engine/conditional.ts` | me | ⬜ | 1.1, 0.3 | A "conditional" counter only counts as covered if the pool can deliver the mechanism |
| 1.4 | Graceful degradation: unknown `character_name`, masked names, partial roster, no-good-suggestion → `Hold` | `src/engine/*.ts` | me | ⬜ | 1.1 | Never crashes, never silently under-covers (SRE finding) |

### Phase 2 — Post-game coach (first consumer of the engine)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|-----------|---------|-------|--------|------|-------|
| 2.1 | Post-game review: full matchup table, what you could've swapped to, pool gaps | `src/postgame/*.ts` + UI | me | ⬜ | 1.* | Design §6 mode 2; lowest-risk consumer, no live edge cases |

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
| `provides_mechanisms` | registry/KB (0.x) | engine conditional resolution | Per-hero inverse of `countered_by`. Conditional coverage = needed-mechanisms ∩ pool-provided-mechanisms (research refinement #5). |
| Threat weight | registry/overlay (0.4) | engine | `weight = f(counterability, patch_trend)` — formula written in 0.4; no magic numbers in engine code. |
| GEP roster fields consumed | gep (3.x) | engine | ONLY: `character_name`, `character_id`, `team`, `is_teammate`, `uid`, `is_alive`, K/D/A, `is_local`. Never read/derive enemy dmg/healing or enemy `ult_charge`. **Never DERIVE a prohibited fact from permitted fields** (e.g. enemy ult timing from K/D cadence — D-007). |
| Macro-read output | macro (6.x) | overlay, post-game | Kill tallies are **internal trigger signals only**; user-facing output is self-directed coaching (your play / a swap from your pool) — **never an enemy scoreboard, never "shut down enemy X"** (D-008 framing rule). |

---

## Scope tiering

**Core (ship-blockers, must be high quality):**
1. **C1** Phase 0 registry + validated KBs (everything depends on it).
2. **C2** Set-cover engine that passes the golden fixtures (D-005) and emits `Pick \| Swap \| Hold`.
3. **C3** Post-game coach over hand-entered/recorded rosters (the trustworthy, compliant core).

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

---

## Open Questions

> Decisions that block work. Resolve by research or by asking; never proceed on a silent assumption.

- [ ] **Q-001 — When does enemy `character_name` first populate via GEP?** Draft / round_start / first-contact is **undocumented** (design §3). Gates Phase 3 and whether live advice is draft-time or mid-match only. **Must be tested in a REAL match — the GEP Simulator only confirms schema, not timing (research-refuted). Owner: me.**
- [ ] **Q-002 — Stat/asset API ToS, rate limits, `x-api-key`, commercial/redistribution rights** (marvelrivalsapi.com). Gates Phase 4 (patch sync) + emblem assets. **Irrelevant for personal use per CLAUDE.md, but confirm before any sharing. Owner: me.**
- [x] **Q-003 — Layer A research synthesis fold-in.** ✅ DONE 2026-06-19: confirmed data bugs A1-A4 + compliance vs official GEP page; refuted JarodWellinghoff scaffold / Simulator-tests-timing / compliant-by-construction. Folded into D-007..D-010 + this snapshot.
- [ ] **Q-004 — Is the single-expert VOD counter KB good enough, and how is staleness handled?** Council + research flagged edge-count-as-signal bias + single-correlated-source. Mitigation: per-edge provenance + confidence tag (research refinement #8), `valid_for_patch` stamp, validate against own games. **Owner: me (revisit after golden fixtures exist).**
- [ ] **Q-005 — Overwolf NATIVE vs ow-electron? ⟵ NEEDS YOUR DECISION (D-010).** ow-electron avoids the native "no private apps" approval wall + lets you host/share freely; native is lighter for a glanceable overlay but needs email whitelisting before any local run. GEP API differs between them, so switching later is costly. **Blocks Phase 3+ scaffolding, NOT the engine (Phase 0/1). Owner: YOU.**
- [ ] **Q-006 — Does GEP `kill_feed` attribute the KILLER (character_name / mappable uid) next to the victim?** Gates macro reads #1/#2 (Phase 6.2); read #3 (tempo) ships regardless. **Test in the same real-match spike as Q-001. Owner: me.**

---

## Pre-deliver checklist (start now, grow all build)

"Deliver" here = trust it in your own ranked games. All must pass:

1. [ ] Every KB validates against the registry with zero unknown tokens (`npm run validate` green).
2. [ ] Engine passes 100% of the golden fixtures (D-005).
3. [ ] Engine output type cannot represent a ban; grep confirms no ban field is serialized (D-006).
4. [ ] Engine consumes ONLY the whitelisted GEP fields (Shared Contracts) — no enemy dmg/healing/ult_charge anywhere.
5. [ ] Graceful `Hold` on unknown/masked/partial rosters — no crash, no silent under-cover.
6. [ ] Compliance one-liner visible in README: "GEP-only, no injection, no confidential data."

---

_Last updated: 2026-06-19 (Layer A research + macro_reader integration) by me._
