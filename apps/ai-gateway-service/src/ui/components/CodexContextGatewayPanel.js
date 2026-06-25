// CodexContextGatewayPanel - main orchestrator
import { readOperatorPanelPreview } from "@unified-ai-system/codex-context-gateway/src/operatorPanelPreview.js";
import { buildUsageWorkflowPreview } from "@unified-ai-system/codex-context-gateway/src/usageWorkflow.js";
import { buildRealUsageTrialReport } from "@unified-ai-system/codex-context-gateway/src/usageTrialReportBuilder.js";
import { buildRepeatedUsageBenchmarkReport } from "@unified-ai-system/codex-context-gateway/src/repeatedUsageBenchmark.js";
import { buildControlledBaseUrlIntegrationDesignReport } from "@unified-ai-system/codex-context-gateway/src/baseUrlIntegrationDesign.js";
import { buildAuthorizationEvidenceDryRunSimulationReport } from "@unified-ai-system/codex-context-gateway/src/authorizationEvidenceBuilder.js";
import { buildPhase599AuthorizationReviewReport } from "@unified-ai-system/codex-context-gateway/src/phase599AuthorizationReviewReport.js";
import { buildPhase600ReadinessReviewReport } from "@unified-ai-system/codex-context-gateway/src/phase600ReadinessReviewReport.js";
import { buildPhase601PreparationReport } from "@unified-ai-system/codex-context-gateway/src/phase601PreparationReport.js";
import { buildPhase602OneShotReport } from "@unified-ai-system/codex-context-gateway/src/phase602OneShotReport.js";
import { buildPhase603PreparationReport } from "@unified-ai-system/codex-context-gateway/src/phase603PreparationReport.js";
import { buildPhase604OneShotReport } from "@unified-ai-system/codex-context-gateway/src/phase604OneShotReport.js";
import { codexContextGatewayCopy } from "../copy/codexContextGatewayCopy.js";
import {
  readPhase607InteractiveTerminalIntakePreview,
  readPhase610CodexExecResultIntakePreview,
  readPhase611ReliabilityDesignPreview,
  readPhase611RepeatedGuardedTestDesignPreview,
  readPhase612RepeatedGuardedReliabilityPreview,
  readPhase613RepeatedReliabilityClosurePreview,
  readPhase614ControlledIntegrationPreviewGate,
  readPhase615RuntimeIntegrationApprovalPacket,
  readPhase616R620RRuntimeCandidateDryRunBundle,
  readPhase621R628RControlledRuntimeCandidatePath,
} from "./CodexContextGatewayPanel-readers-a.js";
import {
  readPhase629RMainChainFinalHumanApprovalPacket,
  readPhase630RMainChainIntegrationDesignPatch,
  readPhase639RP1ApprovalPreview,
  readPhase639RNightlyFallbackOperatorPanel,
  readPhase640RNightlyPermissionedRetryPack,
  readPhase641RNightlyRegistrationResultIntake,
  readPhase640RExternalToolMode,
  readPhase641R645RExternalToolBundle,
  readPhase646R650RExternalToolClosure,
} from "./CodexContextGatewayPanel-readers-b.js";
import { preparePanelData } from "./CodexContextGatewayPanel-data.js";
import { buildDetailPayload } from "./CodexContextGatewayPanel-payload.js";
import { renderTemplateA } from "./CodexContextGatewayPanel-template-a.js";
import { renderTemplateB } from "./CodexContextGatewayPanel-template-b.js";

export function renderCodexContextGatewayPanel() {
  const preview = readOperatorPanelPreview();
  const usage = buildUsageWorkflowPreview();
  const trial = buildRealUsageTrialReport();
  const benchmark = buildRepeatedUsageBenchmarkReport();
  const baseUrlDesign = buildControlledBaseUrlIntegrationDesignReport();
  const authorizationDesign = buildAuthorizationEvidenceDryRunSimulationReport();
  const humanApprovalReview = buildPhase599AuthorizationReviewReport();
  const readinessReview = buildPhase600ReadinessReviewReport();
  const preparationReview = buildPhase601PreparationReport();
  const oneShotReview = buildPhase602OneShotReport();
  const customProviderReview = buildPhase603PreparationReport();
  const customProviderOneShotReview = buildPhase604OneShotReport();
  const interactiveTerminalIntake = readPhase607InteractiveTerminalIntakePreview();
  const codexExecIntake = readPhase610CodexExecResultIntakePreview();
  const repeatedReliabilityDesign = readPhase611ReliabilityDesignPreview();
  const repeatedGuardedTestDesign = readPhase611RepeatedGuardedTestDesignPreview();
  const repeatedGuardedTestResult = readPhase612RepeatedGuardedReliabilityPreview();
  const repeatedReliabilityClosure = readPhase613RepeatedReliabilityClosurePreview();
  const controlledIntegrationPreviewGate = readPhase614ControlledIntegrationPreviewGate();
  const runtimeIntegrationApprovalPacket = readPhase615RuntimeIntegrationApprovalPacket();
  const runtimeCandidateDryRunBundle = readPhase616R620RRuntimeCandidateDryRunBundle();
  const controlledRuntimeCandidatePath = readPhase621R628RControlledRuntimeCandidatePath();
  const mainChainFinalApprovalPacket = readPhase629RMainChainFinalHumanApprovalPacket();
  const mainChainDesignPatch = readPhase630RMainChainIntegrationDesignPatch();
  const phase639RP1ApprovalPreview = readPhase639RP1ApprovalPreview();
  const phase639RNightlyFallbackPanel = readPhase639RNightlyFallbackOperatorPanel();
  const phase640RNightlyPermissionedRetryPack = readPhase640RNightlyPermissionedRetryPack();
  const phase641RNightlyRegistrationResultIntake = readPhase641RNightlyRegistrationResultIntake();
  const phase640RExternalToolMode = readPhase640RExternalToolMode();
  const phase641R645RExternalToolBundle = readPhase641R645RExternalToolBundle();
  const phase646R650RExternalToolClosure = readPhase646R650RExternalToolClosure();

  const d = preparePanelData(
    preview, usage, trial, benchmark, baseUrlDesign, authorizationDesign,
    humanApprovalReview, readinessReview, preparationReview, oneShotReview,
    customProviderReview, customProviderOneShotReview,
    interactiveTerminalIntake, codexExecIntake,
    repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult,
    repeatedReliabilityClosure, controlledIntegrationPreviewGate,
    runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle,
    controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch,
    phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel,
    phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake,
    phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure,
    codexContextGatewayCopy
  );

  const detailPayload = JSON.stringify(buildDetailPayload(
    preview, usage, trial, benchmark, baseUrlDesign, authorizationDesign,
    humanApprovalReview, readinessReview, preparationReview, oneShotReview,
    customProviderReview, customProviderOneShotReview,
    interactiveTerminalIntake, codexExecIntake,
    repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult,
    repeatedReliabilityClosure, controlledIntegrationPreviewGate,
    runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle,
    controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch,
    phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel,
    phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake,
    phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure
  )).replace(/</g, "\\u003c");

  const htmlA = renderTemplateA(d, preview, usage, trial, benchmark, baseUrlDesign,
    authorizationDesign, humanApprovalReview, readinessReview, preparationReview,
    oneShotReview, customProviderReview, customProviderOneShotReview, codexContextGatewayCopy);

  const htmlB = renderTemplateB(d,
    interactiveTerminalIntake, codexExecIntake,
    repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult,
    repeatedReliabilityClosure, controlledIntegrationPreviewGate,
    runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle,
    controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch,
    phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel,
    phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake,
    phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure,
    detailPayload);

  return htmlA + htmlB;
}
