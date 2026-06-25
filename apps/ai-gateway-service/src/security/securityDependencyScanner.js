import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readJson } from "../entrypoints/entrypointUtils.js";

export function scanDependencyScriptRisk(repoRoot) {
  const rootPackage = readJson(resolve(repoRoot, "package.json"));
  const servicePackage = readJson(resolve(repoRoot, "apps/ai-gateway-service/package.json"));
  const allScripts = {
    ...rootPackage.scripts,
    ...Object.fromEntries(Object.entries(servicePackage.scripts ?? {}).map(([key, value]) => [`service:${key}`, value])),
  };
  const entries = Object.entries(allScripts);
  const autoCommitPushRelease = entries.filter(([, command]) => /\bgit\s+(commit|push)|gh\s+pr|gh\s+release|npm\s+publish|docker\s+push/i.test(command));
  const installHooks = entries.filter(([name]) => /postinstall|preinstall|prepare/i.test(name));
  const controlledRunnerScripts = entries.filter(([name, command]) => /codex|workflow|agent:auto/i.test(`${name} ${command}`));
  const findings = [];

  for (const [name, command] of autoCommitPushRelease) {
    findings.push({
      id: `script-auto-publish-${findings.length + 1}`,
      severity: "medium",
      dimension: "Dependency / Script Risk",
      file: "package.json",
      message: `Script ${name} needs manual review for publish/commit/push behavior.`,
      commandPreviewRecorded: command.slice(0, 80),
    });
  }

  for (const [name] of controlledRunnerScripts.slice(0, 1)) {
    findings.push({
      id: "controlled-runner-scripts-present",
      severity: "info",
      dimension: "Dependency / Script Risk",
      file: "package.json",
      message: `Controlled runner-related scripts are present, including ${name}; Phase 280A did not execute them.`,
    });
  }

  return {
    status: autoCommitPushRelease.length === 0 && installHooks.length === 0 ? (controlledRunnerScripts.length > 0 ? "warn" : "pass") : "warn",
    findings,
    packageScriptsChecked: entries.length,
    controlledRunnerScriptCount: controlledRunnerScripts.length,
    dangerousInstallHookCount: installHooks.length,
    autoCommitPushReleaseCount: autoCommitPushRelease.length,
    pnpmAuditStatus: "audit_unavailable_not_executed_no_network",
    newDependencyInstalled: false,
  };
}

