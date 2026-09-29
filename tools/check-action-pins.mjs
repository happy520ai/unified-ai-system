// Verifies that every `uses: owner/repo[/sub]@ref` pin in the GitHub workflows
// resolves to a commit that exists upstream, and that it is pinned by SHA at all.
//
// Why this exists: two action pins reached master pointing at commits that were
// never in their repositories. The supply-chain check validates that a pin looks
// like a 40-character SHA, not that the SHA exists, so both passed the gate while
// every CodeQL run failed on them. A pin is a supply-chain claim; this is the
// check that the claim is true.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = join(repoRoot, ".github", "workflows");

const SHA = /^[0-9a-f]{40}$/;

/** Pure: collect every action reference from workflow text. No I/O, no network. */
export function extractActionPins(workflows) {
  const found = new Map();
  for (const [file, text] of Object.entries(workflows)) {
    const pattern = /^\s*(?:-\s*)?uses:\s*([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)(?:\/([A-Za-z0-9._-]+))?@([^\s#]+)/gm;
    for (const match of text.matchAll(pattern)) {
      const [, owner, repo, sub, ref] = match;
      const key = `${owner}/${repo}${sub ? `/${sub}` : ""}@${ref}`;
      const entry = found.get(key) ?? {
        action: `${owner}/${repo}${sub ? `/${sub}` : ""}`,
        ref,
        shaPinned: SHA.test(ref),
        files: [],
      };
      entry.files.push(file);
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((a, b) => a.action.localeCompare(b.action) || a.ref.localeCompare(b.ref));
}

function readWorkflows(dir) {
  const workflows = {};
  for (const file of readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort()) {
    workflows[file] = readFileSync(join(dir, file), "utf8");
  }
  return workflows;
}

function commitExists(action, ref) {
  const result = spawnSync("gh", ["api", `repos/${action}/commits/${ref}`, "--jq", ".sha"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 && SHA.test((result.stdout || "").trim());
}

function verify(pins) {
  if (spawnSync("gh", ["--version"], { encoding: "utf8", windowsHide: true }).status !== 0) {
    return { checked: false, reason: "gh is unavailable; pin existence not verified", failures: [] };
  }
  const failures = [];
  for (const pin of pins) {
    if (!pin.shaPinned) {
      failures.push({ ...pin, problem: `pinned by ${pin.shaPinned ? "sha" : `${pin.ref}`} instead of a commit SHA` });
      continue;
    }
    if (!commitExists(pin.action, pin.ref)) {
      failures.push({ ...pin, problem: "no such commit upstream" });
    }
  }
  return { checked: true, failures };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const offline = process.argv.includes("--offline");
  const pins = extractActionPins(readWorkflows(workflowDir));
  const unpinned = pins.filter((pin) => !pin.shaPinned);
  const outcome = offline
    ? { checked: false, reason: "--offline: existence not verified", failures: [] }
    : verify(pins);
  for (const pin of pins) {
    process.stdout.write(`${pin.shaPinned ? "sha " : "ref "} ${pin.action}@${pin.ref}  (${pin.files.join(", ")})\n`);
  }
  for (const failure of outcome.failures) {
    process.stderr.write(`${failure.action}@${failure.ref}: ${failure.problem} (${failure.files.join(", ")})\n`);
  }
  const summary = {
    pins: pins.length,
    shaPinned: pins.length - unpinned.length,
    unpinned: unpinned.length,
    verified: outcome.checked,
    failures: outcome.failures.length,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (outcome.failures.length > 0) {
    process.stderr.write(`${outcome.failures.length} action pin(s) cannot be resolved.\n`);
    process.exit(1);
  }
  if (!outcome.checked) {
    process.stdout.write(`${outcome.reason}\n`);
  }
}
