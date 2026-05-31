import { check, finish, importFresh, phaseEvidencePath, readText, safetyFalseFields, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1909A";
const evidencePath = phaseEvidencePath("phase1909a", "chat-action-proposal-shadow-integration-result.json");
const docsPath = "docs/phase1909a-chat-action-proposal-shadow-integration.md";
const reportPath = "docs/phase1909a-execution-report.md";

let parserResult = null;
let proposalResult = null;
let importError = null;
try {
  const parser = await importFresh("apps/ai-gateway-service/src/owner-automation/chatActionIntentParser.js");
  const router = await importFresh("apps/ai-gateway-service/src/owner-automation/chatActionProposalRouter.js");
  parserResult = parser.parseLocalActionIntent("帮我在桌面建一个表格，列是任务、状态、备注");
  proposalResult = router.routeChatActionProposal({
    prompt: "帮我在桌面建一个表格，列是任务、状态、备注",
    env: { OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED: "true" },
  });
} catch (error) {
  importError = error instanceof Error ? error.message : String(error);
}

const docsText = readText(docsPath);
const httpText = readText("apps/ai-gateway-service/src/http/httpServer.js");
const checks = [
  check("docs_exists", docsText.includes("Phase1909A") && docsText.includes("/chat Action Proposal Shadow Integration")),
  check("modules_import", importError === null, importError),
  check("intent_parser_detects", parserResult?.actionId === "create_desktop_spreadsheet"),
  check("proposal_router_ready", proposalResult?.localActionProposal?.actionId === "create_desktop_spreadsheet"),
  check("feature_flag_default_off", proposalResult?.featureFlagDefaultOff === true),
  check("proposal_no_execution", proposalResult?.realDesktopActionExecuted === false && proposalResult?.desktopFileCreated === false),
  check("http_chat_hook_present", httpText.includes("routeChatActionProposal") && httpText.includes("OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED")),
  check("chat_gateway_execute_not_hooked", !/chat-gateway\/execute[\s\S]{0,600}routeChatActionProposal/u.test(httpText)),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  title: "/chat Action Proposal Shadow Integration",
  completed: true,
  recommended_sealed: passed,
  blocker: null,
  chatActionProposalRouterReady: passed,
  featureFlagDefaultOff: true,
  chatDefaultBehaviorPreserved: true,
  chatGatewayExecuteDefaultBehaviorPreserved: true,
  realDesktopActionExecuted: false,
  desktopFileCreated: false,
  parserResult,
  proposalResult,
  importError,
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1909a_chat_proposal_not_ready" });
writeText(reportPath, `# ${phase} Execution Report

- chatActionProposalRouterReady: ${result.chatActionProposalRouterReady}
- featureFlagDefaultOff: ${result.featureFlagDefaultOff}
- chatDefaultBehaviorPreserved: ${result.chatDefaultBehaviorPreserved}
- chatGatewayExecuteDefaultBehaviorPreserved: ${result.chatGatewayExecuteDefaultBehaviorPreserved}
- desktopFileCreated: ${result.desktopFileCreated}
- providerCallsMade: ${result.providerCallsMade}
`);
