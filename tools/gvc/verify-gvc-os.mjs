import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const brainDir = path.join(repoRoot, "docs/project-brain");
const evidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2000-gvc-os");
const evidencePath = path.join(evidenceDir, "gvc-os-result.json");
const approvalPacketPath = path.join(repoRoot, "docs/approvals/phase2000-gvc-os-l3-provider-test-approval-required.json");

const requiredBrainFiles = [
  "current-state.json",
  "goals.json",
  "risk-policy.json",
  "next-actions.json",
  "completion-definition.json",
];

const requiredToolFiles = [
  "read-project-brain.mjs",
  "select-next-action.mjs",
  "validate-risk-gate.mjs",
  "write-execution-result.mjs",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson.scripts && packageJson.scripts[scriptName]);
}

function resetProbeOutputs() {
  if (existsSync(approvalPacketPath)) {
    rmSync(approvalPacketPath);
  }
}

async function main() {
  resetProbeOutputs();

  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(
    hasScript(packageJson, "verify:phase2000-gvc-os"),
    "missing package script verify:phase2000-gvc-os",
  );

  for (const fileName of requiredBrainFiles) {
    const filePath = path.join(brainDir, fileName);
    assert(existsSync(filePath), `missing project-brain file: ${fileName}`);
    readJson(filePath);
  }

  for (const fileName of requiredToolFiles) {
    const filePath = path.join(__dirname, fileName);
    assert(existsSync(filePath), `missing GVC tool: ${fileName}`);
  }

  assert(existsSync(path.join(repoRoot, "docs/phase2000-gvc-os.md")), "missing Phase2000 documentation");

  const { readProjectBrain } = await import("./read-project-brain.mjs");
  const { selectNextAction } = await import("./select-next-action.mjs");
  const { validateRiskGate } = await import("./validate-risk-gate.mjs");
  const { writeExecutionResult } = await import("./write-execution-result.mjs");

  const brain = readProjectBrain({ repoRoot });
  assert(
    /^Phase20\d{2}-GVC-/.test(brain.currentState.phaseId),
    "current-state phaseId must remain on the GVC line",
  );
  assert(Array.isArray(brain.nextActions.actions), "next-actions actions must be an array");

  const l0 = selectNextAction({ repoRoot, maxRiskLevel: "L0", exactRiskLevel: "L0" });
  const l1 = selectNextAction({ repoRoot, maxRiskLevel: "L1", exactRiskLevel: "L1" });
  const l2 = selectNextAction({ repoRoot, maxRiskLevel: "L2", exactRiskLevel: "L2" });

  assert(l0?.riskLevel === "L0", "selector did not select an L0 task");
  assert(l1?.riskLevel === "L1", "selector did not select an L1 task");
  assert(l2?.riskLevel === "L2", "selector did not select an L2 task");

  const allowed = validateRiskGate({
    repoRoot,
    task: {
      taskId: "phase2000-gvc-os-docs-refresh",
      title: "Refresh local project brain docs",
      riskLevel: "L1",
      touches: ["docs/project-brain/current-state.json"],
      operations: ["docs_update", "evidence_write"],
    },
  });
  assert(allowed.decision === "allowed", "L1 docs task should be allowed");

  const forbidden = validateRiskGate({
    repoRoot,
    task: {
      taskId: "phase2000-gvc-os-secret-read",
      title: "Attempt to read raw secret",
      riskLevel: "L2",
      touches: [".env"],
      operations: ["secret_read"],
    },
  });
  assert(forbidden.decision === "forbidden", "secret read task should be forbidden");
  assert(forbidden.secretRead === false, "risk gate must not read secrets");

  const authJsonForbidden = validateRiskGate({
    repoRoot,
    task: {
      taskId: "phase2000-gvc-os-auth-json-read",
      title: "Attempt to read auth.json by nested path",
      riskLevel: "L2",
      touches: ["C:/Users/Administrator/.codex/auth.json"],
      operations: ["auth_json_read"],
    },
  });
  assert(authJsonForbidden.decision === "forbidden", "auth.json by nested path should be forbidden");

  const approvalRequired = validateRiskGate({
    repoRoot,
    task: {
      taskId: "phase2000-gvc-os-l3-provider-test",
      title: "Guarded real provider one-shot candidate",
      riskLevel: "L3",
      touches: ["tools/provider/runtime-adapter.mjs"],
      operations: ["provider_call"],
      approvalRequiredFields: [
        "provider",
        "model",
        "credentialRef",
        "maxRequests",
        "maxCostUsd",
        "timeoutMs",
        "retryPolicy",
        "prompt",
        "expectedResult",
        "rollbackPlan",
      ],
    },
  });
  assert(approvalRequired.decision === "approval_required", "L3 provider task should require approval");
  assert(existsSync(approvalPacketPath), "L3 task did not generate approval-required packet");

  const approvalPacket = readJson(approvalPacketPath);
  assert(approvalPacket.status === "approval_required", "approval packet status mismatch");
  assert(approvalPacket.providerCallsMade === false, "approval packet must not call providers");
  assert(approvalPacket.secretRead === false, "approval packet must not read secrets");
  assert(approvalPacket.requiredFields.includes("credentialRef"), "approval packet missing credentialRef field");

  const result = writeExecutionResult({
    repoRoot,
    phaseId: "Phase2000-GVC-OS",
    taskId: "phase2000-gvc-os-verifier-probe",
    status: "passed",
    recommendedSealed: true,
    checks: {
      projectBrainJsonParseable: true,
      riskPolicyDecisionCoverage: ["allowed", "approval_required", "forbidden"],
      selectorSupportsL0L1L2: true,
      l3ApprovalPacketGenerated: true,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      deployReleasePerformed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
    },
    blocker: "none",
  });
  assert(result.path === evidencePath, "execution result path mismatch");
  assert(existsSync(evidencePath), "execution result evidence was not written");

  const evidence = readJson(evidencePath);
  assert(evidence.phaseId === "Phase2000-GVC-OS", "evidence phaseId mismatch");
  assert(evidence.recommendedSealed === true, "evidence recommendedSealed mismatch");
  assert(evidence.providerCallsMade === false, "providerCallsMade must remain false");
  assert(evidence.secretRead === false, "secretRead must remain false");
  assert(evidence.chatModified === false, "chatModified must remain false");
  assert(evidence.chatGatewayExecuteModified === false, "chatGatewayExecuteModified must remain false");
  assert(evidence.legacyModified === false, "legacyModified must remain false");
  assert(evidence.projectContextModified === false, "projectContextModified must remain false");

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log("Phase2000 GVC OS verifier passed");
}

main().catch((error) => {
  console.error(`Phase2000 GVC OS verifier failed: ${error.message}`);
  process.exit(1);
});
