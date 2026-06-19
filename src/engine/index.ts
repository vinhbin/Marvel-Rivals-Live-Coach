/**
 * Phase 1 — engine public surface.
 *
 * The engine is plain TS over the validated data/ KBs (D-003). It consumes a roster + comfort pool
 * and emits a single `Pick | Swap | Hold` (D-006 — no ban is representable). The constrained
 * objective is scored exhaustively over the pool, NOT greedy set-cover (D-009).
 */
export { recommend, getKb } from "./engine.js";
export type {
  EngineInput,
  EngineResult,
  EngineMode,
  Suggestion,
  Pick,
  Swap,
  Hold,
  WeightedThreat,
  FunctionCoverage,
  ScoreBreakdown,
  EngineNote,
} from "./types.js";
export type { LoadedKb, CanonicalKey, Role } from "./load.js";
