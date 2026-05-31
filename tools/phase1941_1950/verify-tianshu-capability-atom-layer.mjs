import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getSyntheticCapabilityAtoms } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/syntheticCapabilityAtomRegistry.js";
import { FORBIDDEN_CAPABILITY_ATOM_FIELDS, validateCapabilityAtomShape } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomSchema.js";
import { verifyCapabilityAtomIds } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomHash.js";

const root = process.cwd();
const sourceFiles = [
  "apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomSchema.js",
  "apps/ai-gateway-service/src/tianshu-capability-atom/syntheticCapabilityAtomRegistry.js",
  "apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomHash.js",
  "apps/ai-gateway-service/src/tianshu-capability-atom/capabilityAtomWeaveDryRun.js",
  "apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityReadoutAdapter.js",
  "apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityRiskGate.js",
  "apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityEvidencePreview.js",
  "apps/ai-gateway-service/src/ui/TianshuCapabilityAtomPreviewPanel.js",
  "tools/phase1941_1950/run-tianshu-capability-atom-dry-run.mjs",
  "tools/phase1941_1950/smoke-tianshu-capability-atom-preview.mjs",
];
const safetyScanFiles = sourceFiles.filter((file) => !file.startsWith("tools/phase1941_1950/"));
const evidenceFiles = [
  "apps/ai-gateway-service/evidence/phase1941_1950/tianshu-capability-atom-dry-run-result.json",
  "apps/ai-gateway-service/evidence/phase1941_1950/tianshu-capability-readout-result.json",
  "apps/ai-gateway-service/evidence/phase1941_1950/tianshu-capability-risk-gate-result.json",
  "apps/ai-gateway-service/evidence/phase1941_1950/phase1950-seal-result.json",
];
const forbiddenTextPatterns = [
  /\beval\s*\(/u,
  /\bnew Function\b/u,
  /\bvm\.runIn/u,
  /\bexec\s*\(/u,
  /process\.env/u,
  /auth\.json/u,
  /\.env/u,
  /Authorization:/u,
  /Bearer /u,
];

const atoms = getSyntheticCapabilityAtoms();
const shapeResults = atoms.map((atom) => validateCapabilityAtomShape(atom));
const hashVerification = verifyCapabilityAtomIds(atoms);
const dryRun = readJson(evidenceFiles[0]);
const readout = readJson(evidenceFiles[1]);
const riskGate = readJson(evidenceFiles[2]);
const seal = readJson(evidenceFiles[3]);
const dangerousHits = [];
for (const file of safetyScanFiles) {
  const text = readText(file);
  for (const pattern of forbiddenTextPatterns) {
    if (pattern.test(text)) dangerousHits.push({ file, pattern: String(pattern) });
  }
}

const checks = [
  ...sourceFiles.map((file) => check(`source_exists:${file}`, existsSync(join(root, file)))),
  ...evidenceFiles.map((file) => check(`evidence_exists:${file}`, existsSync(join(root, file)))),
  check("forbidden_text_patterns_absent", dangerousHits.length === 0, { dangerousHits }),
  check("atom_count_at_least_six", atoms.length >= 6),
  check("required_atoms_present", ["owner_daily_status_check", "evidence_replay_summary", "secret_safety_check", "ui_smoke_check", "provider_stability_check", "rollback_drill_check"].every((title) => atoms.some((atom) => atom.title === title))),
  check("atom_shapes_valid", shapeResults.every((item) => item.ok), { shapeResults }),
  check("forbidden_atom_fields_absent", atoms.every((atom) => FORBIDDEN_CAPABILITY_ATOM_FIELDS.every((field) => !Object.prototype.hasOwnProperty.call(atom, field)))),
  check("atom_id_verified", hashVerification.atomIdVerified === true),
  check("atom_id_mismatch_count_zero", hashVerification.atomIdMismatchCount === 0),
  check("dry_run_executed", dryRun?.dryRunExecuted === true),
  check("dependency_graph_generated", dryRun?.dependencyGraphGenerated === true),
  check("resolved_atom_count_zero", dryRun?.resolvedAtomCount === 0),
  check("missing_dependency_count_zero", dryRun?.missingDependencyCount === 0),
  check("conflict_count_zero", dryRun?.conflictCount === 0),
  check("tianshu_readout_generated", readout?.tianshuReadoutGenerated === true),
  check("selected_atoms_expected", ["owner_daily_status_check", "evidence_replay_summary", "secret_safety_check", "ui_smoke_check"].every((title) => readout?.selectedAtoms?.some((atom) => atom.title === title))),
  check("provider_stability_blocked", readout?.blockedCapabilities?.some((item) => item.title === "provider_stability_check" && item.blocker === "provider_stability_not_verified")),
  check("risk_gate_passed", riskGate?.riskGatePassed === true),
  check("forbidden_capability_blocked", riskGate?.forbiddenCapabilityBlocked === true),
  check("seal_completed", seal?.completed === true),
  check("seal_recommended", seal?.recommended_sealed === true),
  check("seal_blocker_null", seal?.blocker === null),
  check("tianshu_readout_experiment_ready", seal?.tianshuCapabilityReadoutExperimentReady === true),
  check("execution_allowed_false", seal?.executionAllowed === false),
  check("arbitrary_code_executed_false", seal?.arbitraryCodeExecuted === false),
  check("provider_calls_made_false", seal?.providerCallsMade === false),
  check("raw_secret_read_false", seal?.rawSecretRead === false),
  check("secret_value_exposed_false", seal?.secretValueExposed === false),
  check("chat_route_modified_false", seal?.chatRouteModified === false),
  check("chat_gateway_execute_modified_false", seal?.chatGatewayExecuteModified === false),
  check("deploy_release_tag_artifact_false", seal?.deployExecuted === false && seal?.releaseExecuted === false && seal?.tagCreated === false && seal?.artifactUploaded === false),
  check("readiness_claims_false", seal?.productionReadyClaimed === false && seal?.publicLaunchReadyClaimed === false && seal?.commercialReadyClaimed === false),
];

const passed = checks.every((item) => item.passed);
const validation = {
  phase: "Phase1941P-1950P",
  name: "Tianshu Capability Atom Experiment Layer Verification",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "tianshu_capability_atom_layer_verification_failed",
  tianshuCapabilityReadoutExperimentReady: seal?.tianshuCapabilityReadoutExperimentReady === true,
  checks,
};

writeJson("apps/ai-gateway-service/evidence/phase1941_1950/tianshu-capability-atom-validation-result.json", validation);
console.log(JSON.stringify(validation, null, 2));
if (!passed) process.exitCode = 1;

function check(id, passed, details = undefined) {
  return { id, passed: Boolean(passed), ...(details === undefined ? {} : { details }) };
}

function readText(relativePath) {
  try {
    return readFileSync(join(root, relativePath), "utf8");
  } catch {
    return "";
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch {
    return null;
  }
}

function writeJson(relativePath, value) {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
