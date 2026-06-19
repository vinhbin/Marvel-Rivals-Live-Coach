# LLM Council Transcript — Rivals Coach Murder-Board (Layer A Phase 2)

**Date:** 2026-06-19
**Mode:** TECHNICAL (engineering plan review; success = does the system work / give good advice, compliance-correctness)
**Original question:** Murder-board the GEP-only Marvel Rivals coaching-overlay concept on engineering risk + compliance-correctness (not market/pitch). Suspected weak points: single-expert VOD-sourced counter KB, and engine quality (does set-cover give GOOD advice?).

## Framed question (given to advisors)

A solo dev builds a GEP-only Overwolf overlay for Marvel Rivals (game id 24890): reads the live roster, suggests counter-picks/swaps + comp-gap fixes from the user's OWN comfort pool, via a weighted set-cover engine over three hand-authored KBs (counter graph, comp-function-coverage model, per-patch strength overlay). "Coach, not stats tracker." Personal/unlisted, solo, TypeScript end-to-end, no hard deadline, no backend. Hard compliance: GEP-only data; no enemy confidential stats; never output a hero BAN (only picks/swaps); never predict enemy ults; no copyrighted art. Tear it apart on engineering risk + compliance-correctness.

Files provided for grounding: CLAUDE.md, rivals_live_coach_design.md, rivals_counter_kb.json, rivals_comp_gap_model.json.

## Anonymization mapping (R1 advisors → letters)

- A = Contrarian
- B = First Principles
- C = Expansionist
- D = Outsider
- E = Executor
- F = Software Lead
- G = Long-Term Architect

---

## Round 1 — Advisor responses

### A (Contrarian)
The engine is graph lookups dressed up as "set-cover" and will emit garbage because nothing is grounded in truth. `mechanism_vocab` lists 13 tokens but edges use ~20 undeclared ones (`zone_denial`, `mark`, `brawl`, `ult_turnaround`, `flat_damage`…). `zod` will reject the KB or you loosen to `z.string()` and the vocab becomes decorative. The comp-gap model is a DIFFERENT taxonomy with no join key, so "cross-reference counter_kb" has no join. "Weighted set-cover" has no real weights — patch overlay covers only ~15/40 heroes; for the rest threat weight is undefined, so set-cover degrades to counting edges, and edge counts are an artifact of how much the VOD talked about a hero (Venom has 6 counters, Blade 3). Build post-game review first; check picks against your own games.

### B (First Principles)
The engine solves a problem one rung too low. Real problem: "a player loses winnable games because they don't know which comfort hero to switch to, and when." The engine is only as good as the patch overlay (L2), which doesn't exist yet — build order puts patch sync at step 4, overlay at step 5, so the first runnable thing produces threat rankings with NO strength signal: single-expert opinion dressed as a weighted optimizer. Set-cover optimizes coverage, but coaching value is TIMING and CONFIDENCE. The draft-vs-midmatch timing unknown (§3) gates which product this is — resolve BEFORE the engine. Build post-game first on hand-entered rosters, no live GEP. Compliance well-handled via "schema is the envelope." One live risk: strip `ban_value` from the engine output type so a ban can't leak.

### C (Expansionist)
Undervalued leverage: the comp-gap model's `engine_note` already says both engines are the SAME set-cover and can run together (weight a gap higher when the enemy comp punishes it). A single composite objective — cover threats AND comp-gaps AND patch-strength in one pass — is something a generic "switch to X" competitor structurally can't match. Bigger: the L1/L2 split makes the engine GAME-AGNOSTIC; nothing in `recommendation_logic` is Marvel-specific. The dev is accidentally building a role-coverage coaching KERNEL. Post-game coach generates a labeled dataset for free = data flywheel to auto-tune patch weights. `playstyle_modifiers` inference is a second product: pre-match draft prep.

### D (Outsider)
The two data files speak different languages and the engine sits on both. `comp_gap_model` declares a closed `mechanism_vocab` of 13 strings but `counter_kb` uses dozens not in the list (`mark`, `brawl`, `zone_denial`, `ult_turnaround`, `flat_damage`, `go_over`…). If the vocab isn't shared/validated, matching silently breaks; in 6 months nobody knows which spelling is canonical. Hero naming has no enforced key: `aka:["Phoenix","Gan","Gene"]` for Jean, yet Black Cat's `countered_by` references a hero literally named `"Gan"`. `Deadpool_Tank/DPS/Strat` are three "heroes" but GEP delivers one `character_name` — mapping undefined. `answer_heroes` "via" uses `zone_denial`, not in vocab. `ban_value_numeric` and `ban_note` fields contradict CLAUDE.md's absolute NEVER-a-ban rule. The set-cover "weight" is described but never numerically defined.

### E (Executor)
Monday: do NOT touch Overwolf. Paste a hand-typed enemy roster + comfort pool, run set-cover against the two JSONs already in repo. Day-one buildable because `recommendation_logic.steps` IS a literal 7-step algorithm spec — you implement written pseudocode. CLAUDE.md (engine first) is correct; design §7 (GEP spike first) is wrong for a solo dev — §3 admits enemy `character_name` populate timing is undocumented, so leading with GEP starts on the one task with no clear first step. Secret swamp: step 4 patch overlay sync — `marvelrivalsapi` ToS, rate limits, `x-api-key` all unconfirmed = weeks + licensing gate. Day-one snags: `zone_denial` not in `mechanism_vocab` (zod rejects KB); `hero_functions` is "seed set," missing heroes, so set-cover silently under-covers.

### F (Software Lead)
The spec is self-inconsistent in ways that halt a junior day one. (1) The two taxonomies don't join — no crosswalk from `countered_by.mechanism` (`cc_immune_body`, `mark`, `ult_turnaround`) to a `comp_function` (`anti_dive_peel`); `hero_functions` never uses "grounding," it uses `anti_flyer_grounding`. (2) `mechanism_vocab` is a lie: 13 declared, ~20 used. (3) Counter heroes that don't exist as entries: `"Gan"` is a Jean alias referenced as a hero — engine joining on key drops it. (4) `character_name` join unspecified: `Deadpool_Tank/DPS/Strat` but GEP emits one `character_name`; Jeff vs "Jeff the Land Shark", Bucky vs "Winter Soldier", Mr Fantastic vs "Mister Fantastic"; no `character_id` map provided despite §3 listing it available. (5) "Weighted set-cover" has no weights: `trend` is a string enum with no numeric mapping; hero→coverage is binary. Fix before code: (a) mechanism→function crosswalk, (b) reconcile vocab, (c) key on `character_id` + alias table, (d) numeric `trend` multipliers + `raise/lower` deltas.

### G (Long-Term Architect)
The L1/L2 split leaks and that's the 6-month wall. The "durable" counter KB is stamped `season_context: ~S7.5-S8` and "Re-validate every season" — a strength fact wearing a mechanics costume. `countered_by` lists specific HEROES, so when Black Cat is nerfed out you hand-edit every `countered_by` array she appears in — L2 volatility bleeding into L1 by construction. Load-bearing wall: `counterability` is a hand-typed enum per hero, then patched by `counterability_override` strings in the overlay — same fact in two files with no schema link, drift guaranteed within two patches. `ban_value_numeric`/`ban_logic` still in the KB despite NEVER-a-ban — dead, compliance-adjacent code a future you will mistake for live logic. Cheap fix now: make `countered_by` reference MECHANISMS only, resolve hero→mechanism at runtime, delete `ban_value` from L1.

---

## Round 2 — Peer reviews (5 personas, all responses re-verified against the JSON files)

### Senior engineer (PR reviewer)
Verified every falsifiable claim against the JSON (13-token vocab vs ~20 used; "Gan"=Jean alias; ban fields present; Deadpool×3; non-numeric trend; disjoint taxonomies — ALL confirmed).
1. **Strongest: F** — only response that reads line-by-line and lands every defect with a fix attached.
2. **Devil's advocate: G** — argues the L1/L2 split is architecturally false (fixing the data model prevents bugs F only patches symptom-by-symptom).
3. **Biggest blind spot: C** — celebrates a "game-agnostic kernel"/flywheel while the two JSONs don't even join today.
4. **All missed:** none questions the single-expert VOD as ground truth (edge counts encode how much the VOD discussed a hero); none demands a golden-roster test fixture; none flags the mechanism→function crosswalk is itself an undefined third KB nobody scoped.

### SRE / on-call
1. **Strongest: F** — most evidence-grounded, every claim verified, each defect paired with a fix.
2. **Devil's advocate: C** — the L1/L2 split makes the engine a reusable role-coverage kernel.
3. **Biggest blind spot: C** — pure upside on a broken foundation; "cheerleading on a broken foundation is the most dangerous review here."
4. **All missed (the SRE failures):** no runtime resilience — what the engine does when GEP sends a `character_name` absent from the KB (silent under-coverage, no fallback); no observability to detect silent join failures; **name-masking at Diamond 3+** (`character_name` is `*****` pre-round — engine has no input then); GEP schema version drift; partial/streaming rosters; the **no-good-suggestion case** — every response assumes the engine outputs *something* rather than degrading to "hold / no confident swap," the safest behavior.

### Security / compliance
1. **Strongest: B** — only response identifying compliance posture as *structural* ("schema IS the envelope") and giving the one concrete fix (strip `ban_value` from engine output type); notes post-game/hand-entered build doesn't touch the compliance surface.
2. **Devil's advocate: G** — dormant `ban_value`/`ban_logic` is "compliance-adjacent code a future you will mistake for live logic"; reintroduction risk may matter more than accidental leak.
3. **Biggest blind spot: C** — treats `playstyle_modifiers` inference from "public most-played heroes" + match-data harvesting as free upside, ignoring the ToS/data-provenance lines that get tools flagged.
4. **All missed:** no one distinguishes never-COMPUTING a ban from never-DISPLAYING one — set-cover ranking inherently produces a counterability ordering whose inverse *is* a ban signal; suppressing the field doesn't suppress the computation. All overstate "schema is the envelope" — it guards live GEP, but the static KBs, the patch-overlay stat API, and emblem-asset loading are separate provenance surfaces with their own ToS exposure. None addresses copyrighted-art handling as a live boundary.

### Junior developer (curse-of-knowledge)
Verified contradictions against files (all real); confirmed no engine code, no test fixtures, no hero-name source of truth exist yet.
1. **Strongest for a newcomer: E** — only one actionable Monday without a meeting; names the exact file/field (`recommendation_logic.steps` = numbered 7-step spec), says don't touch Overwolf, flags the precise day-one crash (`zone_denial`→zod reject).
2. **Devil's advocate: G** — the real rot is architectural drift, not just today's vocab typos.
3. **Biggest blind spot: C** — exciting but un-actionable; "builds the penthouse before the foundation passes inspection."
4. **All missed:** no one points to where the *truth* lives — no golden test fixture (roster → expected good suggestion), no canonical hero-name source of truth (should be `character_id`; nobody wrote the alias→id table), no "how to add a hero safely" contributor path.

### Future maintainer (6 months out)
Verified claims; **important correction:** `countered_by` entries are objects carrying BOTH `hero` AND `mechanism`, so G's "references heroes not mechanisms" is *partially wrong* — both are present (but G's structural drift argument survives).
1. **Strongest (long-term): G** — names the actual 6-month wall: the L1/L2 split leaks by construction (season-stamped KB; `counterability_override` duplicates a hand-typed enum across two files with no schema link).
2. **Devil's advocate: E** — the unglamorous patch-overlay-sync ToS/rate-limit/API-key gate is the likeliest thing to actually stall the project.
3. **Biggest blind spot: C** — franchising a foundation that doesn't validate.
4. **All missed:** no one addresses the *re-sync workflow* — four uncoordinated namespaces (`mechanism_vocab` 13, edge mechanisms ~20+, `comp_functions` tags, hero keys) a human hand-edits every patch with nothing forcing convergence; no golden-fixture regression test; the fix nobody proposes: one canonical hero+mechanism registry all files import + snapshot tests gating each patch sync.

---

## Chairman synthesis

### Where the council agrees (high-confidence)
1. **The data contracts are broken today and that is the #1 engineering risk — above the suspected "VOD-quality" worry.** Independently surfaced by A, D, E, F, G and re-verified against the JSON by all 5 reviewers:
   - `mechanism_vocab` declares **13** tokens; edges use **~20+ undeclared** ones (`zone_denial`, `mark`, `brawl`, `ult_turnaround`, `flat_damage`, `go_over`, `contest_vertical`, `survive_onslaught`, `prolonged_hitbox`, `cooldown_force`, `support_deny`, `clone_pressure`, `kill_through_ult`, `chase`, `ult_zone`, `ult_punish`, `ult_counter`, `range_advantage`, `contest`, `space_denial`). A strict zod schema rejects the KB; a loose one makes the vocab decorative.
   - **No crosswalk** between the counter KB's `mechanism` strings and the comp-gap model's `function` tags — yet `recommendation_logic` step 3 and design §4.2 both depend on that join. (Note: `anti_flyer_grounding` ≠ `grounding`.)
   - **Hero-key join is unspecified and partly impossible:** `"Gan"` (a Jean Grey alias) appears as a *counter hero*; `Deadpool_Tank/DPS/Strat` are 3 keys but GEP emits one `character_name`; Jeff/Bucky/Mr Fantastic display names won't match. No `character_id`↔name↔alias table exists despite design §3 listing `character_id` as available.
   - **"Weighted set-cover" has no numeric weights.** `trend` is a string enum; hero→function coverage is binary; the patch overlay covers ~15/40 heroes. The "weight" formula (threat = strength × counterability) is described but never written down or defined numerically.
2. **Build engine-first on hand-entered rosters; do NOT start with the GEP spike.** A, B, E (and Junior) converge. CLAUDE.md's order is right; design §7's "GEP spike first" is wrong because §3 admits enemy `character_name` populate-timing is undocumented — leading with it starts on the one task with no clear first step.
3. **The patch-overlay stat-API sync (build step 4) is the hidden swamp.** ToS, rate limits, `x-api-key`, and commercial/redistribution rights are all unconfirmed (design §8). E and the Maintainer both flag it as the likeliest stall point.
4. **`ban_value`/`ban_logic` must leave the engine's runtime path.** A, B, D, F, G all flag the dead ban machinery sitting in L1 despite the absolute never-ban rule.

### Where the council clashes
- **Is set-cover even the right model? (B vs the rest.)** B argues coaching value is *timing and confidence*, not coverage completeness, so optimizing coverage is "one rung too low." The majority accepts set-cover as the right primitive but insists it needs real weights + a confidence/abstain output. Resolution: keep set-cover, but (a) give it numeric weights, and (b) make it emit a *confidence* and a "hold — no confident swap" option rather than always forcing a pick. That absorbs B without discarding the architecture.
- **How much to invest in the "game-agnostic kernel" vision (C).** C is unanimously the biggest blind spot — but its underlying observation (the engine core is role-coverage-generic, and post-game generates a free labeled dataset) is *correct and valuable* once the foundation validates. Resolution: bank C's ideas as deferred upside; do NOT let them shape the foundation work.

### Blind spots the council caught (only emerged in peer review)
1. **Single-expert VOD as unquestioned ground truth.** Even a perfect engine launders one opinion; edge *counts* encode how much the VOD discussed a hero (Venom 6 / Blade 3), and the greedy set-cover reads that as signal. → Needs a confidence/provenance tag and validation against the user's own games.
2. **No golden test fixture.** There is no (roster + comfort pool → expected good suggestion) frozen dataset, so you cannot tell "correct" from "plausible-looking," and cannot regression-test a patch edit. (Raised by Senior Eng, Junior, Maintainer.)
3. **Runtime resilience is unspecified** (SRE): unknown `character_name`, Diamond-3+ name-masking (`*****` pre-round), partial rosters, GEP version drift, and the **no-good-suggestion** case all need explicit handling — default to "hold," never crash or silently under-cover.
4. **Compliance: never-COMPUTING vs never-DISPLAYING a ban** (Compliance). Set-cover inherently computes a counterability ordering whose inverse is a ban signal. Suppressing the output field is necessary but not sufficient framing — the discipline is that the engine's *purpose and output type* are pick/swap, and the inverse ranking is never surfaced or exported. Also: "schema is the envelope" guards *live GEP only*; the static KBs, stat API, and emblem assets are separate provenance surfaces.
5. **No single source of truth / re-sync workflow** (Maintainer): four uncoordinated namespaces hand-edited every patch. Fix: one canonical hero + mechanism + function registry that every file imports, plus snapshot tests gating each patch sync.

### Steelman of the strongest minority view (mandatory)
The least-supported-but-load-bearing view is **G (Long-Term Architect)** — picked as devil's-advocate by 3 reviewers but "strongest" by only the Maintainer. Steelman: *Everyone else is patching symptoms. The bugs F enumerates (vocab drift, "Gan", duplicated counterability) are not 12 separate defects — they are one disease: the data model has no canonical registry and bakes volatile strength into the "durable" layer. If you fix only the symptoms, the same class of bug returns at the next patch, because nothing structurally prevents a human hand-editing four namespaces from drifting again. The real fix is a single typed registry + mechanisms-resolved-at-runtime + golden snapshot tests gating every sync — do that and F's entire bug list becomes unrepresentable.*

**Verdict on the steelman: ABSORB it fully.** G's structural framing is the correct *organizing principle* for the fix; F's enumerated bugs are the *acceptance checklist* that proves the registry works. I reject only G's one factual slip (it's already objects with both `hero` and `mechanism`, not heroes-only) — which means the runtime hero→mechanism *capability* resolution G wants is partly already enabled by the data; the work is validation + a canonical registry, not a re-author from scratch.

### Confidence call
**HIGH** that the data-contract repair (canonical registry + crosswalk + numeric weights + `character_id` keying + golden fixtures) must precede engine code, and that engine-first-on-hand-entered-rosters is the right Monday. **Flips to MEDIUM** only if the dev intends to throw the hand-authored KBs away and source the counter graph from the stat API instead — in which case the registry work changes shape (but doesn't disappear). One piece of evidence would flip the build-order call: if the GEP Simulator turns out to expose enemy `character_name` reliably at draft with zero timing ambiguity, the "engine-first" argument weakens slightly — but that's exactly the undocumented unknown, so it stays a gated Open Question, not a reason to lead with GEP.

### The recommendation
Proceed with the project — the concept is sound and compliance is genuinely well-architected ("schema is the envelope" holds for live data). But insert a **Phase 0: Data-Contract Hardening** before the engine, organized by G's structural principle and acceptance-tested by F's bug list:
1. A single canonical **registry** (`data/heroes.ts` or `registry.json`): each hero's canonical key + `character_id` + display-name aliases (resolves Gan/Phoenix, Deadpool×3 by id+role, Jeff/Bucky/Mr Fantastic) + the closed mechanism vocab + the comp-function vocab. Every other file imports from it; nothing re-declares.
2. A **mechanism ↔ comp-function crosswalk** (the unscoped "third KB" reviewers caught) so the two engines actually join.
3. **Numeric weights**: map `trend` enum → multiplier, `counterability` → weight, `raise/lower` → deltas. Write the threat-weight formula down.
4. **Strip ban machinery** from the engine's types and runtime path; the engine's output type is `Pick | Swap | Hold` — no ban is representable.
5. **A golden-fixture test set**: ~6–10 hand-entered (enemy roster + comfort pool) cases with the suggestion *you* judge correct, so engine quality is measurable and patch edits are regression-tested.
6. Engine then consumes the validated registry; emits a **confidence** and a **"hold"** when no confident swap exists; degrades gracefully on unknown/masked heroes.

Defer (bank, don't build): C's game-agnostic kernel, data flywheel, and playstyle-inference second product. Park as Open Questions: GEP `character_name` timing (gates live mode), and stat-API ToS (gates the patch-overlay sync swamp).

### The one thing to do first
Before writing any engine code, build the **canonical hero+mechanism+function registry** (item 1) and validate the two existing JSONs against it — that single artifact makes F's entire bug list unrepresentable and is the foundation everything else imports.
