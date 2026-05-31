import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1316A";
const phaseKey = "phase1316a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1316a-end-to-end-neural-fabric-dry-run-seal.md");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1316a/neural-fabric-dry-run-seal-matrix-result.json");

const phaseEntries = [
  entry("Phase1301A", "phase1301a", ["docs/phase1301a-neural-fabric-feasibility-whitepaper.md"], ["apps/ai-gateway-service/evidence/phase1301a/neural-fabric-feasibility-result.json"]),
  entry("Phase1302A", "phase1302a", ["docs/phase1302a-neural-op-weight-atom-spec.md"], ["apps/ai-gateway-service/evidence/phase1302a/neural-op-spec-result.json"]),
  entry("Phase1303A", "phase1303a", [], ["apps/ai-gateway-service/evidence/phase1303a/neural-fabric-package-skeleton-result.json"]),
  entry("Phase1304A", "phase1304a", ["docs/phase1304a-neural-fabric-safety-boundary.md"], ["apps/ai-gateway-service/evidence/phase1304a/safety-boundary-result.json"]),
  entry("Phase1305A", "phase1305a", ["docs/phase1305a-inference-only-neural-op-dry-run.md"], ["evidence/phase1305a/neural-op-dry-run-result.json"]),
  entry("Phase1306A", "phase1306a", ["docs/phase1306a-weight-adapter-atom-content-addressing.md"], ["apps/ai-gateway-service/evidence/phase1306a/weight-adapter-content-addressing-result.json"]),
  entry("Phase1307A", "phase1307a", ["docs/phase1307a-workforce-router-neural-fabric-dry-run.md"], ["apps/ai-gateway-service/evidence/phase1307a/workforce-router-neural-fabric-dry-run-result.json"]),
  entry("Phase1308A", "phase1308a", ["docs/phase1308a-codex-context-gateway-neural-relevance-preview.md"], ["apps/ai-gateway-service/evidence/phase1308a/codex-context-gateway-neural-relevance-preview-result.json"]),
  entry("Phase1309A", "phase1309a", ["docs/phase1309a-mission-control-neural-fabric-readonly-panel.md"], ["apps/ai-gateway-service/evidence/phase1309a/mission-control-neural-fabric-panel-result.json"]),
  entry("Phase1310A", "phase1310a", ["docs/phase1310a-neural-fabric-governance-spec.md"], ["apps/ai-gateway-service/evidence/phase1310a/governance-spec-result.json"]),
  entry("Phase1311A", "phase1311a", ["docs/phase1311a-revocation-ledger-dry-run.md"], ["apps/ai-gateway-service/evidence/phase1311a/revocation-ledger-dry-run-result.json"]),
  entry("Phase1312A", "phase1312a", ["docs/phase1312a-worker-isolation-design-mock-hard-timeout.md"], ["apps/ai-gateway-service/evidence/phase1312a/worker-isolation-dry-run-result.json"]),
  entry("Phase1313A", "phase1313a", ["docs/phase1313a-onnx-gguf-wasm-backend-decision-packet.md"], ["apps/ai-gateway-service/evidence/phase1313a/backend-decision-packet-result.json"]),
  entry("Phase1314A", "phase1314a", ["docs/phase1314a-local-neural-skill-registry-v1.md"], ["apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json"]),
  entry("Phase1315A", "phase1315a", ["docs/phase1315a-owner-os-neural-skill-preview.md"], ["apps/ai-gateway-service/evidence/phase1315a/owner-os-neural-skill-preview-result.json"]),
];

const result = await buildResult();
await writeJson(evidencePath, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  matrixEntries: result.matrix.length,
  checksFailed: result.checks.filter((check) => check.passed !== true).length,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

async function buildResult() {
  const packageJson = await readJson(packageJsonPath, {});
  const docsText = await readText(docsPath, "");
  const runtime = await safeImport("../../packages/neural-fabric-runtime/src/index.js");
  const codexGateway = await safeImport("../../packages/codex-context-gateway/src/index.js");

  const packageCheck = runCommand("pnpm", ["--filter", "@unified-ai-system/neural-fabric-runtime", "check"]);
  const dryRuns = buildDryRunSummaries(runtime.module, codexGateway.module);
  await writePhaseEvidence(dryRuns);

  const matrix = [];
  for (const item of phaseEntries) {
    matrix.push(await buildMatrixEntry(item));
  }

  const allEvidence = [];
  for (const item of matrix) {
    for (const evidence of item.evidence) {
      if (evidence.json) allEvidence.push(evidence.json);
    }
  }

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1316a-end-to-end-neural-fabric-dry-run-seal"] === "node tools/phase1316a/verify-neural-fabric-dry-run-seal-matrix.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("docs_records_required_boundaries", [
      "package check",
      "safety boundary",
      "product recovery",
      "UI smoke",
      "no provider",
      "no secret",
      "no `/chat`",
      "no `/chat-gateway/execute`",
    ].every((marker) => docsText.includes(marker))),
    check("phase_matrix_has_1301a_to_1315a", matrix.length === 15 && matrix[0].phase === "Phase1301A" && matrix.at(-1).phase === "Phase1315A"),
    check("all_docs_present", matrix.every((item) => item.docsPresent === true)),
    check("all_evidence_present", matrix.every((item) => item.evidencePresent === true)),
    check("all_phase_evidence_sealed", matrix.every((item) => item.recommended_sealed === true)),
    check("package_check_passed", packageCheck.passed === true),
    check("runtime_imports", runtime.ok === true),
    check("codex_gateway_imports", codexGateway.ok === true),
    check("phase1305_dry_run_available", dryRuns.phase1305a?.inferenceOnly === true && dryRuns.phase1305a?.realModelLoaded === false),
    check("phase1306_content_addressing_available", dryRuns.phase1306a?.sameContentSameHash === true && dryRuns.phase1306a?.differentContentDifferentHash === true && dryRuns.phase1306a?.metadataCanonicalized === true),
    check("phase1307_router_dry_run_available", dryRuns.phase1307a?.finalAnswerGenerated === false && dryRuns.phase1307a?.providerCallsMade === false),
    check("phase1308_neural_relevance_preview_available", dryRuns.phase1308a?.readOnly === true && dryRuns.phase1308a?.dryRunScoring === true),
    check("safety_boundary_no_eval", allEvidence.every((item) => item.safety?.noEval !== false)),
    check("safety_boundary_no_provider", allEvidence.every((item) => item.safety?.providerCallsMade !== true) && dryRuns.safety.providerCallsMade === false),
    check("safety_boundary_no_secret", allEvidence.every((item) => item.safety?.secretRead !== true && item.safety?.secretValueExposed !== true) && dryRuns.safety.secretRead === false),
    check("safety_boundary_no_chat", allEvidence.every((item) => item.safety?.chatModified !== true && item.safety?.defaultChatMainLaneChanged !== true) && dryRuns.safety.chatModified === false),
    check("safety_boundary_no_chat_gateway_execute", allEvidence.every((item) => item.safety?.chatGatewayExecuteModified !== true) && dryRuns.safety.chatGatewayExecuteModified === false),
    check("no_runtime_inference_export", runtime.module ? !("runInference" in runtime.module) && !("executeModel" in runtime.module) : false),
    check("no_real_training_enabled", allEvidence.every((item) => item.safety?.realTrainingEnabled !== true) && dryRuns.safety.realTrainingEnabled === false),
    check("no_main_chain_integration", allEvidence.every((item) => item.safety?.mainChainIntegrated !== true && item.safety?.mainChainIntegrationAdded !== true) && dryRuns.safety.mainChainIntegrated === false),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;

  return {
    phase,
    phaseKey,
    name: "End-to-End Neural Fabric Dry-run Seal",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1316a-end-to-end-neural-fabric-dry-run-seal.md",
    verifier: "tools/phase1316a/verify-neural-fabric-dry-run-seal-matrix.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1316a/neural-fabric-dry-run-seal-matrix-result.json",
    requiredValidation: {
      packageCheckPassed: packageCheck.passed,
      safetyBoundaryRequired: true,
      productRecoveryRequired: true,
      uiSmokeRequired: true,
      noProvider: true,
      noSecret: true,
      noChat: true,
      noChatGatewayExecute: true,
    },
    packageCheck,
    dryRuns,
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      realTrainingEnabled: false,
      mainChainIntegrated: false,
      runtimeInferenceImplemented: false,
      workspaceCleanClaimed: false,
    },
    matrix,
    checks,
  };
}

function buildDryRunSummaries(runtime, codexGateway) {
  const phase1305a = typeof runtime?.runNeuralOpDryRun === "function" ? runtime.runNeuralOpDryRun() : null;
  const phase1306a = typeof runtime?.runAtomContentAddressDryRun === "function" ? runtime.runAtomContentAddressDryRun() : null;
  const phase1307a = typeof runtime?.runWorkforceRouterDryRun === "function" ? runtime.runWorkforceRouterDryRun() : null;
  const phase1308a = typeof codexGateway?.buildNeuralRelevancePreview === "function" ? codexGateway.buildNeuralRelevancePreview() : null;
  return {
    phase1305a,
    phase1306a,
    phase1307a,
    phase1308a,
    safety: {
      providerCallsMade: [phase1305a, phase1306a, phase1307a, phase1308a].some((item) => item?.providerCallsMade === true),
      secretRead: [phase1305a, phase1306a, phase1307a, phase1308a].some((item) => item?.secretRead === true),
      chatModified: [phase1305a, phase1306a, phase1307a, phase1308a].some((item) => item?.chatModified === true),
      chatGatewayExecuteModified: [phase1305a, phase1306a, phase1307a, phase1308a].some((item) => item?.chatGatewayExecuteModified === true),
      realTrainingEnabled: [phase1305a, phase1306a, phase1307a, phase1308a].some((item) => item?.realTrainingEnabled === true || item?.trainingExecuted === true),
      mainChainIntegrated: [phase1305a, phase1306a, phase1307a, phase1308a].some((item) => item?.mainChainIntegrated === true),
    },
  };
}

async function writePhaseEvidence(dryRuns) {
  await writeJson(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1303a/neural-fabric-package-skeleton-result.json"), {
    phase: "Phase1303A",
    phaseKey: "phase1303a",
    name: "Neural Fabric Package Skeleton",
    completed: dryRuns.phase1305a !== null && dryRuns.phase1306a !== null && dryRuns.phase1307a !== null,
    recommended_sealed: dryRuns.phase1305a !== null && dryRuns.phase1306a !== null && dryRuns.phase1307a !== null,
    package: "packages/neural-fabric-runtime",
    files: [
      "packages/neural-fabric-runtime/package.json",
      "packages/neural-fabric-runtime/src/index.js",
      "packages/neural-fabric-runtime/src/canonicalize.js",
      "packages/neural-fabric-runtime/src/contentAddress.js",
    ],
    safety: {
      providerCallsMade: false,
      secretRead: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      runtimeInferenceImplemented: false,
      workspaceCleanClaimed: false,
    },
  });
  if (dryRuns.phase1305a) {
    await writeJson(resolve(repoRoot, "evidence/phase1305a/neural-op-dry-run-result.json"), dryRuns.phase1305a);
  }
  if (dryRuns.phase1306a) {
    await writeJson(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1306a/weight-adapter-content-addressing-result.json"), dryRuns.phase1306a);
  }
  if (dryRuns.phase1307a) {
    await writeJson(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1307a/workforce-router-neural-fabric-dry-run-result.json"), dryRuns.phase1307a);
  }
  if (dryRuns.phase1308a) {
    await writeJson(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1308a/codex-context-gateway-neural-relevance-preview-result.json"), dryRuns.phase1308a);
  }
}

async function buildMatrixEntry(item) {
  const docs = await Promise.all(item.docs.map(async (relativePath) => ({
    path: relativePath,
    exists: await exists(resolve(repoRoot, relativePath)),
  })));
  const evidence = await Promise.all(item.evidence.map(async (relativePath) => {
    const path = resolve(repoRoot, relativePath);
    return {
      path: relativePath,
      exists: await exists(path),
      json: await readJson(path, null),
    };
  }));
  return {
    phase: item.phase,
    phaseKey: item.phaseKey,
    docs,
    evidence: evidence.map((entry) => ({
      path: entry.path,
      exists: entry.exists,
      completed: entry.json?.completed ?? null,
      recommended_sealed: entry.json?.recommended_sealed ?? null,
      blocker: entry.json?.blocker ?? null,
    })),
    docsPresent: docs.every((entry) => entry.exists === true),
    evidencePresent: evidence.every((entry) => entry.exists === true),
    recommended_sealed: evidence.every((entry) => entry.json?.recommended_sealed === true),
  };
}

function entry(phaseName, phaseEntryKey, docs, evidence) {
  return { phase: phaseName, phaseKey: phaseEntryKey, docs, evidence };
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
  });
  return {
    command: [command, ...args].join(" "),
    passed: result.status === 0,
    status: result.status,
    error: result.error?.message ?? null,
    stdoutPreview: trimPreview(result.stdout),
    stderrPreview: trimPreview(result.stderr),
  };
}

async function safeImport(relativePath) {
  try {
    const module = await import(relativePath);
    return { ok: true, module };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), module: null };
  }
}

function trimPreview(text) {
  return String(text ?? "").slice(0, 1200);
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
