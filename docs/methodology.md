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

**Status:** <!-- RESEARCH-SYNTHESIS-SLOT -->
Recon + fact-check agents completed; structured synthesis was still finalizing at the time of
writing. Findings to be folded into PLAN.md **Open Questions** and the decision log when the
synthesis lands. The design doc (`design.md` §0, §8) already carried a verified compliance
murder-board and a competitor read (DeepRivals as the direct competitor; tracker.gg as the
incumbent), so this phase is **confirmatory** of an already-assessed lane rather than the
load-bearing phase for a personal build.

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

<!-- GAP-ANALYSIS-SLOT — final adversarial pass for the one objection not yet addressed,
     run after the research synthesis is folded in. -->

---

_Decisions that came out of Layer A are recorded in `decision-log.md` (D-001 … D-00x). The
phase table they feed is in `../PLAN.md`._
