import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ACTIONS,
  DECISIONS,
  evaluatePermissionRules,
  permissionResultSchema,
} from "../../packages/gvc-permission-engine/src/index.js";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const rules = [
  { id: "allow-docs", effect: "allow", action: "file_mutation", pathPrefix: "docs/" },
  { id: "approval-tools", effect: "approval_required", action: "file_mutation", pathPrefix: "tools/" },
  { id: "forbid-secret", effect: "forbidden", action: "secret_read" },
  { id: "deny-provider", effect: "deny", action: "provider_call" },
  { id: "forbid-deploy", effect: "forbidden", action: "deploy" },
  { id: "approval-chat-route", effect: "approval_required", action: "chat_route_modify" },
];

const docsResult = evaluatePermissionRules({ action: "file_mutation", resource: "docs/phase2047-pme-permission-rule-dsl.md", rules });
const toolsResult = evaluatePermissionRules({ action: "file_mutation", resource: "tools/phase2047/verify-pme-permission-rule-dsl.mjs", rules });
const secretResult = evaluatePermissionRules({ action: "secret_read", resource: ".env", rules });
const providerResult = evaluatePermissionRules({ action: "provider_call", resource: "nvidia", rules });
const deployResult = evaluatePermissionRules({ action: "deploy", resource: "release", rules });
const chatResult = evaluatePermissionRules({ action: "chat_route_modify", resource: "/chat-gateway/execute", rules });

check("decisions_cover_allow_deny_approval_forbidden", ["allow", "deny", "approval_required", "forbidden"].every((decision) => DECISIONS.includes(decision)));
check("actions_cover_required_surface", ["file_mutation", "shell_command", "provider_call", "secret_read", "deploy", "chat_route_modify"].every((action) => ACTIONS.includes(action)));
check("docs_allowed", docsResult.decision === "allow", docsResult.decision);
check("tools_approval_required", toolsResult.decision === "approval_required", toolsResult.decision);
check("secret_forbidden", secretResult.decision === "forbidden", secretResult.decision);
check("provider_denied", providerResult.decision === "deny", providerResult.decision);
check("deploy_forbidden", deployResult.decision === "forbidden", deployResult.decision);
check("chat_route_approval_required", chatResult.decision === "approval_required", chatResult.decision);
check("permission_result_schema_present", permissionResultSchema.required.includes("decision") && permissionResultSchema.properties.decision.enum.includes("approval_required"));
check("no_provider_call", [docsResult, toolsResult, secretResult, providerResult, deployResult, chatResult].every((result) => result.providerCallsMade === false));
check("no_secret_read", [docsResult, toolsResult, secretResult, providerResult, deployResult, chatResult].every((result) => result.secretRead === false));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2047-PME-Permission-Rule-DSL",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  sampleResults: { docsResult, toolsResult, secretResult, providerResult, deployResult, chatResult },
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
};

writeEvidenceFile("apps/ai-gateway-service/evidence/phase2047-pme-permission-rule-dsl/result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

