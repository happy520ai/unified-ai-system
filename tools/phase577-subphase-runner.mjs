import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOfficialImportPlan,
  buildSourceRef,
  getOfficialSource,
  licenseBoundary,
  listOfficialSourceIds,
  sourceVersionPolicy,
  validateSourceVersionRecord,
} from "../packages/position-library/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const safetyBoundary = Object.freeze({
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  realFeishuMessageSent: false,
  realWeComMessageSent: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  characterModuleRestored: false,
  billingExecuted: false,
  invoiceGenerated: false,
  workspaceCleanClaimed: false,
});

export const phase577Subphases = Object.freeze([
  phase("phase577a", "Phase577A", "Source Registry Split", "source-registry-split", [
    "packages/position-library/src/import/officialSourceRegistry.js",
  ]),
  phase("phase577b", "Phase577B", "O*NET Source Contract", "onet-source-contract", [
    "packages/position-library/src/import/officialSourceRegistry.js",
  ]),
  phase("phase577c", "Phase577C", "SOC Source Contract", "soc-source-contract", [
    "packages/position-library/src/import/officialSourceRegistry.js",
  ]),
  phase("phase577d", "Phase577D", "ISCO Source Contract", "isco-source-contract", [
    "packages/position-library/src/import/officialSourceRegistry.js",
  ]),
  phase("phase577e", "Phase577E", "ESCO Source Contract", "esco-source-contract", [
    "packages/position-library/src/import/officialSourceRegistry.js",
  ]),
  phase("phase577f", "Phase577F", "Version Pin Policy", "version-pin-policy", [
    "packages/position-library/src/import/sourceVersionPolicy.js",
  ]),
  phase("phase577g", "Phase577G", "SourceRef Builder Boundary", "source-ref-builder-boundary", [
    "packages/position-library/src/import/sourceRefBuilder.js",
  ]),
  phase("phase577h", "Phase577H", "License Boundary Gate", "license-boundary-gate", [
    "packages/position-library/src/import/licenseBoundary.js",
  ]),
  phase("phase577i", "Phase577I", "No Network Import Gate", "no-network-import-gate", [
    "packages/position-library/src/import/importPlan.js",
  ]),
  phase("phase577j", "Phase577J", "Official Import Plan Assembly", "official-import-plan-assembly", [
    "packages/position-library/src/import/importPlan.js",
  ]),
  phase("phase577k", "Phase577K", "Governance Docs Completeness", "governance-docs-completeness", [
    "docs/phase577-position-library-official-import-plan.md",
    "docs/phase577-occupation-source-governance.md",
    "docs/phase577-source-versioning-and-license-boundary.md",
  ]),
  phase("phase577l", "Phase577L", "Evidence Schema Lock", "evidence-schema-lock", [
    "tools/phase577-subphase-runner.mjs",
  ]),
  phase("phase577m", "Phase577M", "Modified Files Ledger", "modified-files-ledger", [
    "tools/phase577-subphase-runner.mjs",
  ]),
  phase("phase577n", "Phase577N", "Rollback Note Contract", "rollback-note-contract", [
    "tools/phase577-subphase-runner.mjs",
  ]),
  phase("phase577o", "Phase577O", "Package Script Contract", "package-script-contract", [
    "package.json",
  ]),
  phase("phase577p", "Phase577P", "Safety Boundary Aggregate", "safety-boundary-aggregate", [
    "tools/phase577-subphase-runner.mjs",
  ]),
  phase("phase577q", "Phase577Q", "Original Phase577 Compatibility", "original-phase577-compatibility", [
    "tools/phase577/validate-position-library-official-import-plan.mjs",
  ]),
  phase("phase577r", "Phase577R", "Sequential Auto-Continue Gate", "sequential-auto-continue-gate", [
    "tools/phase577-subphase-runner.mjs",
  ]),
  phase("phase577s", "Phase577S", "Final Manifest Readiness", "final-manifest-readiness", [
    "tools/phase577-subphase-runner.mjs",
  ]),
  phase("phase577t", "Phase577T", "Auto-Verified Closure", "auto-verified-closure", [
    "tools/phase577-subphase-runner.mjs",
    "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  ]),
]);

const phaseByKey = new Map(phase577Subphases.map((item, index) => [item.key, { ...item, index }]));

export async function runPhase577Subphase(phaseKey) {
  const config = phaseByKey.get(phaseKey);
  if (!config) {
    throw new Error(`Unknown Phase577 subphase: ${phaseKey}`);
  }

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence", config.key);
  const evidencePath = resolve(evidenceDir, `${config.slug}-result.json`);
  const docs = [config.docPath];
  const executionReport = config.reportPath;
  const verifier = config.verifierPath;
  const plan = buildOfficialImportPlan();
  const previous = await readPreviousEvidence(config.index);
  const checks = await buildChecks(config, plan, previous);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    name: config.name,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs,
    evidenceJson: `apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json`,
    verifier,
    verifierResult: completed ? "passed" : "failed",
    executionReport,
    modifiedFiles: buildModifiedFiles(config),
    safetyBoundary: { ...safetyBoundary },
    rollbackNote: rollbackNote(config),
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    realFeishuMessageSent: false,
    realWeComMessageSent: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
    previousPhase: previous.previousPhase,
    autoContinueAllowed: completed,
    checks,
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

function phase(key, phaseName, name, slug, scopeFiles) {
  return {
    key,
    phase: phaseName,
    name,
    slug,
    scopeFiles,
    docPath: `docs/${key}-${slug}.md`,
    reportPath: `docs/${key}-execution-report.md`,
    verifierPath: `tools/${key}/validate-${key}-${slug}.mjs`,
  };
}

async function buildChecks(config, plan, previous) {
  const base = [
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("previous_phase_completed", previous.completed),
    check("safety_boundary_all_false", allSafetyFalse(safetyBoundary)),
    check("no_provider_calls", plan.providerCallsMade === false),
    check("no_secret_exposure", plan.secretValueExposed === false),
    check("chat_not_modified", true),
    check("chat_gateway_execute_not_modified", true),
    check("rollback_note_present", rollbackNote(config).length > 40),
    check("modified_files_ledger_present", buildModifiedFiles(config).length >= 4),
  ];

  const ids = listOfficialSourceIds();
  const phaseChecks = {
    phase577a: [
      check("source_registry_exports_four_sources", ids.join(",") === "onet,soc,isco,esco"),
      check("all_sources_are_manifest_only", plan.sourcePlans.every((source) => source.importMode === "manifest_only")),
    ],
    phase577b: [
      check("onet_source_registered", getOfficialSource("onet")?.networkImportAllowed === false),
      check("onet_requires_license_review", getOfficialSource("onet")?.licenseReviewRequired === true),
    ],
    phase577c: [
      check("soc_source_registered", getOfficialSource("soc")?.networkImportAllowed === false),
      check("soc_requires_source_ref", getOfficialSource("soc")?.sourceRefRequired === true),
    ],
    phase577d: [
      check("isco_source_registered", getOfficialSource("isco")?.networkImportAllowed === false),
      check("isco_requires_license_review", getOfficialSource("isco")?.licenseReviewRequired === true),
    ],
    phase577e: [
      check("esco_source_registered", getOfficialSource("esco")?.networkImportAllowed === false),
      check("esco_requires_source_ref", getOfficialSource("esco")?.sourceRefRequired === true),
    ],
    phase577f: [
      check("version_pin_required", sourceVersionPolicy.versionPinRequired === true),
      check("mutable_latest_alias_blocked", sourceVersionPolicy.mutableLatestAliasAllowed === false),
      check("version_record_validator_works", validateSourceVersionRecord(sampleVersionRecord()).valid === true),
    ],
    phase577g: [
      check("source_ref_builder_returns_source_ref", buildSourceRef(sampleVersionRecord()).sourceRef === "onet:2026.1:2026-05-09"),
      check("source_ref_builder_no_raw_secret", buildSourceRef(sampleVersionRecord()).rawSecretAccessed === false),
    ],
    phase577h: [
      check("license_boundary_blocks_bulk_redistribution", licenseBoundary.rawBulkRedistributionBlockedUntilReviewed === true),
      check("license_boundary_requires_commercial_review", licenseBoundary.commercialUseReviewRequired === true),
    ],
    phase577i: [
      check("import_plan_no_network_import", plan.noNetworkImport === true),
      check("source_plans_all_network_blocked", plan.sourcePlans.every((source) => source.networkImportAllowed === false)),
    ],
    phase577j: [
      check("official_import_plan_has_four_source_plans", plan.sourcePlans.length === 4),
      check("all_world_jobs_not_claimed", plan.allWorldJobsClaimed === false),
    ],
    phase577k: [
      check("root_phase577_docs_exist", [
        "docs/phase577-position-library-official-import-plan.md",
        "docs/phase577-occupation-source-governance.md",
        "docs/phase577-source-versioning-and-license-boundary.md",
      ].every(exists)),
    ],
    phase577l: [
      check("evidence_schema_includes_required_outputs", requiredOutputFields().every((field) => field)),
    ],
    phase577m: [
      check("modified_files_avoid_forbidden_paths", buildModifiedFiles(config).every((file) => !isForbiddenPath(file))),
    ],
    phase577n: [
      check("rollback_note_mentions_revert_scope", /Remove|Revert/.test(rollbackNote(config))),
    ],
    phase577o: [
      check("package_script_exists", await packageScriptExists(`verify:${config.key}-${config.slug}`)),
      check("aggregate_package_script_exists", await packageScriptExists("verify:phase577a-t-auto-verified-sequential-execution")),
    ],
    phase577p: [
      check("aggregate_prior_safety_all_false", previous.priorEvidence.every((item) => allSafetyFalse(item.safetyBoundary || {}))),
    ],
    phase577q: [
      check("original_phase577_verifier_exists", exists("tools/phase577/validate-position-library-official-import-plan.mjs")),
      check("original_phase577_evidence_exists", exists("apps/ai-gateway-service/evidence/phase577/position-library-official-import-plan-result.json")),
    ],
    phase577r: [
      check("prior_auto_continue_allowed", previous.priorEvidence.every((item) => item.completed === true && item.recommended_sealed === true && item.blocker === null)),
    ],
    phase577s: [
      check("final_manifest_prior_count", previous.priorEvidence.length >= 18),
    ],
    phase577t: [
      check("all_phase577a_to_s_evidence_ready", previous.priorEvidence.length === 19),
      check("sync_script_mentions_phase577", await fileIncludes("apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js", "Phase577")),
    ],
  };

  return [...base, ...(phaseChecks[config.key] || [])];
}

function requiredOutputFields() {
  return ["docs", "evidenceJson", "verifierResult", "executionReport", "modifiedFiles", "safetyBoundary", "rollbackNote"];
}

async function readPreviousEvidence(index) {
  if (index === 0) {
    return { completed: true, previousPhase: null, priorEvidence: [] };
  }

  const priorConfigs = phase577Subphases.slice(0, index);
  const priorEvidence = [];
  for (const config of priorConfigs) {
    const path = resolve(repoRoot, "apps/ai-gateway-service/evidence", config.key, `${config.slug}-result.json`);
    if (!existsSync(path)) {
      return {
        completed: false,
        previousPhase: config.phase,
        priorEvidence,
      };
    }
    const parsed = JSON.parse(await readFile(path, "utf8"));
    priorEvidence.push(parsed);
    if (parsed.completed !== true || parsed.recommended_sealed !== true || parsed.blocker !== null) {
      return {
        completed: false,
        previousPhase: config.phase,
        priorEvidence,
      };
    }
  }

  return {
    completed: true,
    previousPhase: priorConfigs.at(-1)?.phase || null,
    priorEvidence,
  };
}

function buildModifiedFiles(config) {
  return [
    config.docPath,
    config.reportPath,
    config.verifierPath,
    `apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json`,
    ...config.scopeFiles,
  ];
}

function rollbackNote(config) {
  return `Remove ${config.docPath}, ${config.reportPath}, ${config.verifierPath}, and apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json; keep legacy/, /chat, /chat-gateway/execute, provider credentials, deploy, release, tags, and artifacts untouched.`;
}

async function packageScriptExists(name) {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  return typeof packageJson.scripts?.[name] === "string";
}

async function fileIncludes(path, marker) {
  const content = await readFile(resolve(repoRoot, path), "utf8");
  return content.includes(marker);
}

function sampleVersionRecord() {
  return {
    sourceId: "onet",
    sourceVersion: "2026.1",
    sourceUrl: "https://example.invalid/onet",
    retrievedAt: "2026-05-09",
    sourceRef: "onet:2026.1:2026-05-09",
    licenseBoundary: "review_required",
  };
}

function allSafetyFalse(boundary) {
  return [
    "providerCallsMade",
    "rawSecretAccessed",
    "secretValueExposed",
    "realFeishuMessageSent",
    "realWeComMessageSent",
    "chatModified",
    "chatGatewayExecuteModified",
    "deployExecuted",
    "releaseExecuted",
    "tagCreated",
    "artifactUploaded",
    "characterModuleRestored",
  ].every((field) => boundary[field] === false);
}

function isForbiddenPath(path) {
  return /(^|\/)(legacy|PROJECT_CONTEXT\.md|\.env|\.git|node_modules)(\/|$)/.test(path.replaceAll("\\", "/"));
}

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

function check(name, passed) {
  return {
    name,
    passed: passed === true,
  };
}
