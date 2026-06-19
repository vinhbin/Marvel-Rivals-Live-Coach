# Methodology — how this build was de-risked before code (Layer A trace)

> This is the front-loaded decision process, written down as it ran. It exists so that on a
> tired day the "why" behind a choice has a recorded answer, and so the process itself is
> auditable. Build coordination lives in `../PLAN.md`; locked decisions in `decision-log.md`.

**Project shape (confirmed with the user 2026-06-19):** personal / unlisted build · solo dev ·
TypeScript end-to-end · no hard deadline · engine-first build order · full Layer A re-run
requested.

Because it's a personal build with no deadline, Layer A was deliberately **re-aimed**: the
classic hackathon question ("will a judge defeat this in 5 seconds because the empty lane was
taken?") matters less here. The failure modes that actually kill a *personal* build are
(a) a wrong **compliance** assumption that risks the user's game account, and (b) an engine
that produces **bad coaching advice**. So the murder-board and research were pointed at those
two, not at market positioning.

---

## Phase 1 — Competitive recon  ·  Phase 4 — Deep research

**Method:** fan-out research workflow (`rivals-coach-layerA-research`) — 2 recon agents
(direct competitors; the Blitz/NetEase ban precedent) + 4 adversarial fact-check agents, each
told to *falsify* a load-bearing claim, not confirm it (GEP roster schema + enemy
`character_name` timing; the compliance boundary; engine-quality risk; Overwolf platform/stack
risk), then a synthesis pass.

**Status: COMPLETE (2026-06-19).** Key results:
- **Confirmed against primary sources** (Overwolf's official GEP page + changelog): enemy
  damage/healing absent from the schema; `ult_charge` teammate-only (changelog v292.1.1
  "Disabled ult_charge in roster for enemy players"); `selected_character` since GEP 296.0;
  `banned_characters` since 281.0 (and it includes `is_teammate` for both teams — the one
  field needing self-discipline). The 3 NetEase prohibitions are stated on Overwolf's own dev
  page. Blitz was banned for injection + the 3 feature categories.
- **Independently confirmed all 4 data bugs against the files** (A1: 13 declared vs 32 used
  mechanisms; A2: "Gan"=Jean alias used as a counter node; A3: Deadpool split + zero Deadpool
  entries in comp_gap; A4: 13 KB heroes missing from `hero_functions`).
- **Competitive lane (honest):** GEP-only compliant counter advice is **table stakes, not a
  moat** — Counterwatch is a sophisticated incumbent (50/30/20 counter/synergy/map, Bayesian-
  shrunk win rates). BUT it *explicitly excludes* personal pool and comp-composition as inputs,
  so the **pool-aware + comp-gap-as-set-cover intersection IS unoccupied.** For a personal
  build the lane barely matters; recorded for honesty.
- **Refuted, with consequences:** "compliant-by-construction" → downgraded to "by-current-
  schema + discipline" (D-007); the JarodWellinghoff scaffold (design §9) is a no-React webpack
  skeleton → use `overwolf/events-sample-app` (D-003 update); the **GEP Simulator cannot test
  the `character_name` timing** — only schema → Q-001 needs a real match (D-003 update).
- **Ban-risk nuance:** Blitz users got amnesty (no bans) if they stopped, but real multi-year
  bans hit other *injecting* software (SteelSeries GG + Process Hacker) → GEP-only is the
  *survivable* architecture. Residual personal risk LOW-not-zero; no written safe-harbor.

Folded into decision log D-007…D-010 and PLAN.md Open Questions.

---

## Phase 2 — Murder-board  (THE decisive phase)

**Method:** invoked the `llm-council` skill in **TECHNICAL mode** — 7 independent advisors
(Contrarian, First-Principles, Expansionist, Outsider, Executor, Software-Lead,
Long-Term-Architect), 5 anonymized peer reviewers (Senior-Eng, SRE, Security/Compliance,
Junior-Dev, Future-Maintainer), chairman synthesis. Full transcript:
`../council-transcript-20260619-0238.md`.

**Verdict: the concept survives — but a `Phase 0: Data-Contract Hardening` must be inserted
before any engine code.** The suspected weak point (VOD-quality of the counter KB) is real but
secondary; the **#1 engineering risk is that the data contracts are broken today**, surfaced
independently by 5 of 7 advisors and re-verified against the JSON by all 5 reviewers:

1. **`mechanism_vocab` declares 13 tokens; the edges use ~20+ undeclared ones** (`zone_denial`,
   `mark`, `brawl`, `ult_turnaround`, `flat_damage`, `go_over`, `contest_vertical`, …). Strict
   zod rejects the KB; loose zod makes the vocab decorative.
2. **No crosswalk** between the counter KB's `mechanism` strings and the comp-gap model's
   `function` tags — yet the engine's killer step depends on that join (`anti_flyer_grounding`
   ≠ `grounding`).
3. **Hero-key join is unspecified and partly impossible:** `"Gan"` (a Jean Grey alias) is
   referenced as a *counter hero*; `Deadpool_Tank/DPS/Strat` are 3 keys but GEP emits one
   `character_name`; display names (Jeff / Bucky / Mr Fantastic) won't match. No
   `character_id`↔name↔alias table exists despite `design.md` §3 listing `character_id`.
4. **"Weighted set-cover" has no numeric weights.** `trend` is a string enum; coverage is
   binary; the patch overlay covers ~15/40 heroes. The weight formula is described, never
   defined.
5. **`ban_value`/`ban_logic` still live in the KB** despite the absolute never-ban rule.

**Blind spots peer review caught (not in any single R1 view):**
- Single-expert VOD as unquestioned ground truth — edge *counts* encode how much the VOD
  discussed a hero, and greedy set-cover reads that as signal. Needs a confidence/provenance tag.
- **No golden test fixture** — can't tell "correct" from "plausible," can't regression-test a
  patch edit.
- Runtime resilience unspecified — unknown `character_name`, Diamond-3+ name-masking (`*****`
  pre-round), partial rosters, GEP version drift, and the **no-good-suggestion** case all need
  a "hold" fallback, never a crash or silent under-cover.
- **never-COMPUTING vs never-DISPLAYING a ban** — set-cover inherently produces a counterability
  ordering whose inverse is a ban signal; the discipline is the engine's *output type* is
  `Pick | Swap | Hold` and the inverse ranking is never surfaced.
- "Schema is the envelope" guards **live GEP only**; the static KBs, the stat API, and emblem
  assets are separate provenance surfaces with their own ToS exposure.

**Strongest minority view (absorbed):** the Long-Term-Architect — the bugs aren't 12 separate
defects, they're one disease (no canonical registry; volatile strength baked into the "durable"
layer). Fix the *data model* (one typed registry + mechanisms resolved at runtime + golden
snapshot tests) and the entire bug list becomes unrepresentable. Adopted as the organizing
principle for Phase 0; the Software-Lead's enumerated bugs become Phase 0's acceptance checklist.

**Confidence:** HIGH that data-contract repair must precede engine code and that
engine-first-on-hand-entered-rosters is the right first move.

---

## Phase 3 — Concept lock

The murder-board did not surface a *fatal* flaw — it surfaced a **mandatory sequencing change**
(insert Phase 0). No pivot of the concept itself. Locked brief in `decision-log.md` (D-001).

---

## Phase 5 — Gap analysis

The Layer A research workflow doubled as the gap-analysis pass — it surfaced the objections the
murder-board did NOT, by checking the design against primary sources and the data against itself:

1. **The engine objective is wrong, not just the data.** Greedy set-cover maximizes
   threats-covered-per-pick *blind to comp coherence* — it will "spam pick Thing" (covers the
   most nodes) and recommend throw picks the user can't execute or that lose to the rest of the
   enemy comp. → **D-009:** replace with a single constrained objective (`+threat +function
   −introduced_vulnerability −clash −redundancy`, hard-constrained to pool ∩ legal slot ∩ ≤1
   change) + exhaustive search (trivial at ~52 heroes). This is the single most important catch
   the council missed.
2. **The GEP Simulator can't validate the load-bearing timing unknown** — it needs the game
   running and only confirms schema. Q-001 (and Q-006) must be tested in a real match.
3. **The recommended scaffold is the wrong stack** — use `overwolf/events-sample-app`.
4. **Platform choice is a real decision, not a default** — native vs ow-electron has a genuine
   personal-build tradeoff (approval wall + private-app block vs overlay weight; divergent GEP
   APIs). → Q-005, escalated to the user.
5. **The 4th KB (`macro_reader`) introduced a new compliance edge** — vetted separately:
   SAFE-WITH-FRAMING-CONSTRAINT (kill tally = internal trigger only, self-directed coaching
   only) + a 2nd build-gating GEP unknown (Q-006). → **D-008.**

**The one objection a knowledgeable critic would still raise, now addressed:** "your engine will
LOOK trustworthy long before it IS" — caught and answered by D-005 (golden fixtures + property
invariants as the oracle) + D-009 (kill the throw-pick pathology) + D-008's confidence/provenance
tagging (Q-004).

---

_Decisions that came out of Layer A are recorded in `decision-log.md` (D-001 … D-00x). The
phase table they feed is in `../PLAN.md`._
