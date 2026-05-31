import { mkdir, readFile, writeFile } from "node:fs/promises";

const draftFiles = [
  "docs/approvals/phase361/drafts/human-approval-record.draft.json",
  "docs/approvals/phase361/drafts/deploy-authorization-record.draft.json",
  "docs/approvals/phase361/drafts/god-mode-reviewer-quality-signoff.draft.json",
  "docs/approvals/phase361/drafts/tianshu-reviewer-decision-record.draft.json",
  "docs/approvals/phase361/drafts/credential-vault-backend-approval-record.draft.json",
  "docs/approvals/phase361/drafts/tenant-admin-approval-record.draft.json",
  "docs/approvals/phase361/drafts/billing-warning-copy-approval-record.draft.json",
];

const findings = [];

for (const file of draftFiles) {
  const draft = JSON.parse(await readFile(file, "utf8"));
  validateDraft(file, draft, findings);
}

const result = {
  phase: "Phase363A-pre",
  draftCount: draftFiles.length,
  validDraftCount: findings.length === 0 ? draftFiles.length : draftFiles.length - findings.length,
  invalidDraftCount: findings.length,
  approvedDraftCount: 0,
  secretFindingCount: findings.filter((item) => item.code === "SECRET_VALUE_IN_APPROVAL_DRAFT").length,
  templateCountedAsApproval: false,
  validationPassed: findings.length === 0,
  findings,
  workspaceCleanClaimed: false,
};

await mkdir("apps/ai-gateway-service/evidence/phase363a-pre", { recursive: true });
await writeFile(
  "apps/ai-gateway-service/evidence/phase363a-pre/approval-draft-validation-result.json",
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
await writeFile(
  "docs/phase363a-pre-approval-draft-validation-report.md",
  [
    "# Phase363A-pre Approval Draft Validation Report",
    "",
    `- draftCount: ${result.draftCount}`,
    `- validDraftCount: ${result.validDraftCount}`,
    `- invalidDraftCount: ${result.invalidDraftCount}`,
    `- secretFindingCount: ${result.secretFindingCount}`,
    `- validationPassed: ${result.validationPassed}`,
  ].join("\n"),
  "utf8",
);

if (findings.length) {
  const first = findings[0];
  throw new Error(first.code);
}

console.log(JSON.stringify(result, null, 2));

function validateDraft(file, draft, findings) {
  if (!draft.draftOnly || !draft.notAnApproval || !draft.requiresHumanCompletion || draft.approvalDecision !== "pending" || draft.approvalId !== null || draft.approvalTimestamp !== null) {
    findings.push({ file, code: "DRAFT_MUST_NOT_BE_APPROVED" });
    return;
  }
  if (draft.auditTrace?.forged !== false || draft.auditTrace?.secretValueIncluded !== false) {
    findings.push({ file, code: "DRAFT_MUST_NOT_BE_APPROVED" });
    return;
  }
  if (containsSecretLikeValue(draft)) {
    findings.push({ file, code: "SECRET_VALUE_IN_APPROVAL_DRAFT" });
    return;
  }
  if (containsForbiddenApprovalWords(draft)) {
    findings.push({ file, code: "DRAFT_MUST_NOT_BE_APPROVED" });
    return;
  }
}

function containsSecretLikeValue(value) {
  const values = collectStringValues(value);
  return values.some((text) =>
    [
      /api[_-]?key\s*[:=]/i,
      /\.env\s*[:=]/i,
      /sk-[A-Za-z0-9]{12,}/i,
      /secret\s*[:=]/i,
      /token\s*[:=]/i,
    ].some((pattern) => pattern.test(text)),
  );
}

function containsForbiddenApprovalWords(value) {
  return collectStringValues(value).some((text) => text === "approved" || text === "approved_with_conditions");
}

function collectStringValues(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringValues(item, acc);
  }
  return acc;
}
