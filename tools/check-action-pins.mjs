// Verifies that every `uses: owner/repo[/sub]@ref` pin in the GitHub workflows
// resolves to a commit that exists upstream, and that it is pinned by SHA at all.
//
// Why this exists: two action pins reached master pointing at commits that were
// never in their repositories. The supply-chain check validates that a pin looks
// like a 40-character SHA, not that the SHA exists, so both passed the gate while
// every CodeQL run failed on them. A pin is a supply-chain claim; this is the
// check that the claim is true.
//
// Two kinds of "false" are not the same statement, and conflating them red-flagged
// every pin on every run (issue #205): the commits endpoint answers 422 "No commit
// found for SHA" when a pin really is absent, and 404 "Not Found" when the path is
// malformed or the credential cannot see the repository. Only 422 is a claim about
// a pin. Requests carry no credential on purpose - the workflow token is scoped to
// this repository alone, and sending it turns every foreign lookup into a 404.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultWorkflowDir = join(repoRoot, ".github", "workflows");

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
        // Commits live at the repository, never below a sub-directory, so the
        // display identifier and the lookup target are different strings by design.
        apiTarget: `${owner}/${repo}`,
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

/** Pure: turn one probe response into one of three statements. Never network. */
export function classifyProbe({ status, sha, detail }) {
  const text = SHA.test(String(sha ?? "")) ? String(sha) : "";
  if (status === 200 && text) return { state: "resolved", sha: text, detail: "" };
  if (status === 422) return { state: "absent", detail: detail || "no commit found for this sha" };
  if (status === 404) return { state: "unreadable", detail: detail || "not found - path or visibility, not an absent commit" };
  if (status === 401 || status === 403) return { state: "unreadable", detail: detail || `rejected with ${status}` };
  return { state: "unreadable", detail: detail || `unexpected response (${status ?? "no status"})` };
}

export async function probeCommit(apiTarget, ref, fetchImpl = globalThis.fetch) {
  const url = `https://api.github.com/repos/${apiTarget}/commits/${ref}`;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "unified-ai-system-action-pin-check" },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    return classifyProbe({
      status: response.status,
      sha: body?.sha,
      detail: typeof body?.message === "string" ? body.message : "",
    });
  } catch (error) {
    return classifyProbe({ status: null, sha: "", detail: `request failed: ${error?.name ?? "error"} ${error?.message ?? ""}`.trim() });
  }
}

function readWorkflows(dir) {
  const workflows = {};
  for (const file of readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort()) {
    workflows[file] = readFileSync(join(dir, file), "utf8");
  }
  return workflows;
}

/** One pass over a workflow directory. Returns the verdicts; prints and exits nowhere. */
export async function runGuard({ workflowDir = defaultWorkflowDir, offline = false, fetchImpl = globalThis.fetch } = {}) {
  const pins = extractActionPins(readWorkflows(workflowDir));
  const unpinned = pins.filter((pin) => !pin.shaPinned);
  const failures = [];
  const unreadable = [];
  if (!offline) {
    for (const pin of pins) {
      if (!pin.shaPinned) {
        failures.push({ ...pin, problem: `pinned by ${pin.ref} instead of a commit SHA` });
        continue;
      }
      const outcome = await probeCommit(pin.apiTarget, pin.ref, fetchImpl);
      if (outcome.state === "absent") failures.push({ ...pin, problem: `no such commit upstream (${outcome.detail})` });
      if (outcome.state === "unreadable") unreadable.push({ ...pin, why: outcome.detail });
    }
  }
  return {
    pins,
    failures,
    unreadable,
    summary: {
      pins: pins.length,
      shaPinned: pins.length - unpinned.length,
      unpinned: unpinned.length,
      verified: !offline,
      evaluated: offline ? 0 : pins.length - unreadable.length,
      unreadable: offline ? 0 : unreadable.length,
      failures: failures.length,
    },
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const offline = process.argv.includes("--offline");
  const { pins, failures, unreadable, summary } = await runGuard({ offline });
  for (const pin of pins) {
    process.stdout.write(`${pin.shaPinned ? "sha " : "ref "} ${pin.action}@${pin.ref}  (${pin.files.join(", ")})\n`);
  }
  for (const failure of failures) {
    process.stderr.write(`${failure.action}@${failure.ref}: ${failure.problem} (${failure.files.join(", ")})\n`);
  }
  for (const probe of unreadable) {
    process.stdout.write(`UNREADABLE ${probe.action}@${probe.ref}: ${probe.why} (${probe.files.join(", ")})\n`);
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (failures.length > 0) {
    process.stderr.write(`${failures.length} action pin(s) cannot be resolved.\n`);
    process.exit(1);
  }
  if (offline) {
    process.stdout.write("--offline: existence not verified\n");
  }
  if (!offline && pins.length > 0 && unreadable.length === pins.length) {
    process.stdout.write("PIN-EXISTENCE-NOT-VERIFIED: every lookup was unreadable, so this step judged nothing.\n");
  }
}
