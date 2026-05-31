import { validateGlobalModelRecord } from "./globalModelCatalogSchema.js";
import { classifyModelRisk } from "./modelRiskPolicy.js";

export function runDryRunCatalogImporter(seedPack, options = {}) {
  const models = Array.isArray(seedPack?.models) ? seedPack.models : [];
  const imported = models.map((model) => {
    const risk = classifyModelRisk(model);
    return {
      ...model,
      status: normalizeDryRunStatus(model.status),
      risk: {
        ...model.risk,
        ...risk,
      },
      selectableGate: {
        eligible: false,
        reason: "dry_run_import_not_smoke_verified",
      },
      dryRunImport: {
        imported: true,
        runtimeEnabled: false,
        providerCallsMade: false,
        secretRead: false,
      },
    };
  });
  const validation = imported.map((record) => ({
    modelId: record.modelId,
    ...validateGlobalModelRecord(record),
  }));
  return {
    phase: "Phase776",
    dryRun: true,
    importedModelCount: imported.length,
    validationFailureCount: validation.filter((item) => !item.valid).length,
    newSelectableModelsAdded: 0,
    selectableModelCountUnchanged: true,
    smokePassedModelCountUnchanged: true,
    providerCallsMade: false,
    discoveryApiCalled: false,
    secretRead: false,
    authJsonRead: false,
    rawSecretValueAccepted: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    imported,
    validation,
    options: {
      source: options.source ?? "static_seed",
      maxStatus: "credential_missing",
    },
  };
}

function normalizeDryRunStatus(status) {
  if (status === "cataloged") return "cataloged";
  if (status === "deprecated" || status === "blocked" || status === "high_risk") return status;
  return "credential_missing";
}
