/**
 * Phase 0.6 — `npm run validate`.
 *
 * The CI-style gate. Loads every KB, validates each against its zod schema (which keys off
 * the registry's closed vocabularies), then runs the CROSS-FILE invariants no single schema
 * can express. Exits non-zero on ANY drift — this is what makes the Phase 0 contract class
 * unrepresentable going forward (PLAN.md 0.6 acceptance).
 *
 * Invariants enforced (with the bug IDs / decisions they defend):
 *   A1  every mechanism token in counter_kb / crosswalk is in the registry vocab    (schemas)
 *   A2  every counter hero resolves to a canonical key                              (schema)
 *   A4  counter_kb.heroes and comp_gap.hero_functions cover the same hero set       (here)
 *  D-004/D-006  NO ban field anywhere in the engine-read runtime path               (here)
 *   0.7 provides_mechanisms is the consistent inverse of countered_by               (here)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { loadRegistry } from "./registry.js";
import { buildCounterKbSchema } from "./counter_kb.js";
import { buildCompGapSchema } from "./comp_gap_model.js";
import { buildCrosswalkSchema } from "./crosswalk.js";
import { WeightsSchema } from "./weights.js";
import { MacroReaderSchema } from "./macro_reader.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = (f: string) => resolve(ROOT, "data", f);
const readJson = (f: string) => JSON.parse(readFileSync(dataPath(f), "utf8"));

const failures: string[] = [];
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};

console.log("Rivals Coach — data-contract validation (Phase 0.6)\n");

// ---- 1. Registry first (the source of truth) -------------------------------
console.log("registry.json");
const registryRaw = readJson("registry.json");
const { registry, mechanismVocab, functionVocab, heroKeys } = loadRegistry(registryRaw);
ok(`registry parsed: ${heroKeys.size} heroes, ${mechanismVocab.size} mechanisms, ${functionVocab.size} functions`);

// merge-map sanity: every merge TARGET is itself a canonical vocab token, and no ALIAS is.
for (const [alias, canon] of Object.entries(registry.mechanism_merge_map)) {
  if (!mechanismVocab.has(canon)) fail(`merge target '${canon}' (from '${alias}') is not in mechanism_vocab`);
  if (mechanismVocab.has(alias)) fail(`merge alias '${alias}' should NOT be in the canonical vocab`);
}
if (failures.length === 0) ok("mechanism_merge_map is consistent (targets canonical, aliases excluded)");

// ---- 2. counter_kb ----------------------------------------------------------
console.log("\ncounter_kb.json");
const counterRaw = readJson("counter_kb.json");
const CounterKb = buildCounterKbSchema({ mechanismVocab, heroKeys });
const counterParsed = CounterKb.safeParse(counterRaw);
if (!counterParsed.success) {
  for (const issue of counterParsed.error.issues) fail(`counter_kb ${issue.path.join(".")}: ${issue.message}`);
} else {
  ok("counter_kb parsed — all mechanisms in vocab (A1), all counter heroes resolve (A2)");
}

// ---- 3. comp_gap_model ------------------------------------------------------
console.log("\ncomp_gap_model.json");
const compRaw = readJson("comp_gap_model.json");
const CompGap = buildCompGapSchema({ functionVocab, heroKeys });
const compParsed = CompGap.safeParse(compRaw);
if (!compParsed.success) {
  for (const issue of compParsed.error.issues) fail(`comp_gap ${issue.path.join(".")}: ${issue.message}`);
} else {
  ok("comp_gap parsed — all function tags in vocab, all hero_functions keys resolve");
}

// ---- 4. crosswalk -----------------------------------------------------------
console.log("\ncrosswalk.json");
const crosswalkRaw = readJson("crosswalk.json");
const Crosswalk = buildCrosswalkSchema({ mechanismVocab, functionVocab });
const crosswalkParsed = Crosswalk.safeParse(crosswalkRaw);
if (!crosswalkParsed.success) {
  for (const issue of crosswalkParsed.error.issues) fail(`crosswalk ${issue.path.join(".")}: ${issue.message}`);
} else {
  ok("crosswalk parsed — total over the mechanism vocab, all targets in function vocab");
}

// ---- 5. weights -------------------------------------------------------------
console.log("\nweights.json");
const weightsParsed = WeightsSchema.safeParse(readJson("weights.json"));
if (!weightsParsed.success) {
  for (const issue of weightsParsed.error.issues) fail(`weights ${issue.path.join(".")}: ${issue.message}`);
} else {
  // every counterability tier in the registry must have a weight
  for (const tier of registry.counterability_tiers) {
    if (!(tier in weightsParsed.data.counterability_weight)) {
      fail(`weights.counterability_weight missing tier '${tier}'`);
    }
  }
  if (failures.length === 0) ok("weights parsed — every counterability tier has a weight");
}

// ---- 6. macro_reader --------------------------------------------------------
console.log("\nmacro_reader.json");
const macroParsed = MacroReaderSchema.safeParse(readJson("macro_reader.json"));
if (!macroParsed.success) {
  for (const issue of macroParsed.error.issues) fail(`macro_reader ${issue.path.join(".")}: ${issue.message}`);
} else {
  ok("macro_reader parsed — no prohibited enemy field in GEP inputs (D-007)");
}

// ---- 7. CROSS-FILE INVARIANTS ----------------------------------------------
console.log("\ncross-file invariants");

// A4 — hero-set parity between counter_kb.heroes and comp_gap.hero_functions.
// Deadpool_* are KNOWN to be absent from hero_functions (A3); they are the documented
// exception, allow-listed here so parity holds for every OTHER hero.
const KNOWN_HERO_FUNCTION_GAPS = new Set(
  Object.keys((counterRaw as any).heroes).filter((k) => k.startsWith("Deadpool_")),
);
const counterHeroSet = new Set(Object.keys((counterRaw as any).heroes));
const compHeroSet = new Set(
  Object.keys((compRaw as any).hero_functions).filter((k) => k !== "comment"),
);
const missingFromComp = [...counterHeroSet].filter(
  (h) => !compHeroSet.has(h) && !KNOWN_HERO_FUNCTION_GAPS.has(h),
);
const missingFromCounter = [...compHeroSet].filter((h) => !counterHeroSet.has(h));
if (missingFromComp.length) {
  fail(`A4: ${missingFromComp.length} heroes in counter_kb but missing hero_functions: ${missingFromComp.join(", ")}`);
} else {
  ok(`A4: hero-set parity holds (${KNOWN_HERO_FUNCTION_GAPS.size} allow-listed Deadpool split entries excepted)`);
}
if (missingFromCounter.length) {
  fail(`A4: heroes in hero_functions but missing from counter_kb: ${missingFromCounter.join(", ")}`);
}

// D-004 / D-006 — NO ban field anywhere in the engine-read runtime path.
// The runtime path is everything EXCEPT the quarantined _archival_do_not_use block.
const runtimePath = {
  meta: (counterRaw as any).meta,
  mechanism_vocab: (counterRaw as any).mechanism_vocab,
  answer_heroes: (counterRaw as any).answer_heroes,
  heroes: (counterRaw as any).heroes,
};
const runtimeBlob = JSON.stringify(runtimePath);
const banFieldHits = runtimeBlob.match(/"ban_[a-z_]+"\s*:/gi) || [];
if (banFieldHits.length) {
  fail(`D-004/D-006: ban FIELD in runtime path: ${[...new Set(banFieldHits)].join(", ")}`);
} else {
  ok("D-004/D-006: zero ban fields in the engine-read runtime path");
}
// also: no ban-value PROSE leaked back into hero notes.
const notesWithBan = Object.entries((counterRaw as any).heroes)
  .filter(([, v]: [string, any]) => typeof v.notes === "string" && /\bban\b/i.test(v.notes))
  .map(([k]) => k);
if (notesWithBan.length) {
  fail(`D-004: ban-value prose remains in notes of: ${notesWithBan.join(", ")}`);
} else {
  ok("D-004: no ban-value prose in any hero notes");
}

// 0.7 — provides_mechanisms is the consistent inverse of countered_by.
// For every (enemy <- counterHero via M) edge, counterHero.provides_mechanisms must include M.
const heroesObj = (counterRaw as any).heroes as Record<string, any>;
let inverseGaps = 0;
for (const enemyHero of Object.values(heroesObj)) {
  for (const edge of enemyHero.countered_by ?? []) {
    const provider = heroesObj[edge.hero];
    if (provider && !provider.provides_mechanisms?.includes(edge.mechanism)) {
      inverseGaps++;
    }
  }
}
if (inverseGaps) {
  fail(`0.7: ${inverseGaps} countered_by edges not reflected in the provider's provides_mechanisms`);
} else {
  ok("0.7: provides_mechanisms is the consistent inverse of countered_by");
}

// ---- Result ----------------------------------------------------------------
console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} contract violation(s).`);
  process.exit(1);
}
console.log("PASSED — all data contracts hold.");
