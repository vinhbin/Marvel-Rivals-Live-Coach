/**
 * Phase 0.6 — zod schema for data/comp_gap_model.json.
 *
 * Every function tag (in comp_functions, hero_functions, playstyle_modifiers) must be in
 * the registry's closed function_vocab. Hero keys in hero_functions must resolve to the
 * registry. (A4 hero-set parity is asserted cross-file in validate.ts, not here.)
 */
import { z } from "zod";

export function buildCompGapSchema(opts: {
  functionVocab: Set<string>;
  heroKeys: Set<string>;
}) {
  const fn = z.string().refine((f) => opts.functionVocab.has(f), {
    message: "function tag not in registry function_vocab",
  });
  const heroRef = z.string().refine((h) => opts.heroKeys.has(h), {
    message: "hero_functions key does not resolve to a canonical registry key",
  });

  const CompFunction = z
    .object({
      label: z.string(),
      ideal_providers: z.number().int().min(0),
      why: z.string(),
    })
    .strict();

  const PlaystyleModifier = z
    .object({
      trigger: z.string(),
      raise: z.array(fn).optional(),
      lower: z.array(fn).optional(),
      note: z.string().optional(),
      // Self-directed anti-meta read shown when the ENEMY matches this archetype (D-008).
      counter_read: z.string().optional(),
    })
    .strict();

  return z
    .object({
      meta: z.record(z.string(), z.unknown()),
      comp_functions: z.record(fn, CompFunction),
      hero_functions: z.record(z.string(), z.union([z.string(), z.array(fn)])),
      playstyle_modifiers: z.record(z.string(), z.union([z.string(), PlaystyleModifier])),
      gap_rules: z.record(z.string(), z.unknown()),
      recommendation_logic: z.record(z.string(), z.unknown()),
    })
    .strict()
    .superRefine((data, ctx) => {
      // hero_functions keys (excluding the freeform `comment`) must resolve to registry heroes.
      for (const key of Object.keys(data.hero_functions)) {
        if (key === "comment") continue;
        if (!opts.heroKeys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `hero_functions['${key}'] is not a canonical registry hero key`,
            path: ["hero_functions", key],
          });
        }
      }
    });
}
