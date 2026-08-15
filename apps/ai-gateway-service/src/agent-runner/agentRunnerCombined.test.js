import { describe, it, expect } from "vitest";
import { buildGoNoGoReview, GO_NO_GO_STATUSES } from "./goNoGoReview.js";
import {
  getPermissionModePolicy,
  listPermissionModes,
  PERMISSION_MODES,
  BLOCKED_PATHS,
  BLOCKED_COMMAND_PATTERNS,
  FULL_OPEN_DISABLED,
} from "./permissionModePolicy.js";

describe("go-no-go-review", () => {
  it("exports status constants", () => {
    expect(GO_NO_GO_STATUSES).toEqual(["go", "no-go", "review-required"]);
  });

  it("returns go for clean input", () => {
    const result = buildGoNoGoReview({});
    expect(result.status).toBe("go");
    expect(result.blockers).toEqual([]);
    expect(result.autoCommit).toBe(false);
    expect(result.autoPush).toBe(false);
  });

  it("returns no-go when blockers exist", () => {
    const result = buildGoNoGoReview({ blockers: ["critical failure"] });
    expect(result.status).toBe("no-go");
  });

  it("returns no-go when boundary check fails", () => {
    expect(buildGoNoGoReview({ boundaryCheck: { autoCommit: true } }).status).toBe("no-go");
    expect(buildGoNoGoReview({ boundaryCheck: { autoPush: true } }).status).toBe("no-go");
    expect(buildGoNoGoReview({ boundaryCheck: { releaseOrDeploy: true } }).status).toBe("no-go");
    expect(buildGoNoGoReview({ boundaryCheck: { fullOpenEnabled: true } }).status).toBe("no-go");
  });

  it("returns review-required for warnings", () => {
    const result = buildGoNoGoReview({ warnings: ["minor issue"] });
    expect(result.status).toBe("review-required");
  });

  it("returns review-required for skipped commands", () => {
    const result = buildGoNoGoReview({ commandsSkipped: ["cmd-1"] });
    expect(result.status).toBe("review-required");
  });

  it("returns review-required when approval required", () => {
    const result = buildGoNoGoReview({ approvalRequired: true });
    expect(result.status).toBe("review-required");
    expect(result.approvalRequired).toBe(true);
  });

  it("passes through array fields", () => {
    const result = buildGoNoGoReview({
      blockers: ["b1"],
      warnings: ["w1"],
      commandsRun: ["c1"],
      evidencePaths: ["/path"],
      changedFiles: ["file.js"],
      nextSteps: ["step1"],
    });
    expect(result.blockers).toEqual(["b1"]);
    expect(result.warnings).toEqual(["w1"]);
    expect(result.commandsRun).toEqual(["c1"]);
    expect(result.evidencePaths).toEqual(["/path"]);
    expect(result.changedFiles).toEqual(["file.js"]);
    expect(result.nextSteps).toEqual(["step1"]);
  });
});

describe("permission-mode-policy", () => {
  it("exports blocked paths including legacy and .env", () => {
    expect(BLOCKED_PATHS).toContain("legacy/");
    expect(BLOCKED_PATHS).toContain(".env");
    expect(BLOCKED_PATHS).toContain("PROJECT_CONTEXT.md");
  });

  it("exports blocked command patterns including git commit and push", () => {
    expect(BLOCKED_COMMAND_PATTERNS).toContain("git commit");
    expect(BLOCKED_COMMAND_PATTERNS).toContain("git push");
    expect(BLOCKED_COMMAND_PATTERNS).toContain("deploy");
  });

  it("full_open mode is disabled", () => {
    expect(FULL_OPEN_DISABLED).toBe(true);
  });

  it("getPermissionModePolicy returns manual mode", () => {
    const policy = getPermissionModePolicy("manual");
    expect(policy.id).toBe("manual");
    expect(policy.fullOpenEnabled).toBe(false);
    expect(policy.autoCommit).toBe(false);
    expect(policy.autoPush).toBe(false);
    expect(policy.requireApprovalBeforeWrite).toBe(true);
  });

  it("getPermissionModePolicy returns auto_review mode", () => {
    const policy = getPermissionModePolicy("auto_review");
    expect(policy.id).toBe("auto_review");
    expect(policy.autoRunSafeVerifiers).toBe(true);
    expect(policy.autoCommit).toBe(false);
  });

  it("getPermissionModePolicy returns null for unknown mode", () => {
    expect(getPermissionModePolicy("full_open")).toBe(null);
    expect(getPermissionModePolicy("unknown")).toBe(null);
  });

  it("listPermissionModes returns all enabled modes", () => {
    const modes = listPermissionModes();
    expect(modes).toHaveLength(2);
    expect(modes.map((m) => m.id).sort()).toEqual(["auto_review", "manual"]);
  });

  it("all modes have safe defaults (no auto commit/push/deploy)", () => {
    for (const mode of listPermissionModes()) {
      expect(mode.autoCommit).toBe(false);
      expect(mode.autoPush).toBe(false);
      expect(mode.releaseOrDeployAllowed).toBe(false);
      expect(mode.fullOpenEnabled).toBe(false);
    }
  });
});
