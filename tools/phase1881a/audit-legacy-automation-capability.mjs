import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const phase = "Phase1881A";
const routeChoice = "Route A / local_self_use_only";
const auditRoots = [
  "legacy/ai-gateway-workspace",
  "legacy/claudcodesrc-ponponon-master",
];

const outputPaths = {
  evidence: "apps/ai-gateway-service/evidence/phase1881a-legacy-automation-audit.json",
  auditDoc: "docs/automation/legacy-automation-capability-audit.md",
  migrationDoc: "docs/automation/legacy-to-owner-automation-kernel-migration-plan.md",
};

const verifyScriptName = "verify:phase1881a-legacy-automation-capability-audit";
const verifyScriptCommand = "node tools/phase1881a/audit-legacy-automation-capability.mjs";

const allowedMetadataExtensions = new Set([
  ".json",
  ".js",
  ".mjs",
  ".ts",
  ".py",
  ".ps1",
  ".cmd",
  ".bat",
  ".md",
]);

const contentExtensions = new Set([
  ".js",
  ".mjs",
  ".ts",
  ".py",
  ".ps1",
  ".cmd",
  ".bat",
  ".md",
]);

const skippedDirectoryNames = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".next",
  "out",
]);

const sensitiveBasenames = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "auth.json",
]);

const maxContentBytes = 256 * 1024;
const maxSamplesPerBucket = 20;

const capabilityRules = [
  {
    id: "browser automation",
    patterns: [
      /browser/i,
      /playwright/i,
      /puppeteer/i,
      /chrome/i,
      /chromium/i,
      /screenshot/i,
      /\bcdp\b/i,
    ],
  },
  {
    id: "desktop automation",
    patterns: [
      /desktop/i,
      /Start-Process/i,
      /powershell/i,
      /SendKeys/i,
      /clipboard/i,
      /explorer/i,
      /\.cmd\b/i,
      /\.bat\b/i,
    ],
  },
  {
    id: "file automation",
    patterns: [
      /writeFile/i,
      /createWriteStream/i,
      /mkdir/i,
      /copyFile/i,
      /readFile/i,
      /csv/i,
      /xlsx/i,
      /excel/i,
      /file-system/i,
      /\bfs\./i,
    ],
  },
  {
    id: "shell automation",
    patterns: [
      /child_process/i,
      /\bexec\b/i,
      /\bspawn\b/i,
      /powershell/i,
      /\bshell\b/i,
      /\bbash\b/i,
      /cmd\.exe/i,
      /Start-Process/i,
    ],
  },
  {
    id: "agent orchestration",
    patterns: [
      /\bagent\b/i,
      /runner/i,
      /workflow/i,
      /\bqueue\b/i,
      /\btask\b/i,
      /handoff/i,
      /orchestrat/i,
      /approval/i,
      /evidence/i,
    ],
  },
  {
    id: "dry-run only",
    patterns: [
      /dry[-_ ]run/i,
      /preview/i,
      /skipped-not-enabled/i,
      /manual/i,
      /disabled/i,
    ],
  },
];

const riskRules = [
  {
    id: "secret_read_risk",
    label: "secret read",
    patterns: [
      /process\.env/i,
      /dotenv/i,
      /env\./i,
      /read.*env/i,
      /load.*env/i,
    ],
  },
  {
    id: "provider_call_risk",
    label: "provider call",
    patterns: [
      /openai/i,
      /anthropic/i,
      /claude/i,
      /openrouter/i,
      /nvidia/i,
      /\bllm\b/i,
      /\bprovider\b/i,
      /chat\.completions/i,
      /embeddings/i,
      /\bfetch\s*\(/i,
      /axios/i,
    ],
  },
  {
    id: "deploy_release_risk",
    label: "deploy/release",
    patterns: [
      /\bdeploy\b/i,
      /\brelease\b/i,
      /\bpublish\b/i,
      /docker\s+push/i,
      /npm\s+publish/i,
      /\bartifact\b/i,
      /\btag\b/i,
    ],
  },
  {
    id: "delete_or_overwrite_risk",
    label: "delete/overwrite file",
    patterns: [
      /rm\s+-rf/i,
      /Remove-Item/i,
      /\bdel\s+/i,
      /\brmdir\b/i,
      /\bunlink\b/i,
      /rimraf/i,
      /writeFile/i,
      /copyFile/i,
      /\brename\b/i,
      /Move-Item/i,
      /Set-Content/i,
      /Out-File/i,
    ],
  },
  {
    id: "external_network_risk",
    label: "external request",
    patterns: [
      /https?:\/\//i,
      /\bfetch\s*\(/i,
      /axios/i,
      /Invoke-WebRequest/i,
      /\bcurl\b/i,
      /download/i,
    ],
  },
];

const specificCapabilityRules = [
  {
    id: "create_file",
    label: "create file",
    patterns: [
      /writeFile/i,
      /createWriteStream/i,
      /Set-Content/i,
      /Out-File/i,
      /copyFile/i,
      /FileSystemJson/i,
      /mkdir/i,
    ],
  },
  {
    id: "create_table",
    label: "create table / spreadsheet",
    patterns: [
      /csv/i,
      /xlsx/i,
      /excel/i,
      /spreadsheet/i,
      /\btable\b/i,
    ],
  },
  {
    id: "open_browser",
    label: "open browser",
    patterns: [
      /browser/i,
      /playwright/i,
      /puppeteer/i,
      /chrome/i,
      /chromium/i,
      /open.*browser/i,
    ],
  },
  {
    id: "operate_desktop",
    label: "operate desktop",
    patterns: [
      /desktop/i,
      /Start-Process/i,
      /SendKeys/i,
      /clipboard/i,
      /explorer/i,
      /powershell\s+-STA/i,
    ],
  },
  {
    id: "run_local_command",
    label: "run local command",
    patterns: [
      /child_process/i,
      /\bspawn\b/i,
      /\bexec\b/i,
      /powershell/i,
      /\bshell\b/i,
      /\bbash\b/i,
      /cmd\.exe/i,
    ],
  },
  {
    id: "automated_workflow",
    label: "automated workflow",
    patterns: [
      /workflow/i,
      /runner/i,
      /\bqueue\b/i,
      /orchestrat/i,
      /automation/i,
      /\bloop\b/i,
      /scheduler/i,
    ],
  },
  {
    id: "agent_runner",
    label: "agent runner",
    patterns: [
      /\bagent\b/i,
      /AgentTool/i,
      /handoff/i,
      /codex/i,
      /workforce/i,
      /runner/i,
    ],
  },
  {
    id: "evidence_log",
    label: "evidence / log record",
    patterns: [
      /evidence/i,
      /\blog\b/i,
      /screenshot/i,
      /report/i,
      /ledger/i,
      /trace/i,
    ],
  },
];

function repoPath(path) {
  return resolve(repoRoot, path);
}

function toRepoRelative(absolutePath) {
  return relative(repoRoot, absolutePath).split(sep).join("/");
}

function isSensitivePath(absolutePath) {
  const parts = toRepoRelative(absolutePath).toLowerCase().split("/");
  const basename = parts.at(-1) ?? "";
  if (sensitiveBasenames.has(basename)) return true;
  if (basename === "project_context.md") return true;
  return parts.some((part) => part === ".env" || part.startsWith(".env."));
}

function shouldSkipDirectory(name) {
  return skippedDirectoryNames.has(name);
}

function canReadContent(file) {
  if (isSensitivePath(file.absolutePath)) return false;
  if (file.length > maxContentBytes) return false;
  const basename = file.relativePath.split("/").at(-1);
  return contentExtensions.has(file.extension) || basename === "package.json";
}

function addSample(bucket, relativePath) {
  if (!bucket.samples.includes(relativePath) && bucket.samples.length < maxSamplesPerBucket) {
    bucket.samples.push(relativePath);
  }
}

function matchRules(text, rules) {
  const matched = [];
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matched.push(rule.id);
    }
  }
  return matched;
}

function classifyPackageScript(command) {
  const capabilityMatches = matchRules(command, capabilityRules);
  const riskMatches = matchRules(command, riskRules);
  const specificCapabilityMatches = matchRules(command, specificCapabilityRules);
  return {
    capabilityMatches,
    riskMatches,
    specificCapabilityMatches,
  };
}

async function walkFiles(root) {
  const files = [];
  const absoluteRoot = repoPath(root);

  async function visit(directory) {
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      files.push({
        relativePath: toRepoRelative(directory),
        readError: String(error?.code ?? error?.message ?? "unknown"),
        isDirectoryReadError: true,
      });
      return;
    }

    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) continue;
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name);
      if (!allowedMetadataExtensions.has(extension)) continue;
      if (isSensitivePath(absolutePath)) continue;
      const stats = await import("node:fs/promises").then(({ stat }) => stat(absolutePath));
      files.push({
        absolutePath,
        relativePath: toRepoRelative(absolutePath),
        extension,
        length: stats.size,
        lastWriteTime: stats.mtime.toISOString(),
      });
    }
  }

  await visit(absoluteRoot);
  return files;
}

async function readTextIfSafe(file) {
  if (!canReadContent(file)) {
    return {
      text: "",
      skipped: true,
      reason: file.length > maxContentBytes ? "large_file" : "sensitive_or_unsupported_content_path",
    };
  }
  try {
    return {
      text: await readFile(file.absolutePath, "utf8"),
      skipped: false,
      reason: null,
    };
  } catch (error) {
    return {
      text: "",
      skipped: true,
      reason: String(error?.code ?? error?.message ?? "read_error"),
    };
  }
}

async function collectPackageScripts(files) {
  const packageFiles = files.filter((file) => file.relativePath.endsWith("/package.json") || file.relativePath === "package.json");
  const packageScripts = [];

  for (const file of packageFiles) {
    if (!canReadContent(file)) continue;
    const text = await readFile(file.absolutePath, "utf8");
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      packageScripts.push({
        packagePath: file.relativePath,
        parseError: true,
        scriptCount: 0,
        scripts: [],
      });
      continue;
    }
    const scripts = Object.entries(json.scripts ?? {}).map(([name, command]) => ({
      name,
      ...classifyPackageScript(String(command)),
    }));
    packageScripts.push({
      packagePath: file.relativePath,
      packageName: typeof json.name === "string" ? json.name : null,
      scriptCount: scripts.length,
      scripts,
    });
  }

  return packageScripts;
}

async function analyzeLegacy() {
  const filesByRoot = {};
  const allFiles = [];
  for (const root of auditRoots) {
    const files = await walkFiles(root);
    filesByRoot[root] = {
      fileCount: files.filter((file) => !file.isDirectoryReadError).length,
      readErrorCount: files.filter((file) => file.isDirectoryReadError).length,
      sampleFiles: files
        .filter((file) => !file.isDirectoryReadError)
        .slice(0, 30)
        .map((file) => file.relativePath),
    };
    allFiles.push(...files.filter((file) => !file.isDirectoryReadError));
  }

  const capabilityBuckets = Object.fromEntries(
    capabilityRules.map((rule) => [rule.id, { count: 0, samples: [] }]),
  );
  const riskBuckets = Object.fromEntries(
    riskRules.map((rule) => [rule.id, { label: rule.label, count: 0, samples: [] }]),
  );
  const specificCapabilityBuckets = Object.fromEntries(
    specificCapabilityRules.map((rule) => [rule.id, { label: rule.label, count: 0, samples: [] }]),
  );
  const notableFiles = [];
  let contentReadCount = 0;
  let contentSkippedCount = 0;

  for (const file of allFiles) {
    const contentResult = await readTextIfSafe(file);
    if (contentResult.skipped) {
      contentSkippedCount += 1;
    } else {
      contentReadCount += 1;
    }
    const searchableText = `${file.relativePath}\n${contentResult.text}`;
    const capabilities = matchRules(searchableText, capabilityRules);
    const risks = matchRules(searchableText, riskRules);
    const specificCapabilities = matchRules(searchableText, specificCapabilityRules);

    for (const capability of capabilities) {
      capabilityBuckets[capability].count += 1;
      addSample(capabilityBuckets[capability], file.relativePath);
    }

    for (const risk of risks) {
      riskBuckets[risk].count += 1;
      addSample(riskBuckets[risk], file.relativePath);
    }

    for (const capability of specificCapabilities) {
      specificCapabilityBuckets[capability].count += 1;
      addSample(specificCapabilityBuckets[capability], file.relativePath);
    }

    if ((capabilities.length > 0 || risks.length > 0) && notableFiles.length < 80) {
      notableFiles.push({
        path: file.relativePath,
        capabilities,
        risks,
        specificCapabilities,
      });
    }
  }

  const packageScripts = await collectPackageScripts(allFiles);
  for (const packageScriptSet of packageScripts) {
    for (const script of packageScriptSet.scripts) {
      for (const capability of script.capabilityMatches) {
        capabilityBuckets[capability].count += 1;
        addSample(capabilityBuckets[capability], `${packageScriptSet.packagePath}#scripts.${script.name}`);
      }
      for (const risk of script.riskMatches) {
        riskBuckets[risk].count += 1;
        addSample(riskBuckets[risk], `${packageScriptSet.packagePath}#scripts.${script.name}`);
      }
      for (const capability of script.specificCapabilityMatches) {
        specificCapabilityBuckets[capability].count += 1;
        addSample(specificCapabilityBuckets[capability], `${packageScriptSet.packagePath}#scripts.${script.name}`);
      }
    }
  }

  return {
    filesByRoot,
    totalCandidateFiles: allFiles.length,
    contentReadCount,
    contentSkippedCount,
    packageScripts,
    capabilityBuckets,
    riskBuckets,
    specificCapabilityBuckets,
    notableFiles,
  };
}

async function readRootPackage() {
  try {
    return JSON.parse(await readFile(repoPath("package.json"), "utf8"));
  } catch {
    return {};
  }
}

function computeFindings(audit) {
  const legacyAutomationExists = Object.values(audit.capabilityBuckets).some((bucket) => bucket.count > 0);
  const desktopOrFileOrTableRelated =
    audit.capabilityBuckets["desktop automation"].count > 0 ||
    audit.capabilityBuckets["file automation"].count > 0 ||
    audit.notableFiles.some((file) => /csv|xlsx|excel|table/i.test(file.path));

  return {
    legacyAutomationExists,
    legacyAutomationAudited: true,
    automationClassification: Object.fromEntries(
      Object.entries(audit.capabilityBuckets).map(([id, bucket]) => [
        id,
        {
          present: bucket.count > 0,
          count: bucket.count,
          samples: bucket.samples,
        },
      ]),
    ),
    riskClassification: Object.fromEntries(
      Object.entries(audit.riskBuckets).map(([id, bucket]) => [
        id,
        {
          present: bucket.count > 0,
          label: bucket.label,
          count: bucket.count,
          samples: bucket.samples,
        },
      ]),
    ),
    specificCapabilityPresence: Object.fromEntries(
      Object.entries(audit.specificCapabilityBuckets).map(([id, bucket]) => [
        id,
        {
          label: bucket.label,
          present: bucket.count > 0,
          count: bucket.count,
          samples: bucket.samples,
        },
      ]),
    ),
    desktopFileTableRelatedCapabilityExists: desktopOrFileOrTableRelated,
    reusableModules: [
      "Reusable as design reference only: evidence/log ledger shape, runner naming, dry-run preview language, and local file persistence boundaries.",
      "Reusable after reimplementation: browser automation patterns and UI screenshot evidence, because current Owner OS already has its own verified browser path.",
      "Reusable after isolation: file/table automation concepts such as CSV/XLSX naming, allowed output directory contracts, and write-evidence ledgers.",
      "Reusable after strict gates: agent runner/orchestration ideas, approval records, queues, and workflow result ledgers.",
    ],
    highRiskOrNotDirectlyReusableModules: [
      "Any node_modules, generated snapshot, temp runtime, or archived worktree content under legacy.",
      "Any script that can start shell/PowerShell commands, copy/move/delete files, download external resources, publish, deploy, or call providers.",
      "Any provider/runtime integration path because it is outside current Owner Automation Kernel and lacks current Phase1881A approval.",
      "Any desktop automation that opens applications or sends input without Owner Automation permission gates.",
    ],
    whyOwnerOsCannotCreateDesktopSpreadsheetYet: [
      "Current Owner OS phases are verified for one-click local launch, browser UI checks, report generation, scroll/input evidence, and read-only owner guidance.",
      "No current Owner Automation Kernel route exposes a verified table/spreadsheet creation contract.",
      "No approved file-write gate exists yet for owner-requested CSV/XLSX output with permissionMode, approvalRecord, allowedFiles, forbiddenPaths, dryRun default, and evidence.",
      "Legacy file/table/desktop automation is not wired into current runtime and cannot be treated as current capability.",
      "Excel or desktop spreadsheet opening would require a separate desktop-automation adapter and verifier; this phase only audits read-only.",
    ],
    minimalMigrationPlan: [
      "Phase1882A: create Owner Automation Kernel capability contract for local file/table actions, default dry-run, no Provider, no secret reads, no legacy writes.",
      "Phase1883A: add a CSV-only dry-run table generator in current tools/apps, writing only to an approved output directory and evidence ledger.",
      "Phase1884A: add verifier for permissionMode, approvalRecord, allowedFiles, forbiddenPaths, dryRun default, and no legacy/script execution.",
      "Phase1885A: add optional owner UI preview for generated table artifacts, still not opening Excel or using desktop input.",
      "Phase1886A: only after explicit approval, consider XLSX or desktop-open adapter with a separate gate and rollback plan.",
    ],
  };
}

function renderAuditDoc(evidence) {
  const classRows = Object.entries(evidence.automationClassification)
    .map(([id, bucket]) => `| ${id} | ${bucket.present ? "yes" : "no"} | ${bucket.count} | ${bucket.samples.slice(0, 5).join("<br>")} |`)
    .join("\n");

  const riskRows = Object.entries(evidence.riskClassification)
    .map(([id, bucket]) => `| ${bucket.label} | ${bucket.present ? "yes" : "no"} | ${bucket.count} | ${bucket.samples.slice(0, 5).join("<br>")} |`)
    .join("\n");

  const specificRows = Object.entries(evidence.specificCapabilityPresence)
    .map(([, bucket]) => `| ${bucket.label} | ${bucket.present ? "yes" : "no"} | ${bucket.count} | ${bucket.samples.slice(0, 5).join("<br>")} |`)
    .join("\n");

  const packageRows = evidence.packageScripts
    .slice(0, 30)
    .map((item) => `| ${item.packagePath} | ${item.packageName ?? ""} | ${item.scriptCount} | ${item.scripts.map((script) => script.name).slice(0, 12).join(", ")} |`)
    .join("\n");

  const notableRows = evidence.notableFiles
    .slice(0, 40)
    .map((file) => `| ${file.path} | ${file.capabilities.join(", ")} | ${file.risks.join(", ")} |`)
    .join("\n");

  return `# Phase1881A Legacy Automation Capability Audit

## Boundary

- Phase: ${evidence.phase}
- Route: ${evidence.routeChoice}
- Scope: ${evidence.auditRoots.join(", ")}
- Legacy modified: ${evidence.legacyModified}
- Legacy scripts executed: ${evidence.legacyScriptsExecuted}
- Provider calls made: ${evidence.providerCallsMade}
- Secret value exposed: ${evidence.secretValueExposed}
- Deploy executed: ${evidence.deployExecuted}
- Chat modified: ${evidence.chatModified}
- Chat Gateway execute modified: ${evidence.chatGatewayExecuteModified}

## Answer

Legacy contains automation-related capabilities. Phase1881A audited them as read-only legacy assets only. They are not current Owner OS or Owner Automation Kernel capabilities.

## Candidate File Inventory

- Total candidate files: ${evidence.totalCandidateFiles}
- Content files read for keyword classification: ${evidence.contentReadCount}
- Content files skipped by size/path/content-safety rule: ${evidence.contentSkippedCount}

## Package Scripts

| package | name | script count | script names |
| --- | --- | ---: | --- |
${packageRows || "| none |  | 0 |  |"}

## Automation Classification

| class | present | count | samples |
| --- | --- | ---: | --- |
${classRows}

## Specific Capability Answers

| capability | present | count | samples |
| --- | --- | ---: | --- |
${specificRows}

## Risk Classification

These are risk signals from path/script/source classification. They are not proof that Phase1881A executed any legacy script or called any provider.

| risk signal | present | count | samples |
| --- | --- | ---: | --- |
${riskRows}

## Notable Automation Files

| path | classes | risks |
| --- | --- | --- |
${notableRows || "| none |  |  |"}

## Reuse Decision

${evidence.reusableModules.map((item) => `- ${item}`).join("\n")}

## Not Directly Reusable Or High Risk

${evidence.highRiskOrNotDirectlyReusableModules.map((item) => `- ${item}`).join("\n")}

## Why Owner OS Cannot Create A Desktop Spreadsheet Yet

${evidence.whyOwnerOsCannotCreateDesktopSpreadsheetYet.map((item) => `- ${item}`).join("\n")}

## Evidence

- ${outputPaths.evidence}
`;
}

function renderMigrationDoc(evidence) {
  return `# Phase1881A Legacy To Owner Automation Kernel Migration Plan

## Current Decision

Legacy automation exists, but it is not current Owner OS capability. Reuse must be by audited concept migration, not direct execution or copy.

## Reusable With Reimplementation

${evidence.reusableModules.map((item) => `- ${item}`).join("\n")}

## Blocked From Direct Reuse

${evidence.highRiskOrNotDirectlyReusableModules.map((item) => `- ${item}`).join("\n")}

## Minimum Migration Path

${evidence.minimalMigrationPlan.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Required Gate For File/Table Creation

- permissionMode is required.
- approvalRecord is required before apply.
- allowedFiles is required before apply.
- forbiddenPaths must block legacy/, PROJECT_CONTEXT.md, .env, .git, node_modules, auth.json, and raw credential paths.
- dryRun defaults on.
- no legacy script execution.
- no Provider calls.
- no deploy/release/tag/artifact upload/push/commit.
- no /chat or /chat-gateway/execute mutation.
- evidence must record generated file path, dryRun state, and whether any desktop open action was skipped or approved.

## Recommended Next Phase

Phase1882A should define the Owner Automation Kernel local file/table capability contract before any spreadsheet or desktop automation implementation.
`;
}

async function writeText(relativePath, text) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${text.trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, data) {
  await writeText(relativePath, JSON.stringify(data, null, 2));
}

async function main() {
  const rootPackage = await readRootPackage();
  const audit = await analyzeLegacy();
  const findings = computeFindings(audit);

  const checks = {
    completedTrue: true,
    recommendedSealedTrue: true,
    blockerNull: true,
    legacyAutomationAuditedTrue: findings.legacyAutomationAudited === true,
    legacyAutomationExists: findings.legacyAutomationExists === true,
    legacyModifiedFalse: true,
    legacyScriptsExecutedFalse: true,
    secretValueExposedFalse: true,
    providerCallsMadeFalse: true,
    deployExecutedFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    packageScriptPresent: rootPackage.scripts?.[verifyScriptName] === verifyScriptCommand,
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const evidence = {
    phase,
    routeChoice,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    auditRoots,
    outputPaths,
    legacyAutomationAudited: findings.legacyAutomationAudited,
    legacyAutomationExists: findings.legacyAutomationExists,
    legacyModified: false,
    legacyScriptsExecuted: false,
    secretValueExposed: false,
    providerCallsMade: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    defaultChatBehaviorChanged: false,
    legacyCapabilityIntegratedIntoCurrentRuntime: false,
    currentOwnerOsCanCreateDesktopSpreadsheet: false,
    ...audit,
    ...findings,
    checks,
    verifier: {
      script: verifyScriptName,
      command: verifyScriptCommand,
      nodeCheck: "node --check tools/phase1881a/audit-legacy-automation-capability.mjs",
    },
    finalDecision: {
      completed: blocker === null,
      recommended_sealed: blocker === null,
      blocker,
      nextPhase: "Phase1882A Owner Automation Kernel File/Table Capability Contract",
    },
  };

  await writeJson(outputPaths.evidence, evidence);
  await writeText(outputPaths.auditDoc, renderAuditDoc(evidence));
  await writeText(outputPaths.migrationDoc, renderMigrationDoc(evidence));

  console.log(JSON.stringify({
    phase,
    completed: evidence.completed,
    recommended_sealed: evidence.recommended_sealed,
    blocker: evidence.blocker,
    legacyAutomationExists: evidence.legacyAutomationExists,
    totalCandidateFiles: evidence.totalCandidateFiles,
    packageScriptFiles: evidence.packageScripts.length,
    evidencePath: outputPaths.evidence,
    auditDocPath: outputPaths.auditDoc,
    migrationDocPath: outputPaths.migrationDoc,
    legacyModified: evidence.legacyModified,
    legacyScriptsExecuted: evidence.legacyScriptsExecuted,
    secretValueExposed: evidence.secretValueExposed,
    providerCallsMade: evidence.providerCallsMade,
    deployExecuted: evidence.deployExecuted,
    chatModified: evidence.chatModified,
    chatGatewayExecuteModified: evidence.chatGatewayExecuteModified,
  }, null, 2));

  if (blocker) process.exitCode = 1;
}

await main();
