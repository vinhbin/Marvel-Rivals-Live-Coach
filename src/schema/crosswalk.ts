/**
 * Phase 0.6 — zod schema for data/crosswalk.json (0.3).
 *
 * Every KEY of mechanism_to_function must be a registry mechanism; every VALUE function
 * must be a registry comp-function. Validates the join that lets counter mode and
 * comp-gap mode score on one objective (D-009).
 */
import { z } from "zod";

export function buildCrosswalkSchema(opts: {
  mechanismVocab: Set<string>;
  functionVocab: Set<string>;
}) {
  const mechanism = z.string().refine((m) => opts.mechanismVocab.has(m), {
    message: "crosswalk mechanism key not in registry mechanism_vocab",
  });
  const fn = z.string().refine((f) => opts.functionVocab.has(f), {
    message: "crosswalk maps to a function not in registry function_vocab",
  });

  return z
    .object({
      meta: z.record(z.string(), z.unknown()),
      mechanism_to_function: z.record(mechanism, z.array(fn)),
      unmapped_mechanisms_note: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
      // Every mechanism in the registry vocab must appear as a key (even if it maps to []),
      // so the crosswalk is provably TOTAL over the vocab — nothing silently forgotten.
      for (const m of opts.mechanismVocab) {
        if (!(m in data.mechanism_to_function)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `crosswalk is missing mechanism '${m}' (must map to a function list, possibly [])`,
            path: ["mechanism_to_function", m],
          });
        }
      }
    });
}
