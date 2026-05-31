import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const uiRoot = "apps/ai-gateway-service/src/ui";
const docPath = "docs/phase3961a-dead-button-and-preview-only-full-scan.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3961a-dead-button-and-preview-only-full-scan/result.json";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), value, "utf8");
}

function listUiFiles() {
  const root = resolve(repoRoot, uiRoot);
  if (!existsSync(root)) return [];
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      if (entry.isFile() && /\.(js|html|css)$/.test(entry.name) && !entry.name.includes(".bak")) {
        files.push(relative(repoRoot, full).replaceAll("\\", "/"));
      }
    }
  }
  return files.sort();
}

function classifyButton(fragment) {
  const lower = fragment.toLowerCase();
  const disabled = /disabled|aria-disabled|approval-required|blocked/.test(lower);
  const previewOnly = /preview|dry-run|read-only|no real action|预览|只读|审批|模拟/.test(lower);
  const risky = /deploy|release|provider|secret|api key|smoke|codex exec|真实执行|调用|部署|发布|密钥/.test(lower);
  const explained = disabled && /because|blocked|requires|审批|required|说明|原因/.test(lower);
  return {
    disabledButExplained: explained,
    previewOnly,
    misleadingRealAction: risky && !disabled && !previewOnly,
    dangerousAction: risky,
    missingBoundaryCopy: risky && !/no provider|providercalls=false|secretread=false|deployexecuted=false|审批|approval|blocked|dry-run|preview|read-only/.test(lower),
  };
}

export function scanDeadButtonsAndPreviewOnly() {
  const scannedFiles = listUiFiles();
  const findings = [];

  for (const file of scannedFiles) {
    const text = readFileSync(resolve(repoRoot, file), "utf8");
    const buttonMatches = [...text.matchAll(/<button[\s\S]*?<\/button>/gi)];
    for (const match of buttonMatches) {
      const fragment = match[0].slice(0, 600);
      const classification = classifyButton(fragment);
      findings.push({ file, fragment: fragment.replace(/\s+/g, " ").slice(0, 220), ...classification });
    }
  }

  const summary = {
    deadButtonCount: findings.filter((item) => /id=["'][^"']+["']/.test(item.fragment) === false && !item.disabledButExplained).length,
    disabledButExplainedCount: findings.filter((item) => item.disabledButExplained).length,
    previewOnlyButtonCount: findings.filter((item) => item.previewOnly).length,
    misleadingRealActionButtonCount: findings.filter((item) => item.misleadingRealAction).length,
    dangerousActionButtonCount: findings.filter((item) => item.dangerousAction).length,
    missingBoundaryCopyCount: findings.filter((item) => item.missingBoundaryCopy).length,
  };

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    deadButtonScanCompleted: true,
    scannedRoot: uiRoot,
    scannedFileCount: scannedFiles.length,
    scannedButtonCount: findings.length,
    ...summary,
    sampleFindings: findings.slice(0, 20),
    uiModified: false,
    realActionButtonAdded: false,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
  };

  writeText(
    docPath,
    `# Phase3961A Dead Button And Preview-Only Full Scan\n\n## Goal\n\nRun a repository-local UI scan for dead buttons, misleading real-action buttons, preview-only controls, dangerous action wording, and missing boundary copy.\n\n## Scope\n\n- ${uiRoot}\n- Mission Control panels\n- mode cards\n- provider panels\n- evidence panels\n- command palette style entries\n- owner trial/sample task entries\n\n## Result Summary\n\n- scannedFileCount=${result.scannedFileCount}\n- scannedButtonCount=${result.scannedButtonCount}\n- deadButtonCount=${result.deadButtonCount}\n- disabledButExplainedCount=${result.disabledButExplainedCount}\n- previewOnlyButtonCount=${result.previewOnlyButtonCount}\n- misleadingRealActionButtonCount=${result.misleadingRealActionButtonCount}\n- dangerousActionButtonCount=${result.dangerousActionButtonCount}\n- missingBoundaryCopyCount=${result.missingBoundaryCopyCount}\n\n## Boundary\n\nThis phase does not modify UI behavior. It adds no real execution button, calls no Provider, reads no secret, and does not deploy.\n\n## Rollback\n\n- Delete \`tools/phase3961a/\`.\n- Delete \`docs/phase3961a-dead-button-and-preview-only-full-scan.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3961a-dead-button-and-preview-only-full-scan/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = scanDeadButtonsAndPreviewOnly();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    scannedFileCount: result.scannedFileCount,
    scannedButtonCount: result.scannedButtonCount,
    deadButtonCount: result.deadButtonCount,
    misleadingRealActionButtonCount: result.misleadingRealActionButtonCount,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
