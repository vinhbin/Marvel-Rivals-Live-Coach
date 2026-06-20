/**
 * CLI — pure parse + render helpers for the manual-input coach.
 *
 * No I/O, no Overwolf, no engine logic — just turns user input into names and a PostGameReport into
 * the plain text the CLI prints. Kept pure so it's unit-testable; the stdin shell (coach.ts) is the
 * only impure part.
 *
 * Display discipline (Conventions): every number is rounded; output is self-directed coaching — it
 * never prints an enemy scoreboard or a ban (inherited from the engine/report, which can't represent
 * one).
 */
import type { Suggestion } from "../engine/index.js";
import type { PostGameReport } from "../postgame/index.js";

/** Split a comma-separated roster line into trimmed, non-empty names. */
export function parseNames(line: string): string[] {
  return line
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** One-line headline: the engine's primary call. */
export function formatHeadline(s: Suggestion): string {
  if (s.kind === "hold") {
    return `HOLD — ${s.reason}`;
  }
  const conf = `${Math.round(s.confidence * 100)}%`;
  if (s.kind === "swap") {
    return `SWAP ${s.replaces} → ${s.hero}  (${conf})  ${s.rationale}`;
  }
  return `PICK ${s.hero}  (${conf})  ${s.rationale}`;
}

/** The full post-game review as plain text. */
export function formatReport(report: PostGameReport): string {
  const L: string[] = [];
  const { meta } = report;

  L.push("══════════════════════════════════════════════════════════");
  L.push(` RECOMMENDATION: ${formatHeadline(report.headline)}`);
  L.push("══════════════════════════════════════════════════════════");
  L.push(`mode: ${meta.mode}   archetype: ${meta.archetype ?? "—"}   team: ${meta.teamSize}   pool: ${meta.poolSize}`);

  // --- matchup table ---
  L.push("");
  L.push("── MATCHUP (each enemy threat: did you have an answer?) ──");
  if (report.matchup.length === 0) {
    L.push("  (no taggable enemy heroes)");
  }
  for (const m of report.matchup) {
    const answered = m.answeredByCurrentComp ? "✓ answered" : "✗ open";
    const could = m.couldHaveAnswered.length
      ? `  from your pool: ${m.couldHaveAnswered.map((c) => c.displayName).join(", ")}`
      : "";
    const cond = m.counterability === "conditional"
      ? ` [conditional:${m.conditionalCovered ? "covered" : "uncovered"}]`
      : "";
    L.push(`  ${m.displayName.padEnd(18)} w=${r1(m.weight)} ${m.counterability}${cond}  ${answered}${could}`);
    // full counter list regardless of pool — "heroes you could pick/learn" (self-directed, never a ban)
    if (m.counters.length) {
      L.push(`      all counters: ${m.counters.map((c) => c.displayName).join(", ")}`);
    }
  }

  // --- pool gaps ---
  L.push("");
  L.push("── POOL GAPS (threats NOTHING you own answers — what to add) ──");
  if (report.poolGaps.length === 0) {
    L.push("  (none — your pool can answer every tagged threat)");
  }
  for (const g of report.poolGaps) {
    L.push(`  ${g.displayName.padEnd(18)} w=${r1(g.weight)}  needs: ${g.neededMechanisms.join(", ") || "—"}`);
  }

  // --- alternatives ---
  L.push("");
  L.push("── ALTERNATIVES (your full option space, best first) ──");
  if (report.alternatives.length === 0) {
    L.push("  (no legal candidate from your pool)");
  }
  for (const a of report.alternatives) {
    const repl = a.replaces ? ` (out: ${a.replaces})` : "";
    const ans = a.answersThreats.length ? `  answers: ${a.answersThreats.join(", ")}` : "";
    const cl = a.closesFunctions.length ? `  closes: ${a.closesFunctions.join(", ")}` : "";
    L.push(`  ${a.displayName.padEnd(18)}${repl} score=${r1(a.score)}${ans}${cl}`);
  }

  // --- notes (degraded input — never swallowed) ---
  if (report.notes.length) {
    L.push("");
    L.push("── NOTES (degraded / skipped input) ──");
    for (const n of report.notes) L.push(`  [${n.level}] ${n.message}`);
  }

  return L.join("\n");
}
