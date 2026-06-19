/**
 * Phase 0.6 — zod schema for data/macro_reader.json (4th KB, D-008).
 *
 * macro_reader is mostly prose config (reads, thresholds, templates). The schema asserts
 * the load-bearing structure exists and — compliance-critically — that the documented GEP
 * inputs never include a prohibited enemy field. The framing constraint (kill tally = internal
 * trigger only, self-directed coaching) is enforced by design/tests downstream, not parseable
 * here; this schema just guards the input surface.
 */
import { z } from "zod";

/** Tokens that must NEVER appear as a consumed enemy field (D-007 never-derive discipline). */
export const PROHIBITED_ENEMY_FIELDS = [
  "enemy_ult_charge",
  "enemy_damage",
  "enemy_healing",
  "enemy_ult",
];

export const MacroReaderSchema = z
  .object({
    meta: z.record(z.string(), z.unknown()),
    BUILD_GATING_UNKNOWN: z.record(z.string(), z.unknown()),
    inputs_from_gep: z.record(z.string(), z.string()),
    fight_segmentation: z.record(z.string(), z.unknown()),
    reads: z.record(z.string(), z.unknown()),
    output_modes: z.record(z.string(), z.unknown()),
    thresholds_note: z.string(),
    caveats: z.array(z.string()),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Compliance guard: the documented GEP inputs must not name a prohibited enemy field.
    const inputsBlob = JSON.stringify(data.inputs_from_gep).toLowerCase();
    for (const bad of PROHIBITED_ENEMY_FIELDS) {
      if (inputsBlob.includes(bad)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `macro_reader inputs_from_gep names a prohibited enemy field: ${bad} (D-007)`,
          path: ["inputs_from_gep"],
        });
      }
    }
  });
