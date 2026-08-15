#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("better-sqlite3/package.json"));
const force = process.argv.includes("--force");

function nativeBindingIsReady() {
  try {
    require("better-sqlite3");
    return true;
  } catch (_error) {
    return false;
  }
}

function commandCandidates() {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  // Pin node-gyp so the install lifecycle never pulls an unvetted latest
  // release from the registry.
  return [
    { command: `pnpm${suffix}`, args: ["dlx", "node-gyp@11.5.0", "rebuild"] },
    { command: `npx${suffix}`, args: ["--yes", "node-gyp@11.5.0", "rebuild"] },
  ];
}

function rebuild() {
  let missingCommand = true;
  for (const candidate of commandCandidates()) {
    const result = spawnSync(candidate.command, candidate.args, {
      cwd: packageRoot,
      stdio: "inherit",
      windowsHide: true,
    });

    if (result.error?.code === "ENOENT") {
      continue;
    }

    missingCommand = false;
    if (result.status === 0) {
      console.log("[forge] better-sqlite3 native rebuild succeeded");
      return 0;
    }
  }

  if (missingCommand) {
    console.error(
      "[forge] Could not rebuild better-sqlite3: install pnpm or npm and ensure it is available on PATH."
    );
  } else {
    console.error(
      "[forge] better-sqlite3 rebuild failed. Node.js 22, Python, and Visual Studio Build Tools are recommended for a local compile."
    );
  }
  return 1;
}

if (!force && nativeBindingIsReady()) {
  console.log("[forge] better-sqlite3 native OK");
  process.exit(0);
}

console.log("[forge] Rebuilding better-sqlite3...");
process.exit(rebuild());
