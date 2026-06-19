# Marvel Rivals Live Counter-Comp Coach — System Design v0.1

**Vision:** An Overwolf overlay that reads the live enemy roster, detects hero swaps, and
suggests how *you* should draft / swap to counter them — plus a deep post-game review mode.

**Status:** Design draft. Compliance boundary is load-bearing; read that section first.

---

## 0. The compliance boundary (read this before building anything)

The sanctioned data path is the **Overwolf Game Events Provider (GEP)**, which supports
Marvel Rivals (game ID `24890`). This is the *only* safe live-data source — reading game
memory or injecting input is an anti-cheat ban; raw screen OCR is fragile and unnecessary
now that GEP exists.

GEP comes with documented NetEase compliance restrictions. An overlay app **may not**:

1. **Expose other players' confidential stats** (e.g. enemy damage/healing numbers).
2. **Provide selective hero-banning tooling** (i.e. "ban this specific enemy's main").
3. **Predict opponents' ultimate abilities** (e.g. "their Luna ult is up in 3s").

Also: in Competitive at **Diamond 3+**, player names arrive as `*****` until the round
starts, and stay hidden for anyone using the hidden-name option. So enemy *identity* is
unavailable during the ban phase in high lobbies even through the legal API.

> **VERIFIED (council research pass).** 1–3 are confirmed on Overwolf's official Marvel
> Rivals GEP page, which states NetEase's compliance policy prevents giving users confidential
> damage/healing stats, selective hero-ban tooling, and opponent-ultimate prediction. The
> Blitz precedent (NetEase announcement 2025-02-21) cited the *same three feature categories*
> **plus process injection** as why it was "cheating software." Takeaway: the prohibited
> features AND the injection method both got Blitz killed — staying on the non-injecting
> Overwolf GEP retires the method risk; respecting 1–3 retires the feature risk.
>
> **Cleaner mental model — the schema IS the envelope.** The GEP roster payload deliberately
> withholds the prohibited data: you get enemy `character_name`, `team`, K/D/A, alive state —
> but **no enemy damage/healing, and `ult_charge` is teammate-only.** So if you consume *only
> GEP fields*, you are compliant-by-construction on stats (#1) and ult prediction (#3) — the
> data simply isn't handed to you. The *one* line still requiring self-discipline is #2
> (selective ban): `banned_characters` IS exposed, so you could build ban-advice on top — and
> must choose not to. Don't.
>
> **Still genuinely open:** whether passive *counter-pick* advice (what YOU should play, off
> your own pool + allowed state) is blessed. No primary precedent either way. Lower risk than
> ban advice, but confirm with Overwolf DevRel in writing before publishing.

### What this kills, what it keeps

| Feature | Verdict | Why |
|---|---|---|
| Target-ban advisor ("ban their one-trick's main") | **OUT** (sanctioned build) | Prohibition #2 + name masking + hide-name trend |
| Live enemy stat readout (their KDA/dmg this game) | **OUT** | Prohibition #1 |
| "Enemy ult is charging" warnings | **OUT** | Prohibition #3 |
| **Counter-comp coach off visible roster** | **IN** | Roster character names are public on-screen info |
| **Swap detection → re-suggest counter** | **IN** | `selected_character` / roster events are exposed |
| **Post-game review (all public data)** | **IN** | Highest-value, lowest-risk |

The counter KB built earlier is **not wasted** — it powers the IN features. It just gets
repointed from "what to ban" to "what to pick/swap to."

---

## 1. Scope (v1)

**In:**
- Detect enemy roster + swaps live via GEP.
- Score your comp's *coverage gaps* against the enemy comp using the counter graph.
- Surface a glanceable swap/pick suggestion drawn from **your comfort pool only**.
- Post-game review: full matchup breakdown, what you could have countered, drill notes.

**Out (v1, and out entirely for a sanctioned build):**
- Selective ban recommendations.
- Any enemy-specific live stats or ult prediction.
- Auto-anything. Advice only; the human picks/swaps.

**Competitive-integrity note:** real-time external coaching is banned in official/tournament
play. For solo/duo ladder a passive advisory overlay sits in the same grey zone as every
stat tracker. Build it for ladder/practice; don't run it in sanctioned matches.

---

## 2. Architecture — four layers

```
[ L1 Static counter graph ]   durable matchup mechanics (Thing answers dive,
        (counter KB)           grounding answers flyers). Changes slowly.
              |
[ L2 Patch/meta overlay ]      per-patch strength, who's rising/falling, ban frequency.
   (API sync + tier videos)    VOLATILE. Syncs each patch. See §5 for v1 (patch 8.5).
              |
[ L3 Live state (GEP) ]         current enemy roster + swap events. game ID 24890.
              |
[ L4 Your side ]                comfort pool (manual entry or inferred from your history).
              |
         === ENGINE ===  ->  glanceable live suggestion + deep post-game review
```

The key discipline: **mechanics live in L1, strength lives in L2.** Never hardcode "Elsa is
strong" — that's an L2 fact that flips every patch (see §5). L1 says "Elsa is grounding-
answerable and dive-resistant"; that stays true across patches.

---

## 3. Live data layer (Overwolf GEP) — VERIFIED schema

- Game: `24890`. Documented features: `gep_internal`, `match_info`, `game_info`.
- **`match_info` info updates:** `roster_xx`, `match_id`, `game_type`, `game_mode`, `map`,
  `player_stats`, `match_outcome`, `banned_characters`, `ability_cooldown_X`,
  `additional_ability_cd_X`, `objective_progress`, `game_mode_id`, `selected_character`.
- **`match_info` events:** `match_start`, `match_end`, `round_start`, `round_end`, `death`,
  `kill`, `assist`, `kill_feed`.
- **`roster_xx` params (the core of the engine):** `name`, `uid`, `character_name`,
  `character_id`, `team`, `is_teammate`, `kills`, `deaths`, `assists`,
  `ult_charge` *(teammates only)*, `is_alive`, `is_local`, `elo_score`, `is_disconnected`.
- **Enemy roster IS exposed live** — `team` + `is_teammate` cover both sides, index 0–11
  dynamic. The counter-comp premise is therefore buildable as designed. **Track by `uid`.**
- **Compliance is baked into the schema:** enemy `character_name`/K-D-A/alive = available;
  enemy damage/healing = NOT present; `ult_charge` = teammate-only. Consume only these fields
  and you can't accidentally cross prohibitions #1/#3.
- **Version gotcha:** `selected_character` only since GEP **296.0** (swap detection is the
  newest field) — treat older-client coverage as a compatibility hotspot. `banned_characters`
  since 281.0, cooldowns/`objective_progress` since 282.0.
- Names masked for D3+ until round start (hidden-name opt-out persists). **Key off
  `character_name`, never identity** — keeps you compliant *and* immune to name masking.
- **Unverified timing:** exactly when enemy `character_name` first populates across draft →
  round-start → swap → reconnect is NOT documented. Resolve empirically in the GEP Simulator
  before building the live UX — it determines whether you advise during draft or only post-lock.
- Swap detection = diff the enemy side's `character_name` set on each `selected_character` /
  `roster_xx` update; emit `swap(old, new, side)` into the engine.

---

## 4. The engine — counter-comp instead of ban

Same KB, run forward. Given the live enemy roster `E = {e1..e6}` and your comfort pool `P`:

1. **Threat list.** For each `ei`, pull L2 strength. Rank enemy heroes by current-patch
   threat (high-strength, low-counterability heroes float to top — e.g. Dino, Jean, Gambit).
2. **Coverage check.** For each threat `ei`, does your *current* comp already contain a
   counter (from L1 `countered_by`, with the mechanism your comp can actually deliver)? If
   yes, `ei` is covered — drop it.
3. **Gap = uncovered threats.** These are what's hurting you.
4. **Suggestion = weighted set cover.** Find the hero in `P` that covers the most uncovered
   threat weight with the fewest changes (prefer a single swap that answers 2–3 enemies — the
   "answer heroes" like Thing / Peni / Magneto / White Fox / Invis are set-cover winners).
5. **Resolve conditionals at runtime.** KB heroes tagged `conditional` (Moon Knight, Squirrel
   Girl, Spider-Man, Jeff, Wolverine) only count as "covered" if `P` can deliver the required
   mechanism. This is why the comfort pool (L4) is mandatory, not optional.

Output: *"Their Dino + Wolverine are unanswered. Swap [your DPS] → Punisher (poke-from-range
beats both), or [your tank] → Thing (CC-immune body shuts Wolverine)."* — drawn only from `P`.

---

## 5. Patch overlay v1 — patch 8.5 (qualitative seed)

This is L2 data. Replace/augment with API win/ban rates per patch; these are the directional
deltas from the 8.5 tier breakdown. `trend` feeds threat weighting; `counterability_override`
patches the static KB where mechanics shifted.

```json
{
  "patch": "8.5",
  "note": "Qualitative seed from tier-list VOD. Sync numeric win/ban rates from API.",
  "overlay": {
    "Elsa":            { "trend": "up",   "reason": "faster charge levels; top winrate; strongest DPS ult (instant CC)" },
    "Angela":          { "trend": "up2",  "reason": "dash 6s->4s, bigger/faster shield; top tank pick; slots into Cap+Venom dive" },
    "Cloak and Dagger":{ "trend": "up",   "reason": "more AoE heal + heal-wall %, faster ult", "counterability_override": "medium (was high; sustain up but still multi-prong-divable)" },
    "Human Torch":     { "trend": "up",   "reason": "slam CD -5s, 2 dash charges; now a real playmaking pseudo-diver", "counterability_override": "medium (was high; still grounding-answerable but slipperier)" },
    "Rogue":           { "trend": "up2",  "reason": "block longer/absorbs more, dash -2s; now standalone strong without Gambit team-up; one-trickable this patch" },
    "Deadpool_Strat":  { "trend": "up2",  "reason": "'secretly OP'; fastest ult, extendable into ~2 half-ults, overtime monster", "threat_note": "raise ban/threat weight significantly" },
    "Psylocke":        { "trend": "up",   "reason": "untouched; rises as Black Cat falls; consistently dodges the ban list" },
    "Magneto":         { "trend": "up",   "reason": "ult hold 4s->5s, 300->350 no-absorb; stronger ult denial -> better answer hero vs ult-reliant picks" },
    "Gambit":          { "trend": "down",  "reason": "ult nerf BUT still best-in-slot ult + strong neutral; slightly less perma-banned", "counterability_override": "low (unchanged — still high threat)" },
    "White Fox":       { "trend": "down",  "reason": "charm slightly harder; still elite, esp. White Fox + Luna backline" },
    "Jean Grey":       { "trend": "down",  "reason": "harder off-angle; still top-tier, no bad matchups", "counterability_override": "low (unchanged)" },
    "Daredevil":       { "trend": "down_banned_more", "reason": "deflect reduced but burst intact; best-in-slot diver; banned MORE now that he's the only elite diver -> ban frequency UP" },
    "Black Cat":       { "trend": "down2", "reason": "heavily nerfed, may vanish from meta -> drops as threat AND as a counter-hero in the graph" },
    "Star-Lord":       { "trend": "down",  "reason": "small nerf, 'won't affect much'; still strong w/ Gambit combo" },
    "Devil Dinosaur":  { "trend": "flat",  "reason": "slightly weaker, fundamentally same kidnap + HP; 'if you don't have a bag for him, ban him'", "counterability_override": "low (unchanged)" }
  }
}
```

**Engine implication of 8.5:** with Black Cat falling out, dive softens; comps leaning on the
Thing-answers-dive axis get relatively less mandatory, while grounding answers (vs the rising
Human Torch/Angela flyers) and range-poke answers (vs Dino) get *more* important. Daredevil
becoming the lone elite diver means he's the dive threat your coverage check should weight up.

---

## 6. UX — two modes, because you can't read prose mid-fight

**Live mode (during play): glanceable only.**
- One line max: a single recommended swap + the threat it answers.
- Icon row: your comp's 1–2 *uncovered* enemy threats (red), covered ones (dim).
- Fires on `swap` events and at round start. Silent otherwise. No walls of text, ever.
- Depth on demand: hover/TAB expands the reasoning. Default state is near-silent.

**Post-game mode (between rounds / after match): deep coach.**
- Full matchup table: each enemy hero, whether you had an answer, what you could've swapped to.
- "Your comfort pool gaps" — threats this patch your pool can't answer; what to add.
- VOD-style notes. This mode is where the rich reasoning from the ban engine lives now.
- 100% compliant (all public, post-hoc) and arguably the highest-value feature. **Consider
  building this FIRST** — lowest risk, proves the engine, no live-overlay edge cases.

---

## 7. Build sequence

1. **GEP data spike.** Stand up the Overwolf sample app (community MR tracker repo is a good
   base), confirm you receive `roster` + `selected_character` for the enemy side, confirm
   name masking behavior, confirm the compliance restrictions in the primary docs.
2. **Comfort pool input (L4).** Start with manual multi-select; later infer from your own
   match history via the stat API.
3. **Post-game coach (§6 mode 2).** Run the engine on a completed roster. Validate suggestions
   against your own game knowledge + the council (Claude/GPT/Perplexity) before trusting it.
4. **Patch overlay sync (L2).** Wire win/ban rates from rivalsmeta/marvelrivalsapi; seed with §5.
5. **Live glanceable mode (§6 mode 1).** Only after 3–4 feel right. Hardest UX, most edge cases.

---

## 8. Open risks / decisions

- **Compliance — mostly retired, one open item.** §0 prohibitions are verified; the schema
  enforces #1/#3 by construction. The ONE open question is whether passive *counter-pick*
  advice is blessed. Close it by emailing Overwolf DevRel before publishing. Personal/unlisted
  use is low-stakes; a published app needs this answer.
- **Enemy `character_name` timing (build-gating).** Not documented. Test in the GEP Simulator
  first — it decides whether the live coach advises during draft or only after picks lock.
- **Data-layer ToS (publishing-gating).** marvelrivalsapi.com needs an `x-api-key`; rate limits
  and *commercial-use rights* are unconfirmed. tracker.gg API is contact-only. Confirm written
  commercial permission before monetizing; irrelevant for a personal build.
- **Hero-emblem assets (publishing-gating).** Plan: GEP `character_id` -> API hero image URL ->
  render in emblem slot (one-line swap from the placeholder glyph). Mechanism is trivial; the
  open question is whether the API's image assets are licensed for *redistribution* in a
  published app (vs personal use). Read marvelrivalsapi.com terms; if ambiguous, ask Overwolf
  DevRel for the sanctioned asset source. tracker.gg likely self-hosts art under a publisher
  partnership a solo dev can't assume. Non-issue for personal/unlisted; a gate for publishing.
- **Comfort-pool source:** manual multi-select (v1) vs history-inferred (later).
- **Patch cadence:** L2 must re-sync every patch; automate the API pull, tier videos as sanity layer.

### Competitive landscape (verified this pass)

- **DeepRivals** (solo dev, Overwolf) — **the direct competitor.** Self-describes as a
  "decision support system" with "smarter hero switches," live recommendations, and post-game
  analysis. This means **"coach not tracker" is no longer the differentiation — DeepRivals
  already claims it.** BUT: its own store listing carries a user note worrying it may be
  ban-risky, and it's early/solo. Refined wedge → (a) *demonstrably* GEP-only/compliant (a
  trust angle DeepRivals seemingly lacks), and (b) *depth* of reasoning: pool-aware +
  comp-gap set-cover + patch-aware, vs likely-generic "switch to X." **Action: install
  DeepRivals and measure how deep its recommendations actually go before committing.**
- **tracker.gg** — stats/brand/distribution incumbent. Don't compete on data.
- **Counterwatch** — solo, OW+MR, "improve your odds" + swap alerts. Adjacent niche.
- **Cheat swamp (e.g. "ESP Vision")** — injection-based wallhack overlays. Your product must
  visibly distinguish itself from this category (it's why NetEase is twitchy); lead with
  "GEP-only, no injection, no confidential data."

---

## 9. Tech stack

**TypeScript end-to-end.** Day-job is Django/MySQL, but Overwolf is a JS platform — going TS
everywhere means one shared engine + one shared type set across overlay and (eventual) backend.
Don't split the stack.

| Layer | Choice | Notes |
|---|---|---|
| Platform | Overwolf **native** app (game `24890`) | Apps are web apps in Overwolf's client. Electron GEP is rolling out per-game — check MR status before picking; native is confirmed today. |
| Overlay UI | React | Renders the HUD components (§6). Keep light — overlay frame cost matters. |
| Live data | Overwolf GEP API (`overwolf.games.events`) | `roster_xx`, `selected_character`, etc. (§3 schema). |
| Engine | Plain TS set-cover module | Consumes the 3 KB JSONs (bundled). No lib needed. `zod` to validate KB shapes + GEP payloads. |
| Knowledge base | 3 JSONs + patch overlay JSON | counter graph, comp-gap, ult-combo (todo), patch overlay (§5). |
| Stat + asset API | marvelrivalsapi.com (`x-api-key`) | Per-patch win/ban rates (L2) + hero emblem images. |
| Build / tooling | Vite + npm/yarn, Overwolf CLI | Scaffold from the community sample `JarodWellinghoff/marvel-rivals-tracker` (TS-on-GEP). |

**Architectural fork — backend or not (gated on personal vs published):**

- **Personal / unlisted (start here):** NO backend. Engine, KBs, emblem fetches, patch data all
  client-side; API key in local config. Ship only the Overwolf app.
- **Published / monetized (later):** thin TS backend (serverless — Cloudflare Workers / Vercel) to
  (a) hold the API key, (b) cache + serve the patch overlay, (c) proxy emblem assets if licensing
  requires, (d) optional match-history DB (Postgres/Supabase). Add a scheduled function for the
  per-patch sync. This is also where the publishing-gate items in §8 (commercial ToS, asset
  licensing, counter-pick blessing) get resolved.
```
