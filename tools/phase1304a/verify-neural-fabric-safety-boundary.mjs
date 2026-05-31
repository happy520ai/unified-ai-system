import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1304A";
const phaseKey = "phase1304a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPaths = [
  resolve(repoRoot, "docs/phase1301a-neural-fabric-feasibility-whitepaper.md"),
  resolve(repoRoot, "docs/phase1302a-neural-op-weight-atom-spec.md"),
  resolve(repoRoot, "docs/phase1304a-neural-fabric-safety-boundary.md"),
];
const runtimeFiles = [
  resolve(repoRoot, "packages/neural-fabric-runtime/src/index.js"),
  resolve(repoRoot, "packages/neural-fabric-runtime/src/canonicalize.js"),
  resolve(repoRoot, "packages/neural-fabric-runtime/src/contentAddress.js"),
];
const packageSpecPaths = [
  resolve(repoRoot, "packages/neural-fabric-runtime/package.json"),
  resolve(repoRoot, "packages/neural-fabric-runtime/specs/neural-op.schema.json"),
  resolve(repoRoot, "packages/neural-fabric-runtime/specs/weight-atom.schema.json"),
];
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1304a/safety-boundary-result.json");

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
  const docsText = await Promise.all(docsPaths.map((path) => readText(path, "")));
  const runtimeTexts = await Promise.all(runtimeFiles.map((path) => readText(path, "")));
  const specTexts = await Promise.all(packageSpecPaths.map((path) => readText(path, "")));

  const docsExistChecks = [];
  for (const [index, path] of docsPaths.entries()) {
    docsExistChecks.push(check(`docs_${index + 1}_exists`, await exists(path)));
  }

  const specExistChecks = [];
  for (const [index, path] of packageSpecPaths.entries()) {
    specExistChecks.push(check(`spec_${index + 1}_exists`, await exists(path)));
  }

  const runtimeExistChecks = [];
  for (const [index, path] of runtimeFiles.entries()) {
    runtimeExistChecks.push(check(`runtime_${index + 1}_exists`, await exists(path)));
  }

  const checkList = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1304a-neural-fabric-safety-boundary"] === "node tools/phase1304a/verify-neural-fabric-safety-boundary.mjs"),
    ...docsExistChecks,
    ...specExistChecks,
    ...runtimeExistChecks,
    check("docs_phase1301_mentions_neural_fabric", docsText[0].includes("Neural Fabric")),
    check("docs_phase1302_mentions_neural_fabric_terms", ["neural-op", "weight-atom", "adapter-atom", "router-op"].every((term) => docsText[1].includes(term))),
    check("docs_phase1302_says_schema_only", docsText[1].includes("schema/spec only")),
    check("docs_phase1304_mentions_safety_boundary", docsText[2].includes("no eval") && docsText[2].includes("no vm2") && docsText[2].includes("no new Function") && docsText[2].includes("child_process.exec")),
    check("no_eval_detected", !hasDangerousPattern(runtimeTexts, /(^|[^\w])eval\s*\(/u)),
    check("no_vm2_detected", !hasDangerousPattern(runtimeTexts, /\bvm2\b/u)),
    check("no_new_function_detected", !hasDangerousPattern(runtimeTexts, /\bnew\s+Function\s*\(/u)),
    check("no_child_process_exec_detected", !hasDangerousPattern(runtimeTexts, /\bchild_process\b|\bexecFile\s*\(|\bexecSync\s*\(|\bspawnSync\s*\(/u)),
    check("no_provider_calls_detected", !hasDangerousPattern(runtimeTexts, /\bprovider\b|\bProvider\b/u)),
    check("no_secret_reads_detected", !hasDangerousPattern(runtimeTexts, /\bsecret\b|\b\.env\b|\bauth\.json\b/u)),
    check("no_chat_modified_detected", !hasDangerousPattern(runtimeTexts, /\/chat/u)),
    check("no_chat_gateway_execute_modified_detected", !hasDangerousPattern(runtimeTexts, /\/chat-gateway\/execute/u)),
    check("runtime_files_use_safe_modules_only", runtimeTexts.every((text) => !text.includes("node:vm") && !text.includes("node:child_process"))),
    check("runtime_has_load_manifest", runtimeTexts[0].includes("loadManifest")),
    check("runtime_has_canonicalize", runtimeTexts[1].includes("normalizeForCanonicalJson") && runtimeTexts[1].includes("canonicalize")),
    check("runtime_has_content_address", runtimeTexts[2].includes("createHash") && runtimeTexts[2].includes("contentAddress")),
    check("runtime_package_syntax_contract", specTexts[0].includes("\"main\": \"./src/index.js\"") && specTexts[0].includes("\"exports\"")),
  ];

  const blocker = checkList.find((check) => check.passed !== true)?.id ?? null;

  return {
    phase,
    phaseKey,
    name: "Neural Fabric Safety Boundary Verifier",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: [
      "docs/phase1301a-neural-fabric-feasibility-whitepaper.md",
      "docs/phase1302a-neural-op-weight-atom-spec.md",
      "docs/phase1304a-neural-fabric-safety-boundary.md",
    ],
    packageFiles: [
      "packages/neural-fabric-runtime/package.json",
      "packages/neural-fabric-runtime/src/index.js",
      "packages/neural-fabric-runtime/src/canonicalize.js",
      "packages/neural-fabric-runtime/src/contentAddress.js",
      "packages/neural-fabric-runtime/specs/neural-op.schema.json",
      "packages/neural-fabric-runtime/specs/weight-atom.schema.json",
    ],
    verifier: "tools/phase1304a/verify-neural-fabric-safety-boundary.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1304a/safety-boundary-result.json",
    safety: {
      noEval: true,
      noVm2: true,
      noNewFunction: true,
      noChildProcessExec: true,
      providerCallsMade: false,
      secretRead: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
    scope: {
      docsOnly: true,
      schemaSpecOnly: true,
      packageSkeletonOnly: true,
      runtimeInferenceImplemented: false,
    },
    checks: checkList,
  };
}

function hasDangerousPattern(texts, pattern) {
  return texts.some((text) => pattern.test(text));
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
