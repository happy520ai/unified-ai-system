import { resolve } from "node:path";
import { tmpdir } from "node:os";

export const WORKFORCE_PLAN_STORE_PHASE = "phase-102d-agent-workforce-plan-store";
export const WORKFORCE_PLAN_STORE_MODE = "dev-only-local-plan-store";
export const WORKFORCE_PLAN_LIFECYCLE_PHASE = "phase-140a-workforce-clarification-lifecycle";
export const WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE = "phase-141a-workforce-review-approval-gate";
export const WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE = "phase-143a-role-tier-event-ledger";
export const WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE = "phase-144a-execution-readiness-preflight";
export const WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE = "phase-145a-external-omx-runner-design";
export const WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE = "phase-146a-runner-request-review-queue";
export const WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE = "phase-147a-execution-approval-record";
export const WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE = "phase-148a-external-runner-protocol-freeze";
export const WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE = "phase-149a-agent-workforce-preview-final-ux-seal";
export const WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE = "phase-153a-agent-workforce-product-template-pack";
export const WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE = "phase-167a-export-handoff-package-manifest";
export const WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE = "phase-201a-codex-desktop-handoff-pack";
export const WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE = "phase-202a-manual-codex-execution-loop";
export const WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE = "phase-203a-codex-result-import-review";
export const WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE = "phase-204a-safe-desktop-runner-design";

export const STORE_VERSION = 1;
export const DEFAULT_STORE_PATH = resolve(tmpdir(), "unified-ai-system", "workforce-plans.json");
