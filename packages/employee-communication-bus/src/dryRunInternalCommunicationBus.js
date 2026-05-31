import {
  createEmployeeMessageEnvelope,
  createEmployeeCollaborationDecision,
  PHASE587_FANOUT_LIMITS,
} from "../../employee-communication-contracts/src/index.js";
import {
  createReviewRequest,
  createReviewResult,
  createHandoffFromUxToEngineer,
  createSecurityBoundaryObjection,
  createCouncilSummary,
  createFinalRecommendation,
  blockAllEmployeeBroadcast,
} from "../../employee-collaboration-protocol/src/index.js";
import { createInternalInbox } from "./internalInbox.js";
import { createInternalOutbox } from "./internalOutbox.js";
import { createThreadStorePreview } from "./threadStore.preview.js";
import { routeInternalMessage } from "./messageRouter.js";
import { routeMention } from "./mentionRouter.js";
import { routeHandoff } from "./handoffRouter.js";
import { createDryRunReply } from "./replyRouter.js";
import { buildInternalCollaborationEvidence } from "./collaborationEvidenceBuilder.js";

export const PHASE587_ALLOWED_ACTIVE_EMPLOYEES = Object.freeze([
  "emp-product-chief",
  "emp-ux-researcher",
  "emp-security-chief",
]);

export const PHASE587_CANDIDATE_EMPLOYEES = Object.freeze([
  "emp-product-chief",
  "emp-security-chief",
  "emp-ux-researcher",
  "emp-ai-gateway-engineer",
  "emp-qa-engineer",
]);

export function createDryRunInternalCommunicationBus() {
  const inbox = createInternalInbox();
  const outbox = createInternalOutbox();
  const threadStore = createThreadStorePreview();

  return {
    inbox,
    outbox,
    threadStore,
    runScenarioProductUxReview() {
      const threadResult = threadStore.createThread();
      const request = createReviewRequest({ threadId: threadResult.thread.threadId });
      const reply = createReviewResult({ threadId: threadResult.thread.threadId });
      outbox.send(request);
      inbox.receive(reply);
      threadStore.appendEvidence(threadResult.thread.threadId, "ux_researcher_reply_created");
      return {
        scenarioId: "product_ux_review",
        threadCreated: threadResult.created,
        askMessageCreated: true,
        replyCreated: true,
        thread: threadStore.get(threadResult.thread.threadId),
        messages: [request, reply],
        evidence: buildInternalCollaborationEvidence({ scenarioId: "product-ux-review", thread: threadResult.thread, messages: [request, reply] }),
        providerCallsMade: false,
        dryRunOnly: true,
      };
    },
    runScenarioSecurityObjection() {
      const objection = createSecurityBoundaryObjection();
      const routed = routeInternalMessage(objection, [...PHASE587_ALLOWED_ACTIVE_EMPLOYEES, "emp-ai-gateway-engineer"]);
      outbox.send(objection);
      return {
        scenarioId: "security_objection",
        objectionMessage: objection,
        routed,
        riskLevel: objection.riskLevel,
        providerCallsMade: false,
        secretValueExposed: false,
        evidence: buildInternalCollaborationEvidence({ scenarioId: "security-objection", messages: [objection] }),
        dryRunOnly: true,
      };
    },
    runScenarioUxHandoff() {
      const { handoff, message } = createHandoffFromUxToEngineer();
      const routed = routeHandoff(handoff);
      outbox.send(message);
      return {
        scenarioId: "ux_handoff",
        handoff,
        handoffCreated: routed.routed,
        accepted: routed.accepted,
        reason: handoff.reason,
        message,
        evidence: buildInternalCollaborationEvidence({ scenarioId: "ux-handoff", messages: [message], handoff }),
        dryRunOnly: true,
      };
    },
    runScenarioBroadcastBlocked() {
      const broadcast = createEmployeeMessageEnvelope({
        messageId: "message.preview.broadcast.blocked",
        threadId: "thread.preview.broadcast-blocked",
        fromEmployeeId: "emp-product-chief",
        toEmployeeIds: ["*"],
        messageType: "review_request",
        intent: "request_all_employees_review",
        title: "Blocked all employee broadcast",
        body: "request all employees review",
      });
      const blocked = blockAllEmployeeBroadcast();
      const routed = routeInternalMessage(broadcast, PHASE587_CANDIDATE_EMPLOYEES);
      return {
        scenarioId: "broadcast_blocked",
        blockedReason: blocked.blockedReason,
        noAllEmployeeBroadcast: routed.blockedReason === "no_all_employee_broadcast",
        activeEmployees: blocked.activeEmployees,
        rejectedEmployees: blocked.rejectedEmployees,
        maxActiveEmployees: PHASE587_FANOUT_LIMITS.maxActiveEmployees,
        maxBrainCalls: 0,
        evidence: buildInternalCollaborationEvidence({ scenarioId: "broadcast-blocked", messages: [broadcast], rejectedEmployees: blocked.rejectedEmployees }),
        dryRunOnly: true,
      };
    },
    runScenarioCouncilSummary() {
      const summary = createCouncilSummary();
      const finalRecommendation = createFinalRecommendation();
      const decision = createEmployeeCollaborationDecision();
      outbox.send(summary);
      outbox.send(finalRecommendation);
      return {
        scenarioId: "council_summary",
        summary,
        finalRecommendation,
        decision,
        evidence: buildInternalCollaborationEvidence({ scenarioId: "council-summary", messages: [summary, finalRecommendation] }),
        providerCallsMade: false,
        secretValueExposed: false,
        dryRunOnly: true,
      };
    },
    previewMention() {
      return routeMention();
    },
    previewReply() {
      return createDryRunReply();
    },
  };
}
