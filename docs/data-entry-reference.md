# Data-Entry Reference — strengthening the coaching KBs

> For sessions where the dev (a Marvel Rivals player) feeds game knowledge into the data files.
> The dev is the oracle; the agent encodes faithfully, validates, and pushes back with specifics.

## Files you edit (and what each does)

- `data/registry.json` — **source of truth** for hero keys, roles, aliases, and the closed vocabs.
  Every other file must agree with it.
- `data/counter_kb.json` — who counters each enemy hero, via which **mechanism**. Core of the engine.
- `data/comp_gap_model.json` — each hero's comp **functions**; archetype triggers + anti-meta reads.
- `data/weights.json` — the durable **scoring** mapping (counterability→weight, conditional
  resolution, objective). **Threat WEIGHTS live here, NOT in counter_kb.** A "this hero scores too
  high/low" symptom is usually a weights/logic issue, not a KB-content issue — locate the source first.

## The two CLOSED vocabularies (use these exact tokens; adding one is a deliberate, logged decision)

**Mechanism vocab (24)** — counter_kb `countered_by[].mechanism` + `provides_mechanisms`:
`anti_dive, anti_heal, brawl, burst_range, cc_immune_body, clone_pressure, contest_vertical,
cooldown_force, displacement, flat_damage, grounding, hard_cc, hitscan, kill_through_ult, mark,
mobility_dive, peel, prolonged_hitbox, range_poke, support_deny, survive_onslaught, ult_turnaround,
wall_break, zone_denial`

**Comp-function vocab (10)** — comp_gap_model `hero_functions`:
`frontline_space, sustain_healing, anti_dive_peel, anti_flyer_grounding, burst_pick, range_poke,
dive_flank, zone_wall, anti_heal, ult_denial_defensive`

> The vocab is closed AND lossy: "Hela counters Spider-Man" could be `burst_range` OR `hitscan`.
> The agent must STATE which token it chose and WHY, and surface ambiguous cases instead of guessing.

## counter_kb entry shape

```json
"Wolverine": {
  "role": "Duelist",
  "counterability": "low" | "medium" | "high" | "conditional",
  "notes": "prose (self-directed; no ban language)",
  "countered_by": [ { "hero": "Thing", "mechanism": "cc_immune_body" } ],
  "provides_mechanisms": ["hard_cc"]
}
```

`counterability` drives threat weight (weights.json): low=1.0 (highest), high≈0.35 (lowest),
conditional = resolved at runtime (covered vs uncovered) by whether YOUR pool delivers an answer.

## CANONICAL NAMING (Season 8.5) — official in-game name = key; everything else = alias

Two pending decisions the dev must confirm before encoding (current data and the dev's review disagree):
- **Phoenix vs Jean Grey:** current data keys her **"Jean Grey"** (Phoenix as alias). Dev says
  official name is **Phoenix**. DECIDE before touching her entry; if flipping, rename the key in ALL
  files + swap the alias.
- **Deadpool:** counter_kb splits him into **Deadpool_Tank / Deadpool_DPS / Deadpool_Strat**;
  registry has **one** Deadpool (multi-role, GEP emits one "Deadpool" name — A3/Q-001). DECIDE: one
  multi-role entry vs three keyed variants. The split currently exists for matchup tagging; don't
  "fix" it without resolving this deliberately.

### Vanguards
Captain America (Cap) · Devil Dinosaur (Dino, Devil Dino) · Doctor Strange (Strange, Doc Strange, DS) ·
Emma Frost (Emma) · Groot · Hulk (Bruce, Banner) · Magneto (Mag, Mags) · Peni Parker (Peni, Penny) ·
Rogue · The Thing (Thing) · Thor · Venom · Angela

### Duelists
Black Cat (Cat, BC) · Black Panther (BP, Panther) · Black Widow (Widow, BW) · Blade ·
Cyclops (Cyke, Scott) · Daredevil (DD) · Elsa Bloodstone (Elsa) · Hawkeye (Hawk) · Hela ·
Human Torch (Torch, Johnny) · Iron Fist (Fist, IF) · Iron Man (IM, Tony, Stark) · Magik ·
Mister Fantastic (Mr Fantastic, Reed, Mr F) · Moon Knight (MK, Moonknight) · Namor *(NOT "Neymar")* ·
Phoenix (Jean, Jean Grey, Jean Gray) · Psylocke (Psy, Sai) · Scarlet Witch (Wanda, SW) ·
Spider-Man (Spidey, Spiderman, Spider) · Squirrel Girl (Squirrel, SG) · Star-Lord (Starlord, SL, Quill) ·
Storm (Ororo) · The Punisher (Punisher, Punny, Frank) · Winter Soldier (Bucky, WS) ·
Wolverine (Wolvie, Logan, Wol)

### Strategists
Adam Warlock (Adam, Warlock) · Cloak & Dagger (Cloak and Dagger, C&D, CnD, Cloak) · Gambit (Remy) ·
Invisible Woman (Invis, Sue, IW, Sue Storm) · Jeff the Land Shark (Jeff, Shark) · Loki ·
Luna Snow (Luna) · Mantis · Rocket Raccoon (Rocket, Raccoon) · Ultron · White Fox (Fox, WF, Ami)

### Multi-Role
Deadpool (DP, Wade, Pool) — see the Deadpool decision above.

> Known prior mishearings to NOT alias as real names: "Neymar" (→ Namor), "Gan Gray"/"Gene"
> (→ Jean Grey/Phoenix).

## The known starting issue — Jeff (a WEIGHTS/LOGIC bug, not a KB-content bug)

Jeff is `counterability: conditional`; his answer is `flat_damage`. When the pool can't deliver
flat_damage, the engine resolves him to `conditional_resolution.uncovered_weight = 1.0` in
weights.json — the SAME max tier as Gambit. Dev says Jeff isn't a 1.0 threat. So:
- The fix is almost certainly in **weights.json / engine logic**, NOT Jeff's `countered_by`.
- Underlying rule to add: **sparse/unanswerable data must NOT read as MAX threat.** An *uncovered
  conditional* (or a hero with empty `countered_by`) should resolve to a moderate/neutral weight,
  never the top tier. "Unknown ≠ dangerous."
- Locate the weight source FIRST; state whether it's a data or logic fix BEFORE editing.
