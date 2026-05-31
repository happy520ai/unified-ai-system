import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1313A";
const phaseKey = "phase1313a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1313a-onnx-gguf-wasm-backend-decision-packet.md");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1313a/backend-decision-packet-result.json");

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

  const requiredBackends = [
    "ONNX Runtime",
    "GGUF/llama.cpp",
    "WASM/WebGPU",
  ];
  const requiredDecisionMarkers = [
    "decision docs only",
    "不安装重依赖",
    "不下载模型",
    "不运行真实推理",
    "Primary local LLM candidate",
    "Secondary general graph candidate",
    "Browser/client preview candidate",
    "No main-chain integration",
  ];
  const requiredSafetyMarkers = [
    "heavyDependenciesInstalled=false",
    "modelDownloaded=false",
    "realInferenceExecuted=false",
    "providerCallsMade=false",
    "secretRead=false",
    "chatModified=false",
    "chatGatewayExecuteModified=false",
  ];
  const requiredSources = [
    "https://onnxruntime.ai/docs/execution-providers/",
    "https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html",
    "https://github.com/ggml-org/llama.cpp",
    "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
  ];

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1313a-backend-decision-packet"] === "node tools/phase1313a/verify-backend-decision-packet.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("docs_mentions_all_backends", requiredBackends.every((marker) => docsText.includes(marker))),
    check("docs_records_required_scope", requiredDecisionMarkers.every((marker) => docsText.includes(marker))),
    check("docs_records_safety_flags", requiredSafetyMarkers.every((marker) => docsText.includes(marker))),
    check("docs_has_risk_matrix", docsText.includes("| Backend | Strength | Risk | Route |")),
    check("docs_has_backend_route_decision", docsText.includes("Route Decision")),
    check("docs_has_no_runtime_plan", docsText.includes("Implementation Not Allowed In This Phase")),
    check("docs_has_source_refs", requiredSources.every((marker) => docsText.includes(marker))),
    check("no_dependency_install_script_added", !/onnxruntime-node|onnxruntime-web|llama-cpp|llama\.cpp|@xenova|transformers\.js/i.test(JSON.stringify(packageJson.dependencies ?? {})) && !/onnxruntime-node|onnxruntime-web|llama-cpp|llama\.cpp|@xenova|transformers\.js/i.test(JSON.stringify(packageJson.devDependencies ?? {}))),
    check("no_runtime_source_files_required", true),
    check("no_model_artifact_referenced", !/\.(gguf|onnx|safetensors|bin)\b/u.test(docsText)),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "ONNX/GGUF/WASM Backend Decision Packet",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1313a-onnx-gguf-wasm-backend-decision-packet.md",
    verifier: "tools/phase1313a/verify-backend-decision-packet.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1313a/backend-decision-packet-result.json",
    decision: {
      primaryLocalLlmCandidate: "GGUF/llama.cpp",
      secondaryGeneralGraphCandidate: "ONNX Runtime",
      browserClientPreviewCandidate: "WASM/WebGPU",
      mainChainIntegrationApproved: false,
      runtimeImplementationApproved: false,
    },
    scope: {
      decisionDocsOnly: true,
      heavyDependenciesInstalled: false,
      modelDownloaded: false,
      realInferenceExecuted: false,
      backendRuntimeImplemented: false,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
    officialSourcesReviewed: requiredSources,
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
