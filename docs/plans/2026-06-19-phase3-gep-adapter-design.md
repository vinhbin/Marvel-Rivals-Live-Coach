# Phase 3 — GEP ingestion (platform-neutral parts) Design

**Date:** 2026-06-19
**Phase:** 3.1 / 3.2 (the testable, platform-NEUTRAL slice — design §3, §7 step 1)
**Status:** designed, building
**Decisions referenced:** D-007 (compliant-by-construction, never derive prohibited facts),
D-010 (platform is an OPEN user decision — Q-005), D-012 (graceful degradation / unresolvable names).

---

## 0. What this is — and explicitly is NOT

Phase 3 is the convergence point where live GEP data first meets the engine. Two hard blockers sit
at this boundary and are **not** resolved here (both confirmed by the user this session):

- **Q-005 (native vs ow-electron) is deferred again.** So we build ONLY platform-neutral parts —
  nothing that imports a native-Overwolf or ow-electron GEP API. The platform-specific listener is
  a thin later shim that feeds this layer.
- **Q-001 (when enemy `character_name` populates) + Q-006 (`kill_feed` killer attribution) require
  a REAL match.** The GEP Simulator confirms schema, not timing (§3 correction; council research).
  We CANNOT answer them in code. Instead we (a) build everything testable against synthetic/recorded
  payloads, and (b) ship a precise real-match **spike protocol** (`docs/gep-spike-protocol.md`) for
  the user to run.

**In scope (this slice):**
1. GEP roster-payload zod schema — strip-to-whitelist (compliance boundary).
2. Roster diff / swap detection — pure logic over enemy `character_name` sets.
3. GEP → `EngineInput` adapter — the platform-neutral seam.
4. The real-match spike protocol doc.

**Out of scope:** any native/ow-electron API call; live event wiring; the overlay UI (Phase 5);
macro reads (Phase 6).

---

## 1. The compliance boundary IS the schema (D-007)

GEP roster payloads carry fields the engine may NEVER consume — notably `ult_charge` (teammate-only;
consuming it edges toward prohibited ult inference) and whatever future GEP versions add. Decision
(user, this session): **strip to a whitelist.**

- The parser tolerates a loose/extra-field input (so a GEP version bump never crashes ingestion —
  §3 "version gotcha" is real), but its OUTPUT type contains ONLY the whitelisted fields:
  `character_name, character_id, team, is_teammate, uid, is_alive, kills, deaths, assists, is_local`.
- `ult_charge` and every non-whitelisted key are DROPPED at the boundary. The engine literally
  cannot see them — compliance-by-construction, not by-discipline.
- A runtime test asserts no prohibited key survives a parse (fuzz a payload full of junk +
  `ult_charge` + enemy-stat-shaped keys → assert the output object's keys ⊆ whitelist).

> This is the single most important file in Phase 3. Enemy damage/healing are absent from GEP by
> design; `ult_charge` is the one teammate field we explicitly drop so it can't be misused.

---

## 2. Modules

```
raw GEP roster update (unknown)
        │  parseRosterUpdate()         src/gep/schema.ts   (strip-to-whitelist, zod)
        ▼
GepRoster = { players: GepRosterPlayer[] }   (narrow, whitelisted-only)
        │  detectSwaps(prev, next)     src/gep/swaps.ts    (pure diff over enemy character_name)
        ▼  → SwapEvent[]  { side, out, in }
        │
        │  toEngineInput(roster, pool) src/gep/adapter.ts  (split team/enemy, masked handling)
        ▼
EngineInput  → recommend() / analyzePostGame()  (existing, unchanged)
```

### 2.1 `src/gep/schema.ts`
- `GepRosterPlayerSchema` — whitelisted fields only; `ult_charge` etc. stripped. Numbers optional
  (a masked/early payload may omit K/D/A); `character_name` may be `"*****"` or empty (D3+ masking).
- `parseRosterUpdate(raw): GepRoster` — loose-in, narrow-out. Never throws on extra fields; throws
  only on a structurally unusable payload (not an object / players not an array).

### 2.2 `src/gep/swaps.ts`
- `detectSwaps(prev: GepRoster | null, next: GepRoster): SwapEvent[]` — track by `uid` (Conventions:
  never by roster index). For each side, a `uid` whose `character_name` changed between non-masked
  values = a swap. A masked→named transition is a REVEAL, not a swap (no event — it's first
  population, the Q-001 case). Named→masked (rare) is ignored. New/departed `uid`s are
  join/leave, not swaps.
- Output feeds re-running the engine (design §3 "emit swap(old,new,side) into the engine").

### 2.3 `src/gep/adapter.ts`
- `toEngineInput(roster, comfortPool, opts?): EngineInput` — split players by `is_teammate` (NOT by
  `team` string, which is side-relative); enemy = `!is_teammate && !is_local`-adjacent logic per the
  schema; our team = teammates (+ local). Pass raw `character_name`s straight to the engine (it does
  alias resolution + graceful degradation already — D-012). Masked names (`"*****"`/empty) counted
  via the engine's existing masked path; `maskedCount` derived for any side we can only size, not name.
- The adapter does NOT tag, score, or resolve — it only shapes. All hero logic stays in the engine.

---

## 3. Testing (TDD, D-005 discipline)

- **schema:** a realistic GEP payload (incl. `ult_charge` + junk extras) parses; output keys ⊆
  whitelist (compliance invariant — the load-bearing test); masked/missing K-D-A tolerated;
  structurally broken payload throws cleanly.
- **swaps:** named→named on same uid = swap; masked→named = NO swap (reveal); no-change = none;
  join/leave = none; tracked by uid even when roster order shuffles.
- **adapter:** teammates vs enemies split correctly; masked enemies counted not named; the produced
  `EngineInput` round-trips through `recommend()` without throwing; an all-masked enemy still yields
  a usable (Hold-likely) result.
- **fuzz:** random/garbage payloads never crash the pipeline (schema → swaps → adapter → engine).

Wire `test/gep.test.ts` into `npm test`.

---

## 4. The spike protocol (deliverable, not code)

`docs/gep-spike-protocol.md` — a step-by-step the user runs in a REAL ranked/practice match:
- what to install (the `overwolf/events-sample-app` GEP reference, NOT the JarodWellinghoff repo);
- exact `match_info` events + `roster_xx` fields to log, with timestamps;
- **Q-001:** record WHEN each enemy `character_name` first turns from `*****`/empty → a real name,
  across draft → round_start → first-contact; note Diamond-3+ masking behavior.
- **Q-006:** on each `kill_feed` event, log every field; determine whether the KILLER
  (character_name / a mappable uid) is present next to the victim.
- a results table to paste back here → then we build 3.2 swap-into-engine + Phase 6.2 against
  CONFIRMED reality.

---

## 5. After this slice

- User runs the spike → answers Q-001/Q-006 → we finalize live wiring + decide if draft-time advice
  is viable or we narrow to mid-match/post-lock (the documented fallback).
- Q-005 still open: pick platform before writing the platform-specific listener shim.
- README compliance one-liner (last open pre-deliver item #6) — fold in opportunistically.
