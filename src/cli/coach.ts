/**
 * CLI — manual-input coach. Run: `npm run coach`.
 *
 * No Overwolf, no game: you type the enemy comp, your team, and your comfort pool; it runs the real
 * engine + post-game coach and prints the recommendation + full review. Useful for testing advice
 * quality in real drafts (alt-tab + type what you see) before any live wiring exists.
 *
 * Thin I/O shell over the pure helpers (format.ts) and the engine — no logic of its own. Uses the
 * classic readline `line` event (not readline/promises `question()`, which does not read piped
 * stdin reliably — it hangs/rejects at EOF), so it works both interactively AND with piped input.
 */
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { analyzePostGame } from "../postgame/index.js";
import type { EngineInput, EngineMode } from "../engine/index.js";
import { parseNames, formatReport } from "./format.js";

/** The ordered prompts for one matchup; answers are consumed in this order. */
const PROMPTS = [
  "Enemy comp: ",
  "Your team:  ",
  "Your pool:  ",
  "Mode [pick/swap/auto]: ",
  "Another? [Y/n]: ",
] as const;

function runMatchup(answers: string[]): boolean {
  const [enemyLine = "", teamLine = "", poolLine = "", modeLine = "", againLine = ""] = answers;
  const mode = modeLine.trim().toLowerCase();
  const input: EngineInput = {
    enemy: parseNames(enemyLine),
    team: parseNames(teamLine),
    comfortPool: parseNames(poolLine),
    ...(mode === "pick" || mode === "swap" ? { mode: mode as EngineMode } : {}),
  };

  if (input.comfortPool.length === 0) {
    stdout.write("\n(need at least one comfort-pool hero to recommend from)\n\n");
  } else {
    stdout.write("\n" + formatReport(analyzePostGame(input)) + "\n\n");
  }
  return againLine.trim().toLowerCase() !== "n"; // continue unless the user said "n"
}

function main(): void {
  const rl = createInterface({ input: stdin, output: stdout });

  stdout.write("\nRivals Coach — manual input (no game needed). Enter comma-separated hero names.\n");
  stdout.write("Empty line = skip. Ctrl+C to quit. Names use display names or aliases.\n\n");

  let buffer: string[] = [];
  const prompt = (i: number): void => {
    const p = PROMPTS[i];
    if (p) stdout.write(p);
  };
  prompt(0);

  rl.on("line", (line) => {
    buffer.push(line);
    if (buffer.length < PROMPTS.length) {
      prompt(buffer.length); // prompt for the next field
      return;
    }
    const keepGoing = runMatchup(buffer);
    buffer = [];
    if (!keepGoing) {
      rl.close();
      return;
    }
    prompt(0); // next matchup
  });

  // EOF (piped input exhausted, or Ctrl+D): if a partial matchup was entered, run it; then exit.
  rl.on("close", () => {
    if (buffer.length > 0) runMatchup(buffer);
  });
}

main();
