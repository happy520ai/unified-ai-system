import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProjectBrain } from "./read-project-brain.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const riskRank = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

function normalizePath(input) {
  return String(input || "").replaceAll("\\", "/").replace(/^\.?\//, "");
}

function slugifyTaskId(taskId) {
  return String(taskId || "gvc-task")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function includesAny(values, blockedValues) {
  const normalized = new Set(values.map((value) => normalizePath(value).toLowerCase()));
  return blockedValues.some((blocked) => normalized.has(normalizePath(blocked).toLowerCase()));
}

function touchesForbiddenPrefix(touches, prefixes) {
  return touches.some((touch) => {
    const normalized = normalizePath(touch).toLowerCase();
    return prefixes.some((prefix) => normalized.startsWith(normalizePath(prefix).toLowerCase()));
  });
}

function touchesForbiddenBasename(touches, basenames) {
  const blocked = new Set((basenames || []).map((basename) => basename.toLowerCase()));
  return touches.some((touch) => {
    const normalized = normalizePath(touch).toLowerCase();
    const parts = normalized.split("/");
    return blocked.has(parts[parts.length - 1]);
  });
}

function buildApprovalPacket({ task, policy }) {
  const requiredFields = Array.from(
    new Set([...(task.approvalRequiredFields || []), ...policy.providerApprovalRequiredFields]),
  );

  return {
    taskId: task.taskId,
    title: task.title,
    status: "approval_required",
    reason: "Task is L3 or includes approval-gated operations. Phase2000 only creates this packet and does not execute.",
    requiredFields,
    defaultLimits: policy.providerDefaultLimits,
    ownerMustProvide: {
      provider: "",
      model: "",
      credentialRef: "",
      maxRequests: 1,
      maxCostUsd: 0.02,
      timeoutMs: 30000,
      retryPolicy: "no_retry",
      prompt: "",
      expectedResult: "",
      rollbackPlan: "",
    },
    constraints: {
      maxRequestsMustBeAtMost: 1,
      maxCostUsdMustBeAtMost: 0.02,
      timeoutMsMustBeAtMost: 30000,
      rawSecretReadAllowed: false,
      credentialRefOnly: true,
    },
    providerCallsMade: false,
    secretRead: false,
    deployReleasePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
}

function writeApprovalPacket({ repoRoot, task, policy }) {
  const packetPath = path.join(repoRoot, "docs/approvals", `${slugifyTaskId(task.taskId)}-approval-required.json`);
  mkdirSync(path.dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `${JSON.stringify(buildApprovalPacket({ task, policy }), null, 2)}\n`);
  return packetPath;
}

export function validateRiskGate(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const task = options.task || {};
  const writePacket = options.writeApprovalPacket !== false;
  const brain = readProjectBrain({ repoRoot });
  const policy = brain.riskPolicy;

  const touches = Array.isArray(task.touches) ? task.touches : [];
  const operations = Array.isArray(task.operations) ? task.operations : [];
  const reasons = [];

  const exactPathBlocked = includesAny(touches, policy.forbiddenExactPaths);
  const prefixBlocked = touchesForbiddenPrefix(touches, policy.forbiddenPathPrefixes);
  const basenameBlocked = touchesForbiddenBasename(touches, policy.forbiddenBasenames);
  const forbiddenOperation = operations.some((operation) => policy.forbiddenOperations.includes(operation));
  const approvalOperation = operations.some((operation) => policy.approvalRequiredOperations.includes(operation));
  const riskLevel = task.riskLevel || "L4";
  const riskDefault = policy.riskLevels[riskLevel]?.defaultDecision || "forbidden";

  if (exactPathBlocked) reasons.push("touches_forbidden_exact_path");
  if (prefixBlocked) reasons.push("touches_forbidden_path_prefix");
  if (basenameBlocked) reasons.push("touches_forbidden_basename");
  if (forbiddenOperation) reasons.push("includes_forbidden_operation");

  let decision = riskDefault;
  if (riskRank[riskLevel] >= riskRank.L4) {
    decision = "forbidden";
    reasons.push("risk_level_forbidden");
  }
  if (exactPathBlocked || prefixBlocked || basenameBlocked || forbiddenOperation) {
    decision = "forbidden";
  } else if (riskRank[riskLevel] >= riskRank.L3 || approvalOperation) {
    decision = "approval_required";
    reasons.push("requires_owner_approval");
  }

  const result = {
    taskId: task.taskId || "unknown",
    decision,
    riskLevel,
    reasons,
    approvalPacketPath: null,
    providerCallsMade: false,
    secretRead: false,
    deployReleasePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };

  if (decision === "approval_required" && writePacket) {
    result.approvalPacketPath = writeApprovalPacket({ repoRoot, task, policy });
  }

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const task = {
    taskId: "manual-risk-gate-probe",
    title: "Manual risk gate probe",
    riskLevel: process.argv[2] || "L1",
    touches: process.argv.slice(3),
    operations: [],
  };
  console.log(JSON.stringify(validateRiskGate({ task }), null, 2));
}
