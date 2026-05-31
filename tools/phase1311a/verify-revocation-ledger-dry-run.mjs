import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1311A";
const phaseKey = "phase1311a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1311a-revocation-ledger-dry-run.md");
const srcPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/revocationLedgerDryRun.js");
const indexPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/index.js");
const packageCheckPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-specs.mjs");
const dryRunCheckPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-revocation-ledger-dry-run.mjs");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1311a/revocation-ledger-dry-run-result.json");

const result = await buildResult();
await writeJson(evidencePath, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checksFailed: result.checks.filter((check) => check.passed !== true).length,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

async function buildResult() {
  const packageJson = await readJson(packageJsonPath, {});
  const docsText = await readText(docsPath, "");
  const srcText = await readText(srcPath, "");
  const indexText = await readText(indexPath, "");
  const packageCheckText = await readText(packageCheckPath, "");
  const dryRunCheckText = await readText(dryRunCheckPath, "");
  const runtime = await import("../..//packages/neural-fabric-runtime/src/index.js");
  const dryRun = runtime.runRevocationLedgerDryRun();

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1311a-revocation-ledger-dry-run"] === "node tools/phase1311a/verify-revocation-ledger-dry-run.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("src_exists", await exists(srcPath)),
    check("dry_run_check_exists", await exists(dryRunCheckPath)),
    check("exports_create_ledger", indexText.includes("createRevocationLedger")),
    check("exports_evaluate_candidate", indexText.includes("evaluateRevocationCandidate")),
    check("exports_run_dry_run", indexText.includes("runRevocationLedgerDryRun")),
    check("package_check_runs_revocation_dry_run", packageCheckText.includes("check-revocation-ledger-dry-run.mjs")),
    check("revoked_op_rejected", dryRun.revokedOpRejected === true),
    check("old_epoch_rejected", dryRun.oldEpochRejected === true),
    check("policy_snapshot_recorded", dryRun.policySnapshotRecorded === true),
    check("no_secret_used", dryRun.noSecretUsed === true),
    check("no_network_used", dryRun.networkUsed === false),
    check("ledger_not_published", dryRun.ledgerPublished === false),
    check("provider_not_called", dryRun.providerCallsMade === false),
    check("secret_not_read", dryRun.secretRead === false),
    check("append_only_entries_present", Array.isArray(dryRun.entries) && dryRun.entries.length >= 1 && dryRun.entries.every((entry, index) => entry.sequence === index + 1)),
    check("policy_snapshot_address_recorded", typeof dryRun.policySnapshotAddress?.uri === "string" && dryRun.entries.every((entry) => entry.policySnapshotAddress === dryRun.policySnapshotAddress.uri)),
    check("docs_records_boundaries", ["不联网", "不发布 ledger", "No Provider calls", "No secret"].every((marker) => docsText.includes(marker))),
    check("src_has_no_network_imports", !/(node:https|node:http|fetch\s*\(|XMLHttpRequest|WebSocket)/u.test(srcText)),
    check("src_has_no_secret_reads", !/process\.env|\.env|auth\.json|secretValue|API_KEY/u.test(srcText)),
    check("dry_run_check_asserts_required_flags", ["revokedOpRejected", "oldEpochRejected", "policySnapshotRecorded", "noSecretUsed"].every((marker) => dryRunCheckText.includes(marker))),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "Revocation Ledger Dry-run",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1311a-revocation-ledger-dry-run.md",
    files: [
      "packages/neural-fabric-runtime/src/revocationLedgerDryRun.js",
      "packages/neural-fabric-runtime/src/index.js",
      "packages/neural-fabric-runtime/tools/check-revocation-ledger-dry-run.mjs",
      "packages/neural-fabric-runtime/tools/check-specs.mjs",
    ],
    verifier: "tools/phase1311a/verify-revocation-ledger-dry-run.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1311a/revocation-ledger-dry-run-result.json",
    dryRun: {
      revokedOpRejected: dryRun.revokedOpRejected,
      oldEpochRejected: dryRun.oldEpochRejected,
      policySnapshotRecorded: dryRun.policySnapshotRecorded,
      noSecretUsed: dryRun.noSecretUsed,
      entryCount: dryRun.entries.length,
      policySnapshotAddress: dryRun.policySnapshotAddress.uri,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      networkUsed: false,
      ledgerPublished: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
    checks,
  };
}

function check(id, passed) {
  return { id, passed: passed === true };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJson(path, fallback) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
