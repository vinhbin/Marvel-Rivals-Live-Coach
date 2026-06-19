# Rivals Coach

A live coaching companion for **Marvel Rivals** (Overwolf game `24890`). It reads your live
match roster and suggests a single **pick / swap / hold** drawn from *your own* comfort pool —
to counter the enemy comp and close your team's functional gaps. **Coach, not a stats tracker:**
the value is decision support, not data display.

> **GEP-only, no injection, no confidential data.** The only data source is the Overwolf Game
> Events Provider. The app never reads game memory, never injects into the process, never OCRs
> the screen, never exposes enemy confidential stats, never predicts enemy ultimates, and never
> recommends a hero **ban** — it only ever suggests what *you* should pick or swap to.

## Status

Early build, engine-side complete. The constrained-objective engine (Pick/Swap/Hold), the
post-game coach, and the platform-neutral GEP ingestion layer are built + tested (`npm test`).
Live Overwolf wiring is pending a real-match GEP spike + developer whitelist (see `PLAN.md`).

- `CLAUDE.md` — the constitution (non-negotiable compliance guardrails + stack).
- `docs/design.md` — full system design.
- `docs/methodology.md` — how the build was de-risked before code (Layer A trace).
- `docs/decision-log.md` — every locked decision with rationale.
- `PLAN.md` — phases, status, contracts, open questions.
- `data/` — the knowledge bases (counter graph, comp-gap model; registry + patch overlay to come).

## Stack

TypeScript end-to-end · Overwolf app (native vs ow-electron still open) · React overlay (later) ·
plain TS constrained-objective engine (exhaustive search, not greedy set-cover — D-009) over the
`data/` JSONs · `zod` validation · Vite build. No backend for the personal build.

## Try it without the game (manual CLI)

The engine + post-game coach run locally with no Overwolf — type a roster, get advice:

```
npm run coach
```

Enter the enemy comp, your team, and your comfort pool (comma-separated hero names); it prints the
recommended pick/swap/hold and the full post-game review (matchup table, alternatives, pool gaps).
Useful for testing advice quality in real drafts (alt-tab + type what you see) before live wiring.
