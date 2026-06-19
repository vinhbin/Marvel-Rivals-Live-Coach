# GEP Data Spike — Real-Match Protocol

> **Why this exists:** Phase 3.1's two load-bearing unknowns can only be answered with the game
> running live. The GEP **Simulator confirms schema, not timing** (design §3 correction; council
> research). So the testable code (schema / swap-detection / adapter) is already built and green —
> this doc is the part only YOU can run.
>
> **You are answering two Open Questions:**
> - **Q-001** — *when* does enemy `character_name` first populate (draft → round_start → contact)?
> - **Q-006** — does GEP `kill_feed` attribute the **killer** (not just the victim)?
>
> Run this in a **real ranked or practice match** (Quick Play is fine and lower-stakes — see the
> integrity note in design §1: don't run advisory overlays in sanctioned/tournament play). Paste the
> results tables at the bottom back into the chat and we build the live wiring against confirmed
> reality.

---

## 0. Setup (≈20–30 min, once)

1. Install the **Overwolf client** and enable the Marvel Rivals (game id `24890`) GEP.
2. Clone the GEP reference app: **`overwolf/events-sample-app`**.
   - ⚠️ Do NOT use `JarodWellinghoff/marvel-rivals-tracker` — confirmed wrong stack (no-React
     webpack skeleton), design §9 correction.
3. In the sample app, register for game `24890` and subscribe to the `match_info` feature
   (and `roster` / `game_info` as the sample exposes them).
4. Confirm you can see events printing in the sample app's console/log while in a match.

> This spike does NOT depend on the Q-005 platform decision (native vs ow-electron). The sample app
> is just the cheapest way to observe the raw GEP stream. Our ingestion code (`src/gep/`) is already
> platform-neutral and will consume whatever the eventual listener produces.

---

## 1. What to log (turn on for the whole match)

For **every** `roster_xx` info update, append a line with a timestamp:

```
[hh:mm:ss.mmm] phase=<draft|round_start|in_round|...> uid=<uid> is_teammate=<bool> is_local=<bool>
               character_name=<value or *****> character_id=<value or null>
```

For **every** `match_info` EVENT (`match_start`, `round_start`, `round_end`, `death`, `kill`,
`assist`, `kill_feed`), dump the **entire raw payload** (all keys) with a timestamp. Don't filter —
we need to see exactly which fields are present.

> Compliance reminder while logging: this is a one-time diagnostic dump to answer schema questions.
> The shipped product still consumes ONLY the whitelisted fields (`src/gep/schema.ts` strips the
> rest). Don't build anything that surfaces enemy damage/healing/`ult_charge` — they're either absent
> or deliberately dropped.

---

## 2. Q-001 — enemy `character_name` populate timing

**Goal:** find the EARLIEST phase at which each enemy slot shows a real hero name (not `*****`/empty).
This decides whether live advice can run at **draft** or only **mid-match / post-lock** (the
documented fallback if draft is impossible).

Watch the transition `*****`/empty → real name for each enemy `uid`, and note the phase it happens in:

| Enemy uid | First real name | Phase it appeared | Were names masked (`*****`)? | Notes (Diamond 3+ hide-name?) |
|-----------|-----------------|-------------------|------------------------------|-------------------------------|
| e1 |  |  |  |  |
| e2 |  |  |  |  |
| … |  |  |  |  |

Key things to capture:
- Does ANY enemy `character_name` appear during **draft/ban**, or only at/after **round_start**?
- In a Diamond-3+ lobby (if you can test one), do names stay `*****` until round start as design §0
  predicts? Does the hide-name option change it?
- Does `character_id` populate before/with/after `character_name`?
- On a **swap mid-match**, how fast does the new `character_name` show up (which event drives it)?

> Our `detectSwaps` already treats `*****` → name as a REVEAL (no false swap) and only fires on
> real-name → real-name. Your timing data confirms whether that reveal happens at draft or later.

---

## 3. Q-006 — does `kill_feed` attribute the killer?

**Goal:** determine whether `kill_feed` (or `kill`) payloads identify the KILLER next to the victim.
This gates macro reads #1 (personal nemesis) and #2 (team threat) — see `data/macro_reader.json`
`BUILD_GATING_UNKNOWN`. If killer is absent, read #3 (tempo) still ships (it needs only death
timestamps + `is_alive` + teammate `ult_charge`).

For ~10 kill events, record every field present:

| Event | Victim field(s) present | Killer field(s) present? | Killer = character_name / uid / neither? | uid mappable to roster? |
|-------|-------------------------|--------------------------|------------------------------------------|-------------------------|
| kill_feed #1 |  |  |  |  |
| kill #1 |  |  |  |  |
| … |  |  |  |  |

Decision you're resolving:
- **Killer present as `character_name`** → reads #1/#2 buildable directly.
- **Killer present only as a `uid`** → buildable IF that uid maps to a roster entry (record whether it does).
- **Killer absent (victim only)** → reads #1/#2 are NOT buildable as designed; we ship tempo (#3)
  only and log the cut.

---

## 4. After the spike

Paste the two tables + any surprises back into the chat. We then:
1. Mark **Q-001** and **Q-006** resolved in PLAN.md (with the answers).
2. Finalize **3.2** — wire `detectSwaps` output into a re-run of the engine on the live roster.
3. Decide draft-time vs mid-match-only live advice (Q-001 outcome).
4. Scope macro reads #1/#2 vs tempo-only (Q-006 outcome).
5. Settle **Q-005** (platform) before writing the platform-specific listener shim.
```
