/**
 * Phase2145A Verifier: Chat Truthfulness + Model Gate + Owner Automation Routing Repair
 */

import { TASK_MATRIX, taskForId, isLocalActionTask, isLocalActionClarificationTask, isSafetyRejectTask, isBlockedTask } from "../chat-gateway/chatGatewayTaskMatrix.js";
import { verifyResultCompletion } from "../chat-gateway/resultCompletionVerifier.js";
import { parseLocalActionIntent } from "../owner-automation/chatActionIntentParser.js";

const PHASE = "phase2145a-chat-truthfulness-and-model-gate";

export function verifyPhase2145A() {
  const results = [];
  let allPassed = true;

  // Test 1: Desktop spreadsheet request detected
  const desktopResult = parseLocalActionIntent("帮我在桌面建一个表格");
  results.push(assert("desktop_spreadsheet_detected", desktopResult.matched === true && desktopResult.actionId === "create_desktop_spreadsheet"));
  results.push(assert("desktop_csv_detected", parseLocalActionIntent("帮我创建桌面 CSV").matched === true));
  results.push(assert("desktop_task_table_detected", parseLocalActionIntent("帮我建一个任务表").matched === true));

  // Test 2: Vague desktop request requires clarification
  const vagueResult = parseLocalActionIntent("帮我创建桌面文件");
  results.push(assert("vague_desktop_not_matched", vagueResult.matched === false));

  // Test 3: Task matrix contains local action tasks
  results.push(assert("matrix_has_owner_local_spreadsheet", taskForId("owner_local_spreadsheet_request") !== null));
  results.push(assert("matrix_has_owner_local_file_action", taskForId("owner_local_file_action_request") !== null));
  results.push(assert("matrix_has_local_action_clarification", taskForId("local_action_clarification_required") !== null));

  // Test 4: Local action task not completed by generic chat
  const localActionVerification = verifyResultCompletion({
    intent: { intentType: "owner_local_spreadsheet_request" },
    plan: { taskId: "owner_local_spreadsheet_request", routeDecision: "local_action_preview", blocked: false },
    execution: { success: true, data: { text: "教程文本" }, meta: { providerCalled: false, endpointType: "chat" } },
  });
  results.push(assert("local_action_not_completed", localActionVerification.verifiedCompleted === false));
  results.push(assert("local_action_status_preview", localActionVerification.completionStatus === "preview"));

  // Test 5: Safety reject still works
  const safetyRejectVerification = verifyResultCompletion({
    intent: { intentType: "unsafe_secret_request" },
    plan: { taskId: "unsafe_secret_request", routeDecision: "reject_unsafe_request", blocked: true },
    execution: { success: false, data: { text: "" }, meta: { providerCalled: false, endpointType: "chat" } },
  });
  results.push(assert("safety_reject_completed", safetyRejectVerification.verifiedCompleted === true));

  // Test 6: Normal chat still works
  const normalChatVerification = verifyResultCompletion({
    intent: { intentType: "general_chat" },
    plan: { taskId: "general_chat", routeDecision: "execute_with_verified_chat_model", blocked: false, selected: { modelId: "test-model" } },
    execution: { success: true, data: { outputText: "Hello!" }, meta: { providerCalled: true, modelCalled: "test-model", endpointType: "chat_completions", evidenceId: "test-evidence" } },
  });
  results.push(assert("normal_chat_completed", normalChatVerification.verifiedCompleted === true));

  // Test 7: isLocalActionTask helper works
  results.push(assert("is_local_action_spreadsheet", isLocalActionTask("owner_local_spreadsheet_request") === true));
  results.push(assert("is_local_action_file", isLocalActionTask("owner_local_file_action_request") === true));
  results.push(assert("is_not_local_action_general", isLocalActionTask("general_chat") === false));

  // Test 8: isLocalActionClarificationTask helper works
  results.push(assert("is_clarification_task", isLocalActionClarificationTask("local_action_clarification_required") === true));
  results.push(assert("is_not_clarification_general", isLocalActionClarificationTask("general_chat") === false));

  // Test 9: Task matrix has correct count (original 10 + 3 new = 13)
  results.push(assert("task_matrix_count", TASK_MATRIX.length === 13));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  allPassed = failed === 0;

  return {
    phase: PHASE,
    status: allPassed ? "passed" : "failed",
    passed,
    failed,
    total: results.length,
    results,
    evidence: {
      desktopSpreadsheetDetected: desktopResult.matched,
      vagueRequestNotMatched: !vagueResult.matched,
      localActionNotCompletedByChat: localActionVerification.completionVerified === false,
      safetyRejectStillWorks: safetyRejectVerification.completionVerified === true,
      normalChatStillWorks: normalChatVerification.completionVerified === true,
      taskMatrixCount: TASK_MATRIX.length,
    },
  };
}

function assert(name, condition) {
  return { name, passed: Boolean(condition), timestamp: new Date().toISOString() };
}

// Run if executed directly
const isDirectRun = process.argv[1]?.includes("verifyPhase2145A") || process.argv[1]?.includes("phase2145a");
if (isDirectRun) {
  const result = verifyPhase2145A();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "passed" ? 0 : 1);
}
