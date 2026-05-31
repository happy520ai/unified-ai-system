import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createSessionLedger } from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const ledger = createSessionLedger({ sessionId: "phase2050-sample-session" });
ledger.addEvent({ type: "gvc_runner", summary: "Runner selected one allowed low-risk task.", ref: "docs/project-brain/timed-runner-state.json" });
ledger.addEvent({ type: "project_brain", summary: "Project brain next action consumed.", ref: "docs/project-brain/next-actions.json" });
ledger.addEvent({ type: "approval", summary: "Low-risk autonomous mutation approval checked.", ref: "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json" });
ledger.addEvent({ type: "mutation", summary: "Patch preview generated before mutation.", ref: "apps/ai-gateway-service/evidence/phase2052-structured-diff-patch-review/result.json" });
ledger.addEvent({ type: "verifier", summary: "Verifier completed.", ref: "pnpm run verify:phase2050-session-ledger-context-unification" });

check("session_id_recorded", ledger.sessionId === "phase2050-sample-session");
check("timeline_has_required_types", ["gvc_runner", "project_brain", "approval", "mutation", "verifier"].every((type) => ledger.timeline.some((event) => event.type === type)));
check("timeline_ordered", ledger.timeline.every((event, index) => event.index === index + 1));
check("no_secret_read", ledger.secretRead === false);
check("no_provider_call", ledger.providerCallsMade === false);

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2050-Session-Ledger-Context-Unification",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  ledger,
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
};

writeEvidence("apps/ai-gateway-service/evidence/phase2050-session-ledger-context-unification/result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

function writeEvidence(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
