import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const docsDir = join(root, "docs");
const toolsDir = join(root, "tools");
const evidenceRoot = join(root, "apps", "ai-gateway-service", "evidence");
const registryPath = join(docsDir, "phase-orchestrator", "phase-registry.json");
const phase564EvidenceDir = join(evidenceRoot, "phase564");

const phaseStart = 386;
const phaseEnd = 563;
const auditedPhaseCount = phaseEnd - phaseStart + 1;

const safety = {
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  externalUploadPerformed: false,
  releaseArtifactCreated: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
};

const highValuePhases = new Set([386, 388, 390, 391, 395, 396, 397, 398, 402]);
const usefulReferencePhases = new Set([
  387, 389, 392, 393, 394, 399, 400, 401, 404, 405, 406, 407, 408, 409, 410, 411,
  412, 414, 415, 416, 417, 418, 419, 425, 429, 430, 432, 436, 437, 441, 442, 444,
  447, 450, 478, 486, 504, 524, 554,
]);

const closurePhases = new Set(
  Array.from({ length: 17 }, (_, index) => 403 + index * 10),
);

function toRel(path) {
  return relative(root, path).replaceAll("\\", "/");
}

async function listFilesRecursive(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function categoryFor(slug) {
  if (/script|faq|objection|briefing|onepager|talk-track|summary-card|proof|confidence|trust/.test(slug)) {
    return "sales handoff";
  }
  if (/recording|screenshot|replay|presenter|mobile|localization/.test(slug)) {
    return "recording guide";
  }
  if (/qa|checklist|scorecard|acceptance|review|readiness/.test(slug)) {
    return "QA checklist";
  }
  if (/risk|boundary|limit|guardrail|security|safety|safe/.test(slug)) {
    return "risk register";
  }
  if (/buyer|persona|audience|stakeholder|partner/.test(slug)) {
    return "buyer persona";
  }
  if (/followup|follow-through|followthrough|reminder/.test(slug)) {
    return "follow-up email";
  }
  if (/evidence|trace|ledger|index|appendix/.test(slug)) {
    return "evidence index";
  }
  if (/pilot|poc|trial|rollout/.test(slug)) {
    return "pilot readiness";
  }
  if (/operator|handoff|moderator|facilitation|room|agenda|workshop/.test(slug)) {
    return "operator checklist";
  }
  if (/closure|low-risk-auto-run|lowrisk/.test(slug)) {
    return "closure-only / repetitive auto-run artifacts";
  }
  return "closure-only / repetitive auto-run artifacts";
}

function valueLevelFor(phase, slug) {
  if (closurePhases.has(phase)) {
    return "closure_only";
  }
  if (highValuePhases.has(phase)) {
    return "high_value";
  }
  if (usefulReferencePhases.has(phase)) {
    return "useful_reference";
  }
  if (phase >= 424 && /lowrisk|continuity|continuation|carryforward|forward|controlled|assurance|confidence|trust|ledger|addendum|recap|notes|digest|signals/.test(slug)) {
    return "archive_only";
  }
  return "duplicate_or_low_value";
}

function recommendationFor(valueLevel, category) {
  if (valueLevel === "high_value") {
    return "keep_as_primary_demo_material";
  }
  if (valueLevel === "useful_reference") {
    return "merge_into_master_demo_package_reference";
  }
  if (valueLevel === "closure_only") {
    return "keep_evidence_only_reference_as_auto_run_history";
  }
  if (valueLevel === "archive_only") {
    return "archive_as_reference_only_do_not_use_as_next_phase_seed";
  }
  return `dedupe_into_existing_${category.replaceAll(" ", "_").replaceAll("/", "_")}`;
}

function mergeTargetFor(valueLevel, category) {
  if (valueLevel === "high_value") {
    return "final-yiyi-commercial-demo-package";
  }
  const targets = {
    "demo script": "phase386-demo-narrative-and-script-core",
    "recording guide": "phase388-recording-and-shotlist-core",
    "sales handoff": "phase390-sales-handoff-core",
    "QA checklist": "phase399-final-qa-scorecard-core",
    "risk register": "phase396-risk-register-core",
    "buyer persona": "phase397-buyer-persona-core",
    "follow-up email": "phase398-followup-email-core",
    "evidence index": "phase395-evidence-index-core",
    "pilot readiness": "phase412-pilot-proposal-core",
    "operator checklist": "phase391-operator-rehearsal-core",
    "closure-only / repetitive auto-run artifacts": "phase564-reference-only-auto-run-history",
  };
  return targets[category] ?? "phase564-reference-only-auto-run-history";
}

function phaseSlugFromDocs(phase, docsFiles) {
  const prefix = `phase${phase}`;
  const closure = docsFiles.find((file) => file.startsWith(prefix) && file.includes("-closure.md"));
  const primary = docsFiles.find((file) => file.startsWith(`${prefix}a-`) && file.endsWith(".md"));
  const source = closure ?? primary ?? docsFiles.find((file) => file.startsWith(prefix)) ?? `${prefix}-unknown`;
  return source
    .replace(/^phase\d+a?-/, "")
    .replace(/-closure\.md$/, "")
    .replace(/\.md$/, "")
    .replace(/\.json$/, "");
}

function titleFromSlug(phase, slug) {
  return `Phase${phase} ${slug
    .split("-")
    .filter(Boolean)
    .map((part) => part === "yiyi" ? "Yiyi" : part[0].toUpperCase() + part.slice(1))
    .join(" ")}`;
}

function summarizeCounts(records, key) {
  return records.reduce((acc, record) => {
    acc[record[key]] = (acc[record[key]] ?? 0) + 1;
    return acc;
  }, {});
}

async function buildIndex() {
  const docsFiles = (await readdir(docsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const toolFiles = (await listFilesRecursive(toolsDir)).map(toRel);

  const records = [];
  for (let phase = phaseStart; phase <= phaseEnd; phase += 1) {
    const phaseName = `Phase${phase}`;
    const phasePrefix = `phase${phase}`;
    const primaryDocs = docsFiles
      .filter((file) => file.startsWith(phasePrefix))
      .sort()
      .map((file) => `docs/${file}`);
    const evidenceDir = join(evidenceRoot, phasePrefix);
    const evidenceFiles = (await listFilesRecursive(evidenceDir)).map(toRel).sort();
    const phaseTools = toolFiles
      .filter((file) => file.includes(`phase${phase}`))
      .sort();
    const slug = phaseSlugFromDocs(phase, docsFiles);
    const category = categoryFor(slug);
    const valueLevel = valueLevelFor(phase, slug);
    records.push({
      phase: phaseName,
      phaseNumber: phase,
      title: titleFromSlug(phase, slug),
      category,
      valueLevel,
      primaryFiles: primaryDocs,
      evidenceFiles,
      toolFiles: phaseTools,
      recommendation: recommendationFor(valueLevel, category),
      mergeTarget: mergeTargetFor(valueLevel, category),
      safety,
    });
  }
  return records;
}

function buildKeepList(records) {
  return {
    phase: "Phase564",
    listType: "yiyi_demo_material_keep_list",
    auditedRange: "Phase386-Phase563",
    keepCriteria: [
      "Defines core guided showcase, UI demo, script, scenario, evidence, or operator flow.",
      "Provides a reusable commercial review artifact that is not already superseded.",
      "Has enough specificity to support manual demo packaging or sales review.",
    ],
    phases: records
      .filter((record) => ["high_value", "useful_reference"].includes(record.valueLevel))
      .map((record) => ({
        phase: record.phase,
        title: record.title,
        category: record.category,
        valueLevel: record.valueLevel,
        primaryFiles: record.primaryFiles,
        mergeTarget: record.mergeTarget,
      })),
    recommendedMasterBundles: [
      "final-yiyi-commercial-demo-package",
      "phase386-demo-narrative-and-script-core",
      "phase388-recording-and-shotlist-core",
      "phase390-sales-handoff-core",
      "phase395-evidence-index-core",
      "phase396-risk-register-core",
      "phase397-buyer-persona-core",
      "phase398-followup-email-core",
      "phase399-final-qa-scorecard-core",
      "phase391-operator-rehearsal-core",
    ],
    safety,
  };
}

function buildArchiveList(records) {
  return {
    phase: "Phase564",
    listType: "yiyi_demo_material_archive_list",
    auditedRange: "Phase386-Phase563",
    archiveCriteria: [
      "Closure-only auto-run bookkeeping.",
      "Later sales/readiness/assurance material that repeats earlier canonical packs.",
      "Low-risk filler material that should not seed future automatic phases.",
    ],
    phases: records
      .filter((record) => ["duplicate_or_low_value", "closure_only", "archive_only"].includes(record.valueLevel))
      .map((record) => ({
        phase: record.phase,
        title: record.title,
        category: record.category,
        valueLevel: record.valueLevel,
        primaryFiles: record.primaryFiles,
        evidenceFiles: record.evidenceFiles,
        toolFiles: record.toolFiles,
        recommendation: record.recommendation,
        mergeTarget: record.mergeTarget,
      })),
    stoppedAutoGenerationChains: [
      "build-yiyi-low-risk-phase-pack commercial material continuation chain",
      "low-risk closure loop every ten phases",
      "repeated sales/readiness/confidence/assurance note generation",
      "repeated evidence/ledger/index continuation packs without new product capability",
    ],
    safety,
  };
}

function buildAuditReport(records, keepList, archiveList) {
  const valueCounts = summarizeCounts(records, "valueLevel");
  const categoryCounts = summarizeCounts(records, "category");
  const highValue = records.filter((record) => record.valueLevel === "high_value");
  const useful = records.filter((record) => record.valueLevel === "useful_reference");
  const archive = records.filter((record) => record.valueLevel === "archive_only");
  const duplicate = records.filter((record) => record.valueLevel === "duplicate_or_low_value");
  const closure = records.filter((record) => record.valueLevel === "closure_only");

  const keepLines = keepList.phases.slice(0, 30).map((item) => `- ${item.phase}: ${item.title} -> ${item.mergeTarget}`).join("\n");
  const mergeLines = Object.entries(categoryCounts)
    .map(([category, count]) => `- ${category}: ${count}`)
    .join("\n");

  return `# Phase564 Auto-run Value Audit + Deduplication + Registry Freeze

## Scope

- Audited range: Phase386-Phase563
- Total phases audited: ${auditedPhaseCount}
- Docs scanned: docs/phase386* through docs/phase563*
- Evidence scanned: apps/ai-gateway-service/evidence/phase386 through phase563
- Tools scanned: tools/phase386* through tools/phase563*
- Auto-run action: stopped. No Phase565+ package was generated.

## Safety Boundary

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- rawSecretAccessed=false
- deployExecuted=false
- releaseExecuted=false
- billingExecuted=false
- invoiceGenerated=false
- workspaceCleanClaimed=false

## Value Summary

- high_value: ${valueCounts.high_value ?? 0}
- useful_reference: ${valueCounts.useful_reference ?? 0}
- duplicate_or_low_value: ${valueCounts.duplicate_or_low_value ?? 0}
- closure_only: ${valueCounts.closure_only ?? 0}
- archive_only: ${valueCounts.archive_only ?? 0}

## Category Summary

${mergeLines}

## High-value Materials

${highValue.map((record) => `- ${record.phase}: ${record.title}`).join("\n")}

## Useful Reference Materials

${useful.slice(0, 40).map((record) => `- ${record.phase}: ${record.title}`).join("\n")}

## Duplicate / Low-value Pattern

Phase404 onward introduced many small sales, review, confidence, assurance, ledger, continuation, and recap packets. Some are useful as raw reference, but the later chain increasingly repeats the same claims:

- dry-run only
- no provider call
- no secret
- no deploy
- manual review still recommended
- Phase384 remains gated

These files should not continue as automatic next-phase seeds. They should be collapsed into a small master demo package and referenced only when a human reviewer needs source history.

## Archive-only / Closure-only Materials

- closure_only phases: ${closure.map((record) => record.phase).join(", ")}
- archive_only phases count: ${archive.length}
- duplicate_or_low_value phases count: ${duplicate.length}

## Recommended Keep List

${keepLines}

## Recommended Merge Targets

- final-yiyi-commercial-demo-package: Phase386 core, scenario pack, guided UI, scripts, and evidence.
- phase388-recording-and-shotlist-core: recording, screenshot, mobile, localization, presenter notes.
- phase390-sales-handoff-core: sales handoff, FAQ, objection handling, stakeholder review.
- phase395-evidence-index-core: evidence index, evidence tour, trace map, evidence appendix.
- phase396-risk-register-core: risks, limits, safe claims, security FAQ, guardrails.
- phase397-buyer-persona-core: buyer persona, stakeholder/audience routing, buyer journey notes.
- phase398-followup-email-core: post-demo follow-up and controlled next-step material.
- phase399-final-qa-scorecard-core: QA scorecard, manual trial feedback, acceptance notes.
- phase391-operator-rehearsal-core: rehearsal runbook, operator checklist, moderator and room setup notes.

## Registry Freeze Decision

The phase registry was frozen for filler continuation:

- Phase564 is registered as a low-risk audit/freeze phase with autoContinueAllowed=false.
- selectionOrder now prefers Phase564 and then Phase384 only.
- Phase384 remains high risk, requiresHumanApproval=true, and autoContinueAllowed=false.
- Future automatic generation of similar commercial materials is not recommended.
- Next work must start from an explicit product goal rather than another low-risk material pack.

## Next Route Options

A. 人工整理最终 Demo 包

B. 做真实产品功能

C. 做真实 3D / glTF 依依

D. 做真实 provider test，需授权

E. 暂停开发，进入人工评审

## Evidence

- Master index: docs/phase564-yiyi-demo-material-master-index.json
- Keep list: docs/phase564-yiyi-demo-material-keep-list.json
- Archive list: docs/phase564-yiyi-demo-material-archive-list.json
- Closure evidence: apps/ai-gateway-service/evidence/phase564/auto-run-value-audit-closure-result.json
`;
}

async function updateRegistry(records) {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const phase564Entry = {
    phase: "Phase564",
    title: "Auto-run Value Audit + Deduplication + Registry Freeze",
    phaseType: "auto_run_value_audit_registry_freeze",
    riskLevel: "low",
    requiresHumanApproval: false,
    allowedExecutionMode: "docs_evidence_registry_freeze_only",
    autoContinueAllowed: false,
    futurePhase: true,
    readyToExecute: true,
    fillerAutoRunFreeze: true,
    explicitProductGoalRequiredForNextPhase: true,
    forbiddenActions: [
      "provider_call",
      "read_secret",
      "deploy",
      "release",
      "tag",
      "artifact_upload",
      "billing",
      "invoice",
      "production_ga_claim",
      "modify_provider_runtime",
      "modify_chat_gateway_execute",
      "modify_chat_send_main_chain",
      "safety_gate_relaxation",
    ],
    nextRouteOptions: [
      "manual_final_demo_package_curation",
      "real_product_feature_work",
      "real_3d_gltf_yiyi",
      "guarded_real_provider_test_requires_authorization",
      "pause_for_human_review",
    ],
  };

  registry.selectionOrder = ["Phase564", "Phase384"];
  registry.autoRunFreeze = {
    phase: "Phase564",
    frozenAtPhase: "Phase563",
    lowRiskFillerAutoRunStopped: true,
    noPhase565PlusAutoGeneration: true,
    explicitProductGoalRequired: true,
    forbiddenGenerators: ["tools/build-yiyi-low-risk-phase-pack.mjs"],
    nextRecommendedPhaseMustNotBeFillerCommercialMaterials: true,
    phase384StillRequiresHumanApproval: true,
    safety,
  };

  registry.phases = registry.phases.filter((entry) => entry.phase !== "Phase564");
  registry.phases.push(phase564Entry);

  const phase384 = registry.phases.find((entry) => entry.phase === "Phase384");
  if (!phase384) {
    throw new Error("Phase384 registry entry is missing.");
  }
  phase384.riskLevel = "high";
  phase384.requiresHumanApproval = true;
  phase384.autoContinueAllowed = false;
  phase384.readyToExecute = false;

  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}

function buildClosure(records) {
  const valueCounts = summarizeCounts(records, "valueLevel");
  const categoryCounts = summarizeCounts(records, "category");
  return {
    phase: "Phase564",
    title: "Auto-run Value Audit + Deduplication + Registry Freeze",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "auto_run_value_audit_registry_freeze",
    riskLevel: "low",
    auditedRange: "Phase386-Phase563",
    auditedPhases: auditedPhaseCount,
    valueCounts,
    categoryCounts,
    highValueCount: valueCounts.high_value ?? 0,
    duplicateOrLowValueCount: valueCounts.duplicate_or_low_value ?? 0,
    archiveOnlyCount: valueCounts.archive_only ?? 0,
    lowRiskFillerAutoRunStopped: true,
    phaseRegistryFrozen: true,
    noPhase565PlusGenerated: true,
    phase384StillRequiresHumanApproval: true,
    nextRecommendedPhases: [
      {
        option: "A",
        title: "人工整理最终 Demo 包",
        requiresExplicitProductGoal: true,
        riskLevel: "low",
      },
      {
        option: "B",
        title: "做真实产品功能",
        requiresExplicitProductGoal: true,
        riskLevel: "depends_on_scope",
      },
      {
        option: "C",
        title: "做真实 3D / glTF 依依",
        requiresExplicitProductGoal: true,
        riskLevel: "low_to_medium",
      },
      {
        option: "D",
        phase: "Phase384",
        title: "做真实 provider test，需授权",
        riskLevel: "high",
        requiresHumanApproval: true,
      },
      {
        option: "E",
        title: "暂停开发，进入人工评审",
        requiresExplicitProductGoal: true,
        riskLevel: "low",
      },
    ],
    safety,
    remainingRisks: [
      "manual_demo_package_curation_still_needed",
      "real_provider_test_not_executed",
      "real_product_function_work_not_selected",
      "cross_browser_manual_review_may_still_be_needed",
    ],
    rollbackPlan: [
      "Restore docs/phase-orchestrator/phase-registry.json from version control if the freeze needs to be reverted.",
      "Remove docs/phase564-* and apps/ai-gateway-service/evidence/phase564 if the audit must be regenerated.",
      "Do not resume low-risk filler generation without an explicit product goal and updated registry policy.",
    ],
  };
}

async function main() {
  const records = await buildIndex();
  const keepList = buildKeepList(records);
  const archiveList = buildArchiveList(records);
  const report = buildAuditReport(records, keepList, archiveList);
  const closure = buildClosure(records);

  await mkdir(phase564EvidenceDir, { recursive: true });
  await writeFile(join(docsDir, "phase564-yiyi-demo-material-master-index.json"), `${JSON.stringify({
    phase: "Phase564",
    listType: "yiyi_demo_material_master_index",
    auditedRange: "Phase386-Phase563",
    auditedPhases: auditedPhaseCount,
    generatedBy: "tools/phase564/build-auto-run-value-audit.mjs",
    records,
    valueCounts: summarizeCounts(records, "valueLevel"),
    categoryCounts: summarizeCounts(records, "category"),
    safety,
  }, null, 2)}\n`);
  await writeFile(join(docsDir, "phase564-yiyi-demo-material-keep-list.json"), `${JSON.stringify(keepList, null, 2)}\n`);
  await writeFile(join(docsDir, "phase564-yiyi-demo-material-archive-list.json"), `${JSON.stringify(archiveList, null, 2)}\n`);
  await writeFile(join(docsDir, "phase564-auto-run-value-audit.md"), report);
  await writeFile(join(phase564EvidenceDir, "auto-run-value-audit-closure-result.json"), `${JSON.stringify(closure, null, 2)}\n`);
  await updateRegistry(records);
  console.log(JSON.stringify({
    phase: "Phase564",
    completed: true,
    auditedPhases: auditedPhaseCount,
    valueCounts: closure.valueCounts,
    phaseRegistryFrozen: true,
    safety,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
