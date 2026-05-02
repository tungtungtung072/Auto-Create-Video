// One-off script: re-render the existing composition without re-running TTS.
// Uses already-generated per-scene voice files in <outputDir>/voice/.
//
// Usage: npx tsx rerender.ts <outputDir>
//
// The actual logic lives in `src/rerender-lib.ts` so the server can call it
// programmatically. This file is just the CLI shim.

import { runRerender } from "./src/rerender-lib.js";

async function main() {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("Usage: npx tsx rerender.ts <outputDir>");
    process.exit(2);
  }
  try {
    await runRerender(outputDir);
  } catch (e) {
    console.error("Re-render failed:", e);
    process.exit(1);
  }
}

void main();
