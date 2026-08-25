import { describe, it, expect } from "vitest";
import { buildRepairPlan, countIssuesBySeverity } from "./codebaseAuditRepairPlan.js";
import { createCodebaseAuditPolicy, FULL_CODEBASE_AUDIT_PHASE } from "./codebaseAuditPolicy.js";

describe("codebase-audit-repair-plan", () => {
  it("buildRepairPlan returns applied repairs for empty issues", () => {
    const plan = buildRepairPlan([]);
    expect(plan.repairsProposed.length).toBeGreaterThan(0);
    expect(plan.repairsApplied.length).toBeGreaterThan(0);
    expect(plan.repairsSkipped).toEqual([]);
    expect(plan.blockedRepairs).toEqual([]);
    expect(plan.manualRequired).toEqual([]);
  });

  it("buildRepairPlan flags high-severity issues as manual_required", () => {
    const plan = buildRepairPlan([
      { id: "issue-1", severity: "high" },
      { id: "issue-2", severity: "critical" },
    ]);
    expect(plan.manualRequired).toHaveLength(2);
    expect(plan.manualRequired[0].issueId).toBe("issue-1");
    expect(plan.manualRequired[1].issueId).toBe("issue-2");
  });

  it("buildRepairPlan ignores low-severity issues", () => {
    const plan = buildRepairPlan([
      { id: "low-1", severity: "low" },
      { id: "info-1", severity: "info" },
      { id: "med-1", severity: "medium" },
    ]);
    expect(plan.manualRequired).toHaveLength(0);
  });

  it("countIssuesBySeverity counts by severity level", () => {
    const counts = countIssuesBySeverity([
      { severity: "critical" },
      { severity: "critical" },
      { severity: "high" },
      { severity: "medium" },
      { severity: "low" },
      { severity: "info" },
    ]);
    expect(counts.criticalIssues).toBe(2);
    expect(counts.highIssues).toBe(1);
    expect(counts.mediumIssues).toBe(1);
    expect(counts.lowIssues).toBe(1);
    expect(counts.infoFindings).toBe(1);
  });

  it("countIssuesBySeverity handles empty array", () => {
    const counts = countIssuesBySeverity([]);
    expect(counts.criticalIssues).toBe(0);
    expect(counts.highIssues).toBe(0);
  });
});

describe("codebase-audit-policy", () => {
  it("creates policy with safe defaults", () => {
    const policy = createCodebaseAuditPolicy();
    expect(policy.paidApiAllowed).toBe(false);
    expect(policy.mimoAllowed).toBe(false);
    expect(policy.externalApiAllowed).toBe(false);
    expect(policy.legacyModificationAllowed).toBe(false);
    expect(policy.autoCommitAllowed).toBe(false);
    expect(policy.autoPushAllowed).toBe(false);
    expect(policy.worktreeAllowed).toBe(false);
    expect(policy.codexCliAllowed).toBe(false);
  });

  it("allows minimal repair and secret scan", () => {
    const policy = createCodebaseAuditPolicy();
    expect(policy.minimalRepairAllowed).toBe(true);
    expect(policy.secretScanRequired).toBe(true);
    expect(policy.phaseEvidenceScanRequired).toBe(true);
  });

  it("exports phase constants", () => {
    expect(FULL_CODEBASE_AUDIT_PHASE).toBe("279A-full-codebase-audit");
  });

  it("policy version is stable", () => {
    const policy = createCodebaseAuditPolicy();
    expect(policy.policyVersion).toBe("phase279a-v1");
    expect(policy.mode).toBe("local-codebase-audit-and-minimal-repair");
  });
});
