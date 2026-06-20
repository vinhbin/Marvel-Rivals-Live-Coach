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

/**
 * Prompts for the FIRST matchup, in input order. Your stable inputs (pool, team) come first; the
 * enemy comp — which fills in / changes latest in a real draft — comes last, so you don't wait on it
 * or re-type your own picks. After the first run, the loop only re-asks the enemy comp (your team +
 * pool persist) unless you choose to reset.
 */
const PROMPTS = [
  "Your pool:  ",
  "Your team:  ",
  "Mode [pick/swap/auto]: ",
  "Enemy comp: ",
  "Another? [Y=new enemy / r=reset all / n=quit]: ",
] as const;

interface Stable {
  poolLine: string;
  teamLine: string;
  modeLine: string;
}

/** Run one matchup from the stable inputs + the current enemy line; print the report. */
function runMatchup(stable: Stable, enemyLine: string): void {
  const mode = stable.modeLine.trim().toLowerCase();
  const input: EngineInput = {
    enemy: parseNames(enemyLine),
    team: parseNames(stable.teamLine),
    comfortPool: parseNames(stable.poolLine),
    ...(mode === "pick" || mode === "swap" ? { mode: mode as EngineMode } : {}),
  };

  if (input.comfortPool.length === 0) {
    stdout.write("\n(need at least one comfort-pool hero to recommend from)\n\n");
  } else {
    stdout.write("\n" + formatReport(analyzePostGame(input)) + "\n\n");
  }
}

// Index of the prompts in PROMPTS we still ask on every loop (pool, team, mode, enemy, again).
const POOL = 0, TEAM = 1, MODE = 2, ENEMY = 3, AGAIN = 4;
const ENEMY_ONLY_PROMPT = "New enemy comp (team+pool kept): ";

function main(): void {
  const rl = createInterface({ input: stdin, output: stdout });

  stdout.write("\nRivals Coach — manual input (no game needed). Enter comma-separated hero names.\n");
  stdout.write("Your pool + team are entered once and kept; only the enemy comp is re-asked as it\n");
  stdout.write("fills in. Empty line = skip. Ctrl+C to quit. Names use display names or aliases.\n\n");

  // Two phases: 'full' collects pool/team/mode/enemy/again; 'enemyOnly' collects enemy/again only.
  let phase: "full" | "enemyOnly" = "full";
  let buffer: string[] = [];
  let stable: Stable = { poolLine: "", teamLine: "", modeLine: "" };

  const promptFor = (): void => {
    if (phase === "full") {
      stdout.write(PROMPTS[buffer.length] ?? "");
    } else {
      stdout.write(buffer.length === 0 ? ENEMY_ONLY_PROMPT : (PROMPTS[AGAIN] ?? ""));
    }
  };
  promptFor();

  /** Process a completed buffer: run the matchup, then branch on the trailing "Another?" answer. */
  const finishRound = (): void => {
    let enemyLine: string, againLine: string;
    if (phase === "full") {
      stable = { poolLine: buffer[POOL] ?? "", teamLine: buffer[TEAM] ?? "", modeLine: buffer[MODE] ?? "" };
      enemyLine = buffer[ENEMY] ?? "";
      againLine = buffer[AGAIN] ?? "";
    } else {
      enemyLine = buffer[0] ?? "";
      againLine = buffer[1] ?? "";
    }
    runMatchup(stable, enemyLine);

    const again = againLine.trim().toLowerCase();
    buffer = [];
    if (again === "n") {
      rl.close();
      return;
    }
    phase = again === "r" ? "full" : "enemyOnly"; // 'r' resets pool/team/mode; else keep them
    promptFor();
  };

  const roundLen = (): number => (phase === "full" ? PROMPTS.length : 2); // enemyOnly = enemy + again

  rl.on("line", (line) => {
    buffer.push(line);
    if (buffer.length < roundLen()) {
      promptFor();
      return;
    }
    finishRound();
  });

  // EOF (piped input exhausted / Ctrl+D): run a complete-enough partial, then exit.
  rl.on("close", () => {
    const need = phase === "full" ? ENEMY + 1 : 1; // enough to have an enemy line
    if (buffer.length >= need) {
      if (phase === "full") {
        stable = { poolLine: buffer[POOL] ?? "", teamLine: buffer[TEAM] ?? "", modeLine: buffer[MODE] ?? "" };
        runMatchup(stable, buffer[ENEMY] ?? "");
      } else {
        runMatchup(stable, buffer[0] ?? "");
      }
    }
  });
}

main();
