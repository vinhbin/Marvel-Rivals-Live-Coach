/**
 * Phase 0.6 — zod schema for data/weights.json (0.4).
 *
 * Validates that every numeric constant the engine will import is present and well-typed,
 * keyed off the registry's counterability tiers. 'No magic numbers in engine code' — if a
 * weight is missing here, validation fails before the engine can inline one.
 */
import { z } from "zod";

const num = z.number();

export const WeightsSchema = z
  .object({
    meta: z.record(z.string(), z.unknown()),
    counterability_weight: z
      .object({ low: num, medium: num, high: num, conditional: num })
      .catchall(z.unknown()),
    conditional_resolution: z.object({ covered_weight: num, uncovered_weight: num }).catchall(
      z.unknown(),
    ),
    patch_trend_multiplier: z
      .object({
        strong_up: num,
        up: num,
        neutral: num,
        down: num,
        strong_down: num,
        clamp: z.object({ min: num, max: num }),
      })
      .catchall(z.unknown()),
    playstyle_delta: z.object({ raise: num, lower: num }).catchall(z.unknown()),
    function_gap_weight: z.record(z.string(), z.unknown()),
    objective_penalties: z
      .object({
        introduced_vulnerability: num,
        clash_penalty: num,
        redundancy_penalty: num,
      })
      .catchall(z.unknown()),
    threat_weight_formula: z.record(z.string(), z.unknown()),
    objective_formula: z.record(z.string(), z.unknown()),
  })
  .strict();

export type Weights = z.infer<typeof WeightsSchema>;
