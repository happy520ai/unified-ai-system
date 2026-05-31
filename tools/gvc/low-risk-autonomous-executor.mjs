import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const defaultEvidenceDir = "apps/ai-gateway-service/evidence/phase2031-2032-gvc-low-risk-autonomous-mutation/mutations";
const forbiddenOperations = new Set([
  "provider_call",
  "paid_api_call",
  "secret_read",
  "auth_json_read",
  "deploy",
  "release",
  "tag",
  "artifact_upload",
  "push",
  "commit",
  "chat_modify",
  "chat_gateway_execute_modify",
  "credential_resolver_modify",
  "provider_runtime_core_modify",
  "billing_payment_modify",
]);

const allowedPrefixes = [
  "apps/ai-gateway-service/evidence/",
  "tools/gvc/",
];

function normalizeRelativePath(input) {
  return String(input || "")
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "");
}

function isDocsPhaseFile(relativePath) {
  return /^docs\/phase[^/]*\.md$/i.test(relativePath);
}

function isToolsPhaseFile(relativePath) {
  return /^tools\/phase[^/]+\/.+/i.test(relativePath);
}

function isPackageJson(relativePath) {
  return relativePath === "package.json";
}

function isAllowedPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return (
    isDocsPhaseFile(normalized) ||
    isToolsPhaseFile(normalized) ||
    isPackageJson(normalized) ||
    allowedPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

function isForbiddenPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath).toLowerCase();
  return (
    normalized === "project_context.md" ||
    normalized.startsWith("legacy/") ||
    normalized.endsWith("/auth.json") ||
    normalized === "auth.json" ||
    normalized.endsWith("/.env") ||
    normalized === ".env" ||
    normalized.includes("secret-store") ||
    normalized.includes("credentialresolver") ||
    normalized.includes("credential-resolver") ||
    normalized.includes("providerruntimecore") ||
    normalized.includes("provider-runtime-core") ||
    normalized.includes("billing") ||
    normalized.includes("payment") ||
    normalized.includes("deploy") ||
    normalized.includes("release")
  );
}

function assertApproval(approval, reasons) {
  if (approval?.approved !== true) reasons.push("approval_missing_or_not_approved");
  if (approval?.scope !== "low_risk_only") reasons.push("approval_scope_not_low_risk_only");
  if (approval?.maxMutationsPerLoop !== 3) reasons.push("approval_max_mutations_must_be_3");
  if (approval?.dailyRealExecutionLoopLimit !== 100) reasons.push("approval_daily_limit_must_be_100");
  if (approval?.rollbackRequired !== true) reasons.push("approval_rollback_required_must_be_true");
  for (const [field, expected] of [
    ["providerAllowed", false],
    ["secretReadAllowed", false],
    ["deployAllowed", false],
    ["chatRouteModificationAllowed", false],
    ["legacyModificationAllowed", false],
    ["projectContextModificationAllowed", false],
  ]) {
    if (approval?.[field] !== expected) reasons.push(`${field}_must_be_${expected}`);
  }
}

export function validateLowRiskMutationPlan(options = {}) {
  const approval = options.approval || {};
  const plan = options.plan || {};
  const mutations = Array.isArray(plan.mutations) ? plan.mutations : [];
  const operations = Array.isArray(plan.operations) ? plan.operations : [];
  const reasons = [];

  assertApproval(approval, reasons);

  if (!plan.planId || typeof plan.planId !== "string") reasons.push("plan_id_required");
  if (mutations.length < 1) reasons.push("mutation_required");
  if (mutations.length > approval.maxMutationsPerLoop) reasons.push("max_mutations_per_loop_exceeded");
  if (operations.some((operation) => forbiddenOperations.has(operation))) reasons.push("forbidden_operation_detected");

  for (const mutation of mutations) {
    const relativePath = normalizeRelativePath(mutation.path);
    if (mutation.type !== "write_file") reasons.push("unsupported_mutation_type");
    if (!relativePath) reasons.push("mutation_path_required");
    if (path.isAbsolute(String(mutation.path || ""))) reasons.push("absolute_path_blocked");
    if (relativePath.includes("..")) reasons.push("path_traversal_blocked");
    if (isForbiddenPath(relativePath)) reasons.push("forbidden_path_blocked");
    if (!isAllowedPath(relativePath)) reasons.push("path_not_in_low_risk_allowlist");
    if (typeof mutation.content !== "string") reasons.push("mutation_content_must_be_string");
  }

  const blocker = reasons.includes("forbidden_operation_detected")
    ? "forbidden_operation_detected"
    : reasons.includes("forbidden_path_blocked")
      ? "forbidden_path_blocked"
      : reasons[0] || "none";

  return {
    valid: reasons.length === 0,
    blocker,
    reasons: Array.from(new Set(reasons)),
    mutationCount: mutations.length,
    allowedPaths: mutations.map((mutation) => normalizeRelativePath(mutation.path)),
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  };
}

export async function executeLowRiskMutationPlan(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const approval = options.approval || {};
  const plan = options.plan || {};
  const evidenceDir = normalizeRelativePath(options.evidenceDir || defaultEvidenceDir);
  const generatedAt = new Date().toISOString();
  const validation = validateLowRiskMutationPlan({ approval, plan });
  const planEvidencePath = `${evidenceDir}/${slug(plan.planId || "low-risk-mutation")}-plan.json`;
  const mutationEvidencePath = `${evidenceDir}/${slug(plan.planId || "low-risk-mutation")}-evidence.json`;

  writeJson(path.join(repoRoot, planEvidencePath), {
    phaseId: "Phase2032-GVC-Real-Low-Risk-Autonomous-Executor",
    generatedAt,
    plan,
    validation,
    realWritePlanned: validation.valid,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  });

  if (!validation.valid) {
    const blocked = buildResult({
      status: "blocked",
      blocker: validation.blocker,
      generatedAt,
      plan,
      validation,
      planEvidencePath,
      mutationEvidencePath,
      snapshots: [],
      mutatedFiles: [],
      verifierResults: [],
      rollbackPerformed: false,
      rollbackSucceeded: null,
      realWritePerformed: false,
    });
    writeJson(path.join(repoRoot, mutationEvidencePath), blocked);
    return blocked;
  }

  const snapshots = snapshotMutations(repoRoot, plan.mutations);
  const mutatedFiles = [];
  let verifierResults = [];
  let status = "passed";
  let blocker = "none";
  let rollbackPerformed = false;
  let rollbackSucceeded = null;

  try {
    for (const mutation of plan.mutations) {
      const relativePath = normalizeRelativePath(mutation.path);
      const absolutePath = path.join(repoRoot, relativePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, mutation.content, "utf8");
      mutatedFiles.push(relativePath);
    }

    verifierResults = runVerifierCommands(repoRoot, plan.verifierCommands || []);
    const failedVerifier = verifierResults.find((result) => result.exitCode !== 0);
    if (failedVerifier) {
      status = "rolled_back";
      blocker = "verifier_failed";
      rollbackPerformed = true;
      rollbackSucceeded = restoreSnapshots(repoRoot, snapshots);
      if (!rollbackSucceeded) {
        status = "blocked";
        blocker = "rollback_failed";
      }
    }
  } catch (error) {
    status = "rolled_back";
    blocker = "mutation_apply_failed";
    rollbackPerformed = true;
    rollbackSucceeded = restoreSnapshots(repoRoot, snapshots);
    verifierResults.push({
      command: "mutation_apply",
      exitCode: 1,
      passed: false,
      error: error.message,
    });
    if (!rollbackSucceeded) {
      status = "blocked";
      blocker = "rollback_failed";
    }
  }

  const result = buildResult({
    status,
    blocker,
    generatedAt,
    plan,
    validation,
    planEvidencePath,
    mutationEvidencePath,
    snapshots,
    mutatedFiles,
    verifierResults,
    rollbackPerformed,
    rollbackSucceeded,
    realWritePerformed: mutatedFiles.length > 0,
  });
  writeJson(path.join(repoRoot, mutationEvidencePath), result);
  return result;
}

function snapshotMutations(repoRoot, mutations) {
  return mutations.map((mutation) => {
    const relativePath = normalizeRelativePath(mutation.path);
    const absolutePath = path.join(repoRoot, relativePath);
    return {
      path: relativePath,
      existed: existsSync(absolutePath),
      content: existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null,
    };
  });
}

function restoreSnapshots(repoRoot, snapshots) {
  try {
    for (const snapshot of snapshots) {
      const absolutePath = path.join(repoRoot, snapshot.path);
      if (snapshot.existed) {
        mkdirSync(path.dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, snapshot.content, "utf8");
      } else {
        rmSync(absolutePath, { force: true });
      }
    }
    return true;
  } catch {
    return false;
  }
}

function runVerifierCommands(repoRoot, commands) {
  return commands.map((entry) => {
    const command = entry.command;
    const args = Array.isArray(entry.args) ? entry.args : [];
    const startedAt = new Date().toISOString();
    const result = spawnSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: entry.timeoutMs || 120000,
    });
    return {
      command: [command, ...args].join(" "),
      startedAt,
      exitCode: result.status ?? 1,
      passed: result.status === 0,
      stdoutTail: (result.stdout || "").slice(-1200),
      stderrTail: (result.stderr || "").slice(-1200),
    };
  });
}

function buildResult(input) {
  return {
    phaseId: "Phase2032-GVC-Real-Low-Risk-Autonomous-Executor",
    status: input.status,
    blocker: input.blocker,
    generatedAt: input.generatedAt,
    planId: input.plan.planId || null,
    mutationCount: input.validation.mutationCount,
    mutatedFiles: input.mutatedFiles,
    planEvidencePath: input.planEvidencePath,
    mutationEvidencePath: input.mutationEvidencePath,
    validation: input.validation,
    verifierResults: input.verifierResults,
    rollbackPerformed: input.rollbackPerformed,
    rollbackSucceeded: input.rollbackSucceeded,
    realWritePerformed: input.realWritePerformed,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
  };
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return String(value || "low-risk-mutation")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
