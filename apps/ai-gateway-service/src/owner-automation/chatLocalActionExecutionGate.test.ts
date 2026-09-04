// @test-isolation process
import { describe, expect, it } from "vitest";
import { evaluateChatLocalActionExecutionGate } from "./chatLocalActionExecutionGate.js";

describe("chat local action execution gate", () => {
  it("does not treat a caller-supplied approval object as execution authority", async () => {
    const proposal = {
      actionId: "create_desktop_spreadsheet",
      input: {
        actionId: "create_desktop_spreadsheet",
        filenamePrefix: "must-not-be-created",
        fileType: "csv",
        headers: ["task"],
        rows: [["no write"]],
      },
    };
    const verdict = await evaluateChatLocalActionExecutionGate({
      proposal,
      env: {
        OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED: "true",
        OWNER_AUTOMATION_CHAT_BATCH_ENABLED: "true",
      },
      approval: {
        approvedActionId: proposal.actionId,
        allowChatMainChainLocalActionExecution: true,
        allowOverwrite: false,
        allowDesktopScan: false,
        allowReadOtherDesktopFiles: false,
        approvedOutputDirectory: "Desktop",
        approvedTestFilenamePrefix: "must-not-be-created",
      },
    });
    expect(verdict).toMatchObject({
      allowed: false,
      blocker: "chat_real_run_requires_governed_tool_proxy",
      providerCallsMade: false,
    });
  });
});
