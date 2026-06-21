# Rivals Coach (working title — rename once chosen)

A GEP-only Overwolf companion for Marvel Rivals: reads the live hero roster, and suggests
counter-picks / swaps and ult-combo windows based on the user's own hero pool. **Coach, not a
stats tracker** — the differentiation is decision support, not data display.

> Full design lives in `docs/design.md`. Read it before making architecture decisions. This
> file is the always-loaded constitution; the design doc is the reference.

## NON-NEGOTIABLE compliance guardrails (never violate these in any code)

NetEase bans tools that cross these lines (it labeled the Blitz plugin "cheating software").
Every feature and code suggestion must respect them:

- **GEP-only data.** The Overwolf Game Events Provider is the ONLY data source. Never read
  game memory, never inject into the process, never OCR enemy data. Injection is what got
  Blitz banned.
- **No enemy confidential stats.** Never expose or derive enemy damage/healing. The GEP schema
  already withholds these — consume only GEP fields; never scrape or estimate enemy stats.
- **No hero-BAN tooling.** Output is ALWAYS a pick or swap, NEVER a "ban hero X" suggestion.
  This is an explicitly prohibited feature category, regardless of what informs it.
- **No enemy-ult prediction.** `ult_charge` is teammate-only by design. Never estimate, model,
  or warn about enemy ultimates.
- **No copyrighted art in source.** Never embed Marvel hero images. Load emblems at runtime
  from the data API by `character_id`.
- **Stay visibly distinct from cheats.** Lead with "GEP-only, no injection, no confidential
  data."

## Stack

TypeScript end-to-end (do not introduce Django/Python here — Overwolf is a JS platform; share
one engine + types across overlay and any backend).

- Platform: Overwolf **native** app, game id `24890`. Apps are web apps in Overwolf's client.
- Overlay UI: React. Keep it light — overlay frame cost matters.
- Live data: Overwolf GEP API (`overwolf.games.events`).
- Engine: plain TS set-cover module over the `data/` JSONs. `zod` to validate KB shapes + GEP payloads.
- Build: Vite + npm/yarn, Overwolf CLI for packaging.
- Backend: NONE for personal build. Add a thin serverless backend only when publishing
  (hold API key, cache patch overlay, proxy emblem assets, optional match-history DB).

## File map

- `docs/design.md` — full system design (compliance, GEP schema, UX, risks, stack).
- `data/counter_kb.json` — enemy hero → counters (counterability graph).
- `data/comp_gap_model.json` — comp function coverage → pick/swap advice.
- `data/macro_reader.json` — live event-stream → coaching reads (nemesis / team-threat / tempo). The "play" layer (D-008).
- `data/ult_combo_table.json` — synergistic ult pairs. **TODO: not written yet.**
- `data/patch_overlay.json` — per-patch hero strength (L2). **TODO: sync from stat API.**
- `data/my_pool.json` — your personal comfort pool (the heroes you play). NOT a KB — the `npm run coach` CLI loads it as the default pool; empty/missing → all-heroes mode. Hand-edited.

> Planning state lives in `PLAN.md` (phases, contracts, open questions) and `docs/decision-log.md`
> (D-001…D-010). Read those before building. **Engine optimization is a constrained objective +
> exhaustive search, NOT greedy set-cover** (D-009) — the "set-cover" language below predates that.

## Architecture (4 layers)

`static KB × patch overlay × live GEP roster × user comfort pool → engine → overlay + post-game review`

Mechanics live in the static KBs (durable). Strength lives in the patch overlay (volatile,
synced per patch). **Never hardcode "hero X is strong"** — that's a patch-overlay fact.

## Engine contract

- Input: enemy comp (`character_name`s), user comp, user comfort pool.
- Output: counter suggestions + comp-gap suggestions (+ ult-combo windows).
- Same weighted set-cover for both: counter mode covers enemy threats; comp-gap mode covers
  comp functions. Prefer a single pick/swap that closes multiple gaps.
- **Never outputs a ban.**

## Build order

1. **Engine skeleton** — TS set-cover consuming the 3 KBs. Run on hand-entered rosters first
   (no Overwolf needed yet). Proves the coaching is actually good before live plumbing.
2. **GEP data spike** — confirm enemy roster + `selected_character` events flow. Test WHEN
   enemy `character_name` populates across draft → round_start → swap (undocumented).
3. **Ult-combo table + HUD combo detection.**
4. **Patch overlay sync** from the stat API.
5. **Live glanceable overlay** — hardest UX, do last.

## Conventions

- Track players by `uid`, never by roster index (index is dynamic 0–11).
- Round every displayed number.
- Names are masked (`*****`) for Diamond 3+ until round start; key logic off `character_name`,
  never identity.

## Open gates (publishing only — irrelevant for a personal build)

- Counter-pick-advice compliance: confirm in writing with Overwolf DevRel.
- Stat API + emblem-asset commercial/redistribution ToS.
- Resolve enemy `character_name` timing in the GEP Simulator.
