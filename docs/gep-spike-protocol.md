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

## 0. Setup (≈20–30 min, once) — VERIFIED on this machine 2026-06-19

> ⛔ **PREREQUISITE — developer-account whitelist (do this FIRST; it has a human-approval delay).**
> Loading an unpacked app requires your Overwolf account to be **whitelisted as a developer**. Being
> signed in is necessary but NOT sufficient — until the whitelist clears, **Load-unpacked rejects the
> folder as "unauthorized"** (this is an account gate, not a problem with your build).
> - **How:** email **developers@overwolf.com** describing what you're building (a GEP data spike vs
>   Marvel Rivals `24890`). The whitelist must land on the **exact account you log into the client
>   with**. There is no dev-mode toggle that bypasses this.
> - **NOT the console.** `console.overwolf.com` is a SEPARATE, LATER thing: console access is granted
>   only **after** you submit an app and it passes Overwolf QA. You cannot use the console to unblock
>   unpacked loading — don't go down that path expecting it to whitelist you.
> - Everything below (build, dist/, edits) is already done and stays valid; the moment the whitelist
>   clears you Load-unpacked the same `dist/` and go straight to the Practice match — no rebuild.

1. Install the **Overwolf client**; launch Marvel Rivals once so Overwolf detects game `24890`.
2. Clone the GEP reference app: **`overwolf/events-sample-app`**.
   - ⚠️ Do NOT use `JarodWellinghoff/marvel-rivals-tracker` — confirmed wrong stack (no-React
     webpack skeleton), design §9 correction.

3. **Register game `24890` — the sample app is CONFIG-DRIVEN, there is NO "pick the game" UI.**
   On game launch, the app's `GameDetectionService` reads the running game's `classId` and
   `IndexController.onGameStart` looks it up in `gameData`. **If `24890` is not a key there, launching
   Marvel Rivals silently does nothing** (no window, no events). Two edits register it:
   - `src/.../game-data.ts` — add a `24890` entry with
     `interestedInFeatures: ['game_info', 'match_info', 'kill', 'death', 'assist']`.
     `match_info` is what drives the `setRequiredFeatures` call (and carries the roster + most events).
     > NOTE: `kill_feed` is deliberately NOT in this list yet — see §3. Verify whether it arrives
     > with this set first; only add `'kill_feed'` if it doesn't.
   - `manifest.json` — add `24890` to `game_targeting.game_ids`, `game_events`, and `launch_events`.

   > ✅ **APPLIED & BUILT 2026-06-19** (in `c:\Users\Binep\events-sample-app`): both edits are done.
   > `yarn install` clean, `yarn build` succeeded (0 errors; only benign mode/bundle-size warnings),
   > and `dist/manifest.json` was confirmed to contain `24890` in all three arrays. The `dist/` folder
   > is ready to Load-unpacked. Remaining work here is purely the live in-game observation below —
   > you do NOT need to re-do this registration step.

4. **Build + load the built output (NOT the repo root):**
   ```
   corepack enable            # activates the pinned yarn (1.22.x)
   yarn install
   yarn build                 # produces dist/ with manifest + window controllers
   ```
   Overwolf client → Settings → About → Development options → **Load unpacked** →
   select **`<events-sample-app>\dist`**. (`yarn start` watch-mode also works; load the same `dist/`.)

5. Launch Marvel Rivals → **Practice / vs-AI** match (data spike only — don't run advisory overlays
   in ranked/sanctioned play, design §1). The in-game window's dev tools (`open_dev_tools: true`)
   stream `match_info` / events into the console. Confirm events print before relying on the spike.

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

> **Hypothesis to confirm (not assume).** Overwolf's official Marvel Rivals GEP page lists `kill_feed`
> as carrying **`attacker` and `victim`** — so Q-006 is *likely YES*. Your job is to CONFIRM it, not
> take the doc's word: does an attacker/killer field actually appear, is it a hero name (or a mappable
> uid), and is it present on EVERY kill? Schema docs describe shape, never live reliability.

**Step 0 — does `kill_feed` even arrive?** Your feature set is
`['game_info','match_info','kill','death','assist']` — note `kill_feed` is NOT explicitly in it. It
may ride on `match_info` or alongside the `kill` event. **First confirm whether any `kill_feed`
payload prints at all.** If NONE appears after several kills, add `'kill_feed'` to
`interestedInFeatures` in `game-data.ts`, rebuild, reload, and try again. Only then start recording.

For ~10 kill events, dump the full raw payload to the console and record every field (read the event
OBJECT, not the in-game visual feed):

| Event | Victim field(s) present | Attacker/killer field present? | Attacker = character_name / uid / neither? | uid mappable to roster? |
|-------|-------------------------|--------------------------------|--------------------------------------------|-------------------------|
| kill_feed #1 |  |  |  |  |
| kill #1 |  |  |  |  |
| … |  |  |  |  |

### What to record as the VERIFIED claim

Don't write "yes/no" — write the specific, falsifiable finding, one of these four:

1. **CONFIRMED-NAME** — "`kill_feed` arrives; `attacker` is present on all N kills and is a hero
   `character_name`." → Q-006 = YES. Reads #1/#2 buildable directly.
2. **CONFIRMED-UID** — "`attacker` present on all N kills as a `uid`; that uid IS/IS NOT found in the
   concurrent `roster_xx`." → YES *iff* it maps (record which). If it maps, #1/#2 buildable via the
   uid→roster join.
3. **PARTIAL** — "`attacker` present on only M of N kills" (e.g. missing on environmental/assist
   kills). → record the gap; #1/#2 buildable but lossy — note the loss.
4. **ABSENT** — "no attacker/killer field on any kill; victim only (even after adding `kill_feed`)."
   → Q-006 = NO. Cut #1/#2; ship tempo (#3) only and log the cut.

Include in the claim: the exact field NAME (`attacker`? `killer`? something else), its TYPE
(string/number/object), N (how many kills observed), and whether it appeared on the `kill` event,
the `kill_feed` event, or both. That precision is what lets us build the uid→roster join correctly
without re-running the spike.

---

## 4. After the spike

Paste the two tables + any surprises back into the chat. We then:
1. Mark **Q-001** and **Q-006** resolved in PLAN.md (with the answers).
2. Finalize **3.2** — wire `detectSwaps` output into a re-run of the engine on the live roster.
3. Decide draft-time vs mid-match-only live advice (Q-001 outcome).
4. Scope macro reads #1/#2 vs tempo-only (Q-006 outcome).
5. Settle **Q-005** (platform) before writing the platform-specific listener shim.
```
