import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../../../..");
export const rootPackagePath = resolve(repoRoot, "package.json");

function check({
  id,
  category,
  command,
  rootScriptName = null,
  description,
  cadence = [],
  requiresEnv = [],
  providerCallRisk = false,
  manualApprovalRequired = false,
  defaultRunnable = false,
}) {
  return {
    id,
    category,
    command,
    rootScriptName,
    description,
    cadence,
    requiresEnv,
    providerCallRisk,
    manualApprovalRequired,
    defaultRunnable,
  };
}

export const safeDefaultChecks = [
  check({
    id: "phase107a-secret-safety",
    category: "safe-default",
    command: "cmd /c pnpm run verify:phase107a-secret-safety",
    rootScriptName: "verify:phase107a-secret-safety",
    description: "Secret safety verifier; safe for default local regression.",
    cadence: ["daily", "release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase12a-health",
    category: "safe-default",
    command: "cmd /c pnpm run health:phase12a",
    rootScriptName: "health:phase12a",
    description: "Local health check command.",
    cadence: ["daily", "release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase13a-doctor",
    category: "safe-default",
    command: "cmd /c pnpm run doctor:phase13a",
    rootScriptName: "doctor:phase13a",
    description: "Local doctor command; includes workspace checks.",
    cadence: ["daily", "release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "workspace-check",
    category: "safe-default",
    command: "cmd /c pnpm -r --if-present check",
    description: "Workspace package check; does not require provider credentials.",
    cadence: ["daily", "release-preflight"],
    defaultRunnable: true,
  }),
];

export const localPreviewChecks = [
  check({
    id: "phase278a-free-model-daily-knowledge-enrichment",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase278a-free-model-daily-knowledge-enrichment",
    rootScriptName: "verify:phase278a-free-model-daily-knowledge-enrichment",
    description: "Local preview evidence verifier for daily knowledge enrichment.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase281a-operational-readiness-decision-gate",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase281a-operational-readiness-decision-gate",
    rootScriptName: "verify:phase281a-operational-readiness-decision-gate",
    description: "Operational readiness decision gate verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase282a-commit-readiness-preflight",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase282a-commit-readiness-preflight",
    rootScriptName: "verify:phase282a-commit-readiness-preflight",
    description: "Commit readiness preflight verifier; no commit is performed.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase283a-ui-release-readiness-preflight",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase283a-ui-release-readiness-preflight",
    rootScriptName: "verify:phase283a-ui-release-readiness-preflight",
    description: "UI and release-readiness preflight verifier; no release is performed.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase284a-final-commit-package-clean-baseline-gate",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase284a-final-commit-package-clean-baseline-gate",
    rootScriptName: "verify:phase284a-final-commit-package-clean-baseline-gate",
    description: "Final commit package gate verifier; no commit is performed.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase285a-product-console-ux-hardening",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase285a-product-console-ux-hardening",
    rootScriptName: "verify:phase285a-product-console-ux-hardening",
    description: "Product console UX hardening verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase286a-product-deep-optimization-roadmap",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase286a-product-deep-optimization-roadmap",
    rootScriptName: "verify:phase286a-product-deep-optimization-roadmap",
    description: "Product deep optimization roadmap verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase287a-modular-architecture-refactor-first-cut",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase287a-modular-architecture-refactor-first-cut",
    rootScriptName: "verify:phase287a-modular-architecture-refactor-first-cut",
    description: "Architecture refactor first-cut verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase288a-architecture-refactor-followup-cleanup",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase288a-architecture-refactor-followup-cleanup",
    rootScriptName: "verify:phase288a-architecture-refactor-followup-cleanup",
    description: "Architecture refactor follow-up verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase289a-deployment-runtime-stability",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase289a-deployment-runtime-stability",
    rootScriptName: "verify:phase289a-deployment-runtime-stability",
    description: "Deployment/runtime stability preflight verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase290a-provider-cost-free-model-governance",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase290a-provider-cost-free-model-governance",
    rootScriptName: "verify:phase290a-provider-cost-free-model-governance",
    description: "Provider cost governance policy verifier.",
    cadence: ["release-preflight"],
    defaultRunnable: true,
  }),
  check({
    id: "phase291a-unified-regression-test-matrix",
    category: "local-preview",
    command: "cmd /c pnpm run verify:phase291a-unified-regression-test-matrix",
    rootScriptName: "verify:phase291a-unified-regression-test-matrix",
    description: "This unified regression matrix verifier.",
    cadence: ["daily", "release-preflight"],
    defaultRunnable: true,
  }),
];

export const externalRiskChecks = [
  check({
    id: "smoke-openai-route",
    category: "external-risk",
    command: "cmd /c pnpm --filter @unified-ai-system/ai-gateway-service smoke:openai-route",
    description: "May call OpenAI-compatible provider and requires explicit approval.",
    requiresEnv: ["OPENAI_API_KEY"],
    providerCallRisk: true,
    manualApprovalRequired: true,
  }),
  check({
    id: "smoke-nvidia-route",
    category: "external-risk",
    command: "cmd /c pnpm --filter @unified-ai-system/ai-gateway-service smoke:nvidia-route",
    description: "May call NVIDIA provider and requires explicit approval.",
    requiresEnv: ["NVIDIA_API_KEY"],
    providerCallRisk: true,
    manualApprovalRequired: true,
  }),
  check({
    id: "smoke-mimo-route",
    category: "external-risk",
    command: "cmd /c pnpm run smoke:mimo-route",
    rootScriptName: "smoke:mimo-route",
    description: "May call MiMo and requires explicit approval.",
    requiresEnv: ["MIMO_API_KEY", "XIAOMI_API_KEY"],
    providerCallRisk: true,
    manualApprovalRequired: true,
  }),
  check({
    id: "smoke-mimo-paid-route",
    category: "external-risk",
    command: "cmd /c pnpm run smoke:mimo-paid-route",
    rootScriptName: "smoke:mimo-paid-route",
    description: "Paid MiMo smoke; never part of default regression.",
    requiresEnv: ["MIMO_API_KEY", "XIAOMI_API_KEY"],
    providerCallRisk: true,
    manualApprovalRequired: true,
  }),
  check({
    id: "discover-mimo-model-id",
    category: "external-risk",
    command: "cmd /c pnpm run discover:mimo-model-id",
    rootScriptName: "discover:mimo-model-id",
    description: "Model discovery can require provider access and explicit approval.",
    requiresEnv: ["MIMO_API_KEY", "XIAOMI_API_KEY"],
    providerCallRisk: true,
    manualApprovalRequired: true,
  }),
  check({
    id: "calibrate-token-estimator",
    category: "external-risk",
    command: "cmd /c pnpm run calibrate:token-estimator",
    rootScriptName: "calibrate:token-estimator",
    description: "Calibration may require provider usage and is not default-safe.",
    providerCallRisk: true,
    manualApprovalRequired: true,
  }),
];

export const manualOnlyChecks = [
  check({
    id: "dev-phase7b",
    category: "manual-only",
    command: "cmd /c pnpm run dev:phase7b",
    rootScriptName: "dev:phase7b",
    description: "Starts local dev runtime and may leave a long-running process.",
    manualApprovalRequired: true,
  }),
  check({
    id: "stop-phase9c",
    category: "manual-only",
    command: "cmd /c pnpm run stop:phase9c",
    rootScriptName: "stop:phase9c",
    description: "Stops managed local runtime and should be user-approved.",
    manualApprovalRequired: true,
  }),
  check({
    id: "restart-phase11a",
    category: "manual-only",
    command: "cmd /c pnpm run restart:phase11a",
    rootScriptName: "restart:phase11a",
    description: "Restarts managed runtime and should be user-approved.",
    manualApprovalRequired: true,
  }),
  check({
    id: "codex-loop-once",
    category: "manual-only",
    command: "cmd /c pnpm run codex:loop:once",
    rootScriptName: "codex:loop:once",
    description: "Real Codex execution is manual-only and forbidden in this phase.",
    manualApprovalRequired: true,
  }),
  check({
    id: "codex-desktop-send-once",
    category: "manual-only",
    command: "cmd /c pnpm run codex:desktop:send:once",
    rootScriptName: "codex:desktop:send:once",
    description: "GUI send action is manual-only and forbidden in this phase.",
    manualApprovalRequired: true,
  }),
];

export const releasePreflightChecks = [
  check({
    id: "phase117a-cicd-release-gate",
    category: "release-preflight",
    command: "cmd /c pnpm run verify:phase117a-cicd-release-gate",
    rootScriptName: "verify:phase117a-cicd-release-gate",
    description: "Release gate verifier for future release preflight; not a release.",
    cadence: ["release-preflight"],
    manualApprovalRequired: true,
  }),
  check({
    id: "phase118a-remote-cicd-gate-preflight",
    category: "release-preflight",
    command: "cmd /c pnpm run verify:phase118a-remote-cicd-gate-preflight",
    rootScriptName: "verify:phase118a-remote-cicd-gate-preflight",
    description: "Remote CI/CD preflight; must not trigger remote workflows by default.",
    cadence: ["release-preflight"],
    manualApprovalRequired: true,
  }),
  check({
    id: "phase131a-release-artifact-preflight",
    category: "release-preflight",
    command: "cmd /c pnpm run verify:phase131a-release-artifact-preflight",
    rootScriptName: "verify:phase131a-release-artifact-preflight",
    description: "Release artifact preflight; no artifact is published.",
    cadence: ["release-preflight"],
    manualApprovalRequired: true,
  }),
  check({
    id: "phase132a-release-decision-pack",
    category: "release-preflight",
    command: "cmd /c pnpm run verify:phase132a-release-decision-pack",
    rootScriptName: "verify:phase132a-release-decision-pack",
    description: "Release decision pack verifier; documentation-only.",
    cadence: ["release-preflight"],
    manualApprovalRequired: true,
  }),
];

export function readRootPackageJson() {
  return JSON.parse(readFileSync(rootPackagePath, "utf8"));
}

export function rootScriptExists(rootPackageJson, scriptName) {
  if (!scriptName) {
    return true;
  }
  return Boolean(rootPackageJson?.scripts?.[scriptName]);
}

export function annotateCheckAvailability(checkItem, rootPackageJson = readRootPackageJson()) {
  const available = rootScriptExists(rootPackageJson, checkItem.rootScriptName);
  return {
    ...checkItem,
    available,
    availability: available ? "available" : "not_available",
  };
}

export function getRegressionMatrix(rootPackageJson = readRootPackageJson()) {
  const annotate = (items) => items.map((item) => annotateCheckAvailability(item, rootPackageJson));
  return {
    safeDefaultChecks: annotate(safeDefaultChecks),
    localPreviewChecks: annotate(localPreviewChecks),
    externalRiskChecks: annotate(externalRiskChecks),
    manualOnlyChecks: annotate(manualOnlyChecks),
    releasePreflightChecks: annotate(releasePreflightChecks),
  };
}

export function getNotAvailableChecks(matrix = getRegressionMatrix()) {
  return [
    ...matrix.safeDefaultChecks,
    ...matrix.localPreviewChecks,
    ...matrix.externalRiskChecks,
    ...matrix.manualOnlyChecks,
    ...matrix.releasePreflightChecks,
  ]
    .filter((item) => item.available === false)
    .map((item) => ({
      id: item.id,
      category: item.category,
      command: item.command,
      rootScriptName: item.rootScriptName,
      status: "not_available",
      reason: "script is not present in root package.json",
    }));
}

export function getDefaultRunnableChecks(matrix = getRegressionMatrix()) {
  return [...matrix.safeDefaultChecks, ...matrix.localPreviewChecks].filter((item) => item.defaultRunnable === true);
}

export function detectProviderCallRisk(checks) {
  return checks.some((item) => item.providerCallRisk === true || item.category === "external-risk");
}

export function projectContextExists() {
  return existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md"));
}
