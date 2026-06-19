/**
 * Phase 0.6 — zod schema for data/counter_kb.json.
 *
 * Enforces the contracts the murder-board / Layer A research found broken:
 *  - A1: every mechanism token is in the registry's closed 24-token vocab (zero unknowns).
 *  - A2: every counter `hero` resolves to a canonical hero key (Gan->Jean Grey resolved).
 *  - D-004/D-006: NO ban field is representable in the runtime path. The quarantined
 *    `_archival_do_not_use` block is the ONLY place ban vocab may live, and the engine
 *    never reads it.
 *
 * The closed vocab + hero-key set are passed in from loadRegistry(); this module builds
 * the schema against them so a token unknown to the registry is a parse error.
 */
import { z } from "zod";
import { RoleSchema, CounterabilitySchema } from "./registry.js";

export function buildCounterKbSchema(opts: {
  mechanismVocab: Set<string>;
  heroKeys: Set<string>;
}) {
  const mechanism = z.string().refine((m) => opts.mechanismVocab.has(m), {
    message: "mechanism token not in registry mechanism_vocab (A1)",
  });
  const heroRef = z.string().refine((h) => opts.heroKeys.has(h), {
    message: "counter hero does not resolve to a canonical registry key (A2)",
  });

  const Edge = z.object({ hero: heroRef, mechanism }).strict();

  const Hero = z
    .object({
      role: RoleSchema,
      counterability: CounterabilitySchema,
      notes: z.string(),
      countered_by: z.array(Edge),
      provides_mechanisms: z.array(mechanism), // 0.7 — same validated vocab
    })
    .strict(); // .strict() => any stray `ban_note`/`ban_value` field is a PARSE ERROR (D-004)

  const AnswerHero = z
    .object({
      answers: z.array(heroRef),
      via: z.array(mechanism),
      note: z.string().optional(),
    })
    .strict();

  return z
    .object({
      meta: z.record(z.string(), z.unknown()),
      mechanism_vocab: z.array(mechanism),
      // answer_heroes carries a freeform `comment` string alongside hero entries.
      answer_heroes: z.record(z.string(), z.union([z.string(), AnswerHero])),
      heroes: z.record(z.string(), Hero),
      // Ban machinery is ONLY allowed here, quarantined, and never read by the engine.
      _archival_do_not_use: z.record(z.string(), z.unknown()).optional(),
    })
    .strict();
}
