import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  detectProviderCallRisk,
  getDefaultRunnableChecks,
  getNotAvailableChecks,
  getRegressionMatrix,
} from "./regressionMatrix.js";

function asSkipped(checkItem, reason) {
  return {
    id: checkItem.id,
    category: checkItem.category,
    command: checkItem.command,
    status: "skipped",
    reason,
  };
}

export function runSafeRegressionMatrix() {
  const matrix = getRegressionMatrix();
  const defaultRunnableChecks = getDefaultRunnableChecks(matrix);
  const providerCallRiskDetected = detectProviderCallRisk(defaultRunnableChecks);
  const failedChecks = [];

  if (providerCallRiskDetected) {
    failedChecks.push({
      id: "default-regression-provider-risk",
      category: "safe-default",
      status: "fail",
      reason: "default runnable checks include a provider-call risk",
    });
  }

  const executedChecks = [
    {
      id: "matrix-definition-loaded",
      category: "safe-default",
      command: "internal:load-regression-matrix",
      status: "pass",
      reason: "regression matrix loaded from local source files",
    },
    {
      id: "default-scope-validated",
      category: "safe-default",
      command: "internal:validate-default-scope",
      status: "pass",
      checkedCount: defaultRunnableChecks.length,
      reason: "default scope is limited to safe-default and local-preview checks",
    },
    {
      id: "provider-risk-boundary-validated",
      category: "safe-default",
      command: "internal:validate-no-provider-risk",
      status: providerCallRiskDetected ? "fail" : "pass",
      reason: "external-risk and manual-only checks are excluded from default regression",
    },
  ];

  const skippedChecks = [
    ...matrix.externalRiskChecks.map((item) => asSkipped(item, "external-risk checks require explicit manual approval")),
    ...matrix.manualOnlyChecks.map((item) => asSkipped(item, "manual-only checks are not executed by the safe regression matrix")),
    ...matrix.releasePreflightChecks.map((item) => asSkipped(item, "release-preflight checks are not executed by this phase")),
  ];

  const notAvailableChecks = getNotAvailableChecks(matrix);

  return {
    status: failedChecks.length === 0 ? "pass" : "fail",
    mode: "safe-default-and-local-preview-matrix-only",
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    providerCallRiskDetected,
    safeDefaultChecks: matrix.safeDefaultChecks,
    localPreviewChecks: matrix.localPreviewChecks,
    externalRiskChecks: matrix.externalRiskChecks,
    manualOnlyChecks: matrix.manualOnlyChecks,
    releasePreflightChecks: matrix.releasePreflightChecks,
    notAvailableChecks,
    executedChecks,
    skippedChecks,
    failedChecks,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = runSafeRegressionMatrix();
  if (result.status !== "pass") {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: "passed",
    runner: "verify:safe-regression-matrix",
    mode: result.mode,
    safeDefaultChecks: result.safeDefaultChecks.length,
    localPreviewChecks: result.localPreviewChecks.length,
    skippedChecks: result.skippedChecks.length,
    notAvailableChecks: result.notAvailableChecks.length,
    providerCallRiskDetected: result.providerCallRiskDetected,
  }, null, 2));
}
