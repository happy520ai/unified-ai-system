#!/usr/bin/env node

// Permanent invariant gate for VISION.md's "The Principle of Simplicity"
// section. The section codifies the repository's simplicity philosophy
// (I Ching three meanings: change, invariance, simplicity) and may only be
// modified by an explicit owner decision. This guard makes silent removal or
// rewording fail `pnpm check`, so the invariant survives refactors and
// subtraction campaigns without relying on memory.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VISION_PATH = "VISION.md";

const ISSUE_SOURCE = "vision-invariants-check";

// Each fragment must appear verbatim (single-line strings only, so CRLF/LF
// differences cannot cause false failures).
const REQUIRED_FRAGMENTS = [
  {
    id: "section-heading",
    fragment: "## The Principle of Simplicity",
    description: "section heading present",
  },
  {
    id: "permanent-invariant-declaration",
    fragment: "**Permanent invariant.**",
    description: "permanent invariant declaration present",
  },
  {
    id: "owner-only-amendment",
    fragment: "repository owner, recorded in the changelog",
    description: "owner-only amendment rule present",
  },
  {
    id: "gate-reference",
    fragment: "pnpm check:vision-invariants",
    description: "gate command referenced",
  },
  {
    id: "change-meaning",
    fragment: "**Change (变易).**",
    description: "change (变易) meaning present",
  },
  {
    id: "invariance-meaning",
    fragment: "**Invariance (不易).**",
    description: "invariance (不易) meaning present",
  },
  {
    id: "simplicity-meaning",
    fragment: "**Simplicity (简易).**",
    description: "simplicity (简易) meaning present",
  },
  {
    id: "xici-quote",
    fragment: "易则易知，简则易从",
    description: "Xici source quote present",
  },
  {
    id: "great-way-simple",
    fragment: "大道至简",
    description: "founding phrase present",
  },
  {
    id: "capability-boundary",
    fragment: "reducing complexity, never removing capability",
    description: "simplicity boundary rule present",
  },
  {
    id: "converge-first",
    fragment: "converge before",
    description: "converge-before-extend rule present",
  },
  {
    id: "chinese-section",
    fragment: "### 设计哲学：三易",
    description: "Chinese counterpart section present",
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    outputJson: args.includes("--json"),
  };
}

function readVisionText() {
  const raw = readFileSync(resolve(repoRoot, VISION_PATH), "utf8");
  return raw.replace(/\r\n/g, "\n");
}

function main() {
  const { outputJson } = parseArgs();
  const visionText = readVisionText();

  const missing = [];
  const issueCodes = [];
  for (const requirement of REQUIRED_FRAGMENTS) {
    if (!visionText.includes(requirement.fragment)) {
      missing.push(requirement.id);
      issueCodes.push({
        code: `vision-invariant-missing:${requirement.id}`,
        severity: "high",
        message: `VISION.md is missing required invariant fragment (${requirement.description}); permanent invariants may change only by explicit owner decision`,
        artifactPath: VISION_PATH,
        source: ISSUE_SOURCE,
      });
    }
  }

  const result = {
    ok: missing.length === 0,
    source: ISSUE_SOURCE,
    visionPath: VISION_PATH,
    checkedFragments: REQUIRED_FRAGMENTS.map((item) => item.id),
    missingFragments: missing,
    issueCodes,
    issueCodeSummary: {
      total: issueCodes.length,
      high: issueCodes.length,
      medium: 0,
      low: 0,
      info: 0,
      unknown: 0,
      blocking: issueCodes.length > 0,
    },
  };

  if (outputJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const lines = [
      `Vision invariants check: ${result.ok ? "PASS" : "FAIL"}`,
      `Fragments checked: ${REQUIRED_FRAGMENTS.length}`,
    ];
    if (missing.length > 0) {
      lines.push(`Missing fragments: ${missing.join(", ")}`);
      lines.push(
        "The Principle of Simplicity section in VISION.md is a permanent invariant.",
      );
      lines.push(
        "It may be changed only by an explicit decision of the repository owner, recorded in the changelog.",
      );
    }
    process.stdout.write(`${lines.join("\n")}\n`);
  }

  process.exitCode = result.ok ? 0 : 1;
}

main();
