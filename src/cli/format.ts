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

/**
 * Decide which comfort pool the engine should use, given (in priority order):
 *   1. a pool typed this session (overrides everything),
 *   2. the saved pool from data/my_pool.json,
 *   3. nothing → fall back to ALL heroes ("best pick from anyone", with a note).
 *
 * Pure (no file I/O): the caller supplies the saved pool and the full hero-key list. Returns the
 * resolved pool plus `usingAllHeroes` so the CLI can show the "no pool set" note. Recommending from
 * all heroes is a CLI default only — the engine contract is unchanged (it always recommends from the
 * pool it is handed); we just choose what pool to hand it.
 */
export function resolvePoolSource(
  typedPool: string[],
  savedPool: string[],
  allHeroKeys: string[],
): { pool: string[]; usingAllHeroes: boolean; source: "typed" | "saved" | "all" } {
  if (typedPool.length > 0) return { pool: typedPool, usingAllHeroes: false, source: "typed" };
  if (savedPool.length > 0) return { pool: savedPool, usingAllHeroes: false, source: "saved" };
  return { pool: allHeroKeys, usingAllHeroes: true, source: "all" };
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

/**
 * The mid-game GLANCE line — the single thing to read during a swap window: the action, why it
 * helps, and the worst enemy threat your CURRENT comp still can't answer. Deliberately one block,
 * placed at the END of the report (where your eyes land last). design §6 "live mode: one line max".
 */
export function formatGlance(report: PostGameReport): string {
  const h = report.headline;

  // ACTION + WHY.
  let action: string;
  if (h.kind === "hold") {
    action = `HOLD — ${h.reason}`;
  } else {
    const verb = h.kind === "swap" ? `SWAP ${h.replaces} → ${h.hero}` : `PICK ${h.hero}`;
    // "why" = the gap it closes and/or the threats it answers, whichever it has (closes reads better).
    const why = h.closesFunctions.length
      ? `closes ${h.closesFunctions.join(", ")}`
      : h.answersThreats.length
        ? `answers ${h.answersThreats.slice(0, 3).join(", ")}`
        : "";
    action = why ? `${verb}  ·  ${why}` : verb;
  }

  // TOP OPEN THREAT — highest-weight enemy still unanswered AFTER you take the recommendation.
  // Must exclude threats the recommended hero answers, or the glance contradicts its own advice
  // ("SWAP to White Fox … but Luna still open" when White Fox is precisely the Luna answer).
  const answeredBySuggestion = new Set(h.kind === "hold" ? [] : h.answersThreats);
  const open = report.matchup
    .filter((m) => !m.answeredByCurrentComp && !answeredBySuggestion.has(m.hero))
    .sort((a, b) => b.weight - a.weight)[0];
  let threatLine = "";
  if (open) {
    const gap = report.poolGaps.find((g) => g.hero === open.hero);
    const needs = gap?.neededMechanisms.length ? ` (needs ${gap.neededMechanisms.join("/")})` : "";
    threatLine = `\n  ⚠ still open: ${open.displayName}${needs}`;
  }

  return `▶ ${action}${threatLine}`;
}

/** The full post-game review as plain text. */
export function formatReport(report: PostGameReport): string {
  const L: string[] = [];
  const { meta } = report;

  L.push("══════════════════════════════════════════════════════════");
  L.push(` RECOMMENDATION: ${formatHeadline(report.headline)}`);
  L.push("══════════════════════════════════════════════════════════");
  L.push(`mode: ${meta.mode}   your archetype: ${meta.archetype ?? "—"}   team: ${meta.teamSize}   pool: ${meta.poolSize}`);

  // --- your comp health (standalone: is YOUR comp even functional?) ---
  const ch = report.compHealth;
  L.push("");
  L.push("── YOUR COMP HEALTH ──");
  const rc = ch.roleCounts;
  const unresolved = ch.unresolved > 0 ? `   (${ch.unresolved} unresolved)` : "";
  L.push(`  roles: ${rc.Vanguard} tank / ${rc.Duelist} DPS / ${rc.Strategist} support${unresolved}`);
  if (ch.shortfalls.length === 0) {
    L.push("  ✓ all core roles covered");
  } else {
    for (const s of ch.shortfalls) {
      const flag = s.critical ? "⚠ CRITICAL" : "·";
      L.push(`  ${flag} ${s.label} (${s.providers}/${s.ideal})`);
    }
  }

  // --- enemy strategy read (inform-only) ---
  if (report.enemyArchetype) {
    L.push("");
    L.push(`── ENEMY STRATEGY: ${report.enemyArchetype} ──`);
    if (report.enemyRead) L.push(`  ${report.enemyRead}`);
  }

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

  // --- mid-game glance (the TL;DR, last so it's where your eyes land during a swap window) ---
  L.push("");
  L.push("══════════════════════════════════════════════════════════");
  L.push(formatGlance(report));
  L.push("══════════════════════════════════════════════════════════");

  return L.join("\n");
}
