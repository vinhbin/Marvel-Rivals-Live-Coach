/**
 * Phase 0.6 — zod schema for the canonical registry (data/registry.json).
 *
 * The registry sits ABOVE every other KB in the sources-of-truth order (PLAN.md).
 * This schema is loaded FIRST; the closed vocabularies it parses (mechanism_vocab,
 * function_vocab) become the validation set every other KB is checked against.
 *
 * See D-002 (registry-first), D-004 (no ban vocab), D-006 (no ban representable).
 */
import { z } from "zod";

export const RoleSchema = z.enum(["Vanguard", "Duelist", "Strategist"]);
export const CounterabilitySchema = z.enum(["low", "medium", "high", "conditional"]);

/** A registry hero entry: identity + display only — never matchup logic. */
export const RegistryHeroSchema = z
  .object({
    character_id: z.number().int().positive(),
    canonical_key: z.string().min(1),
    display_name: z.string().min(1),
    gep_character_name: z.string().min(1),
    role: RoleSchema,
    aliases: z.array(z.string()),
  })
  .strict();

export const RegistrySchema = z
  .object({
    meta: z.record(z.string(), z.unknown()),
    mechanism_vocab: z.array(z.string().min(1)).min(1),
    mechanism_merge_map: z.record(z.string(), z.string()),
    function_vocab: z.array(z.string().min(1)).min(1),
    roles: z.array(RoleSchema),
    counterability_tiers: z.array(CounterabilitySchema),
    heroes: z.record(z.string(), RegistryHeroSchema),
    alias_index: z.record(z.string(), z.string()),
    unresolved_gep_collisions: z.record(z.string(), z.unknown()),
  })
  .strict();

export type Registry = z.infer<typeof RegistrySchema>;
export type RegistryHero = z.infer<typeof RegistryHeroSchema>;

/**
 * Parse the registry and derive the closed sets + helpers the other validators need.
 * Throws (via zod) on any structural problem.
 */
export function loadRegistry(raw: unknown) {
  const registry = RegistrySchema.parse(raw);
  const mechanismVocab = new Set(registry.mechanism_vocab);
  const functionVocab = new Set(registry.function_vocab);
  const heroKeys = new Set(Object.keys(registry.heroes));
  return { registry, mechanismVocab, functionVocab, heroKeys };
}
