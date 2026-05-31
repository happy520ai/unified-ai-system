import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const repoRoot = process.cwd();

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function readText(relativePath) {
  try {
    return readFileSync(repoPath(relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

export function readJson(relativePath) {
  try {
    if (!existsSync(repoPath(relativePath))) {
      return { exists: false, data: null, parseError: null };
    }
    return { exists: true, data: JSON.parse(readText(relativePath)), parseError: null };
  } catch (error) {
    return { exists: true, data: null, parseError: error instanceof Error ? error.message : String(error) };
  }
}

export function writeJson(relativePath, data) {
  const absolutePath = repoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, text) {
  const absolutePath = repoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${String(text).trimEnd()}\n`, "utf8");
}

export function pathExists(relativePath) {
  return existsSync(repoPath(relativePath));
}

export function check(id, passed, details = undefined) {
  return { id, passed: Boolean(passed), ...(details === undefined ? {} : { details }) };
}

export function allPassed(checks) {
  return checks.every((item) => item.passed === true);
}

export function finish({ result, checks, evidencePath, failedBlockerPrefix, exitOnUnsealed = true }) {
  const failed = checks.filter((item) => !item.passed).map((item) => item.id);
  if (failed.length > 0 && result.blocker === null) {
    result.recommended_sealed = false;
    result.blocker = `${failedBlockerPrefix}:${failed.join(",")}`;
  }
  result.checks = checks;
  writeJson(evidencePath, result);
  console.log(JSON.stringify(result, null, 2));
  if (exitOnUnsealed && (result.completed !== true || result.recommended_sealed !== true || result.blocker)) {
    process.exitCode = 1;
  }
}

export function safetyFalseFields(extra = {}) {
  return {
    providerCallsMade: false,
    paidApiCalled: false,
    mimoCalled: false,
    openaiCalled: false,
    claudeCalled: false,
    openrouterCalled: false,
    nvidiaCalled: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
    ...extra,
  };
}

export function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

export function hasAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

export async function importFresh(relativePath) {
  const url = pathToFileURL(repoPath(relativePath)).href;
  return import(`${url}?phase=${Date.now()}-${Math.random()}`);
}

export function approvalTemplatePath(inputPath) {
  return inputPath.replace(/\.input\.json$/u, ".input.template.json");
}

export function ensureApprovalTemplate(inputPath, template) {
  const templatePath = approvalTemplatePath(inputPath);
  if (!pathExists(inputPath) && !pathExists(templatePath)) {
    writeJson(templatePath, template);
  }
  return templatePath;
}

export function readApproval(inputPath, template) {
  const templatePath = ensureApprovalTemplate(inputPath, template);
  const input = readJson(inputPath);
  return {
    exists: input.exists,
    data: input.data,
    parseError: input.parseError,
    templatePath,
  };
}

export function phaseEvidencePath(phase, fileName) {
  return join("apps/ai-gateway-service/evidence", phase.toLowerCase(), fileName);
}

export function createExecutionReport({ phase, title, result }) {
  return `# ${phase} ${title}

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker ?? "null"}
- providerCallsMade: ${result.providerCallsMade}
- secretValueExposed: ${result.secretValueExposed}
- workspaceCleanClaimed: ${result.workspaceCleanClaimed}
`;
}
