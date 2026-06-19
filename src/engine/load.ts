/**
 * Phase 1.1 — KB loader + typed lookup tables.
 *
 * Loads the four data KBs, validates each against its Phase 0 zod schema (so the engine can NEVER
 * run on drifted data — the registry is the source of truth, PLAN.md), and derives the fast
 * lookup structures the engine needs. Nothing here inlines a number or a vocab token: weights come
 * from weights.json, vocab from the registry.
 *
 * Name resolution (alias_index) lives here too, including the D-012 rule that a bare ambiguous
 * "Deadpool" does NOT resolve to a single canonical key pre-GEP-spike (A3/Q-001).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { loadRegistry, type Registry } from "../schema/registry.js";
import { buildCounterKbSchema } from "../schema/counter_kb.js";
import { buildCompGapSchema } from "../schema/comp_gap_model.js";
import { buildCrosswalkSchema } from "../schema/crosswalk.js";
import { WeightsSchema, type Weights } from "../schema/weights.js";

export type CanonicalKey = string;
export type MechanismKey = string;
export type CompFunctionKey = string;
export type Role = "Vanguard" | "Duelist" | "Strategist";
export type Counterability = "low" | "medium" | "high" | "conditional";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (f: string): unknown =>
  JSON.parse(readFileSync(resolve(ROOT, "data", f), "utf8"));

/** A single counter edge: `hero` answers the enemy via `mechanism`. */
export interface CounterEdge {
  hero: CanonicalKey;
  mechanism: MechanismKey;
}

/** Everything the engine needs to know about one enemy/hero from counter_kb. */
export interface HeroCounterInfo {
  role: Role;
  counterability: Counterability;
  countered_by: CounterEdge[];
  provides_mechanisms: MechanismKey[];
}

/** The validated, indexed knowledge the engine runs on. */
export interface LoadedKb {
  registry: Registry;
  weights: Weights;

  /** canonical key -> role (from the registry — the authoritative role source). */
  roleOf: Map<CanonicalKey, Role>;
  /** canonical key -> display name (for rationales / UI). */
  displayOf: Map<CanonicalKey, string>;

  /** canonical key -> counter_kb hero record. */
  counter: Map<CanonicalKey, HeroCounterInfo>;
  /** canonical key -> comp functions it meaningfully provides. */
  functionsOf: Map<CanonicalKey, CompFunctionKey[]>;
  /** comp function -> { ideal_providers }. */
  compFunctions: Map<CompFunctionKey, { ideal: number; label: string }>;
  /** mechanism -> comp functions it credits (crosswalk; may be []). */
  mechanismToFunction: Map<MechanismKey, CompFunctionKey[]>;
  /** playstyle archetype defs (trigger parsed into structured form). */
  playstyle: PlaystyleModifier[];

  mechanismVocab: Set<MechanismKey>;
  functionVocab: Set<CompFunctionKey>;
}

export interface PlaystyleModifier {
  name: string;
  /** Parsed trigger: each clause is a (function, op, count); all must hold (AND). */
  triggers: Array<{ fn: CompFunctionKey; op: ">=" | "<"; count: number }>;
  raise: CompFunctionKey[];
  lower: CompFunctionKey[];
  note?: string;
}

/**
 * Parse a playstyle trigger string into structured clauses.
 * Examples seen in comp_gap_model.json:
 *   ">=3 heroes with dive_flank"
 *   ">=2 frontline_space AND >=2 sustain_healing AND <2 dive_flank"
 *   ">=3 range_poke"
 * We extract every `(>=|<) <int> ... <function_token>` clause, joined by AND.
 */
function parseTrigger(
  trigger: string,
  functionVocab: Set<string>,
): PlaystyleModifier["triggers"] {
  const clauses: PlaystyleModifier["triggers"] = [];
  for (const part of trigger.split(/\bAND\b/i)) {
    const m = part.match(/(>=|<)\s*(\d+)/);
    if (!m) continue;
    const op = m[1] as ">=" | "<";
    const count = Number(m[2]);
    // the function token in this clause = the first vocab token that appears in the text
    const fn = [...functionVocab].find((f) => part.includes(f));
    if (fn) clauses.push({ fn, op, count });
  }
  return clauses;
}

/**
 * Load + validate every KB and build the lookup tables.
 * Throws (zod) if any KB has drifted from the registry — the engine refuses to run on bad data.
 */
export function loadKb(): LoadedKb {
  // 1. Registry first (source of truth).
  const registryRaw = readJson("registry.json");
  const { registry, mechanismVocab, functionVocab, heroKeys } = loadRegistry(registryRaw);

  // 2. Validate the rest against the registry-derived vocab.
  const counterRaw = buildCounterKbSchema({ mechanismVocab, heroKeys }).parse(readJson("counter_kb.json"));
  const compRaw = buildCompGapSchema({ functionVocab, heroKeys }).parse(readJson("comp_gap_model.json"));
  const crosswalkRaw = buildCrosswalkSchema({ mechanismVocab, functionVocab }).parse(readJson("crosswalk.json"));
  const weights = WeightsSchema.parse(readJson("weights.json"));

  // 3. Index.
  const roleOf = new Map<CanonicalKey, Role>();
  const displayOf = new Map<CanonicalKey, string>();
  for (const [key, hero] of Object.entries(registry.heroes)) {
    roleOf.set(key, hero.role as Role);
    displayOf.set(key, hero.display_name);
  }

  const counter = new Map<CanonicalKey, HeroCounterInfo>();
  for (const [key, hero] of Object.entries(counterRaw.heroes)) {
    counter.set(key, {
      role: hero.role as Role,
      counterability: hero.counterability as Counterability,
      countered_by: hero.countered_by as CounterEdge[],
      provides_mechanisms: hero.provides_mechanisms as MechanismKey[],
    });
  }

  const functionsOf = new Map<CanonicalKey, CompFunctionKey[]>();
  for (const [key, val] of Object.entries(compRaw.hero_functions)) {
    if (key === "comment") continue;
    if (Array.isArray(val)) functionsOf.set(key, val as CompFunctionKey[]);
  }

  const compFunctions = new Map<CompFunctionKey, { ideal: number; label: string }>();
  for (const [fn, def] of Object.entries(compRaw.comp_functions)) {
    compFunctions.set(fn, { ideal: def.ideal_providers, label: def.label });
  }

  const mechanismToFunction = new Map<MechanismKey, CompFunctionKey[]>();
  for (const [mech, fns] of Object.entries(crosswalkRaw.mechanism_to_function)) {
    mechanismToFunction.set(mech, fns as CompFunctionKey[]);
  }

  const playstyle: PlaystyleModifier[] = [];
  for (const [name, def] of Object.entries(compRaw.playstyle_modifiers)) {
    if (name === "comment" || typeof def === "string") continue;
    playstyle.push({
      name,
      triggers: parseTrigger(def.trigger, functionVocab),
      raise: (def.raise ?? []) as CompFunctionKey[],
      lower: (def.lower ?? []) as CompFunctionKey[],
      note: def.note,
    });
  }

  return {
    registry,
    weights,
    roleOf,
    displayOf,
    counter,
    functionsOf,
    compFunctions,
    mechanismToFunction,
    playstyle,
    mechanismVocab,
    functionVocab,
  };
}

/** Result of resolving one raw roster name. */
export type Resolution =
  | { status: "ok"; key: CanonicalKey }
  | { status: "masked" } // a *****-masked slot (Diamond 3+ pre-round)
  | { status: "ambiguous"; raw: string } // resolves to >1 canonical key (bare "Deadpool", A3)
  | { status: "unknown"; raw: string }; // not in the alias index at all

const MASK = /^\*+$/;

/**
 * Whether a roster name is MASKED (a `*****`/empty slot — Diamond 3+ pre-round, or an early/unseen
 * GEP value). The single source of truth for "masked" across the engine + GEP boundary so the two
 * never drift. A non-masked name is one we can compare/resolve.
 */
export function isMaskedName(raw: string): boolean {
  const t = raw.trim();
  return t === "" || MASK.test(t);
}

/**
 * Resolve a raw roster string (GEP name / alias / canonical key) to a canonical key.
 *
 * D-012: a name whose alias maps to a key that COLLIDES with an unresolved GEP collision
 * (bare "Deadpool" -> 3 role-split keys) is `ambiguous`, NOT silently resolved to one variant.
 * The engine treats ambiguous + unknown + masked uniformly downstream (count toward roster size,
 * skip for tagging) — 1.4 graceful degradation.
 */
export function resolveName(raw: string, kb: LoadedKb): Resolution {
  const trimmed = raw.trim();
  if (isMaskedName(trimmed)) return { status: "masked" };

  // Direct canonical key hit.
  if (kb.roleOf.has(trimmed)) {
    // Even a direct key can be a member of a known GEP collision when given the bare GEP name,
    // but a canonical key (e.g. "Deadpool_DPS") is itself unambiguous — accept it.
    return { status: "ok", key: trimmed };
  }

  const lower = trimmed.toLowerCase();

  // A raw name equal to a known GEP-collision name (case-insensitive) is ambiguous by design.
  const collisions = kb.registry.unresolved_gep_collisions as Record<string, unknown>;
  if (Object.keys(collisions).some((c) => c.toLowerCase() === lower)) {
    return { status: "ambiguous", raw: trimmed };
  }

  const canon = (kb.registry.alias_index as Record<string, string>)[lower];
  if (canon && kb.roleOf.has(canon)) return { status: "ok", key: canon };

  return { status: "unknown", raw: trimmed };
}
