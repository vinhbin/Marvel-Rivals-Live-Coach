/**
 * Scenario viewer — run all hand-built test drafts and print each coach report.
 * Run: `npm run scenarios`  (optionally a substring filter: `npm run scenarios -- dive`)
 *
 * Not a pass/fail test — it's a fast way to eyeball ADVICE QUALITY across many drafts without
 * grinding real games. Edit test/scenarios.ts to add your own.
 */
import { stdout, argv } from "node:process";

import { analyzePostGame } from "../postgame/index.js";
import { formatReport } from "./format.js";
import { SCENARIOS } from "../../test/scenarios.js";

const filter = (argv[2] ?? "").toLowerCase();
const chosen = filter
  ? SCENARIOS.filter((s) => s.name.toLowerCase().includes(filter))
  : SCENARIOS;

if (chosen.length === 0) {
  stdout.write(`No scenario matches "${filter}". Available:\n`);
  for (const s of SCENARIOS) stdout.write(`  - ${s.name}\n`);
  process.exit(0);
}

let i = 0;
for (const s of chosen) {
  i++;
  stdout.write("\n\n");
  stdout.write(`╔══ SCENARIO ${i}/${chosen.length}: ${s.name} ${"═".repeat(Math.max(0, 40 - s.name.length))}\n`);
  stdout.write(`║ TESTS: ${s.tests}\n`);
  stdout.write(`║ enemy: ${s.input.enemy.join(", ")}\n`);
  stdout.write(`║ team:  ${s.input.team.join(", ")}\n`);
  stdout.write(`║ pool:  ${s.input.comfortPool.join(", ")}   mode: ${s.input.mode ?? "auto"}\n`);
  stdout.write("╚" + "═".repeat(60) + "\n");
  stdout.write(formatReport(analyzePostGame(s.input)) + "\n");
}
stdout.write(`\n\n(${chosen.length} scenario${chosen.length === 1 ? "" : "s"} shown)\n`);
